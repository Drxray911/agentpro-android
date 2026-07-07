const { registerPlugin } = require('@capacitor/core');

/**
 * JS-side bridge to the native UssdAutomationPlugin (Kotlin, see
 * android/src/main/java/com/agentpro/ussd/UssdAutomationPlugin.kt).
 *
 * Native methods:
 *   getSimSlots()                              -> { slots: SimSlotInfo[] }
 *   isAccessibilityServiceEnabled()            -> { enabled: boolean }
 *   openAccessibilitySettings()                -> void (launches system Settings;
 *                                                  Android does not allow an app to
 *                                                  enable its own accessibility
 *                                                  service programmatically — this
 *                                                  is a deliberate OS restriction,
 *                                                  not a limitation of this plugin)
 *   startSession(options: UssdSessionOptions)  -> { started: boolean }
 *   cancelSession()                            -> void
 *
 * Native -> JS events (addListener):
 *   'ussdScreenUpdate'   { rawText: string, stepIndex: number }
 *   'ussdAwaitingPin'    { }  -- automation has stopped; person must enter
 *                               their MoMo PIN on the real network screen
 *   'ussdSessionSuccess' { rawText: string }
 *   'ussdSessionFailed'  { reason: string, rawText?: string }
 *   'ussdSessionCancelled' { }
 */
const UssdAutomation = registerPlugin('UssdAutomation');

module.exports = { UssdAutomation };
