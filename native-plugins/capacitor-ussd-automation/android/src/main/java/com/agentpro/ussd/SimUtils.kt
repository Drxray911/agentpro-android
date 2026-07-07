package com.agentpro.ussd

import android.content.Context
import android.telephony.SubscriptionManager
import androidx.annotation.RequiresPermission

/**
 * Enumerates active SIM subscriptions and does a best-effort match of
 * each SIM's carrier name against Ghana's three MNOs. Carrier display
 * names vary by device/firmware — these alias lists are deliberately
 * generous (case-insensitive substring match) rather than an exact
 * lookup table, since e.g. AT (AirtelTigo) has gone through more than
 * one rebrand and different devices report it differently.
 *
 * Caveat, stated plainly: this has not been run against real SIMs on
 * real hardware in this environment (no telephony-capable
 * emulator/device available) — the SubscriptionManager API surface
 * used here is standard and well-documented, but the actual strings
 * MTN/Telecel/AT SIMs report as their carrier name should be confirmed
 * on real devices before relying on the network auto-match; worst
 * case, matchedNetwork comes back null and the person picks the
 * network manually in the app instead of it being inferred.
 */
object SimUtils {

    private val NETWORK_ALIASES = mapOf(
        "MTN" to listOf("mtn"),
        "TELECEL" to listOf("telecel", "vodafone"), // Telecel Ghana was formerly Vodafone Ghana
        "AT" to listOf("airteltigo", "airtel", "tigo", " at ", "at money"),
    )

    @RequiresPermission(android.Manifest.permission.READ_PHONE_STATE)
    fun getActiveSimSlots(context: Context): List<SimSlotInfo> {
        val subscriptionManager =
            context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
                ?: return emptyList()

        val activeSubscriptions = try {
            subscriptionManager.activeSubscriptionInfoList
        } catch (securityException: SecurityException) {
            // Permission not granted (or not yet requested) — the JS
            // layer is responsible for requesting READ_PHONE_STATE
            // before calling getSimSlots(); returning an empty list
            // here rather than crashing lets the app show a clear
            // "grant phone permission" prompt instead.
            null
        } ?: return emptyList()

        return activeSubscriptions.map { info ->
            val carrierName = info.carrierName?.toString() ?: info.displayName?.toString() ?: ""
            SimSlotInfo(
                slotIndex = info.simSlotIndex,
                subscriptionId = info.subscriptionId,
                carrierName = carrierName,
                matchedNetwork = matchNetwork(carrierName),
            )
        }
    }

    private fun matchNetwork(carrierName: String): String? {
        val normalized = " ${carrierName.lowercase()} "
        for ((network, aliases) in NETWORK_ALIASES) {
            if (aliases.any { normalized.contains(it) }) return network
        }
        return null
    }
}
