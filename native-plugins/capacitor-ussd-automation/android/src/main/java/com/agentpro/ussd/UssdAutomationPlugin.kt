package com.agentpro.ussd

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.telecom.TelecomManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "UssdAutomation",
    permissions = [
        Permission(
            strings = [Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE],
            alias = "phone",
        ),
    ],
)
class UssdAutomationPlugin : Plugin(), UssdAccessibilityService.SessionCallback {

    @PluginMethod
    fun getSimSlots(call: PluginCall) {
        if (getPermissionState("phone") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("phone", call, "getSimSlotsCallback")
            return
        }
        resolveSimSlots(call)
    }

    @PermissionCallback
    private fun getSimSlotsCallback(call: PluginCall) {
        if (getPermissionState("phone") == com.getcapacitor.PermissionState.GRANTED) {
            resolveSimSlots(call)
        } else {
            call.reject("Phone permission is required to detect SIM slots.")
        }
    }

    private fun resolveSimSlots(call: PluginCall) {
        val slots = SimUtils.getActiveSimSlots(context)
        val result = JSObject()
        val array = JSArray()
        slots.forEach { slot ->
            val obj = JSObject()
            obj.put("slotIndex", slot.slotIndex)
            obj.put("subscriptionId", slot.subscriptionId)
            obj.put("carrierName", slot.carrierName)
            obj.put("matchedNetwork", slot.matchedNetwork)
            array.put(obj)
        }
        result.put("slots", array)
        call.resolve(result)
    }

    @PluginMethod
    fun isAccessibilityServiceEnabled(call: PluginCall) {
        val result = JSObject()
        result.put("enabled", UssdAccessibilityService.isServiceRunning())
        call.resolve(result)
    }

    /**
     * Android deliberately does not allow an app to enable its own
     * accessibility service programmatically — the person must do it
     * themselves in Settings. This just gets them to the right screen;
     * the app should explain, before calling this, why it's asking.
     */
    @PluginMethod
    fun openAccessibilitySettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun startSession(call: PluginCall) {
        if (getPermissionState("phone") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Phone permission is required to start a USSD session.")
            return
        }
        if (!UssdAccessibilityService.isServiceRunning()) {
            call.reject("The USSD accessibility service isn't enabled. Call openAccessibilitySettings() first and ask the person to enable it.")
            return
        }

        val subscriptionId = call.getInt("subscriptionId")
        val ussdCode = call.getString("ussdCode")
        if (subscriptionId == null || ussdCode.isNullOrBlank()) {
            call.reject("subscriptionId and ussdCode are required.")
            return
        }

        val stepsArray = call.getArray("steps") ?: JSArray()
        val steps = (0 until stepsArray.length()).map { i ->
            val stepObj = stepsArray.getJSONObject(i)
            UssdStep(
                inputType = stepObj.getString("inputType"),
                value = stepObj.optString("value", null),
                placeholder = stepObj.optString("placeholder", null),
            )
        }

        val valuesObj = call.getObject("values") ?: JSObject()
        val values = mutableMapOf<String, String>()
valuesObj.keys().asSequence().forEach { key ->
    val value = valuesObj.getString(key)
    if (value != null) {
        values[key] = value
    }
}

        val request = UssdSessionRequest(
            subscriptionId = subscriptionId,
            ussdCode = ussdCode,
            steps = steps,
            successPatterns = jsArrayToStringList(call.getArray("successPatterns")),
            failurePatterns = jsArrayToStringList(call.getArray("failurePatterns")),
            pinPromptPatterns = jsArrayToStringList(call.getArray("pinPromptPatterns")),
            stepTimeoutMs = (call.getInt("stepTimeoutMs") ?: 20000).toLong(),
            maxRetries = call.getInt("maxRetries") ?: 2,
            values = values,
        )

        val service = UssdAccessibilityService.instance
        if (service == null) {
            call.reject("The USSD accessibility service is not currently active.")
            return
        }

        service.startSession(request, this)

        if (!dialUssd(subscriptionId, ussdCode)) {
            service.cancelSession()
            call.reject("Could not start the call to dial the USSD code.")
            return
        }

        val result = JSObject()
        result.put("started", true)
        call.resolve(result)
    }

    @PluginMethod
    fun cancelSession(call: PluginCall) {
        UssdAccessibilityService.instance?.cancelSession()
        call.resolve()
    }

    /**
     * Dials the USSD code via the standard system dialer intent,
     * targeting a specific SIM's PhoneAccountHandle so the call goes
     * out on the correct network without the OS showing its own "which
     * SIM?" picker — this is what makes SIM routing "automatic" from
     * the person's point of view (spec: "no Android SIM picker
     * appears"). ACTION_CALL (not ACTION_DIAL) is required for the
     * system to treat this as a USSD/MMI code and show its response
     * dialog rather than just pre-filling the dialer.
     */
    private fun dialUssd(subscriptionId: Int, ussdCode: String): Boolean {
        val telecomManager = context.getSystemService(android.content.Context.TELECOM_SERVICE) as? TelecomManager
            ?: return false

        // Resolve the PhoneAccountHandle for this specific subscription
        // so the call goes out on the correct SIM without the OS
        // showing its own SIM picker. This mapping (subscriptionId ->
        // PhoneAccountHandle) is the part of the dual-SIM story that's
        // been least consistent across OEMs/Android versions in
        // community reports — validate on real dual-SIM hardware
        // before shipping. If resolution fails, falling back to no
        // handle at all (rather than guessing) means the OS will use
        // its own default-SIM behavior, which may still prompt the
        // person to choose — better than silently dialing the wrong
        // SIM.
        val resolvedHandle = resolvePhoneAccountHandle(telecomManager, subscriptionId)

        val intent = Intent(Intent.ACTION_CALL, Uri.fromParts("tel", ussdCode, null))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        resolvedHandle?.let { intent.putExtra(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, it) }

        return try {
            context.startActivity(intent)
            true
        } catch (securityException: SecurityException) {
            false
        }
    }

    private fun resolvePhoneAccountHandle(
        telecomManager: TelecomManager,
        subscriptionId: Int,
    ): android.telecom.PhoneAccountHandle? {
        return try {
            telecomManager.callCapablePhoneAccounts.firstOrNull { handle ->
                val account = telecomManager.getPhoneAccount(handle) ?: return@firstOrNull false
                // PhoneAccount ids on most Android telephony stacks
                // encode the subscription id as the account id string;
                // this is the commonly-used (if not perfectly
                // documented) approach community USSD-automation
                // reference implementations rely on.
                account.accountHandle.id.contains(subscriptionId.toString())
            }
        } catch (securityException: SecurityException) {
            null
        }
    }

    private fun jsArrayToStringList(array: JSArray?): List<String> {
        if (array == null) return emptyList()
        return (0 until array.length()).mapNotNull { i -> array.getString(i) }
    }

    // ---- UssdAccessibilityService.SessionCallback ----

    override fun onScreenUpdate(rawText: String, stepIndex: Int) {
        val data = JSObject()
        data.put("rawText", rawText)
        data.put("stepIndex", stepIndex)
        notifyListeners("ussdScreenUpdate", data)
    }

    override fun onAwaitingPin() {
        notifyListeners("ussdAwaitingPin", JSObject())
    }

    override fun onSuccess(rawText: String) {
        val data = JSObject()
        data.put("rawText", rawText)
        notifyListeners("ussdSessionSuccess", data)
    }

    override fun onFailure(reason: String, rawText: String?) {
        val data = JSObject()
        data.put("reason", reason)
        rawText?.let { data.put("rawText", it) }
        notifyListeners("ussdSessionFailed", data)
    }

    override fun onCancelled() {
        notifyListeners("ussdSessionCancelled", JSObject())
    }
}
