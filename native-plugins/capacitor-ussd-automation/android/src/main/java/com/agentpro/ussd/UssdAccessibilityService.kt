package com.agentpro.ussd

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * IMPORTANT — read before touching this file or relying on it in
 * production:
 *
 * This is the one piece of the whole USSD automation feature that
 * cannot be exercised in an automated/CI environment — Accessibility
 * Service behavior against a real carrier's USSD dialog can only be
 * verified on a real device with a real, active SIM. The structure
 * below (event handling, node-tree search, step execution, PIN
 * hand-off, timeout/retry) is written correctly against the documented
 * Android Accessibility API and is internally consistent, but the
 * exact node tree Android's USSD response dialog exposes varies by
 * OEM (stock AOSP vs. Samsung vs. Xiaomi/MIUI phone apps all differ)
 * and needs real-device validation and likely per-OEM tuning before
 * shipping this to production, especially the heuristics in
 * findLikelyMessageNode/findEditTextNode/findAffirmativeButton below.
 *
 * ==========================================================================
 * THE ONE RULE THIS FILE MUST NEVER BREAK: once a PIN prompt is
 * detected (matchesAnyPattern against pinPromptPatterns), this service
 * MUST NOT read text out of, or write text into, the EditText node
 * again for the remainder of that session. It only watches for the
 * eventual success/failure message. This is what "never request,
 * store, display, log, cache, or transmit a MoMo PIN" means at the
 * code level — the PIN never enters this process's memory at all,
 * because the service simply stops interacting with the node the
 * instant it recognizes the PIN prompt.
 * ==========================================================================
 */
class UssdAccessibilityService : AccessibilityService() {

    interface SessionCallback {
        fun onScreenUpdate(rawText: String, stepIndex: Int)
        fun onAwaitingPin()
        fun onSuccess(rawText: String)
        fun onFailure(reason: String, rawText: String?)
        fun onCancelled()
    }

    companion object {
        // In-process shared state — the plugin and this service run in
        // the same app process, so a companion object is the simplest
        // reliable way for them to talk to each other without needing
        // any cross-process IPC (Binder, LocalBroadcastManager, etc.),
        // which would be unwarranted complexity for two classes that
        // are always co-located in one process by Android's default
        // (no android:process override is set anywhere in this plugin).
        @Volatile var instance: UssdAccessibilityService? = null

        fun isServiceRunning(): Boolean = instance != null
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var activeSession: ActiveSession? = null
    private var sessionCallback: SessionCallback? = null

    private class ActiveSession(
        val request: UssdSessionRequest,
        var stepIndex: Int = 0,
        var retriesAtCurrentStep: Int = 0,
        var awaitingPin: Boolean = false,
        var timeoutRunnable: Runnable? = null,
    )

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    override fun onInterrupt() {
        // The OS is telling us to stop; treat like a cancellation
        // rather than silently going quiet.
        finishSession { it.onCancelled() }
    }

    /** Called by UssdAutomationPlugin once the USSD call has been dialed. */
    fun startSession(request: UssdSessionRequest, callback: SessionCallback) {
        cancelActiveSessionInternal(notifyCancelled = false)
        activeSession = ActiveSession(request)
        sessionCallback = callback
        scheduleStepTimeout()
    }

    fun cancelSession() {
        cancelActiveSessionInternal(notifyCancelled = true)
    }

    private fun cancelActiveSessionInternal(notifyCancelled: Boolean) {
        activeSession?.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        val hadSession = activeSession != null
        activeSession = null
        if (hadSession && notifyCancelled) {
            sessionCallback?.onCancelled()
        }
        sessionCallback = null
    }

    private fun finishSession(action: (SessionCallback) -> Unit) {
        val callback = sessionCallback
        activeSession?.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        activeSession = null
        sessionCallback = null
        callback?.let(action)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val session = activeSession ?: return // Not running an app-initiated session — don't touch anything the person opened themselves.
        if (event == null) return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
        ) return

        val root = rootInActiveWindow ?: return
        val messageNode = findLikelyMessageNode(root) ?: run {
            root.recycle()
            return
        }
        val rawText = messageNode.text?.toString()?.trim().orEmpty()
        if (rawText.isEmpty()) {
            root.recycle()
            return
        }

        handleScreenText(session, root, rawText)
        root.recycle()
    }

    private fun handleScreenText(session: ActiveSession, root: AccessibilityNodeInfo, rawText: String) {
        sessionCallback?.onScreenUpdate(rawText, session.stepIndex)

        // PIN prompt check comes first, before anything else, and once
        // true, this session is permanently in read-only mode for its
        // remaining lifetime — see the file-level comment.
        if (!session.awaitingPin && matchesAnyPattern(rawText, session.request.pinPromptPatterns)) {
            session.awaitingPin = true
            session.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
            sessionCallback?.onAwaitingPin()
            return
        }

        if (matchesAnyPattern(rawText, session.request.successPatterns)) {
            finishSession { it.onSuccess(rawText) }
            return
        }
        if (matchesAnyPattern(rawText, session.request.failurePatterns)) {
            finishSession { it.onFailure("network_message", rawText) }
            return
        }

        // Already past the PIN prompt and waiting for a final
        // success/failure message — do not touch the node tree at all
        // (no reads beyond the message text already extracted above,
        // no writes) while in this state.
        if (session.awaitingPin) return

        executeCurrentStep(session, root)
    }

    private fun executeCurrentStep(session: ActiveSession, root: AccessibilityNodeInfo) {
        val steps = session.request.steps
        if (session.stepIndex >= steps.size) return // Nothing left to send; waiting on a terminal message.
        val step = steps[session.stepIndex]

        if (step.inputType == "pin_wait") {
            // Reaching a pin_wait step without the network's own prompt
            // text having matched yet — still treat it as "stop and
            // wait", since the template author explicitly marked this
            // point as where the PIN happens.
            session.awaitingPin = true
            session.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
            sessionCallback?.onAwaitingPin()
            return
        }

        val valueToSend = when (step.inputType) {
            "menu_option", "literal" -> step.value
            "amount", "phone" -> step.placeholder?.let { session.request.values[it] }
            else -> null
        }
        if (valueToSend == null) {
            finishSession { it.onFailure("missing_step_value", null) }
            return
        }

        val editText = findEditTextNode(root)
        val sendButton = findAffirmativeButton(root)
        if (editText == null || sendButton == null) {
            // Screen doesn't look ready yet (still rendering, or this
            // isn't actually the dialog we think it is) — let the
            // timeout watchdog handle it rather than failing
            // immediately on one missed frame.
            return
        }

        val arguments = Bundle()
        arguments.putCharSequence(
            AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
            valueToSend,
        )
        editText.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
        sendButton.performAction(AccessibilityNodeInfo.ACTION_CLICK)

        session.stepIndex += 1
        session.retriesAtCurrentStep = 0
        scheduleStepTimeout()
    }

    private fun scheduleStepTimeout() {
        val session = activeSession ?: return
        session.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        val runnable = Runnable { onStepTimeout() }
        session.timeoutRunnable = runnable
        mainHandler.postDelayed(runnable, session.request.stepTimeoutMs)
    }

    private fun onStepTimeout() {
        val session = activeSession ?: return
        if (session.awaitingPin) return // Waiting on the person, not the network — no timeout applies once they're mid-PIN-entry.

        if (session.retriesAtCurrentStep >= session.request.maxRetries) {
            finishSession { it.onFailure("timeout", null) }
            return
        }

        session.retriesAtCurrentStep += 1

        // One last look at whatever's on screen right now before giving
        // up on this attempt. If there's real text, handle it exactly
        // like a normal accessibility event — handleScreenText's own
        // branches (success/failure/executeCurrentStep) already
        // schedule whatever timeout comes next, so this method must
        // NOT also schedule one afterward in that case, or the session
        // would end up with two competing timeout callbacks in flight.
        val root = rootInActiveWindow
        val rawText = if (root != null) {
            val messageNode = findLikelyMessageNode(root)
            val text = messageNode?.text?.toString()?.trim()
            root.recycle()
            text
        } else {
            null
        }

        if (!rawText.isNullOrEmpty()) {
            val freshRoot = rootInActiveWindow
            if (freshRoot != null) {
                handleScreenText(session, freshRoot, rawText)
                freshRoot.recycle()
                return
            }
        }

        // Nothing useful found — this retry attempt itself needs its
        // own timeout window.
        scheduleStepTimeout()
    }

    // -------------------------------------------------------------
    // Node-tree heuristics. These are the parts most likely to need
    // per-OEM tuning on real devices — see the file-level caveat.
    // -------------------------------------------------------------

    /**
     * The USSD dialog's message body is (across every OEM dialer this
     * was designed against in documentation/reference implementations)
     * the largest block of static, non-interactive text in the dialog
     * — i.e. a TextView that isn't the title and isn't inside a
     * button. Walk the tree and pick the TextView with the longest
     * text content as a simple, OEM-agnostic heuristic.
     */
    private fun findLikelyMessageNode(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var best: AccessibilityNodeInfo? = null
        var bestLength = 0
        fun visit(node: AccessibilityNodeInfo) {
            if (node.className == "android.widget.TextView" && !node.isClickable) {
                val length = node.text?.length ?: 0
                if (length > bestLength) {
                    bestLength = length
                    best = node
                }
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { visit(it) }
            }
        }
        visit(root)
        return best
    }

    private fun findEditTextNode(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var found: AccessibilityNodeInfo? = null
        fun visit(node: AccessibilityNodeInfo) {
            if (found != null) return
            if (node.className == "android.widget.EditText") {
                found = node
                return
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { visit(it) }
            }
        }
        visit(root)
        return found
    }

    /**
     * Prefers a button labeled SEND/OK/SUBMIT (case-insensitive); falls
     * back to "the clickable button that isn't labeled CANCEL", since
     * a USSD dialog's affirmative action is basically always one of
     * those two shapes.
     */
    private fun findAffirmativeButton(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        val affirmativeLabels = setOf("send", "ok", "submit", "yes")
        var fallback: AccessibilityNodeInfo? = null
        fun visit(node: AccessibilityNodeInfo) {
            val isButtonLike = node.className == "android.widget.Button" ||
                node.className == "android.widget.TextView" && node.isClickable
            if (isButtonLike) {
                val label = node.text?.toString()?.trim()?.lowercase().orEmpty()
                if (label in affirmativeLabels) {
                    return
                }
                if (label != "cancel" && label.isNotEmpty() && fallback == null) {
                    fallback = node
                }
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { visit(it) }
            }
        }
        var exact: AccessibilityNodeInfo? = null
        fun visitForExact(node: AccessibilityNodeInfo) {
            if (exact != null) return
            val isButtonLike = node.className == "android.widget.Button" ||
                (node.className == "android.widget.TextView" && node.isClickable)
            if (isButtonLike) {
                val label = node.text?.toString()?.trim()?.lowercase().orEmpty()
                if (label in affirmativeLabels) {
                    exact = node
                    return
                }
            }
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { visitForExact(it) }
            }
        }
        visitForExact(root)
        if (exact != null) return exact
        visit(root)
        return fallback
    }

    private fun matchesAnyPattern(text: String, patterns: List<String>): Boolean {
        val normalized = text.lowercase()
        return patterns.any { normalized.contains(it.lowercase()) }
    }
}
