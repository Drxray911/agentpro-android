package com.agentpro.ussd

/**
 * Mirrors the shape of a row from the backend's ussd_templates table
 * (see agentpro-api/sql/11_ussd_templates.sql) — the JS side fetches
 * the active template via GET /ussd-templates and passes one of these,
 * resolved into a session request, down to the native layer.
 */
data class UssdStep(
    val inputType: String, // "menu_option" | "amount" | "phone" | "literal" | "pin_wait"
    val value: String? = null,
    val placeholder: String? = null,
)

/**
 * A single dial-and-navigate attempt, fully resolved and ready for the
 * accessibility engine to execute — amount/phone placeholders have
 * already been substituted with real values by the JS layer before
 * this crosses the bridge, so the native code never needs to know
 * anything about "what a transaction is," only "what to type next."
 */
data class UssdSessionRequest(
    val subscriptionId: Int,
    val ussdCode: String,
    val steps: List<UssdStep>,
    val successPatterns: List<String>,
    val failurePatterns: List<String>,
    val pinPromptPatterns: List<String>,
    val stepTimeoutMs: Long,
    val maxRetries: Int,
    // inputType "amount"/"phone" steps carry a placeholder key (e.g.
    // "amount", "customerPhone"); this map resolves those to the
    // actual value to type in for THIS specific transaction.
    val values: Map<String, String>,
)

data class SimSlotInfo(
    val slotIndex: Int,
    val subscriptionId: Int,
    val carrierName: String,
    val matchedNetwork: String?, // "MTN" | "TELECEL" | "AT" | null if unrecognized
)
