import React, { useState, useMemo, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { UssdAutomation } from "capacitor-ussd-automation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  Smartphone,
  Wifi,
  Receipt,
  ArrowLeftRight,
  Eye,
  History,
  Plus,
  X,
  ChevronRight,
  TrendingUp,
  Users,
  AlertTriangle,
  Printer,
  MessageCircle,
  Check,
  Search,
  Filter,
  Download,
  Star,
  Phone,
  Settings2,
  Save,
  RotateCcw,
  Sparkles,
  LogOut,
  Lock,
  Bluetooth,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Clock,
  CreditCard,
  Store,
} from "lucide-react";

/* ---------------------------------------------------------
   API CLIENT
   ---------------------------------------------------------
   IMPORTANT — READ BEFORE RUNNING:
   This artifact runs inside your browser, completely separate from
   wherever the NestJS backend (agentpro-api) actually runs. There is
   no network path from this preview to a backend on someone else's
   machine or in a sandboxed dev environment. For this to actually
   work, change API_BASE_URL below to a URL your browser can reach —
   e.g. http://localhost:3000 if you run the backend on your own
   machine and open this artifact from that same machine, or a real
   deployed URL (Render, Railway, etc.) once the backend is hosted
   somewhere reachable from the internet.

   Every request/response shape below was verified against the real
   running backend before being written here — captured actual
   responses, not assumed ones. See BACKEND_IMPLEMENTATION_NOTES.md.
--------------------------------------------------------- */

const API_BASE_URL = "https://agentpro-api-zsu1.onrender.com";

class ApiError extends Error {
  constructor(status, body) {
    super((body && body.message) || `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

function generateClientId() {
  return crypto.randomUUID();
}

function createApiClient(getToken, onUnauthorized) {
  async function request(method, path, body) {
    let response;
    try {
      response = await fetch(API_BASE_URL + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      // fetch() itself throws on network failure (offline, DNS,
      // connection refused, CORS preflight failure) — this is the
      // real signal the offline-mode banner reacts to, distinct from
      // a server that responded but with an error status.
      const offlineError = new Error("network_unreachable");
      offlineError.isNetworkError = true;
      throw offlineError;
    }

    let json = null;
    try {
      json = await response.json();
    } catch {
      // Some responses (e.g. 204 No Content) have no body — fine.
    }

    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }

    if (!response.ok) {
      throw new ApiError(response.status, json);
    }

    return json;
  }

  return {
    // Business Owner auth: email + password. Registration no longer
    // returns a token — the account sits in pending_approval until a
    // Superuser confirms payment, so callers must handle the
    // { status: "pending_approval" } shape rather than assuming a
    // token comes back.
    login: (email, password, deviceId) => request("POST", "/auth/login", { email, password, deviceId }),
    register: (businessName, fullName, email, password, phone, businessRegNumber, deviceId) =>
      request("POST", "/auth/register", {
        businessName,
        fullName,
        email,
        password,
        phone,
        businessRegNumber: businessRegNumber || undefined,
        deviceId,
      }),
    requestPasswordReset: (email) => request("POST", "/auth/password-reset/request", { email }),
    resetPassword: (token, newPassword) =>
      request("POST", "/auth/password-reset/confirm", { token, newPassword }),
    // Agent/Manager auth: phone + 4-digit app PIN, set up by the
    // Business Owner inside the app — unaffected by the registration
    // rework above.
    pinLogin: (phone, pin, deviceId) => request("POST", "/auth/pin-login", { phone, pin, deviceId }),
    getDashboardSummary: () => request("GET", "/dashboard/summary"),
    listTransactions: (params = {}) => {
      const query = new URLSearchParams();
      if (params.network) query.set("network", params.network);
      if (params.type) query.set("type", params.type);
      if (params.query) query.set("query", params.query);
      if (params.page) query.set("page", String(params.page));
      const qs = query.toString();
      return request("GET", `/transactions${qs ? "?" + qs : ""}`);
    },
    createTransaction: (payload) => request("POST", "/transactions", payload),
    getFloatBalances: () => request("GET", "/float/balances"),
    listFloatMovements: (network) => request("GET", `/float/movements${network ? "?network=" + network : ""}`),
    createFloatMovement: (payload) => request("POST", "/float/movements", payload),
    listCustomers: (query) => request("GET", `/customers${query ? "?query=" + encodeURIComponent(query) : ""}`),
    setCustomerFavorite: (id, isFavorite) => request("PUT", `/customers/${id}/favorite`, { isFavorite }),
    getCommissionRates: () => request("GET", "/commission-rates"),
    getUssdTemplates: () => request("GET", "/ussd-templates"),
    // PUT /commission-rates is Superuser-only as of the commission
    // engine rework (see commissions.controller.ts) and now expects
    // { organizationId, branchId?, items } rather than a bare array —
    // kept here for a future Superuser admin surface, but the mobile
    // app's CommissionsScreen no longer calls this directly; Business
    // Owners go through the request/approval flow below instead.
    updateCommissionRates: (payload) => request("PUT", "/commission-rates", payload),
    requestCommissionRate: (payload) => request("POST", "/commission-rates/requests", payload),
    listMyCommissionRateRequests: () => request("GET", "/commission-rates/requests/mine"),
    listPendingCommissionRateRequests: () => request("GET", "/commission-rates/requests/pending"),
    approveCommissionRateRequest: (id) => request("POST", `/commission-rates/requests/${id}/approve`),
    rejectCommissionRateRequest: (id, reason) =>
      request("POST", `/commission-rates/requests/${id}/reject`, { reason }),
    getSubscriptionStatus: () => request("GET", "/subscriptions/status"),
    getSubscriptionPlatformSettings: () => request("GET", "/subscriptions/platform-settings"),
    submitRenewalPayment: (paymentReference) =>
      request("POST", "/subscriptions/renewal-payments", { paymentReference }),
    listMyRenewalPayments: () => request("GET", "/subscriptions/renewal-payments/mine"),
    listPendingRenewalPayments: () => request("GET", "/subscriptions/renewal-payments/pending"),
    verifyRenewalPayment: (id) => request("POST", `/subscriptions/renewal-payments/${id}/verify`),
    rejectRenewalPayment: (id, reason) =>
      request("POST", `/subscriptions/renewal-payments/${id}/reject`, { reason }),
    // Business Hub (the app's marketplace)
    createBusinessHubListing: (payload) => request("POST", "/business-hub/listings", payload),
    browseBusinessHubListings: (category, location) => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (location) params.set("location", location);
      const qs = params.toString();
      return request("GET", `/business-hub/listings${qs ? "?" + qs : ""}`);
    },
    listMyBusinessHubListings: () => request("GET", "/business-hub/listings/mine"),
    listPendingBusinessHubListings: () => request("GET", "/business-hub/listings/pending-review"),
    approveBusinessHubListingContent: (id) => request("POST", `/business-hub/listings/${id}/approve-content`),
    rejectBusinessHubListingContent: (id, reason) =>
      request("POST", `/business-hub/listings/${id}/reject-content`, { reason }),
    submitBusinessHubListingPayment: (id, paymentReference) =>
      request("POST", `/business-hub/listings/${id}/payments`, { paymentReference }),
    listPendingBusinessHubPayments: () => request("GET", "/business-hub/listing-payments/pending"),
    verifyBusinessHubListingPayment: (id) => request("POST", `/business-hub/listing-payments/${id}/verify`),
    rejectBusinessHubListingPayment: (id, reason) =>
      request("POST", `/business-hub/listing-payments/${id}/reject`, { reason }),
    listSupportTickets: (status) => request("GET", `/support/tickets${status ? "?status=" + status : ""}`),
    createSupportTicket: (payload) => request("POST", "/support/tickets", payload),
    // Superuser-only: reviewing and activating Business Owner
    // registrations. See admin.controller.ts — every one of these is
    // gated by @Roles('super_admin') on the backend, so a non-Superuser
    // hitting these would get a 403 regardless of what the UI shows.
    listPendingOrganizations: () => request("GET", "/admin/organizations/pending"),
    approveOrganization: (organizationId, paymentReference) =>
      request("POST", `/admin/organizations/${organizationId}/approve`, { paymentReference }),
    rejectOrganization: (organizationId, reason) =>
      request("POST", `/admin/organizations/${organizationId}/reject`, { reason }),
    addTicketMessage: (ticketId, message) => request("POST", `/support/tickets/${ticketId}/messages`, { message }),
    syncBatch: (transactions, floatMovements) => request("POST", "/sync/batch", { transactions, floatMovements }),
  };
}

/* ---------------------------------------------------------
   AgentPro Ghana — Mobile Money Agent Management Prototype

   IMPORTANT: This build avoids Tailwind arbitrary-value
   bracket classes (e.g. bg-[#0B5D34], text-[12px]) entirely.
   On some devices the JIT compiler for bracket syntax doesn't
   run, which silently collapses the whole layout to invisible.
   Every custom color, font size, and exact spacing value below
   uses a plain inline style object instead. Only bare Tailwind
   utility classes (flex, grid, gap-2, rounded-xl, p-4, etc.)
   are used for structure, since those ship as pre-built classes
   and don't need bracket parsing.
--------------------------------------------------------- */

const COLORS = {
  green: "#0B5D34",
  greenSoft: "rgba(11,93,52,0.08)",
  greenSoft2: "rgba(11,93,52,0.1)",
  gold: "#C9952B",
  goldSoft: "rgba(201,149,43,0.15)",
  cream: "#FAF8F3",
  ink: "#1C1F1B",
  ink40: "rgba(28,31,27,0.4)",
  ink50: "rgba(28,31,27,0.5)",
  ink55: "rgba(28,31,27,0.55)",
  ink60: "rgba(28,31,27,0.6)",
  ink65: "rgba(28,31,27,0.65)",
  ink70: "rgba(28,31,27,0.7)",
  ink08: "rgba(28,31,27,0.08)",
  ink06: "rgba(28,31,27,0.06)",
  ink12: "rgba(28,31,27,0.12)",
  red: "#C0392B",
  redSoft: "rgba(192,57,43,0.08)",
  white: "#FFFFFF",
  white70: "rgba(255,255,255,0.7)",
  white65: "rgba(255,255,255,0.65)",
  white45: "rgba(255,255,255,0.45)",
  white15: "rgba(255,255,255,0.15)",
  white10: "rgba(255,255,255,0.1)",
};

const NETWORKS = {
  MTN: { label: "MTN MoMo", dot: "#FFCC08" },
  TELECEL: { label: "Telecel Cash", dot: "#E4002B" },
  AT: { label: "AT Money", dot: "#0072CE" },
};

// Keys here MUST match the real backend's role strings exactly — see
// the user_role enum in 01_schema.sql (super_admin, business_owner,
// branch_manager, agent, cashier, auditor). The original mock-data
// prototype used shortened keys (owner, manager, agent, cashier) that
// happened to match for two of the four roles by coincidence — this
// caused a real crash on first integration test, logging in as the
// Business Owner: ROLES[currentUser.role] was undefined because the
// real API returns "business_owner", not "owner".
const ROLES = {
  super_admin: { label: "Super Admin", permissions: ["dashboard", "history", "customers", "commissions", "float", "support", "assistant", "approvals"] },
  business_owner: { label: "Business Owner", permissions: ["dashboard", "history", "customers", "commissions", "float", "support", "assistant", "subscription", "businessHub"] },
  branch_manager: { label: "Branch Manager", permissions: ["dashboard", "history", "customers", "float", "support", "assistant", "businessHub"] },
  agent: { label: "Agent", permissions: ["dashboard", "history", "customers", "support", "assistant", "businessHub"] },
  cashier: { label: "Cashier", permissions: ["dashboard", "support"] },
  auditor: { label: "Auditor", permissions: ["dashboard", "history", "support"] },
};

const TYPE_CONFIG = {
  "Cash-In": { icon: ArrowDownToLine, tone: "green" },
  "Cash-Out": { icon: ArrowUpFromLine, tone: "red" },
  "Send Money": { icon: Send, tone: "green" },
  Airtime: { icon: Smartphone, tone: "gold" },
  Data: { icon: Wifi, tone: "gold" },
};

function toneStyle(tone) {
  if (tone === "green") return { background: COLORS.greenSoft2, color: COLORS.green };
  if (tone === "red") return { background: COLORS.redSoft, color: COLORS.red };
  if (tone === "gold") return { background: COLORS.goldSoft, color: "#9c7420" };
  return {};
}

function money(n) {
  const fixed = Math.abs(n).toFixed(2);
  const [whole, decimals] = fixed.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (n < 0 ? "-GH₵ " : "GH₵ ") + withCommas + "." + decimals;
}

function formatTime(d) {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minuteStr = minutes < 10 ? "0" + minutes : String(minutes);
  return hours + ":" + minuteStr + " " + ampm;
}

// The backend's transaction_type values (cash_in, cash_out, airtime,
// data_bundle) differ from the display labels the UI was built around
// (Cash-In, Cash-Out, Airtime, Data) — these two functions translate
// a real API transaction object into the same shape the presentation
// components already expect, so HistoryScreen/CustomersScreen/etc.
// below don't need to change their rendering logic at all.
const API_TYPE_TO_DISPLAY = {
  cash_in: "Cash-In",
  cash_out: "Cash-Out",
  airtime: "Airtime",
  data_bundle: "Data",
  send_money: "Send Money",
};

function mapApiTransactionToDisplay(apiTx) {
  const createdAt = new Date(apiTx.createdAt);
  return {
    id: apiTx.id,
    type: API_TYPE_TO_DISPLAY[apiTx.type] !== undefined ? API_TYPE_TO_DISPLAY[apiTx.type] : apiTx.type,
    network: apiTx.network,
    customer: apiTx.customer && apiTx.customer.fullName ? apiTx.customer.fullName : "Walk-in Customer",
    phone: apiTx.customer && apiTx.customer.phone ? apiTx.customer.phone : "—",
    amount: parseFloat(apiTx.amount),
    commission: parseFloat(apiTx.commission),
    time: formatTime(createdAt),
    date: createdAt.toISOString().slice(0, 10),
    pendingSync: apiTx.status === "pending_sync",
  };
}

function mapApiTransactionToReceipt(apiTx) {
  return mapApiTransactionToDisplay(apiTx);
}

function FullScreenLoader() {
  return (
    <div style={{ width: "100%", minHeight: 600, background: COLORS.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: COLORS.ink50, fontSize: 14 }}>Loading...</p>
    </div>
  );
}

function FullScreenError({ message, onRetry }) {
  return (
    <div style={{ width: "100%", minHeight: 600, background: COLORS.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <p style={{ color: COLORS.red, fontWeight: 600, marginBottom: 8 }}>Couldn't load your dashboard</p>
      <p style={{ color: COLORS.ink55, fontSize: 13, marginBottom: 20 }}>{message}</p>
      <button onClick={onRetry} style={{ borderRadius: 12, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "12px 24px", border: "none" }}>
        Try again
      </button>
    </div>
  );
}

export default function AgentProGhana() {
  const [currentUser, setCurrentUser] = useState(null);
  const [subscriptionWarning, setSubscriptionWarning] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const tokenRef = useRef(null);

  const [activeModal, setActiveModal] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [toast, setToast] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const [showAlerts, setShowAlerts] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  // Real backend data, fetched on demand — null/[] until loaded.
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [rates, setRates] = useState(null);
  const [ussdTemplates, setUssdTemplates] = useState([]);
  const [ussdAutomationEnabled, setUssdAutomationEnabled] = useState(false);
  const [ussdAccessibilityGranted, setUssdAccessibilityGranted] = useState(false);
  const [simSlots, setSimSlots] = useState([]);
  const [ussdSession, setUssdSession] = useState(null); // { status, log[], network, type } while a live USSD automation run is in progress
  const [floatHistory, setFloatHistory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [historyTransactions, setHistoryTransactions] = useState([]);
  const [historyTotals, setHistoryTotals] = useState({ count: 0, volume: "0.00", commission: "0.00" });
  const [supportTickets, setSupportTickets] = useState([]);
  const [pendingOrganizations, setPendingOrganizations] = useState([]);
  const [pendingCommissionRequests, setPendingCommissionRequests] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [pendingRenewals, setPendingRenewals] = useState([]);
  const [pendingHubListings, setPendingHubListings] = useState([]);
  const [pendingHubPayments, setPendingHubPayments] = useState([]);

  // Transactions created while offline, queued in memory (not
  // localStorage — artifacts can't use browser storage; see the
  // persistent-storage note in this project's system instructions).
  // This queue is lost on page refresh, same as any other in-memory
  // React state — a real production app would persist this to
  // SQLite/IndexedDB on-device, which this artifact sandbox can't do.
  const [pendingQueue, setPendingQueue] = useState([]);

  const api = useMemo(
    () =>
      createApiClient(
        () => tokenRef.current,
        () => {
          // 401 from the server (expired/invalid token) — force back
          // to the login screen rather than continuing to show stale
          // or now-inaccessible data.
          setCurrentUser(null);
          setAccessTokenState(null);
          tokenRef.current = null;
        },
      ),
    [],
  );

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  // Real connectivity detection — the browser's online/offline events,
  // not a manual demo toggle. A fetch can still fail even while
  // navigator.onLine is true (e.g. the backend itself is down), which
  // is why loadDashboard() below also treats a network-level fetch
  // failure as "go offline", not just these events.
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      flushPendingQueue();
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQueue]);

  async function loadDashboard() {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await api.getDashboardSummary();
      setDashboard(data);
      setIsOnline(true);
    } catch (err) {
      if (err.isNetworkError) {
        setIsOnline(false);
      } else {
        setDashboardError(err.message || "Failed to load dashboard");
      }
    } finally {
      setDashboardLoading(false);
    }
  }

  async function loadRates() {
    try {
      const data = await api.getCommissionRates();
      setRates(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
      // Non-network failures (e.g. 403 for non-owner roles) are
      // expected for most roles — Commission Settings simply won't be
      // reachable for them, matching the prototype's permission model.
    }
  }

  async function loadUssdTemplates() {
    try {
      const data = await api.getUssdTemplates();
      setUssdTemplates(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  // Only meaningful on an actual Android build with the native plugin
  // present — in a browser preview, Capacitor.isNativePlatform() is
  // false and this is skipped entirely, leaving ussdAutomationEnabled
  // false and the transaction flow on its existing manual-record path.
  async function refreshUssdCapabilities() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { enabled } = await UssdAutomation.isAccessibilityServiceEnabled();
      setUssdAccessibilityGranted(enabled);
      const { slots } = await UssdAutomation.getSimSlots();
      setSimSlots(slots || []);
    } catch (err) {
      // Plugin present but a call failed (e.g. permission not yet
      // granted) — leave automation off rather than surface an error
      // for a feature the person hasn't tried to use yet.
    }
  }

  async function loadFloatHistory() {
    try {
      const data = await api.listFloatMovements();
      setFloatHistory(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  async function loadCustomers(query) {
    try {
      const data = await api.listCustomers(query);
      setCustomers(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  async function loadHistoryTransactions(filters) {
    try {
      const result = await api.listTransactions(filters);
      setHistoryTransactions(result.results.map(mapApiTransactionToDisplay));
      setHistoryTotals(result.totals);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  async function loadSupportTickets() {
    try {
      const data = await api.listSupportTickets();
      setSupportTickets(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  async function loadPendingOrganizations() {
    try {
      const data = await api.listPendingOrganizations();
      setPendingOrganizations(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  async function loadPendingCommissionRequests() {
    try {
      const data = await api.listPendingCommissionRateRequests();
      setPendingCommissionRequests(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  async function loadSubscriptionStatus() {
    try {
      const data = await api.getSubscriptionStatus();
      setSubscriptionStatus(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  async function loadPendingRenewals() {
    try {
      const data = await api.listPendingRenewalPayments();
      setPendingRenewals(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  async function loadPendingHubListings() {
    try {
      const data = await api.listPendingBusinessHubListings();
      setPendingHubListings(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  async function loadPendingHubPayments() {
    try {
      const data = await api.listPendingBusinessHubPayments();
      setPendingHubPayments(data);
    } catch (err) {
      if (err.isNetworkError) setIsOnline(false);
    }
  }

  useEffect(() => {
    if (currentUser) {
      loadDashboard();
      // Rates are loaded here too (not only when navigating to the
      // Commissions screen) because TransactionModal's live commission
      // estimate needs them as soon as an agent opens Cash In/Cash Out
      // from the dashboard — GET /commission-rates has no role
      // restriction (only PUT does), so this is safe for every role.
      loadRates();
      // Same reasoning as rates above: needed as soon as the
      // transaction modal can open, not only if/when a dedicated USSD
      // settings screen is visited.
      loadUssdTemplates();
      refreshUssdCapabilities();
      // Super Admin needs the pending-approvals count on the dashboard
      // badge immediately on login, not only after visiting the
      // Approvals screen once.
      if (currentUser.role === "super_admin") {
        loadPendingOrganizations();
        loadPendingCommissionRequests();
        loadPendingRenewals();
        loadPendingHubListings();
        loadPendingHubPayments();
      }
      if (currentUser.role === "business_owner") {
        loadSubscriptionStatus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Each screen's own data is fetched lazily, the moment the agent
  // actually navigates there, rather than all loaded upfront on
  // login — there's no reason to fetch commission rates or float
  // history for an Agent who can never reach those screens, and no
  // reason to make the initial login wait on every endpoint.
  useEffect(() => {
    if (!currentUser) return;
    if (screen === "history") loadHistoryTransactions();
    if (screen === "customers") loadCustomers();
    if (screen === "commissions") loadRates();
    if (screen === "float") loadFloatHistory();
    if (screen === "support") loadSupportTickets();
    if (screen === "approvals") {
      loadPendingOrganizations();
      loadPendingCommissionRequests();
      loadPendingRenewals();
      loadPendingHubListings();
      loadPendingHubPayments();
    }
    if (screen === "subscription") loadSubscriptionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, currentUser]);

  function handleLogin(user, token, subWarning) {
    setCurrentUser(user);
    setAccessTokenState(token);
    tokenRef.current = token;
    setSubscriptionWarning(subWarning || null);
  }

  function dismissSubscriptionWarning() {
    setSubscriptionWarning(null);
  }

  function handleLogout() {
    setCurrentUser(null);
    setAccessTokenState(null);
    tokenRef.current = null;
    setDashboard(null);
    setScreen("dashboard");
  }

  // True only when every precondition for actually dialing is met:
  // a real Android device (not the browser preview), the person has
  // opted in, they've enabled the accessibility service in Settings,
  // there's an active template for this network/type, and a SIM slot
  // is available for that network. Any single missing piece means
  // "fall back to manual recording" rather than a half-working attempt.
  function ussdAutomationAvailable(network, apiType) {
    if (!Capacitor.isNativePlatform() || !ussdAutomationEnabled || !ussdAccessibilityGranted) return false;
    const template = ussdTemplates.find((t) => t.network === network && t.transactionType === apiType);
    const simSlot = simSlots.find((s) => s.matchedNetwork === network);
    return Boolean(template && simSlot);
  }

  /**
   * Drives one USSD automation attempt end to end: dials the correct
   * SIM, feeds the person's live progress in ussdSession state as
   * screen updates arrive, and resolves/rejects once the network
   * reports success or failure (or the person cancels). Never touches
   * a MoMo PIN — see UssdAccessibilityService.kt's file-level comment
   * for exactly how that's enforced on the native side; this function
   * only ever sees whatever text the network shows on screen, same as
   * the person would see themselves.
   */
  function startUssdAutomation({ network, apiType, amount, customerPhone }) {
    const template = ussdTemplates.find((t) => t.network === network && t.transactionType === apiType);
    const simSlot = simSlots.find((s) => s.matchedNetwork === network);
    if (!template || !simSlot) {
      return Promise.reject(new Error("USSD automation isn't set up for this network/transaction yet."));
    }

    setUssdSession({ status: "dialing", log: ["Dialing network..."], network, apiType });

    const listeners = [];
    const cleanup = () => listeners.forEach((l) => l.remove());

    return new Promise((resolve, reject) => {
      listeners.push(
        UssdAutomation.addListener("ussdScreenUpdate", ({ rawText }) => {
          setUssdSession((prev) => (prev ? { ...prev, status: "navigating", log: [...prev.log, rawText] } : prev));
        }),
      );
      listeners.push(
        UssdAutomation.addListener("ussdAwaitingPin", () => {
          setUssdSession((prev) =>
            prev ? { ...prev, status: "awaiting_pin", log: [...prev.log, "Awaiting PIN entry (your action required on the network screen)"] } : prev,
          );
        }),
      );
      listeners.push(
        UssdAutomation.addListener("ussdSessionSuccess", ({ rawText }) => {
          setUssdSession((prev) => (prev ? { ...prev, status: "success", log: [...prev.log, rawText, "Transaction Successful"] } : prev));
          cleanup();
          resolve(rawText);
        }),
      );
      listeners.push(
        UssdAutomation.addListener("ussdSessionFailed", ({ reason, rawText }) => {
          const message =
            reason === "timeout"
              ? "The network didn't respond in time."
              : rawText || "The transaction could not be completed.";
          setUssdSession((prev) => (prev ? { ...prev, status: "failed", log: [...prev.log, message] } : prev));
          cleanup();
          reject(new Error(message));
        }),
      );
      listeners.push(
        UssdAutomation.addListener("ussdSessionCancelled", () => {
          cleanup();
          reject(new Error("cancelled"));
        }),
      );

      UssdAutomation.startSession({
        subscriptionId: simSlot.subscriptionId,
        ussdCode: template.ussdCode,
        steps: template.steps,
        successPatterns: template.successPatterns,
        failurePatterns: template.failurePatterns,
        pinPromptPatterns: template.pinPromptPatterns,
        stepTimeoutMs: template.stepTimeoutMs,
        maxRetries: template.maxRetries,
        values: { amount: amount.toFixed(2), customerPhone: customerPhone || "" },
      }).catch((err) => {
        cleanup();
        reject(err);
      });
    });
  }

  function cancelUssdAutomation() {
    UssdAutomation.cancelSession().catch(() => {});
    setUssdSession(null);
  }

  async function recordTransaction({ type, network, customer, phone, amount }) {
    const typeMap = { "Cash-In": "cash_in", "Cash-Out": "cash_out", Airtime: "airtime", Data: "data_bundle" };
    const apiType = typeMap[type];
    const payload = {
      type: apiType,
      network,
      amount: amount.toFixed(2),
      customerPhone: phone || undefined,
      customerName: customer || undefined,
      clientGeneratedId: generateClientId(),
    };

    // If USSD automation is fully set up for this network/transaction,
    // actually dial and navigate it first — only once the network
    // itself confirms success do we record the transaction in the
    // ledger, since that's what genuinely happened. Everyone else
    // (automation not enabled, no template yet, wrong device) keeps
    // the app's original behavior of recording directly, on the
    // understanding the agent performed the USSD transaction
    // themselves outside the app.
    if (ussdAutomationAvailable(network, apiType)) {
      try {
        await startUssdAutomation({ network, apiType, amount, customerPhone: phone });
      } catch (err) {
        setUssdSession(null);
        if (err.message !== "cancelled") {
          showToast(err.message || "USSD transaction failed");
        }
        return;
      }
      setUssdSession(null);
    }

    if (!isOnline) {
      // Genuinely offline (detected via the browser's own online/
      // offline events) — queue locally rather than attempt a fetch
      // we already know will fail, and show the same "pending sync"
      // receipt UX the prototype always had, now backed by a real
      // queue instead of a setTimeout simulation.
      queueOfflineTransaction(payload, { type, network, customer, phone, amount });
      return;
    }

    try {
      const created = await api.createTransaction(payload);
      setActiveModal(null);
      setReceipt(mapApiTransactionToReceipt(created));
      loadDashboard();
    } catch (err) {
      if (err.isNetworkError) {
        // navigator.onLine said we're online, but the actual request
        // failed anyway (backend unreachable, DNS, etc.) — treat this
        // the same as the offline branch above rather than surfacing
        // a confusing error for what the agent will experience as
        // "the app just isn't working."
        setIsOnline(false);
        queueOfflineTransaction(payload, { type, network, customer, phone, amount });
      } else if (err.status === 402) {
        showToast((err.body && err.body.message) || "Insufficient float for this transaction");
      } else {
        showToast(err.message || "Failed to record transaction");
      }
    }
  }

  function queueOfflineTransaction(payload, displayInfo) {
    setPendingQueue((prev) => [...prev, { kind: "transaction", payload }]);
    setActiveModal(null);
    setReceipt({
      ...displayInfo,
      id: payload.clientGeneratedId,
      commission: null, // not known until synced — server computes this
      time: formatTime(new Date()),
      pendingSync: true,
    });
    showToast("Saved offline — will sync when reconnected");
  }

  async function flushPendingQueue() {
    if (pendingQueue.length === 0) return;
    setSyncing(true);
    const transactions = pendingQueue.filter((i) => i.kind === "transaction").map((i) => i.payload);
    const floatMovements = pendingQueue.filter((i) => i.kind === "floatMovement").map((i) => i.payload);
    try {
      const result = await api.syncBatch(transactions, floatMovements);
      setPendingQueue([]);
      const total = result.syncedCount + result.duplicateCount;
      showToast(
        result.failed.length > 0
          ? `Synced ${total} item${total !== 1 ? "s" : ""}, ${result.failed.length} failed`
          : `Back online — synced ${total} item${total !== 1 ? "s" : ""}`,
      );
      loadDashboard();
    } catch (err) {
      if (err.isNetworkError) {
        setIsOnline(false);
      } else {
        showToast("Sync failed — will retry");
      }
    } finally {
      setSyncing(false);
    }
  }

  async function recordFloatMovement({ type, network, amount, note, toNetwork }) {
    const movementTypeMap = { Transfer: "transfer", Purchase: "purchase", Adjustment: "adjustment" };
    const payload = {
      movementType: movementTypeMap[type],
      network,
      toNetwork: type === "Transfer" ? toNetwork : undefined,
      amount: amount.toFixed(2),
      note,
      clientGeneratedId: generateClientId(),
    };

    if (!isOnline) {
      setPendingQueue((prev) => [...prev, { kind: "floatMovement", payload }]);
      showToast("Saved offline — will sync when reconnected");
      return;
    }

    try {
      await api.createFloatMovement(payload);
      showToast(`${type} recorded for ${NETWORKS[network].label}`);
      loadDashboard();
      loadFloatHistory();
    } catch (err) {
      if (err.isNetworkError) {
        setIsOnline(false);
        setPendingQueue((prev) => [...prev, { kind: "floatMovement", payload }]);
        showToast("Saved offline — will sync when reconnected");
      } else if (err.status === 402) {
        showToast((err.body && err.body.message) || "Insufficient funds for this movement");
      } else {
        showToast(err.message || "Failed to record float movement");
      }
    }
  }

  function toggleOnlineDemo() {
    // Manual override, kept only as an explicit developer/demo aid for
    // testing the offline UI without physically disconnecting — real
    // detection is via the browser events wired above. Clearly
    // distinguished in the UI (see the header button below) so it's
    // never mistaken for a real connectivity indicator.
    setIsOnline((prev) => !prev);
  }

  const permissions = currentUser ? ROLES[currentUser.role].permissions : [];

  if (!currentUser) {
    return <LoginScreen api={api} onLogin={handleLogin} />;
  }

  if (dashboardLoading && !dashboard) {
    return <FullScreenLoader />;
  }

  if (dashboardError && !dashboard) {
    return <FullScreenError message={dashboardError} onRetry={loadDashboard} />;
  }

  // Derive the same {MTN, TELECEL, AT} shaped object the rest of the
  // UI was built around, from the API's array response — keeps every
  // presentation component below unchanged in its expectations.
  const floatBal = {};
  const floatBalancesList = dashboard && dashboard.floatBalances ? dashboard.floatBalances : [];
  floatBalancesList.forEach((f) => {
    floatBal[f.network] = parseFloat(f.currentBalance);
  });
  const totalFloat = parseFloat(dashboard && dashboard.totalFloat !== undefined ? dashboard.totalFloat : "0");
  const cashOnHand = parseFloat(dashboard && dashboard.cashOnHand !== undefined ? dashboard.cashOnHand : "0");
  const todayData = dashboard && dashboard.today ? dashboard.today : {};
  const todayStats = {
    commission: parseFloat(todayData.commission !== undefined ? todayData.commission : "0"),
    count: todayData.transactionCount !== undefined ? todayData.transactionCount : 0,
    volume: parseFloat(todayData.volume !== undefined ? todayData.volume : "0"),
  };
  const recentTransactionsList = dashboard && dashboard.recentTransactions ? dashboard.recentTransactions : [];
  const transactions = recentTransactionsList.map(mapApiTransactionToDisplay);
  const lowFloatNetworks = Object.entries(floatBal).filter(([, v]) => v < 3000);
  const pendingSyncCount = pendingQueue.length;

  return (
    <div style={{ width: "100%", minHeight: 600, background: COLORS.cream, color: COLORS.ink, fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 448, margin: "0 auto", paddingBottom: 96, position: "relative" }}>
        {/* Header */}
        <header style={{ position: "sticky", top: 0, zIndex: 20, background: COLORS.green, padding: "20px 16px 16px", color: COLORS.cream, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: COLORS.gold, fontWeight: 600, margin: 0 }}>AgentPro Ghana</p>
              <h1 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, margin: "2px 0 0" }}>
                {screen === "dashboard" && currentUser.name}
                {screen === "history" && "Transaction History"}
                {screen === "customers" && "Customers"}
                {screen === "commissions" && "Commission Settings"}
                {screen === "float" && "Float Management"}
                {screen === "support" && "Support Centre"}
                {screen === "approvals" && "Pending Approvals"}
                {screen === "subscription" && "Subscription"}
                {screen === "businessHub" && "Business Hub"}
              </h1>
              {screen === "dashboard" && (
                <p style={{ fontSize: 11, color: COLORS.white65, margin: "2px 0 0" }}>{ROLES[currentUser.role].label}</p>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                aria-label={isOnline ? "Go offline (demo)" : "Go online (demo)"}
                onClick={toggleOnlineDemo}
                style={{ position: "relative", borderRadius: 999, background: COLORS.white10, padding: 10, border: "none", color: COLORS.cream }}
              >
                {isOnline ? <Wifi size={18} /> : <WifiOff size={18} color="#F4B8A0" />}
              </button>
              <button
                aria-label="Notifications"
                onClick={() => setShowAlerts(true)}
                style={{ position: "relative", borderRadius: 999, background: COLORS.white10, padding: 10, border: "none" }}
              >
                <AlertTriangle size={18} />
                {lowFloatNetworks.length > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, height: 16, width: 16, borderRadius: 999, background: COLORS.red, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${COLORS.green}` }}>
                    {lowFloatNetworks.length}
                  </span>
                )}
              </button>
              <button
                aria-label="Log out"
                onClick={() => setCurrentUser(null)}
                style={{ borderRadius: 999, background: COLORS.white10, padding: 10, border: "none", color: COLORS.cream }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {(!isOnline || syncing) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: syncing ? COLORS.greenSoft2 : "#FBEDEA", padding: "8px 16px", fontSize: 11.5, fontWeight: 600, color: syncing ? COLORS.green : COLORS.red }}>
            {syncing ? <RefreshCw size={13} /> : <WifiOff size={13} />}
            {syncing ? "Syncing pending transactions..." : `Offline — ${pendingSyncCount} transaction${pendingSyncCount !== 1 ? "s" : ""} will sync when reconnected`}
          </div>
        )}

        {subscriptionWarning && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.goldSoft, padding: "10px 16px" }}>
            <AlertTriangle size={14} color={COLORS.gold} style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 11.5, fontWeight: 600, color: "#7A5A12", margin: 0, flex: 1 }}>{subscriptionWarning}</p>
            {permissions.includes("subscription") && (
              <button onClick={() => setScreen("subscription")} style={{ fontSize: 11, fontWeight: 700, color: COLORS.green, background: "none", border: "none", flexShrink: 0, textDecoration: "underline" }}>
                Renew
              </button>
            )}
            <button onClick={dismissSubscriptionWarning} aria-label="Dismiss" style={{ background: "none", border: "none", padding: 0, flexShrink: 0 }}>
              <X size={14} color="#7A5A12" />
            </button>
          </div>
        )}

        {screen === "dashboard" && (
          <DashboardScreen
            floatBal={floatBal}
            totalFloat={totalFloat}
            cashOnHand={cashOnHand}
            todayStats={todayStats}
            transactions={transactions}
            lowFloatNetworks={lowFloatNetworks}
            permissions={permissions}
            pendingApprovalsCount={pendingOrganizations.length + pendingCommissionRequests.length + pendingRenewals.length + pendingHubListings.length + pendingHubPayments.length}
            subscriptionStatus={subscriptionStatus}
            setActiveModal={setActiveModal}
            setScreen={setScreen}
            setReceipt={setReceipt}
            showToast={showToast}
          />
        )}

        {screen === "history" && (
          <HistoryScreen transactions={historyTransactions} totals={historyTotals} onReload={loadHistoryTransactions} onSelectReceipt={setReceipt} showToast={showToast} />
        )}

        {screen === "customers" && permissions.includes("customers") && (
          <CustomersScreen customers={customers} api={api} onReload={loadCustomers} showToast={showToast} />
        )}

        {screen === "commissions" && permissions.includes("commissions") && (
          <CommissionsScreen rates={rates} api={api} showToast={showToast} onSaved={loadRates} role={currentUser.role} setScreen={setScreen} />
        )}

        {screen === "float" && permissions.includes("float") && (
          <FloatScreen floatBal={floatBal} floatHistory={floatHistory} onMove={recordFloatMovement} cashOnHand={cashOnHand} />
        )}

        {screen === "support" && (
          <SupportScreen tickets={supportTickets} api={api} onReload={loadSupportTickets} showToast={showToast} />
        )}

        {screen === "approvals" && permissions.includes("approvals") && (
          <ApprovalsScreen
            organizations={pendingOrganizations}
            onReload={loadPendingOrganizations}
            commissionRequests={pendingCommissionRequests}
            onReloadCommissionRequests={loadPendingCommissionRequests}
            renewals={pendingRenewals}
            onReloadRenewals={loadPendingRenewals}
            hubListings={pendingHubListings}
            onReloadHubListings={loadPendingHubListings}
            hubPayments={pendingHubPayments}
            onReloadHubPayments={loadPendingHubPayments}
            api={api}
            showToast={showToast}
          />
        )}

        {screen === "subscription" && permissions.includes("subscription") && (
          <SubscriptionScreen status={subscriptionStatus} api={api} onReload={loadSubscriptionStatus} showToast={showToast} />
        )}

        {screen === "businessHub" && permissions.includes("businessHub") && (
          <BusinessHubScreen api={api} showToast={showToast} canCreate={currentUser.role === "business_owner"} />
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, maxWidth: 448, margin: "0 auto", borderTop: `1px solid ${COLORS.ink12}`, background: "rgba(255,255,255,0.97)", padding: "8px 8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${4 + (permissions.includes("approvals") ? 1 : 0) + (permissions.includes("businessHub") ? 1 : 0)}, 1fr)` }}>
          <NavItem icon={TrendingUp} label="Dashboard" active={screen === "dashboard"} onClick={() => setScreen("dashboard")} />
          <NavItem icon={Receipt} label="Transactions" active={screen === "history"} onClick={() => setScreen("history")} />
          {permissions.includes("customers") ? (
            <NavItem icon={Users} label="Customers" active={screen === "customers"} onClick={() => setScreen("customers")} />
          ) : (
            <NavItem icon={Users} label="Customers" active={false} onClick={() => showToast("Your role doesn't have access to customers")} />
          )}
          {permissions.includes("businessHub") && (
            <NavItem icon={Store} label="Business Hub" active={screen === "businessHub"} onClick={() => setScreen("businessHub")} />
          )}
          {permissions.includes("approvals") && (
            <NavItem icon={Clock} label="Approvals" active={screen === "approvals"} onClick={() => setScreen("approvals")} badge={pendingOrganizations.length + pendingCommissionRequests.length + pendingRenewals.length + pendingHubListings.length + pendingHubPayments.length} />
          )}
          <NavItem icon={MessageCircle} label="Support" active={screen === "support"} onClick={() => setScreen("support")} />
        </div>
      </nav>

      {/* AI Assistant floating button */}
      <button
        onClick={() => setShowAssistant(true)}
        aria-label="Ask AgentPro Assistant"
        style={{ position: "fixed", bottom: 80, right: 16, zIndex: 20, width: 52, height: 52, borderRadius: 999, background: COLORS.gold, boxShadow: "0 4px 10px rgba(0,0,0,0.15)", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Sparkles size={22} color={COLORS.ink} />
      </button>

      {activeModal && (
        <TransactionModal type={activeModal} rates={rates} onClose={() => setActiveModal(null)} onSubmit={recordTransaction} />
      )}

      {ussdSession && <UssdProgressModal session={ussdSession} onCancel={cancelUssdAutomation} />}

      {receipt && <ReceiptModal tx={receipt} onClose={() => setReceipt(null)} showToast={showToast} />}

      {showAlerts && (
        <AlertsPanel
          lowFloatNetworks={lowFloatNetworks}
          onClose={() => setShowAlerts(false)}
          onTopUp={() => {
            setShowAlerts(false);
            if (permissions.includes("float")) setScreen("float");
            else showToast("Your role doesn't have access to float management");
          }}
        />
      )}

      {showAssistant && (
        // NOTE: `transactions` here is dashboard.recentTransactions,
        // capped at 8 by the backend's /dashboard/summary endpoint —
        // so "most frequent customer" and "top network" answers only
        // see the last 8 transactions, not full history. The original
        // mock-data prototype answered from its entire in-memory
        // transaction list; matching that exactly now would mean a
        // separate full-history fetch just for the assistant, which
        // isn't built yet. Flagging this honestly rather than silently
        // shipping answers that look complete but are scoped smaller
        // than before.
        <AssistantModal onClose={() => setShowAssistant(false)} context={{ floatBal, totalFloat, cashOnHand, todayStats, transactions }} />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 30, borderRadius: 999, background: COLORS.ink, color: COLORS.white, fontSize: 12.5, fontWeight: 500, padding: "8px 16px", boxShadow: "0 4px 10px rgba(0,0,0,0.2)", maxWidth: "88%", textAlign: "center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 0", background: "none", border: "none" }}>
      <span style={{ position: "relative" }}>
        <Icon size={19} color={active ? COLORS.green : COLORS.ink40} />
        {badge > 0 && (
          <span style={{ position: "absolute", top: -6, right: -8, height: 15, width: 15, borderRadius: 999, background: COLORS.red, color: COLORS.white, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: active ? COLORS.green : COLORS.ink40 }}>{label}</span>
    </button>
  );
}

/* ---------------- Dashboard Screen ---------------- */

function DashboardScreen({ floatBal, totalFloat, cashOnHand, todayStats, transactions, lowFloatNetworks, permissions, pendingApprovalsCount, subscriptionStatus, setActiveModal, setScreen, setReceipt, showToast }) {
  return (
    <>
      {/* Float strip */}
      <section style={{ padding: "16px 16px 0" }}>
        <div style={{ borderRadius: 16, background: COLORS.green, padding: "0 4px 4px", boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 12px" }}>
            {Object.entries(NETWORKS).map(([key, net]) => (
              <div key={key} style={{ flexShrink: 0, minWidth: 118, borderRadius: 12, background: "rgba(255,255,255,0.96)", padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ height: 8, width: 8, borderRadius: 999, background: net.dot, display: "inline-block" }} />
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.ink70, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{net.label}</span>
                </div>
                <p style={{ marginTop: 4, fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: floatBal[key] < 3000 ? COLORS.red : COLORS.green }}>
                  {money(floatBal[key])}
                </p>
                {floatBal[key] < 3000 && <p style={{ fontSize: 9, fontWeight: 500, color: COLORS.red, marginTop: 2 }}>Low — top up</p>}
              </div>
            ))}
            <div style={{ flexShrink: 0, minWidth: 118, borderRadius: 12, background: COLORS.gold, padding: "10px 12px" }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(28,31,27,0.75)" }}>Total Float</span>
              <p style={{ marginTop: 4, fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{money(totalFloat)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Today stats */}
      <section style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <StatCard label="Cash on Hand" value={money(cashOnHand)} accent="green" />
          <StatCard label="Today's Commission" value={money(todayStats.commission)} accent="gold" />
          <StatCard label="Transactions" value={todayStats.count} accent="neutral" />
        </div>
      </section>

      {/* Quick actions */}
      <section style={{ padding: "24px 16px 0" }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: COLORS.ink60, marginBottom: 10 }}>Quick Actions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ActionButton icon={ArrowDownToLine} label="Cash In" tone="green" onClick={() => setActiveModal("cashin")} />
          <ActionButton icon={ArrowUpFromLine} label="Cash Out" tone="red" onClick={() => setActiveModal("cashout")} />
          <ActionButton icon={Smartphone} label="Buy Airtime" tone="gold" onClick={() => setActiveModal("airtime")} />
          <ActionButton icon={Wifi} label="Buy Data" tone="gold" onClick={() => setActiveModal("data")} />
          <ActionButton
            icon={ArrowLeftRight}
            label="Float Transfer"
            tone="green"
            onClick={() => (permissions.includes("float") ? setScreen("float") : showToast("Your role doesn't have access to float management"))}
          />
          <ActionButton
            icon={Eye}
            label="Check Float"
            tone="neutral"
            onClick={() => (permissions.includes("float") ? setScreen("float") : showToast("Float is shown live above ↑"))}
          />
        </div>
      </section>

      {/* Recent transactions */}
      <section style={{ padding: "28px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: COLORS.ink60, margin: 0 }}>Recent Transactions</h2>
          <button onClick={() => setScreen("history")} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 600, color: COLORS.green, background: "none", border: "none" }}>
            <History size={13} /> History <ChevronRight size={13} />
          </button>
        </div>
        <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {transactions.slice(0, 8).map((t, i) => {
            const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG["Cash-In"];
            const Icon = cfg.icon;
            return (
              <button
                key={t.id}
                onClick={() => setReceipt(t)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", textAlign: "left", background: "none", border: "none", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink06}` }}
              >
                <span style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, flexShrink: 0, ...toneStyle(cfg.tone) }}>
                  <Icon size={16} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.type}</span>
                    <span style={{ height: 6, width: 6, borderRadius: 999, background: NETWORKS[t.network].dot, flexShrink: 0, display: "inline-block" }} />
                    {t.pendingSync && <RefreshCw size={10} color={COLORS.gold} style={{ flexShrink: 0 }} />}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: COLORS.ink55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.customer} · {t.time}</span>
                </span>
                <span style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{money(t.amount)}</span>
                  <span style={{ display: "block", fontSize: 10.5, color: COLORS.gold, fontWeight: 600 }}>+{money(t.commission)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Settings entry points */}
      <section style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {permissions.includes("approvals") && (
          <button onClick={() => setScreen("approvals")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, borderRadius: 16, background: pendingApprovalsCount > 0 ? COLORS.goldSoft : COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "14px", border: "none", textAlign: "left" }}>
            <span style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, background: pendingApprovalsCount > 0 ? COLORS.gold : COLORS.ink08 }}>
              <Clock size={16} color={pendingApprovalsCount > 0 ? COLORS.ink : COLORS.ink70} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Pending Approvals</span>
              {pendingApprovalsCount > 0 && (
                <span style={{ display: "block", fontSize: 11, color: COLORS.ink60, marginTop: 1 }}>{pendingApprovalsCount} registration{pendingApprovalsCount !== 1 ? "s" : ""} awaiting review</span>
              )}
            </span>
            <ChevronRight size={16} color={COLORS.ink40} />
          </button>
        )}
        {permissions.includes("float") && (
          <button onClick={() => setScreen("float")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "14px", border: "none", textAlign: "left" }}>
            <span style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.ink08 }}>
              <ArrowLeftRight size={16} color={COLORS.ink70} />
            </span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>Float Management</span>
            <ChevronRight size={16} color={COLORS.ink40} />
          </button>
        )}
        {permissions.includes("commissions") && (
          <button onClick={() => setScreen("commissions")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "14px", border: "none", textAlign: "left" }}>
            <span style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.ink08 }}>
              <Settings2 size={16} color={COLORS.ink70} />
            </span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>Commission Rate Settings</span>
            <ChevronRight size={16} color={COLORS.ink40} />
          </button>
        )}
        {permissions.includes("subscription") && (
          <button onClick={() => setScreen("subscription")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, borderRadius: 16, background: subscriptionStatus && subscriptionStatus.status !== "active" ? COLORS.redSoft : COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "14px", border: "none", textAlign: "left" }}>
            <span style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, background: subscriptionStatus && subscriptionStatus.status !== "active" ? COLORS.red : COLORS.ink08 }}>
              <CreditCard size={16} color={subscriptionStatus && subscriptionStatus.status !== "active" ? COLORS.white : COLORS.ink70} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Subscription</span>
              {subscriptionStatus && (
                <span style={{ display: "block", fontSize: 11, color: subscriptionStatus.status !== "active" ? COLORS.red : COLORS.ink60, marginTop: 1 }}>
                  {subscriptionStatus.status === "active" && subscriptionStatus.daysRemaining !== null && `${subscriptionStatus.daysRemaining} day${subscriptionStatus.daysRemaining !== 1 ? "s" : ""} remaining`}
                  {subscriptionStatus.status === "grace_period" && "Grace period — renew now"}
                  {subscriptionStatus.status === "suspended" && "Suspended — renew to restore access"}
                </span>
              )}
            </span>
            <ChevronRight size={16} color={COLORS.ink40} />
          </button>
        )}
      </section>
    </>
  );
}

function StatCard({ label, value, accent }) {
  const borderColor = accent === "green" ? COLORS.green : accent === "gold" ? COLORS.gold : COLORS.ink12;
  return (
    <div style={{ borderRadius: 12, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderLeft: `3px solid ${borderColor}`, padding: "10px" }}>
      <p style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, color: COLORS.ink50, lineHeight: 1.2, margin: 0 }}>{label}</p>
      <p style={{ marginTop: 4, fontFamily: "monospace", fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{value}</p>
    </div>
  );
}

function ActionButton({ icon: Icon, label, tone, onClick }) {
  const bg = tone === "green" ? COLORS.green : tone === "red" ? COLORS.red : tone === "gold" ? COLORS.gold : COLORS.white;
  const textColor = tone === "neutral" ? COLORS.ink : COLORS.white;
  const border = tone === "neutral" ? `1px solid ${COLORS.ink12}` : "none";
  const iconBg = tone === "neutral" ? COLORS.ink08 : "rgba(255,255,255,0.2)";
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 16, background: bg, color: textColor, padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border }}
    >
      <span style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, background: iconBg, flexShrink: 0 }}>
        <Icon size={18} />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2, textAlign: "left" }}>{label}</span>
    </button>
  );
}

/* ---------------- Login / Register Screen ---------------- */

function LoginScreen({ api, onLogin }) {
  const [mode, setMode] = useState("signin"); // "signin" | "register"
  const [signInMethod, setSignInMethod] = useState("email"); // "email" (Business Owner) | "pin" (Agent/Manager)
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessRegNumber, setBusinessRegNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(null); // set after successful registration

  // Forgot-password mini-flow
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetStage, setResetStage] = useState("request"); // "request" | "confirm" | "done"
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // A stable per-installation identifier for device binding. crypto.
  // randomUUID() generates a fresh one each page load in this
  // artifact (no persistent storage available), which is fine for
  // demoing the login flow itself but means the backend's "first
  // login on this device" record resets every reload — a real
  // mobile app (e.g. the Capacitor/Android build) would generate this
  // once and persist it on-device instead.
  const deviceIdRef = useRef(generateClientId());

  function switchMode(next) {
    setMode(next);
    setError("");
    setPin("");
    setPendingApproval(null);
  }

  async function handleSignIn() {
    if (signInMethod === "email") {
      if (email.trim().length === 0) {
        setError("Enter your email address.");
        return;
      }
      if (password.length === 0) {
        setError("Enter your password.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const result = await api.login(email.trim(), password, deviceIdRef.current);
        onLogin(result.user, result.accessToken, result.subscriptionWarning);
      } catch (err) {
        if (err.isNetworkError) {
          setError(`Can't reach the server at ${API_BASE_URL}. Is the backend running and reachable from this app?`);
        } else if (err.status === 401) {
          setError("Incorrect email or password.");
        } else if (err.status === 403) {
          // Organization is pending_approval / suspended / rejected —
          // the backend's message already explains which, and why.
          setError(err.body?.message || "Your account isn't active yet.");
        } else {
          setError(err.message || "Sign in failed.");
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // PIN sign-in path, for Agent/Manager accounts
    if (phone.trim().length === 0) {
      setError("Enter your phone number.");
      return;
    }
    if (pin.length !== 4) {
      setError("Enter your 4-digit PIN.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.pinLogin(phone.trim(), pin, deviceIdRef.current);
      onLogin(result.user, result.accessToken, result.subscriptionWarning);
    } catch (err) {
      if (err.isNetworkError) {
        setError(`Can't reach the server at ${API_BASE_URL}. Is the backend running and reachable from this app?`);
      } else if (err.status === 401) {
        setError("Incorrect phone number or PIN.");
        setPin("");
      } else {
        setError(err.message || "Sign in failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (businessName.trim().length === 0) {
      setError("Enter your business name.");
      return;
    }
    if (fullName.trim().length === 0) {
      setError("Enter your full name.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!/^0\d{9}$/.test(phone.trim())) {
      setError("Enter a valid 10-digit phone number starting with 0 (e.g. 0244123456).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.register(
        businessName.trim(),
        fullName.trim(),
        email.trim(),
        password,
        phone.trim(),
        businessRegNumber.trim(),
        deviceIdRef.current,
      );
      // Registration no longer signs the user in directly — the
      // account sits in pending_approval until a Superuser confirms
      // the subscription payment. Show that state instead of
      // dropping straight into the dashboard.
      setPendingApproval(result);
    } catch (err) {
      if (err.isNetworkError) {
        setError(`Can't reach the server at ${API_BASE_URL}. Is the backend running and reachable from this app?`);
      } else if (err.status === 409) {
        setError(err.body?.message || "An account with this email or phone number already exists. Try signing in instead.");
      } else {
        setError(err.message || "Registration failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestReset() {
    if (!/^\S+@\S+\.\S+$/.test(resetEmail.trim())) {
      setResetError("Enter a valid email address.");
      return;
    }
    setResetLoading(true);
    setResetError("");
    try {
      const result = await api.requestPasswordReset(resetEmail.trim());
      setResetMessage(result.message);
      // The backend hands back the raw token directly for now, since
      // no transactional email provider is wired up yet — see
      // PasswordResetService. Once email sending exists, this token
      // field will stop being returned and this pre-fill goes away
      // naturally (the input stays, just empty).
      if (result.token) setResetToken(result.token);
      setResetStage("confirm");
    } catch (err) {
      setResetError(err.isNetworkError ? "Can't reach the server." : err.message || "Something went wrong.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleConfirmReset() {
    if (resetToken.trim().length === 0) {
      setResetError("Enter the reset token from your email.");
      return;
    }
    if (resetNewPassword.length < 8) {
      setResetError("Choose a password with at least 8 characters.");
      return;
    }
    setResetLoading(true);
    setResetError("");
    try {
      const result = await api.resetPassword(resetToken.trim(), resetNewPassword);
      setResetMessage(result.message);
      setResetStage("done");
    } catch (err) {
      setResetError(err.isNetworkError ? "Can't reach the server." : err.message || "That reset link is invalid or has expired.");
    } finally {
      setResetLoading(false);
    }
  }

  function closeForgotPassword() {
    setShowForgotPassword(false);
    setResetStage("request");
    setResetEmail("");
    setResetToken("");
    setResetNewPassword("");
    setResetMessage("");
    setResetError("");
  }

  function handleDigit(d) {
    if (pin.length >= 4) return;
    setError("");
    setPin(pin + d);
  }

  const inputStyle = {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.1)",
    padding: "12px 14px",
    fontSize: 14,
    color: COLORS.white,
    marginBottom: 12,
    boxSizing: "border-box",
    outline: "none",
  };

  // After a successful registration, show the pending-approval state
  // instead of the sign-in/register form — there's no token to log in
  // with yet, and the person needs clear next steps (pay, submit
  // reference, wait for approval).
  if (pendingApproval) {
    return (
      <div style={{ width: "100%", minHeight: 600, background: COLORS.green, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 24px", color: COLORS.white, fontFamily: "sans-serif", textAlign: "center" }}>
        <div style={{ height: 56, width: 56, borderRadius: 999, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Clock size={26} color={COLORS.gold} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Registration submitted</h1>
        <p style={{ fontSize: 13.5, color: COLORS.white70, lineHeight: 1.5, marginBottom: 20, maxWidth: 280 }}>
          {pendingApproval.message}
        </p>
        <div style={{ width: "100%", maxWidth: 280, borderRadius: 12, background: "rgba(255,255,255,0.1)", padding: 14, marginBottom: 20, textAlign: "left" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.gold, marginBottom: 6 }}>Next steps</p>
          <p style={{ fontSize: 12.5, color: COLORS.white70, lineHeight: 1.5, margin: 0 }}>
            1. Pay your subscription fee via MTN MoMo to the AgentPro Ghana merchant number.{"\n"}
            2. Submit your payment reference in-app once approved contact allows sign-in.{"\n"}
            3. A Superuser will verify payment and activate your account — you'll be able to sign in with your email and password once that's done.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPendingApproval(null);
            setMode("signin");
            setSignInMethod("email");
          }}
          style={{ borderRadius: 12, background: COLORS.gold, color: COLORS.ink, fontWeight: 700, padding: "12px 24px", fontSize: 13.5, border: "none" }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: 600, background: COLORS.green, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 24px", color: COLORS.white, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ height: 10, width: 10, borderRadius: 999, background: COLORS.gold, display: "inline-block" }} />
        <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 3, fontWeight: 600, color: COLORS.gold, margin: 0 }}>AgentPro Ghana</p>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{mode === "signin" ? "Sign in" : "Create your account"}</h1>

      <div style={{ display: "flex", width: "100%", maxWidth: 280, borderRadius: 12, background: "rgba(255,255,255,0.1)", padding: 4, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => switchMode("signin")}
          style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 700, background: mode === "signin" ? COLORS.white : "transparent", color: mode === "signin" ? COLORS.green : COLORS.white }}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode("register")}
          style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 700, background: mode === "register" ? COLORS.white : "transparent", color: mode === "register" ? COLORS.green : COLORS.white }}
        >
          New Business
        </button>
      </div>

      <div style={{ width: "100%", maxWidth: 280 }}>
        {mode === "signin" && (
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => { setSignInMethod("email"); setError(""); }}
              style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, fontWeight: 700, color: signInMethod === "email" ? COLORS.gold : "rgba(255,255,255,0.5)", borderBottom: signInMethod === "email" ? `2px solid ${COLORS.gold}` : "2px solid transparent", paddingBottom: 4 }}
            >
              Business Owner
            </button>
            <button
              type="button"
              onClick={() => { setSignInMethod("pin"); setError(""); }}
              style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, fontWeight: 700, color: signInMethod === "pin" ? COLORS.gold : "rgba(255,255,255,0.5)", borderBottom: signInMethod === "pin" ? `2px solid ${COLORS.gold}` : "2px solid transparent", paddingBottom: 4 }}
            >
              Agent / Manager (PIN)
            </button>
          </div>
        )}

        {mode === "register" && (
          <>
            <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" style={inputStyle} />
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" style={inputStyle} />
          </>
        )}

        {(mode === "register" || signInMethod === "email") && (
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" style={inputStyle} autoCapitalize="none" />
        )}

        {(mode === "register" || signInMethod === "pin") && (
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number (e.g. 0244123456)" style={inputStyle} />
        )}

        {mode === "register" && (
          <input type="text" value={businessRegNumber} onChange={(e) => setBusinessRegNumber(e.target.value)} placeholder="Ghana Card or business reg. number (optional)" style={inputStyle} />
        )}

        {(mode === "register" || signInMethod === "email") && (
          <>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "Choose a password (min. 8 characters)" : "Password"} style={inputStyle} />
            {mode === "register" && (
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" style={inputStyle} />
            )}
          </>
        )}

        {mode === "signin" && signInMethod === "pin" && (
          <>
            <p style={{ fontSize: 11, color: COLORS.white65, marginBottom: 8, textAlign: "center" }}>Enter your PIN</p>
            <div style={{ display: "flex", gap: 12, marginBottom: 12, justifyContent: "center" }}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} style={{ height: 14, width: 14, borderRadius: 999, border: "2px solid rgba(255,255,255,0.4)", background: pin.length > i ? COLORS.white : "transparent", display: "inline-block" }} />
              ))}
            </div>
          </>
        )}

        <p style={{ minHeight: 20, fontSize: 12.5, color: "#F4B8A0", fontWeight: 500, marginBottom: 8, textAlign: "center" }}>{error}</p>

        {mode === "signin" && signInMethod === "pin" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%" }}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key, i) => {
              if (key === "") return <div key={i} />;
              if (key === "del") {
                return (
                  <button type="button" key={i} onClick={() => setPin((p) => p.slice(0, -1))} style={{ height: 56, borderRadius: 16, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: COLORS.white, border: "none" }}>
                    Delete
                  </button>
                );
              }
              return (
                <button type="button" key={i} onClick={() => handleDigit(key)} style={{ height: 56, borderRadius: 16, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, color: COLORS.white, border: "none" }}>
                  {key}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={mode === "signin" ? handleSignIn : handleRegister}
          disabled={loading}
          style={{ width: "100%", marginTop: 16, borderRadius: 12, background: COLORS.gold, color: COLORS.ink, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none", opacity: loading ? 0.5 : 1 }}
        >
          {loading ? (mode === "signin" ? "Signing in..." : "Creating account...") : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        {mode === "signin" && signInMethod === "email" && (
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            style={{ width: "100%", marginTop: 12, background: "none", border: "none", fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "underline" }}
          >
            Forgot password?
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 24, color: "rgba(255,255,255,0.45)" }}>
        <Lock size={12} />
        <p style={{ fontSize: 11, margin: 0, textAlign: "center" }}>
          Connecting to {API_BASE_URL}
        </p>
      </div>

      {showForgotPassword && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ width: "100%", maxWidth: 300, background: COLORS.white, borderRadius: 16, padding: 20, color: COLORS.ink }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Reset your password</h2>

            {resetStage === "request" && (
              <>
                <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>Enter the email on your account and we'll send a reset link.</p>
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="Email address" style={{ width: "100%", borderRadius: 10, border: `1px solid ${COLORS.ink12}`, padding: "10px 12px", fontSize: 13.5, marginBottom: 10, boxSizing: "border-box" }} />
                {resetError && <p style={{ fontSize: 12, color: "#C0392B", marginBottom: 8 }}>{resetError}</p>}
                <button type="button" onClick={handleRequestReset} disabled={resetLoading} style={{ width: "100%", borderRadius: 10, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "11px 0", fontSize: 13.5, border: "none", marginBottom: 8, opacity: resetLoading ? 0.6 : 1 }}>
                  {resetLoading ? "Sending..." : "Send reset link"}
                </button>
              </>
            )}

            {resetStage === "confirm" && (
              <>
                <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>{resetMessage}</p>
                <input type="text" value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Reset token from email" style={{ width: "100%", borderRadius: 10, border: `1px solid ${COLORS.ink12}`, padding: "10px 12px", fontSize: 13.5, marginBottom: 10, boxSizing: "border-box" }} />
                <input type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} placeholder="New password (min. 8 characters)" style={{ width: "100%", borderRadius: 10, border: `1px solid ${COLORS.ink12}`, padding: "10px 12px", fontSize: 13.5, marginBottom: 10, boxSizing: "border-box" }} />
                {resetError && <p style={{ fontSize: 12, color: "#C0392B", marginBottom: 8 }}>{resetError}</p>}
                <button type="button" onClick={handleConfirmReset} disabled={resetLoading} style={{ width: "100%", borderRadius: 10, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "11px 0", fontSize: 13.5, border: "none", marginBottom: 8, opacity: resetLoading ? 0.6 : 1 }}>
                  {resetLoading ? "Resetting..." : "Reset password"}
                </button>
              </>
            )}

            {resetStage === "done" && (
              <>
                <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>{resetMessage}</p>
                <button type="button" onClick={closeForgotPassword} style={{ width: "100%", borderRadius: 10, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "11px 0", fontSize: 13.5, border: "none", marginBottom: 8 }}>
                  Done
                </button>
              </>
            )}

            {resetStage !== "done" && (
              <button type="button" onClick={closeForgotPassword} style={{ width: "100%", background: "none", border: "none", fontSize: 12.5, color: COLORS.ink60, padding: "6px 0" }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Transaction History Screen ---------------- */

function HistoryScreen({ transactions, totals, onReload, onSelectReceipt, showToast }) {
  const [query, setQuery] = useState("");
  const [networkFilter, setNetworkFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);

  // The display-layer type labels (Cash-In, Cash-Out, Airtime, Data)
  // need to map back to the API's transaction_type values before
  // being sent as a filter — same translation table used elsewhere,
  // kept local here since only this component needs the reverse
  // direction (display label -> API value) rather than the other way.
  const DISPLAY_TO_API_TYPE = { "Cash-In": "cash_in", "Cash-Out": "cash_out", Airtime: "airtime", Data: "data_bundle" };

  useEffect(() => {
    const handle = setTimeout(() => {
      onReload({
        query: query || undefined,
        network: networkFilter === "ALL" ? undefined : networkFilter,
        type: typeFilter === "ALL" ? undefined : DISPLAY_TO_API_TYPE[typeFilter],
      });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, networkFilter, typeFilter]);

  function handleExport(format) {
    // Real export (PDF/Excel/CSV streaming) is documented in
    // openapi.yaml's GET /transactions/export but isn't implemented
    // in the reference backend yet (see BACKEND_IMPLEMENTATION_NOTES.md
    // for what's built so far) — surfacing that honestly here rather
    // than faking a successful download.
    showToast(`Export as ${format} isn't implemented in the backend yet`);
  }

  const inputStyle = { width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "10px 14px 10px 40px", fontSize: 13.5, boxSizing: "border-box" };

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={16} color={COLORS.ink40} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, number, or transaction ID" style={inputStyle} />
      </div>

      <button onClick={() => setShowFilters((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: COLORS.green, marginBottom: 12, background: "none", border: "none" }}>
        <Filter size={14} /> {showFilters ? "Hide filters" : "Filter by network or type"}
      </button>

      {showFilters && (
        <div style={{ borderRadius: 12, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 14, marginBottom: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink50, marginBottom: 6 }}>Network</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["ALL", "MTN", "TELECEL", "AT"].map((n) => (
                <Chip key={n} active={networkFilter === n} onClick={() => setNetworkFilter(n)} label={n === "ALL" ? "All Networks" : n} />
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink50, marginBottom: 6 }}>Type</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["ALL", "Cash-In", "Cash-Out", "Airtime", "Data"].map((t) => (
                <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} label={t === "ALL" ? "All Types" : t} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard label="Results" value={totals.count} accent="neutral" />
        <StatCard label="Volume" value={money(parseFloat(totals.volume))} accent="green" />
        <StatCard label="Commission" value={money(parseFloat(totals.commission))} accent="gold" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        <ExportBtn label="PDF" onClick={() => handleExport("PDF")} />
        <ExportBtn label="Excel" onClick={() => handleExport("Excel")} />
        <ExportBtn label="CSV" onClick={() => handleExport("CSV")} />
      </div>

      {transactions.length === 0 ? (
        <EmptyState message="No transactions match your search. Try a different name, number, or filter." />
      ) : (
        <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 16 }}>
          {transactions.map((t, i) => {
            const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG["Cash-In"];
            const Icon = cfg.icon;
            return (
              <button
                key={t.id}
                onClick={() => onSelectReceipt(t)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", textAlign: "left", background: "none", border: "none", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink06}` }}
              >
                <span style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, flexShrink: 0, ...toneStyle(cfg.tone) }}>
                  <Icon size={16} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.type}</span>
                    <span style={{ height: 6, width: 6, borderRadius: 999, background: NETWORKS[t.network].dot, flexShrink: 0, display: "inline-block" }} />
                    {t.pendingSync && <RefreshCw size={10} color={COLORS.gold} style={{ flexShrink: 0 }} />}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: COLORS.ink55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.customer} · {t.date} · {t.time}</span>
                </span>
                <span style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{money(t.amount)}</span>
                  <span style={{ display: "block", fontSize: 10.5, color: COLORS.gold, fontWeight: 600 }}>+{money(t.commission)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontWeight: 600, background: active ? COLORS.green : COLORS.ink06, color: active ? COLORS.white : COLORS.ink65, border: "none" }}
    >
      {label}
    </button>
  );
}

function ExportBtn({ label, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "10px 0", fontSize: 12.5, fontWeight: 600, color: COLORS.ink70 }}>
      <Download size={13.5} /> {label}
    </button>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "40px 20px", textAlign: "center", marginBottom: 16 }}>
      <p style={{ fontSize: 13, color: COLORS.ink55 }}>{message}</p>
    </div>
  );
}

/* ---------------- Customers Screen ---------------- */

function CustomersScreen({ customers, api, onReload, showToast }) {
  const [query, setQuery] = useState("");

  // Debounced server-side search — the real /customers endpoint
  // supports a `query` param directly, so search runs against the
  // full customer list on the backend, not just whatever happens to
  // already be loaded client-side.
  useEffect(() => {
    const handle = setTimeout(() => {
      onReload(query || undefined);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function toggleFavorite(customer) {
    try {
      await api.setCustomerFavorite(customer.id, !customer.isFavorite);
      onReload(query || undefined);
    } catch (err) {
      if (err.isNetworkError) {
        showToast("Can't reach the server — try again once you're back online");
      } else {
        showToast(err.message || "Failed to update favorite");
      }
    }
  }

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={16} color={COLORS.ink40} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers by name or number"
          style={{ width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "10px 14px 10px 40px", fontSize: 13.5, boxSizing: "border-box" }}
        />
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{customers.length} customer{customers.length !== 1 ? "s" : ""}</p>

      {customers.length === 0 ? (
        <EmptyState message="No customers match that search." />
      ) : (
        <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {customers.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink06}` }}>
              <span style={{ display: "flex", height: 40, width: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.greenSoft2, color: COLORS.green, fontWeight: 700, fontSize: 14 }}>
                {(c.fullName || "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.fullName || "Unnamed customer"}</span>
                  {c.network && <span style={{ height: 6, width: 6, borderRadius: 999, background: NETWORKS[c.network] ? NETWORKS[c.network].dot : undefined, flexShrink: 0, display: "inline-block" }} />}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: COLORS.ink55 }}>
                  <Phone size={10} /> {c.phone}
                </span>
                <span style={{ display: "block", fontSize: 10.5, color: COLORS.ink40 }}>
                  {c.transactionCount} transaction{c.transactionCount !== 1 ? "s" : ""} · {money(parseFloat(c.totalVolume))} total
                  {c.lastTransactionAt ? ` · last ${c.lastTransactionAt.slice(0, 10)}` : ""}
                </span>
              </span>
              <button onClick={() => toggleFavorite(c)} aria-label="Toggle favorite" style={{ flexShrink: 0, padding: 4, background: "none", border: "none" }}>
                <Star size={18} color={c.isFavorite ? COLORS.gold : COLORS.ink40} fill={c.isFavorite ? COLORS.gold : "none"} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Commission Settings Screen ---------------- */

// The backend returns rates as a flat array of
// { network, transactionType, ratePercent, effectiveFrom } objects.
// The editing UI below is much simpler to write against a nested
// { MTN: { cash_in: 0.33, ... }, ... } shape, so these two functions
// convert between the two — only at the edges of this component,
// never changing what the API itself actually sends or expects.
const RATE_FIELD_KEYS = ["cash_in", "cash_out", "airtime", "data_bundle"];

function ratesArrayToNested(ratesArray) {
  const nested = {};
  for (const netKey of Object.keys(NETWORKS)) {
    nested[netKey] = {};
    for (const field of RATE_FIELD_KEYS) nested[netKey][field] = 0;
  }
  for (const r of ratesArray ? ratesArray : []) {
    if (!nested[r.network]) nested[r.network] = {};
    nested[r.network][r.transactionType] = r.ratePercent;
  }
  return nested;
}

function nestedRatesToUpdatePayload(nested) {
  const payload = [];
  for (const network of Object.keys(nested)) {
    for (const transactionType of RATE_FIELD_KEYS) {
      payload.push({ network, transactionType, ratePercent: nested[network][transactionType] });
    }
  }
  return payload;
}

function CommissionsScreen({ rates, api, showToast, onSaved, role, setScreen }) {
  const [draft, setDraft] = useState(() => ratesArrayToNested(rates));
  const [saving, setSaving] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const labels = { cash_in: "Cash-In", cash_out: "Cash-Out", airtime: "Airtime", data_bundle: "Data Bundle" };
  const isOwner = role === "business_owner";

  useEffect(() => {
    setDraft(ratesArrayToNested(rates));
  }, [rates]);

  useEffect(() => {
    if (!isOwner) return;
    api
      .listMyCommissionRateRequests()
      .then((data) => setMyRequests(data.filter((r) => r.status === "pending")))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  function pendingRequestFor(network, transactionType) {
    return myRequests.find((r) => r.network === network && r.transactionType === transactionType);
  }

  function updateRate(network, key, pctValue) {
    const numeric = Math.max(0, parseFloat(pctValue) || 0);
    setDraft((prev) => ({ ...prev, [network]: { ...prev[network], [key]: numeric } }));
  }

  // Business Owners can no longer update rates directly (spec section
  // 8: custom rates require Superuser approval) — "Save" now submits
  // one request per changed rate instead of one bulk PUT. Note: this
  // simple screen only edits the flat rate percentage; a rate that
  // already has an approved tiering/cap/provider-share configured
  // keeps that configuration untouched unless a more advanced request
  // is submitted through support — this screen doesn't yet expose
  // those fields for editing.
  async function handleSave() {
    const original = ratesArrayToNested(rates);
    const changed = [];
    for (const network of Object.keys(draft)) {
      for (const key of RATE_FIELD_KEYS) {
        const before = (original[network] && original[network][key]) || 0;
        const after = (draft[network] && draft[network][key]) || 0;
        if (before !== after) changed.push({ network, transactionType: key, ratePercent: after });
      }
    }

    if (changed.length === 0) {
      showToast("No changes to submit");
      return;
    }

    setSaving(true);
    try {
      for (const item of changed) {
        await api.requestCommissionRate(item);
      }
      showToast(
        changed.length === 1
          ? "Rate change submitted for Superuser review"
          : `${changed.length} rate changes submitted for Superuser review`,
      );
      const refreshed = await api.listMyCommissionRateRequests();
      setMyRequests(refreshed.filter((r) => r.status === "pending"));
      onSaved();
    } catch (err) {
      if (err.isNetworkError) {
        showToast("Can't reach the server — rate requests need a live connection");
      } else if (err.status === 403) {
        showToast("Your role doesn't have permission to request rate changes");
      } else {
        showToast(err.message || "Failed to submit rate change request");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDraft(ratesArrayToNested(rates));
    showToast("Reverted to last saved rates");
  }

  if (!rates) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: COLORS.ink55 }}>Loading commission rates...</p>
      </div>
    );
  }

  if (!isOwner) {
    // Super Admin / other roles see rates read-only here — direct
    // per-business rate overrides and reviewing custom-rate requests
    // both happen from the Approvals screen, which already has the
    // cross-organization review pattern built for exactly this kind
    // of Superuser action.
    return (
      <div style={{ padding: "16px 16px 16px" }}>
        <p style={{ fontSize: 12.5, color: COLORS.ink55, marginBottom: 16 }}>
          Rates shown are what's currently active for your branch. To review and approve custom-rate requests from businesses, use Approvals.
        </p>
        {Object.entries(NETWORKS).map(([netKey, net]) => (
          <div key={netKey} style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={{ height: 10, width: 10, borderRadius: 999, background: net.dot, display: "inline-block" }} />
              <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>{net.label}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Object.entries(labels).map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink40, marginBottom: 4 }}>{label}</label>
                  <div style={{ borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.cream, padding: "8px 10px", fontSize: 13.5, fontWeight: 700 }}>
                    {((draft[netKey] && draft[netKey][key]) || 0).toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {setScreen && (
          <button onClick={() => setScreen("approvals")} style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, background: COLORS.green, color: COLORS.white, padding: "12px 0", fontSize: 13, fontWeight: 700, border: "none" }}>
            Go to Approvals
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 16px 16px" }}>
      <p style={{ fontSize: 12.5, color: COLORS.ink55, marginBottom: 16 }}>
        Propose the commission percentage your shop earns per transaction type, by network. Changes are submitted to a Superuser for approval before they take effect.
      </p>

      {Object.entries(NETWORKS).map(([netKey, net]) => (
        <div key={netKey} style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ height: 10, width: 10, borderRadius: 999, background: net.dot, display: "inline-block" }} />
            <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>{net.label}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {Object.entries(labels).map(([key, label]) => {
              const pending = pendingRequestFor(netKey, key);
              return (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink40, marginBottom: 4 }}>{label}</label>
                  <div style={{ display: "flex", alignItems: "center", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.cream, padding: "8px 10px" }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(draft[netKey] && draft[netKey][key] !== undefined ? draft[netKey][key] : 0).toFixed(2)}
                      onChange={(e) => updateRate(netKey, key, e.target.value)}
                      style={{ width: "100%", background: "transparent", fontSize: 13.5, fontWeight: 700, border: "none", outline: "none" }}
                    />
                    <span style={{ fontSize: 12, color: COLORS.ink40, fontWeight: 600 }}>%</span>
                  </div>
                  {pending && (
                    <p style={{ fontSize: 10, color: COLORS.gold, fontWeight: 600, marginTop: 3 }}>
                      {pending.ratePercent.toFixed(2)}% pending review
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <button onClick={handleReset} disabled={saving} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: `1px solid ${COLORS.ink12}`, padding: "12px 0", fontSize: 13, fontWeight: 600, color: COLORS.ink70, background: "none" }}>
          <RotateCcw size={14} /> Reset
        </button>
        <button onClick={handleSave} disabled={saving} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, background: COLORS.green, color: COLORS.white, padding: "12px 0", fontSize: 13, fontWeight: 700, border: "none", opacity: saving ? 0.6 : 1 }}>
          <Save size={14} /> {saving ? "Submitting..." : "Submit for approval"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Support Screen ---------------- */

const FAQ_ITEMS = [
  { q: "A cash-in transaction failed but float was deducted", a: "Check Transaction History for the transaction ID. If float was deducted without a matching customer confirmation, report it under Emergency Help → Failed Transaction with the ID, and our team will reconcile within 24 hours." },
  { q: "Customer says they didn't receive cash-out money", a: "Confirm the transaction ID and customer number in History first. If the network confirms the transfer but the customer disputes it, this is a network-side delay — most resolve within minutes. Persisting issues should be reported as a Float Discrepancy." },
  { q: "My MTN float balance looks wrong", a: "Float balances update automatically after each transaction. If a manual top-up wasn't reflected, use Float Management → Float History to check it was recorded, then contact support if missing." },
  { q: "How do I reverse a wrong transaction?", a: "Reversals can't be done from the app directly for security reasons. Open a support ticket with the transaction ID and reason, and our team will process it with the network." },
];

const ISSUE_CATEGORY_MAP = {
  "Failed Transaction": "failed_transaction",
  "Wrong Amount": "wrong_amount",
  "Float Discrepancy": "float_discrepancy",
  "Airtime Failure": "airtime_failure",
  "System Error": "system_error",
};

function SupportScreen({ tickets, api, onReload, showToast }) {
  const [openFaq, setOpenFaq] = useState(null);
  const [creating, setCreating] = useState(false);
  const waMessage = encodeURIComponent("Hello Support Team, I need assistance with AgentPro Ghana.");
  const waLink = `https://wa.me/233207438990?text=${waMessage}`;

  async function reportIssue(categoryLabel) {
    setCreating(true);
    try {
      await api.createSupportTicket({
        category: ISSUE_CATEGORY_MAP[categoryLabel],
        subject: categoryLabel,
      });
      showToast(`Ticket raised: ${categoryLabel}`);
      onReload();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: "16px 16px 16px" }}>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 16, background: COLORS.green, color: COLORS.white, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 16, textDecoration: "none" }}
      >
        <span style={{ display: "flex", height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(255,255,255,0.15)" }}>
          <MessageCircle size={19} />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>Chat with Support</span>
          <span style={{ display: "block", fontSize: 11.5, color: COLORS.white70 }}>WhatsApp · +233 20 743 8990</span>
        </span>
        <ChevronRight size={16} color={COLORS.white70} />
      </a>

      <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <AlertTriangle size={15} color={COLORS.red} />
          <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>Report a Transaction Issue</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.keys(ISSUE_CATEGORY_MAP).map((cat) => (
            <button key={cat} disabled={creating} onClick={() => reportIssue(cat)} style={{ borderRadius: 12, border: `1px solid rgba(192,57,43,0.25)`, background: COLORS.redSoft, padding: "8px 10px", fontSize: 11.5, fontWeight: 600, color: COLORS.red, textAlign: "left" }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {tickets.length > 0 && (
        <>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Your Tickets</p>
          <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 16 }}>
            {tickets.map((t, i) => (
              <div key={t.id} style={{ padding: 14, borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink06}` }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.subject}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: t.status === "open" ? COLORS.gold : COLORS.green }}>{t.status}</span>
                </span>
                <span style={{ display: "block", fontSize: 11, color: COLORS.ink50, marginTop: 2 }}>{new Date(t.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Frequently Asked Questions</p>
      <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 16 }}>
        {FAQ_ITEMS.map((item, i) => (
          <button key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", textAlign: "left", padding: 14, background: "none", border: "none", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink06}` }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, paddingRight: 8 }}>{item.q}</span>
              <ChevronRight size={14} color={COLORS.ink40} style={{ flexShrink: 0, transform: openFaq === i ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            </span>
            {openFaq === i && <span style={{ display: "block", marginTop: 8, fontSize: 12.5, color: COLORS.ink60, lineHeight: 1.5 }}>{item.a}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Superuser Approvals Screen ---------------- */

function ApprovalsScreen({ organizations, onReload, commissionRequests, onReloadCommissionRequests, renewals, onReloadRenewals, hubListings, onReloadHubListings, hubPayments, onReloadHubPayments, api, showToast }) {
  const [tab, setTab] = useState("registrations"); // "registrations" | "commissions" | "renewals" | "hubListings" | "hubPayments"
  const [actionTarget, setActionTarget] = useState(null); // { org, kind: "approve" | "reject" }
  const [commissionActionTarget, setCommissionActionTarget] = useState(null); // { request, kind }
  const [renewalActionTarget, setRenewalActionTarget] = useState(null); // { payment, kind }
  const [hubListingActionTarget, setHubListingActionTarget] = useState(null); // { listing, kind }
  const [hubPaymentActionTarget, setHubPaymentActionTarget] = useState(null); // { payment, kind }
  const [submitting, setSubmitting] = useState(false);

  async function handleApprove(org, paymentReference) {
    setSubmitting(true);
    try {
      await api.approveOrganization(org.id, paymentReference);
      showToast(`${org.name} approved and activated`);
      setActionTarget(null);
      onReload();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to approve organization");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject(org, reason) {
    setSubmitting(true);
    try {
      await api.rejectOrganization(org.id, reason);
      showToast(`${org.name} registration rejected`);
      setActionTarget(null);
      onReload();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to reject organization");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveCommissionRequest(request) {
    setSubmitting(true);
    try {
      await api.approveCommissionRateRequest(request.id);
      showToast(`${request.organizationName}'s rate change approved and applied`);
      setCommissionActionTarget(null);
      onReloadCommissionRequests();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to approve rate request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRejectCommissionRequest(request, reason) {
    setSubmitting(true);
    try {
      await api.rejectCommissionRateRequest(request.id, reason);
      showToast(`${request.organizationName}'s rate request rejected`);
      setCommissionActionTarget(null);
      onReloadCommissionRequests();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to reject rate request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyRenewal(payment) {
    setSubmitting(true);
    try {
      await api.verifyRenewalPayment(payment.id);
      showToast(`${payment.organizationName}'s renewal verified — subscription extended`);
      setRenewalActionTarget(null);
      onReloadRenewals();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to verify renewal payment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRejectRenewal(payment, reason) {
    setSubmitting(true);
    try {
      await api.rejectRenewalPayment(payment.id, reason);
      showToast(`${payment.organizationName}'s renewal payment rejected`);
      setRenewalActionTarget(null);
      onReloadRenewals();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to reject renewal payment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveHubListing(listing) {
    setSubmitting(true);
    try {
      const result = await api.approveBusinessHubListingContent(listing.id);
      showToast(`"${listing.title}" approved — fee GH₵${result.feeGhs.toFixed(2)}`);
      setHubListingActionTarget(null);
      onReloadHubListings();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to approve listing");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRejectHubListing(listing, reason) {
    setSubmitting(true);
    try {
      await api.rejectBusinessHubListingContent(listing.id, reason);
      showToast(`"${listing.title}" rejected`);
      setHubListingActionTarget(null);
      onReloadHubListings();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to reject listing");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyHubPayment(payment) {
    setSubmitting(true);
    try {
      await api.verifyBusinessHubListingPayment(payment.id);
      showToast(`"${payment.listingTitle}" published`);
      setHubPaymentActionTarget(null);
      onReloadHubPayments();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to verify payment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRejectHubPayment(payment, reason) {
    setSubmitting(true);
    try {
      await api.rejectBusinessHubListingPayment(payment.id, reason);
      showToast(`Payment for "${payment.listingTitle}" rejected`);
      setHubPaymentActionTarget(null);
      onReloadHubPayments();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to reject payment");
    } finally {
      setSubmitting(false);
    }
  }

  const rateFieldLabel = { cash_in: "Cash-In", cash_out: "Cash-Out", airtime: "Airtime", data_bundle: "Data Bundle", send_money: "Send Money", bill_payment: "Bill Payment", merchant_payment: "Merchant Payment" };

  return (
    <div style={{ padding: "16px 16px 16px" }}>
      <div style={{ display: "flex", gap: 4, borderRadius: 12, background: COLORS.ink06, padding: 4, marginBottom: 16, overflowX: "auto" }}>
        <button
          type="button"
          onClick={() => setTab("registrations")}
          style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 9, border: "none", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", background: tab === "registrations" ? COLORS.white : "transparent", color: tab === "registrations" ? COLORS.ink : COLORS.ink55, boxShadow: tab === "registrations" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}
        >
          Registrations {organizations.length > 0 && `(${organizations.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab("commissions")}
          style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 9, border: "none", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", background: tab === "commissions" ? COLORS.white : "transparent", color: tab === "commissions" ? COLORS.ink : COLORS.ink55, boxShadow: tab === "commissions" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}
        >
          Rate Requests {commissionRequests.length > 0 && `(${commissionRequests.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab("renewals")}
          style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 9, border: "none", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", background: tab === "renewals" ? COLORS.white : "transparent", color: tab === "renewals" ? COLORS.ink : COLORS.ink55, boxShadow: tab === "renewals" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}
        >
          Renewals {renewals.length > 0 && `(${renewals.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab("hubListings")}
          style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 9, border: "none", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", background: tab === "hubListings" ? COLORS.white : "transparent", color: tab === "hubListings" ? COLORS.ink : COLORS.ink55, boxShadow: tab === "hubListings" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}
        >
          Hub Listings {hubListings.length > 0 && `(${hubListings.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab("hubPayments")}
          style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 9, border: "none", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", background: tab === "hubPayments" ? COLORS.white : "transparent", color: tab === "hubPayments" ? COLORS.ink : COLORS.ink55, boxShadow: tab === "hubPayments" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}
        >
          Hub Payments {hubPayments.length > 0 && `(${hubPayments.length})`}
        </button>
      </div>

      {tab === "registrations" && (
        organizations.length === 0 ? (
          <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "32px 20px", textAlign: "center" }}>
            <CheckCircle2 size={28} color={COLORS.green} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>No pending registrations</p>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginTop: 4 }}>New Business Owner sign-ups will show up here for review.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginBottom: 12 }}>
              {organizations.length} registration{organizations.length !== 1 ? "s" : ""} waiting on subscription payment confirmation.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {organizations.map((org) => (
                <div key={org.id} style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{org.name}</p>
                      <p style={{ fontSize: 11.5, color: COLORS.ink55, margin: "2px 0 0" }}>Submitted {new Date(org.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: COLORS.gold, background: COLORS.goldSoft, padding: "3px 8px", borderRadius: 999 }}>Pending</span>
                  </div>

                  <div style={{ borderRadius: 12, background: COLORS.ink06, padding: 10, marginBottom: 12 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>{org.ownerFullName}</p>
                    <p style={{ fontSize: 11.5, color: COLORS.ink60, margin: "2px 0 0" }}>{org.ownerEmail}</p>
                    <p style={{ fontSize: 11.5, color: COLORS.ink60, margin: "1px 0 0" }}>{org.ownerPhone}</p>
                    {org.businessRegNumber && (
                      <p style={{ fontSize: 11.5, color: COLORS.ink60, margin: "1px 0 0" }}>Reg. no: {org.businessRegNumber}</p>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                      onClick={() => setActionTarget({ org, kind: "reject" })}
                      style={{ borderRadius: 10, border: `1px solid rgba(192,57,43,0.25)`, background: COLORS.redSoft, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: COLORS.red }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setActionTarget({ org, kind: "approve" })}
                      style={{ borderRadius: 10, border: "none", background: COLORS.green, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: COLORS.white }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {tab === "commissions" && (
        commissionRequests.length === 0 ? (
          <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "32px 20px", textAlign: "center" }}>
            <CheckCircle2 size={28} color={COLORS.green} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>No pending rate requests</p>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginTop: 4 }}>Custom commission rate requests from businesses will show up here.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginBottom: 12 }}>
              {commissionRequests.length} custom rate request{commissionRequests.length !== 1 ? "s" : ""} awaiting review.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {commissionRequests.map((req) => (
                <div key={req.id} style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{req.organizationName}</p>
                      <p style={{ fontSize: 11.5, color: COLORS.ink55, margin: "2px 0 0" }}>Submitted {new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: COLORS.gold, background: COLORS.goldSoft, padding: "3px 8px", borderRadius: 999 }}>Pending</span>
                  </div>

                  <div style={{ borderRadius: 12, background: COLORS.ink06, padding: 10, marginBottom: 12 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>{req.network} · {rateFieldLabel[req.transactionType] || req.transactionType}</p>
                    <p style={{ fontSize: 11.5, color: COLORS.ink60, margin: "2px 0 0" }}>Requested rate: {req.ratePercent.toFixed(2)}%</p>
                    {req.thresholdAmount !== null && req.capAmount !== null && (
                      <p style={{ fontSize: 11.5, color: COLORS.ink60, margin: "1px 0 0" }}>
                        Capped at GH₵{req.capAmount.toFixed(2)} above GH₵{req.thresholdAmount.toFixed(2)}
                      </p>
                    )}
                    {req.providerSharePercent > 0 && (
                      <p style={{ fontSize: 11.5, color: COLORS.ink60, margin: "1px 0 0" }}>Provider share: {req.providerSharePercent.toFixed(2)}%</p>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                      onClick={() => setCommissionActionTarget({ request: req, kind: "reject" })}
                      style={{ borderRadius: 10, border: `1px solid rgba(192,57,43,0.25)`, background: COLORS.redSoft, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: COLORS.red }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setCommissionActionTarget({ request: req, kind: "approve" })}
                      style={{ borderRadius: 10, border: "none", background: COLORS.green, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: COLORS.white }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {tab === "renewals" && (
        renewals.length === 0 ? (
          <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "32px 20px", textAlign: "center" }}>
            <CheckCircle2 size={28} color={COLORS.green} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>No pending renewals</p>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginTop: 4 }}>Subscription renewal payments from businesses will show up here.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginBottom: 12 }}>
              {renewals.length} renewal payment{renewals.length !== 1 ? "s" : ""} awaiting verification.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {renewals.map((payment) => (
                <div key={payment.id} style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{payment.organizationName}</p>
                      <p style={{ fontSize: 11.5, color: COLORS.ink55, margin: "2px 0 0" }}>Submitted {new Date(payment.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: COLORS.gold, background: COLORS.goldSoft, padding: "3px 8px", borderRadius: 999 }}>Pending</span>
                  </div>

                  <div style={{ borderRadius: 12, background: COLORS.ink06, padding: 10, marginBottom: 12 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>Ref: {payment.paymentReference}</p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                      onClick={() => setRenewalActionTarget({ payment, kind: "reject" })}
                      style={{ borderRadius: 10, border: `1px solid rgba(192,57,43,0.25)`, background: COLORS.redSoft, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: COLORS.red }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setRenewalActionTarget({ payment, kind: "approve" })}
                      style={{ borderRadius: 10, border: "none", background: COLORS.green, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: COLORS.white }}
                    >
                      Verify
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {tab === "hubListings" && (
        hubListings.length === 0 ? (
          <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "32px 20px", textAlign: "center" }}>
            <CheckCircle2 size={28} color={COLORS.green} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>No listings awaiting review</p>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginTop: 4 }}>New Business Hub listing submissions will show up here.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginBottom: 12 }}>
              {hubListings.length} listing{hubListings.length !== 1 ? "s" : ""} awaiting content review.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {hubListings.map((listing) => (
                <div key={listing.id} style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{listing.title}</p>
                      <p style={{ fontSize: 11.5, color: COLORS.ink55, margin: "2px 0 0" }}>{listing.organizationName} · GH₵{listing.priceGhs.toFixed(2)}</p>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: COLORS.gold, background: COLORS.goldSoft, padding: "3px 8px", borderRadius: 999 }}>Pending</span>
                  </div>

                  <div style={{ borderRadius: 12, background: COLORS.ink06, padding: 10, marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: COLORS.ink70, margin: 0 }}>{listing.description}</p>
                    <p style={{ fontSize: 11.5, color: COLORS.ink55, margin: "4px 0 0" }}>{listing.category} · {listing.location}</p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                      onClick={() => setHubListingActionTarget({ listing, kind: "reject" })}
                      style={{ borderRadius: 10, border: `1px solid rgba(192,57,43,0.25)`, background: COLORS.redSoft, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: COLORS.red }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setHubListingActionTarget({ listing, kind: "approve" })}
                      style={{ borderRadius: 10, border: "none", background: COLORS.green, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: COLORS.white }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {tab === "hubPayments" && (
        hubPayments.length === 0 ? (
          <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "32px 20px", textAlign: "center" }}>
            <CheckCircle2 size={28} color={COLORS.green} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>No listing payments pending</p>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginTop: 4 }}>Publishing fee payments from approved listings will show up here.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginBottom: 12 }}>
              {hubPayments.length} listing payment{hubPayments.length !== 1 ? "s" : ""} awaiting verification.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {hubPayments.map((payment) => (
                <div key={payment.id} style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{payment.listingTitle}</p>
                      <p style={{ fontSize: 11.5, color: COLORS.ink55, margin: "2px 0 0" }}>{payment.organizationName}</p>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: COLORS.gold, background: COLORS.goldSoft, padding: "3px 8px", borderRadius: 999 }}>Pending</span>
                  </div>

                  <div style={{ borderRadius: 12, background: COLORS.ink06, padding: 10, marginBottom: 12 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>Ref: {payment.paymentReference}</p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                      onClick={() => setHubPaymentActionTarget({ payment, kind: "reject" })}
                      style={{ borderRadius: 10, border: `1px solid rgba(192,57,43,0.25)`, background: COLORS.redSoft, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: COLORS.red }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setHubPaymentActionTarget({ payment, kind: "approve" })}
                      style={{ borderRadius: 10, border: "none", background: COLORS.green, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: COLORS.white }}
                    >
                      Verify
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {actionTarget && (
        <ApprovalActionModal
          org={actionTarget.org}
          kind={actionTarget.kind}
          submitting={submitting}
          onClose={() => setActionTarget(null)}
          onApprove={(paymentReference) => handleApprove(actionTarget.org, paymentReference)}
          onReject={(reason) => handleReject(actionTarget.org, reason)}
        />
      )}

      {renewalActionTarget && (
        <RenewalActionModal
          payment={renewalActionTarget.payment}
          kind={renewalActionTarget.kind}
          submitting={submitting}
          onClose={() => setRenewalActionTarget(null)}
          onApprove={() => handleVerifyRenewal(renewalActionTarget.payment)}
          onReject={(reason) => handleRejectRenewal(renewalActionTarget.payment, reason)}
        />
      )}

      {hubListingActionTarget && (
        <HubListingActionModal
          listing={hubListingActionTarget.listing}
          kind={hubListingActionTarget.kind}
          submitting={submitting}
          onClose={() => setHubListingActionTarget(null)}
          onApprove={() => handleApproveHubListing(hubListingActionTarget.listing)}
          onReject={(reason) => handleRejectHubListing(hubListingActionTarget.listing, reason)}
        />
      )}

      {hubPaymentActionTarget && (
        <HubPaymentActionModal
          payment={hubPaymentActionTarget.payment}
          kind={hubPaymentActionTarget.kind}
          submitting={submitting}
          onClose={() => setHubPaymentActionTarget(null)}
          onApprove={() => handleVerifyHubPayment(hubPaymentActionTarget.payment)}
          onReject={(reason) => handleRejectHubPayment(hubPaymentActionTarget.payment, reason)}
        />
      )}

      {commissionActionTarget && (
        <CommissionRequestActionModal
          request={commissionActionTarget.request}
          kind={commissionActionTarget.kind}
          submitting={submitting}
          onClose={() => setCommissionActionTarget(null)}
          onApprove={() => handleApproveCommissionRequest(commissionActionTarget.request)}
          onReject={(reason) => handleRejectCommissionRequest(commissionActionTarget.request, reason)}
        />
      )}
    </div>
  );
}

function ApprovalActionModal({ org, kind, submitting, onClose, onApprove, onReject }) {
  const [paymentReference, setPaymentReference] = useState("");
  const [reason, setReason] = useState("");
  const isApprove = kind === "approve";

  const inputStyle = { width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 4 };

  function handleSubmit(e) {
    e.preventDefault();
    if (isApprove) {
      if (paymentReference.trim().length === 0) return;
      onApprove(paymentReference.trim());
    } else {
      if (reason.trim().length === 0) return;
      onReject(reason.trim());
    }
  }

  const disabled = submitting || (isApprove ? paymentReference.trim().length === 0 : reason.trim().length === 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 448, borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{isApprove ? "Approve" : "Reject"} {org.name}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        {isApprove ? (
          <>
            <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
              Confirm you've verified the MTN MoMo subscription payment, then enter the reference to activate this account.
            </p>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink55, marginBottom: 6 }}>Payment Reference</label>
            <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="e.g. MOMO-REF-998877" style={inputStyle} />
          </>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
              This registration will be marked rejected. The applicant can be told why via the reason below.
            </p>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink55, marginBottom: 6 }}>Reason</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Payment reference could not be verified" style={inputStyle} />
          </>
        )}

        <button
          type="submit"
          disabled={disabled}
          style={{ width: "100%", marginTop: 16, borderRadius: 12, background: isApprove ? COLORS.green : COLORS.red, color: COLORS.white, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none", opacity: disabled ? 0.5 : 1 }}
        >
          {submitting ? "Submitting..." : isApprove ? "Confirm Approval" : "Confirm Rejection"}
        </button>
      </form>
    </div>
  );
}

function CommissionRequestActionModal({ request, kind, submitting, onClose, onApprove, onReject }) {
  const [reason, setReason] = useState("");
  const isApprove = kind === "approve";

  function handleSubmit(e) {
    e.preventDefault();
    if (isApprove) {
      onApprove();
    } else {
      if (reason.trim().length === 0) return;
      onReject(reason.trim());
    }
  }

  const disabled = submitting || (!isApprove && reason.trim().length === 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 448, borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{isApprove ? "Approve" : "Reject"} rate change</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        {isApprove ? (
          <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
            {request.organizationName} requested {request.ratePercent.toFixed(2)}% for {request.network} {request.transactionType.replace("_", " ")}. Approving applies this to every branch of that business immediately.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
              This rate request will be marked rejected. Let {request.organizationName} know why below.
            </p>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink55, marginBottom: 6 }}>Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Rate too far below platform default"
              style={{ width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 4 }}
            />
          </>
        )}

        <button
          type="submit"
          disabled={disabled}
          style={{ width: "100%", marginTop: 16, borderRadius: 12, background: isApprove ? COLORS.green : COLORS.red, color: COLORS.white, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none", opacity: disabled ? 0.5 : 1 }}
        >
          {submitting ? "Submitting..." : isApprove ? "Confirm Approval" : "Confirm Rejection"}
        </button>
      </form>
    </div>
  );
}

function RenewalActionModal({ payment, kind, submitting, onClose, onApprove, onReject }) {
  const [reason, setReason] = useState("");
  const isApprove = kind === "approve";

  function handleSubmit(e) {
    e.preventDefault();
    if (isApprove) {
      onApprove();
    } else {
      if (reason.trim().length === 0) return;
      onReject(reason.trim());
    }
  }

  const disabled = submitting || (!isApprove && reason.trim().length === 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 448, borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{isApprove ? "Verify" : "Reject"} renewal</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        {isApprove ? (
          <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
            Confirm you've verified reference <strong>{payment.paymentReference}</strong> from {payment.organizationName} via MTN MoMo. This extends their subscription by 30 days and restores access if suspended.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
              This renewal payment will be marked rejected. Let {payment.organizationName} know why below.
            </p>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink55, marginBottom: 6 }}>Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Reference could not be verified"
              style={{ width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 4 }}
            />
          </>
        )}

        <button
          type="submit"
          disabled={disabled}
          style={{ width: "100%", marginTop: 16, borderRadius: 12, background: isApprove ? COLORS.green : COLORS.red, color: COLORS.white, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none", opacity: disabled ? 0.5 : 1 }}
        >
          {submitting ? "Submitting..." : isApprove ? "Confirm Verification" : "Confirm Rejection"}
        </button>
      </form>
    </div>
  );
}

function HubListingActionModal({ listing, kind, submitting, onClose, onApprove, onReject }) {
  const [reason, setReason] = useState("");
  const isApprove = kind === "approve";

  function handleSubmit(e) {
    e.preventDefault();
    if (isApprove) {
      onApprove();
    } else {
      if (reason.trim().length === 0) return;
      onReject(reason.trim());
    }
  }

  const disabled = submitting || (!isApprove && reason.trim().length === 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 448, borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{isApprove ? "Approve" : "Reject"} listing</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        {isApprove ? (
          <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
            "{listing.title}" will move to Pending Payment — a publishing fee is calculated automatically from the current advertisement fee rate and the listing's price (GH₵{listing.priceGhs.toFixed(2)}).
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
              This listing will be marked rejected. Let the business know why below.
            </p>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink55, marginBottom: 6 }}>Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Prohibited item category"
              style={{ width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 4 }}
            />
          </>
        )}

        <button
          type="submit"
          disabled={disabled}
          style={{ width: "100%", marginTop: 16, borderRadius: 12, background: isApprove ? COLORS.green : COLORS.red, color: COLORS.white, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none", opacity: disabled ? 0.5 : 1 }}
        >
          {submitting ? "Submitting..." : isApprove ? "Confirm Approval" : "Confirm Rejection"}
        </button>
      </form>
    </div>
  );
}

function HubPaymentActionModal({ payment, kind, submitting, onClose, onApprove, onReject }) {
  const [reason, setReason] = useState("");
  const isApprove = kind === "approve";

  function handleSubmit(e) {
    e.preventDefault();
    if (isApprove) {
      onApprove();
    } else {
      if (reason.trim().length === 0) return;
      onReject(reason.trim());
    }
  }

  const disabled = submitting || (!isApprove && reason.trim().length === 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 448, borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{isApprove ? "Verify" : "Reject"} payment</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        {isApprove ? (
          <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
            Confirm you've verified reference <strong>{payment.paymentReference}</strong> for "{payment.listingTitle}" via MTN MoMo. This publishes the listing for 30 days.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
              This payment will be marked rejected. The listing stays unpublished until a new reference is submitted.
            </p>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink55, marginBottom: 6 }}>Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Reference could not be verified"
              style={{ width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 4 }}
            />
          </>
        )}

        <button
          type="submit"
          disabled={disabled}
          style={{ width: "100%", marginTop: 16, borderRadius: 12, background: isApprove ? COLORS.green : COLORS.red, color: COLORS.white, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none", opacity: disabled ? 0.5 : 1 }}
        >
          {submitting ? "Submitting..." : isApprove ? "Confirm Verification" : "Confirm Rejection"}
        </button>
      </form>
    </div>
  );
}

/* ---------------- Subscription Screen ---------------- */

function SubscriptionScreen({ status, api, onReload, showToast }) {
  const [paymentReference, setPaymentReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api
      .listMyRenewalPayments()
      .then(setHistory)
      .catch(() => {});
  }, [api]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (paymentReference.trim().length === 0) return;
    setSubmitting(true);
    try {
      await api.submitRenewalPayment(paymentReference.trim());
      showToast("Renewal payment submitted for verification");
      setPaymentReference("");
      onReload();
      const refreshed = await api.listMyRenewalPayments();
      setHistory(refreshed);
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to submit renewal payment");
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: COLORS.ink55 }}>Loading subscription status...</p>
      </div>
    );
  }

  const statusLabel = { active: "Active", grace_period: "Grace Period", suspended: "Suspended" }[status.status] || status.status;
  const statusColor = status.status === "active" ? COLORS.green : status.status === "grace_period" ? COLORS.gold : COLORS.red;
  const statusBg = status.status === "active" ? COLORS.greenSoft : status.status === "grace_period" ? COLORS.goldSoft : COLORS.redSoft;

  return (
    <div style={{ padding: "16px 16px 16px" }}>
      <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink60, margin: 0 }}>Business Plan</p>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: statusColor, background: statusBg, padding: "4px 10px", borderRadius: 999 }}>{statusLabel}</span>
        </div>

        {status.status !== "suspended" && status.daysRemaining !== null && (
          <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            {status.daysRemaining >= 0 ? status.daysRemaining : 0} <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink55 }}>day{status.daysRemaining !== 1 ? "s" : ""} remaining</span>
          </p>
        )}
        {status.subscriptionExpiresAt && (
          <p style={{ fontSize: 11.5, color: COLORS.ink55, marginTop: 4 }}>
            {status.status === "suspended" ? "Expired" : "Renews"} on {new Date(status.subscriptionExpiresAt).toLocaleDateString()}
          </p>
        )}

        {status.status === "grace_period" && (
          <p style={{ fontSize: 12, color: "#7A5A12", background: COLORS.goldSoft, borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
            Your subscription has expired. Renew now — your account will be suspended if the grace period ({status.gracePeriodDays} days) runs out.
          </p>
        )}
        {status.status === "suspended" && (
          <p style={{ fontSize: 12, color: COLORS.red, background: COLORS.redSoft, borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
            Your account is suspended. Submit a renewal payment below to restore access — your data has been preserved.
          </p>
        )}
      </div>

      <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 18, marginBottom: 16 }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Renew subscription</p>
        <p style={{ fontSize: 12, color: COLORS.ink55, marginBottom: 14 }}>
          Pay GH₵{status.subscriptionPriceGhs.toFixed(2)} via MTN MoMo to the AgentPro Ghana merchant number, then submit the payment reference below. A Superuser will verify it and extend your subscription by 30 days.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="e.g. MOMO-REF-123456"
            style={{ width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.cream, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 12 }}
          />
          <button
            type="submit"
            disabled={submitting || paymentReference.trim().length === 0}
            style={{ width: "100%", borderRadius: 12, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "13px 0", fontSize: 13.5, border: "none", opacity: submitting || paymentReference.trim().length === 0 ? 0.5 : 1 }}
          >
            {submitting ? "Submitting..." : "Submit payment reference"}
          </button>
        </form>
      </div>

      {history.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink60, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>Payment History</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((p) => (
              <div key={p.id} style={{ borderRadius: 12, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>{p.paymentReference}</p>
                  <p style={{ fontSize: 10.5, color: COLORS.ink55, margin: "2px 0 0" }}>{new Date(p.createdAt).toLocaleDateString()}</p>
                  {p.status === "rejected" && p.rejectionReason && (
                    <p style={{ fontSize: 10.5, color: COLORS.red, margin: "2px 0 0" }}>{p.rejectionReason}</p>
                  )}
                </div>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, padding: "3px 8px", borderRadius: 999,
                  color: p.status === "verified" ? COLORS.green : p.status === "rejected" ? COLORS.red : COLORS.gold,
                  background: p.status === "verified" ? COLORS.greenSoft : p.status === "rejected" ? COLORS.redSoft : COLORS.goldSoft,
                }}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Business Hub Screen ---------------- */

function BusinessHubScreen({ api, showToast, canCreate }) {
  const [tab, setTab] = useState("browse"); // "browse" | "mine"
  const [browseListings, setBrowseListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null); // listing needing a payment reference

  async function loadBrowse() {
    try {
      const data = await api.browseBusinessHubListings();
      setBrowseListings(data);
    } catch (err) {
      if (!err.isNetworkError) showToast(err.message || "Failed to load listings");
    }
  }

  async function loadMine() {
    if (!canCreate) return;
    try {
      const data = await api.listMyBusinessHubListings();
      setMyListings(data);
    } catch (err) {
      if (!err.isNetworkError) showToast(err.message || "Failed to load your listings");
    }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBrowse(), loadMine()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreated() {
    setShowCreateModal(false);
    showToast("Listing submitted for review");
    loadMine();
  }

  async function handleSubmitPayment(listing, paymentReference) {
    try {
      await api.submitBusinessHubListingPayment(listing.id, paymentReference);
      showToast("Payment submitted for verification");
      setPaymentTarget(null);
      loadMine();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to submit payment");
    }
  }

  const statusLabel = {
    pending_review: "Pending Review", rejected: "Rejected", pending_payment: "Pending Payment",
    active: "Published", expired: "Expired", closed: "Closed",
  };
  const statusColor = (s) =>
    s === "active" ? COLORS.green : s === "rejected" || s === "closed" ? COLORS.red : COLORS.gold;
  const statusBg = (s) =>
    s === "active" ? COLORS.greenSoft : s === "rejected" || s === "closed" ? COLORS.redSoft : COLORS.goldSoft;

  return (
    <div style={{ padding: "16px 16px 16px" }}>
      <div style={{ display: "flex", borderRadius: 12, background: COLORS.ink06, padding: 4, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setTab("browse")}
          style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 700, background: tab === "browse" ? COLORS.white : "transparent", color: tab === "browse" ? COLORS.ink : COLORS.ink55, boxShadow: tab === "browse" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}
        >
          Browse
        </button>
        {canCreate && (
          <button
            type="button"
            onClick={() => setTab("mine")}
            style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 700, background: tab === "mine" ? COLORS.white : "transparent", color: tab === "mine" ? COLORS.ink : COLORS.ink55, boxShadow: tab === "mine" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}
          >
            My Listings {myListings.length > 0 && `(${myListings.length})`}
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: COLORS.ink55, textAlign: "center", padding: "40px 0" }}>Loading...</p>
      ) : tab === "browse" ? (
        browseListings.length === 0 ? (
          <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "32px 20px", textAlign: "center" }}>
            <Store size={28} color={COLORS.ink40} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>No listings yet</p>
            <p style={{ fontSize: 12, color: COLORS.ink55, marginTop: 4 }}>Published listings from businesses across the platform will show up here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {browseListings.map((listing) => (
              <div key={listing.id} style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{listing.title}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.green, margin: 0, whiteSpace: "nowrap" }}>GH₵{listing.priceGhs.toFixed(2)}</p>
                </div>
                <p style={{ fontSize: 12, color: COLORS.ink70, margin: "0 0 8px" }}>{listing.description}</p>
                <p style={{ fontSize: 11, color: COLORS.ink55, margin: 0 }}>{listing.category} · {listing.location}</p>
              </div>
            ))}
          </div>
        )
      ) : myListings.length === 0 ? (
        <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "32px 20px", textAlign: "center" }}>
          <Store size={28} color={COLORS.ink40} style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>You haven't posted any listings</p>
          <p style={{ fontSize: 12, color: COLORS.ink55, marginTop: 4 }}>Post your first listing to reach other businesses on the platform.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {myListings.map((listing) => (
            <div key={listing.id} style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{listing.title}</p>
                <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: statusColor(listing.status), background: statusBg(listing.status), padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                  {statusLabel[listing.status] || listing.status}
                </span>
              </div>
              <p style={{ fontSize: 12, color: COLORS.ink70, margin: "0 0 6px" }}>GH₵{listing.priceGhs.toFixed(2)} · {listing.category} · {listing.location}</p>

              {listing.status === "rejected" && listing.rejectionReason && (
                <p style={{ fontSize: 11.5, color: COLORS.red, background: COLORS.redSoft, borderRadius: 8, padding: "6px 8px", margin: "6px 0 0" }}>{listing.rejectionReason}</p>
              )}
              {listing.status === "pending_payment" && (
                <>
                  <p style={{ fontSize: 11.5, color: "#7A5A12", background: COLORS.goldSoft, borderRadius: 8, padding: "6px 8px", margin: "6px 0 10px" }}>
                    Approved — publishing fee GH₵{listing.feeGhs?.toFixed(2)}. Pay via MTN MoMo, then submit your reference.
                  </p>
                  <button
                    onClick={() => setPaymentTarget(listing)}
                    style={{ width: "100%", borderRadius: 10, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "10px 0", fontSize: 12.5, border: "none" }}
                  >
                    Submit payment reference
                  </button>
                </>
              )}
              {listing.status === "active" && listing.expiresAt && (
                <p style={{ fontSize: 11, color: COLORS.ink55, margin: "6px 0 0" }}>Live until {new Date(listing.expiresAt).toLocaleDateString()}</p>
              )}
              {listing.status === "expired" && (
                <>
                  <p style={{ fontSize: 11.5, color: COLORS.red, background: COLORS.redSoft, borderRadius: 8, padding: "6px 8px", margin: "6px 0 10px" }}>
                    Expired. Renew now before the grace period ends.
                  </p>
                  <button
                    onClick={() => setPaymentTarget(listing)}
                    style={{ width: "100%", borderRadius: 10, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "10px 0", fontSize: 12.5, border: "none" }}
                  >
                    Submit renewal payment
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {canCreate && tab === "mine" && (
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ position: "fixed", bottom: 84, right: 20, maxWidth: 448, borderRadius: 999, background: COLORS.gold, color: COLORS.ink, fontWeight: 700, padding: "13px 20px", fontSize: 13, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={16} /> New Listing
        </button>
      )}

      {showCreateModal && (
        <CreateListingModal api={api} onClose={() => setShowCreateModal(false)} onCreated={handleCreated} showToast={showToast} />
      )}

      {paymentTarget && (
        <SubmitListingPaymentModal
          listing={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSubmit={(ref) => handleSubmitPayment(paymentTarget, ref)}
        />
      )}
    </div>
  );
}

function CreateListingModal({ api, onClose, onCreated, showToast }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceGhs, setPriceGhs] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputStyle = { width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 10 };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !category.trim() || !location.trim() || !priceGhs) return;
    setSubmitting(true);
    try {
      await api.createBusinessHubListing({
        title: title.trim(), description: description.trim(), priceGhs: parseFloat(priceGhs),
        category: category.trim(), location: location.trim(),
      });
      onCreated();
    } catch (err) {
      if (err.isNetworkError) showToast("Can't reach the server — try again once you're back online");
      else showToast(err.message || "Failed to submit listing");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || !title.trim() || !description.trim() || !category.trim() || !location.trim() || !priceGhs;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 448, maxHeight: "85vh", overflowY: "auto", borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>New Listing</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        <input type="number" step="0.01" min="0" value={priceGhs} onChange={(e) => setPriceGhs(e.target.value)} placeholder="Price (GH₵)" style={inputStyle} />
        <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g. Electronics)" style={inputStyle} />
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (e.g. Accra)" style={inputStyle} />

        <p style={{ fontSize: 11, color: COLORS.ink55, marginBottom: 12 }}>
          Your listing goes to a Superuser for review. Once approved, you'll be shown a publishing fee to pay via MTN MoMo.
        </p>

        <button
          type="submit"
          disabled={disabled}
          style={{ width: "100%", borderRadius: 12, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none", opacity: disabled ? 0.5 : 1 }}
        >
          {submitting ? "Submitting..." : "Submit for review"}
        </button>
      </form>
    </div>
  );
}

function SubmitListingPaymentModal({ listing, onClose, onSubmit }) {
  const [paymentReference, setPaymentReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (paymentReference.trim().length === 0) return;
    setSubmitting(true);
    await onSubmit(paymentReference.trim());
    setSubmitting(false);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 448, borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Submit payment</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: COLORS.ink60, marginBottom: 14 }}>
          Pay GH₵{listing.feeGhs?.toFixed(2)} via MTN MoMo to the AgentPro Ghana merchant number, then enter the reference below.
        </p>
        <input
          type="text"
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          placeholder="e.g. MOMO-AD-123456"
          style={{ width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 12 }}
        />
        <button
          type="submit"
          disabled={submitting || paymentReference.trim().length === 0}
          style={{ width: "100%", borderRadius: 12, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none", opacity: submitting || paymentReference.trim().length === 0 ? 0.5 : 1 }}
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}

/* ---------------- Float Management Screen ---------------- */

function FloatScreen({ floatBal, floatHistory, onMove, cashOnHand }) {
  const [mode, setMode] = useState(null);

  return (
    <div style={{ padding: "16px 16px 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {Object.entries(NETWORKS).map(([key, net]) => (
          <div key={key} style={{ borderRadius: 12, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ height: 8, width: 8, borderRadius: 999, background: net.dot, display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.ink60, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{key}</span>
            </div>
            <p style={{ fontFamily: "monospace", fontSize: 13.5, fontWeight: 700, color: floatBal[key] < 3000 ? COLORS.red : COLORS.green, margin: 0 }}>{money(floatBal[key])}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <FloatActionBtn icon={ArrowLeftRight} label="Transfer" onClick={() => setMode("transfer")} />
        <FloatActionBtn icon={Plus} label="Purchase" onClick={() => setMode("purchase")} />
        <FloatActionBtn icon={Settings2} label="Adjust" onClick={() => setMode("adjustment")} />
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Float History</p>
      <div style={{ borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {floatHistory.map((f, i) => {
          const amountNum = parseFloat(f.amount);
          const createdAt = new Date(f.createdAt);
          return (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink06}` }}>
              <span style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.ink06 }}>
                <span style={{ height: 8, width: 8, borderRadius: 999, background: NETWORKS[f.network] ? NETWORKS[f.network].dot : undefined, display: "inline-block" }} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>
                  {f.movementType ? f.movementType.replace(/_/g, " ") : ""} · {NETWORKS[f.network] ? NETWORKS[f.network].label : f.network}
                </span>
                <span style={{ display: "block", fontSize: 11, color: COLORS.ink50, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.note || "—"} · {createdAt.toLocaleDateString()} {formatTime(createdAt)}
                </span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: amountNum < 0 ? COLORS.red : COLORS.green }}>
                {amountNum < 0 ? "" : "+"}{money(amountNum)}
              </span>
            </div>
          );
        })}
      </div>

      {mode && (
        <FloatMoveModal
          mode={mode}
          floatBal={floatBal}
          cashOnHand={cashOnHand}
          onClose={() => setMode(null)}
          onSubmit={(payload) => {
            onMove(payload);
            setMode(null);
          }}
        />
      )}
    </div>
  );
}

function FloatActionBtn({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, borderRadius: 16, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "14px 0", border: "none" }}>
      <span style={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.greenSoft2, color: COLORS.green }}>
        <Icon size={15} />
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function FloatMoveModal({ mode, floatBal, cashOnHand, onClose, onSubmit }) {
  const [network, setNetwork] = useState("MTN");
  const [toNetwork, setToNetwork] = useState("TELECEL");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const numericAmount = parseFloat(amount) || 0;
  const titles = { transfer: "Transfer Float", purchase: "Purchase Float", adjustment: "Adjust Float" };
  const typeMap = { transfer: "Transfer", purchase: "Purchase", adjustment: "Adjustment" };

  function handleSubmit(e) {
    e.preventDefault();
    if (mode === "adjustment" && numericAmount === 0) return;
    if (mode !== "adjustment" && numericAmount <= 0) return;
    if (mode === "transfer" && network === toNetwork) return;
    if (mode === "transfer" && floatBal[network] < numericAmount) return;
    if (mode === "purchase" && cashOnHand < numericAmount) return;

    onSubmit({ type: typeMap[mode], network, toNetwork: mode === "transfer" ? toNetwork : undefined, amount: numericAmount, note });
  }

  const insufficientTransfer = mode === "transfer" && numericAmount > floatBal[network];
  const insufficientCash = mode === "purchase" && numericAmount > cashOnHand;
  const inputStyle = { width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none" };
  const labelStyle = { display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink55, marginBottom: 6 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 448, borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{titles[mode]}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        <label style={labelStyle}>{mode === "transfer" ? "From Network" : "Network"}</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
          {Object.entries(NETWORKS).map(([key, net]) => (
            <button
              type="button"
              key={key}
              onClick={() => setNetwork(key)}
              style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", borderRadius: 12, border: `1px solid ${network === key ? COLORS.green : COLORS.ink12}`, background: network === key ? COLORS.greenSoft2 : "transparent", padding: "10px 8px", fontSize: 12, fontWeight: 600, color: network === key ? COLORS.green : COLORS.ink60 }}
            >
              <span style={{ height: 8, width: 8, borderRadius: 999, background: net.dot, display: "inline-block" }} />
              {key}
            </button>
          ))}
        </div>

        {mode === "transfer" && (
          <>
            <label style={labelStyle}>To Network</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              {Object.entries(NETWORKS).filter(([key]) => key !== network).map(([key, net]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setToNetwork(key)}
                  style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", borderRadius: 12, border: `1px solid ${toNetwork === key ? COLORS.green : COLORS.ink12}`, background: toNetwork === key ? COLORS.greenSoft2 : "transparent", padding: "10px 8px", fontSize: 12, fontWeight: 600, color: toNetwork === key ? COLORS.green : COLORS.ink60 }}
                >
                  <span style={{ height: 8, width: 8, borderRadius: 999, background: net.dot, display: "inline-block" }} />
                  {key}
                </button>
              ))}
            </div>
          </>
        )}

        <label style={labelStyle}>{mode === "adjustment" ? "Adjustment Amount (use − for decrease)" : "Amount (GH₵)"}</label>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" style={{ ...inputStyle, fontSize: 18, fontWeight: 700, marginBottom: 4 }} />

        {insufficientTransfer && <p style={{ fontSize: 11.5, color: COLORS.red, fontWeight: 600, marginBottom: 12 }}>Not enough float in {network} to transfer that amount.</p>}
        {insufficientCash && <p style={{ fontSize: 11.5, color: COLORS.red, fontWeight: 600, marginBottom: 12 }}>Not enough cash on hand to purchase that much float.</p>}
        {!insufficientTransfer && !insufficientCash && <div style={{ marginBottom: 12 }} />}

        <label style={labelStyle}>Note (optional)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Morning top-up, reconciliation" style={{ ...inputStyle, marginBottom: 16 }} />

        <button
          type="submit"
          disabled={(mode === "adjustment" ? numericAmount === 0 : numericAmount <= 0) || insufficientTransfer || insufficientCash || (mode === "transfer" && network === toNetwork)}
          style={{ width: "100%", borderRadius: 12, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none", opacity: (mode === "adjustment" ? numericAmount === 0 : numericAmount <= 0) || insufficientTransfer || insufficientCash || (mode === "transfer" && network === toNetwork) ? 0.4 : 1 }}
        >
          Confirm {titles[mode]}
        </button>
      </form>
    </div>
  );
}

/* ---------------- Transaction Modal ---------------- */

function TransactionModal({ type, rates, onClose, onSubmit }) {
  const config = {
    cashin: { title: "Cash In", verb: "Cash-In", apiType: "cash_in" },
    cashout: { title: "Cash Out", verb: "Cash-Out", apiType: "cash_out" },
    airtime: { title: "Buy Airtime", verb: "Airtime", apiType: "airtime" },
    data: { title: "Buy Data Bundle", verb: "Data", apiType: "data_bundle" },
  }[type];

  const [network, setNetwork] = useState("MTN");
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");

  const numericAmount = parseFloat(amount) || 0;
  // rates is the flat array the real API returns — find the one
  // matching this network/type combination rather than assuming the
  // old mock's nested-object shape. rates can also still be null here
  // if this modal is opened before the dashboard's first load
  // finishes; the projection is purely a nice-to-have preview, so it
  // degrades to showing nothing rather than crashing when unavailable
  // — the server computes the real, authoritative commission anyway.
  const matchingRate = (rates ? rates : []).find((r) => r.network === network && r.transactionType === config.apiType);
  const projectedCommission = matchingRate ? +(numericAmount * (matchingRate.ratePercent / 100)).toFixed(2) : null;
  const inputStyle = { width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none" };
  const labelStyle = { display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink55, marginBottom: 6 };

  function handleSubmit(e) {
    e.preventDefault();
    if (numericAmount <= 0) return;
    onSubmit({ type: config.verb, network, customer, phone, amount: numericAmount });
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 448, borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{config.title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        <label style={labelStyle}>Network</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
          {Object.entries(NETWORKS).map(([key, net]) => (
            <button
              type="button"
              key={key}
              onClick={() => setNetwork(key)}
              style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", borderRadius: 12, border: `1px solid ${network === key ? COLORS.green : COLORS.ink12}`, background: network === key ? COLORS.greenSoft2 : "transparent", padding: "10px 8px", fontSize: 12, fontWeight: 600, color: network === key ? COLORS.green : COLORS.ink60 }}
            >
              <span style={{ height: 8, width: 8, borderRadius: 999, background: net.dot, display: "inline-block" }} />
              {key}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Customer Number</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 XXX XXXX" style={{ ...inputStyle, marginBottom: 16 }} />

        <label style={labelStyle}>Customer Name (optional)</label>
        <input type="text" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in customer" style={{ ...inputStyle, marginBottom: 16 }} />

        <label style={labelStyle}>Amount (GH₵)</label>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required min="1" step="0.01" style={{ ...inputStyle, fontSize: 18, fontWeight: 700, marginBottom: 4 }} />
        {numericAmount > 0 && projectedCommission !== null ? (
          <p style={{ fontSize: 12, color: COLORS.gold, fontWeight: 600, marginBottom: 16 }}>Estimated commission: {money(projectedCommission)}</p>
        ) : (
          <div style={{ marginBottom: 16 }} />
        )}

        <button type="submit" disabled={numericAmount <= 0} style={{ width: "100%", borderRadius: 12, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none", opacity: numericAmount <= 0 ? 0.4 : 1 }}>
          Confirm {config.title}
        </button>
      </form>
    </div>
  );
}

/* ---------------- USSD Live Transaction Progress ---------------- */

function UssdProgressModal({ session, onCancel }) {
  const isTerminal = session.status === "success" || session.status === "failed";
  const isAwaitingPin = session.status === "awaiting_pin";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, borderRadius: 20, background: COLORS.cream, padding: 20, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ height: 34, width: 34, borderRadius: 999, background: isTerminal ? (session.status === "success" ? COLORS.greenSoft : COLORS.redSoft) : COLORS.goldSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {session.status === "success" ? (
              <CheckCircle2 size={18} color={COLORS.green} />
            ) : session.status === "failed" ? (
              <X size={18} color={COLORS.red} />
            ) : (
              <RefreshCw size={18} color={COLORS.gold} />
            )}
          </span>
          <div>
            <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>
              {session.status === "success" ? "Transaction Successful" : session.status === "failed" ? "Transaction Failed" : "Processing USSD Transaction"}
            </p>
            <p style={{ fontSize: 11, color: COLORS.ink55, margin: "1px 0 0" }}>{session.network} · Live network response</p>
          </div>
        </div>

        <div style={{ borderRadius: 14, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: 14, maxHeight: 260, overflowY: "auto", marginBottom: 14 }}>
          {session.log.map((line, i) => {
            const isLast = i === session.log.length - 1;
            const isPinLine = line.toLowerCase().includes("awaiting pin");
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i === session.log.length - 1 ? 0 : 8 }}>
                <span style={{ marginTop: 2, flexShrink: 0 }}>
                  {isPinLine ? (
                    <Clock size={13} color={COLORS.gold} />
                  ) : isLast && !isTerminal ? (
                    <RefreshCw size={13} color={COLORS.ink40} />
                  ) : (
                    <CheckCircle2 size={13} color={COLORS.green} />
                  )}
                </span>
                <p style={{ fontSize: 12, color: isPinLine ? "#7A5A12" : COLORS.ink70, fontWeight: isPinLine ? 700 : 500, margin: 0, lineHeight: 1.4 }}>{line}</p>
              </div>
            );
          })}
        </div>

        {isAwaitingPin && (
          <p style={{ fontSize: 11.5, color: "#7A5A12", background: COLORS.goldSoft, borderRadius: 10, padding: "8px 10px", marginBottom: 12 }}>
            Enter your Mobile Money PIN directly on your phone's network screen now. AgentPro Ghana never sees or stores your PIN.
          </p>
        )}

        {!isTerminal && (
          <button
            type="button"
            onClick={onCancel}
            style={{ width: "100%", borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: "none", padding: "11px 0", fontSize: 13, fontWeight: 600, color: COLORS.ink70 }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Receipt Modal ---------------- */

function ReceiptModal({ tx, onClose, showToast }) {
  const [showPrint, setShowPrint] = useState(false);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: "0 20px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 384, borderRadius: 20, background: COLORS.white, padding: "24px 20px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
          <span style={{ display: "flex", height: 48, width: 48, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.greenSoft2, color: COLORS.green, marginBottom: 8 }}>
            <Check size={22} />
          </span>
          <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{tx.type} Successful</p>
          <p style={{ fontSize: 12, color: COLORS.ink50, margin: 0 }}>{tx.id}</p>
          {tx.pendingSync && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, borderRadius: 999, background: "rgba(201,149,43,0.15)", color: "#9c7420", fontSize: 10.5, fontWeight: 600, padding: "3px 8px" }}>
              <RefreshCw size={10} /> Pending sync
            </span>
          )}
        </div>
        <div style={{ borderRadius: 12, background: COLORS.cream, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <ReceiptRow label="Network" value={NETWORKS[tx.network].label} />
          <ReceiptRow label="Customer" value={tx.customer} />
          <ReceiptRow label="Number" value={tx.phone} />
          <ReceiptRow label="Amount" value={money(tx.amount)} />
          <ReceiptRow label="Commission" value={money(tx.commission)} highlight />
          <ReceiptRow label="Time" value={tx.time} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <ReceiptBtn icon={MessageCircle} label="SMS" onClick={() => showToast(`Receipt SMS queued for ${tx.phone}`)} />
          <ReceiptBtn icon={Printer} label="Print" onClick={() => setShowPrint(true)} />
          <ReceiptBtn icon={Receipt} label="PDF" onClick={() => showToast("Receipt PDF generated")} />
        </div>
        <button onClick={onClose} style={{ width: "100%", marginTop: 16, borderRadius: 12, border: `1px solid ${COLORS.ink12}`, padding: "12px 0", fontSize: 13.5, fontWeight: 600, color: COLORS.ink70, background: "none" }}>
          Done
        </button>
      </div>

      {showPrint && <BluetoothPrintModal tx={tx} onClose={() => setShowPrint(false)} showToast={showToast} />}
    </div>
  );
}

function ReceiptRow({ label, value, highlight }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: COLORS.ink55 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: highlight ? COLORS.gold : COLORS.ink }}>{value}</span>
    </div>
  );
}

function ReceiptBtn({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 12, border: `1px solid ${COLORS.ink12}`, padding: "10px 0", background: "none" }}>
      <Icon size={16} color={COLORS.green} />
      <span style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.ink70 }}>{label}</span>
    </button>
  );
}

/* ---------------- Bluetooth Receipt Printing ---------------- */

const NEARBY_PRINTERS = [
  { id: "BT-7741", name: "Goojprt PT-210", signal: "strong" },
  { id: "BT-2290", name: "Xprinter XP-P200", signal: "medium" },
  { id: "BT-5512", name: "MUNBYN ITPP068", signal: "weak" },
];

function BluetoothPrintModal({ tx, onClose, showToast }) {
  // stage: scanning -> list -> connecting -> printing -> done
  const [stage, setStage] = useState("scanning");
  const [selectedPrinter, setSelectedPrinter] = useState(null);

  React.useEffect(() => {
    if (stage === "scanning") {
      const t = setTimeout(() => setStage("list"), 1400);
      return () => clearTimeout(t);
    }
  }, [stage]);

  function connectTo(printer) {
    setSelectedPrinter(printer);
    setStage("connecting");
    setTimeout(() => {
      setStage("printing");
      setTimeout(() => {
        setStage("done");
        showToast(`Printed via ${printer.name}`);
      }, 1200);
    }, 1000);
  }

  const signalLabel = { strong: "Strong signal", medium: "Medium signal", weak: "Weak signal" };
  const signalColor = { strong: COLORS.green, medium: COLORS.gold, weak: COLORS.ink40 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 384, borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box", minHeight: 320 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.greenSoft2, color: COLORS.green }}>
              <Bluetooth size={15} />
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Print Receipt</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        {stage === "scanning" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0" }}>
            <Bluetooth size={32} color={COLORS.green} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Scanning for printers...</p>
            <p style={{ fontSize: 11.5, color: COLORS.ink50, textAlign: "center" }}>Make sure your Bluetooth thermal printer is powered on and nearby</p>
          </div>
        )}

        {stage === "list" && (
          <div>
            <p style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: COLORS.ink50, marginBottom: 10 }}>
              {NEARBY_PRINTERS.length} printer{NEARBY_PRINTERS.length !== 1 ? "s" : ""} found
            </p>
            <div style={{ borderRadius: 14, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 12 }}>
              {NEARBY_PRINTERS.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => connectTo(p)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px", textAlign: "left", background: "none", border: "none", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink06}` }}
                >
                  <span style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.ink06 }}>
                    <Printer size={16} color={COLORS.ink70} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{p.name}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: signalColor[p.signal] }}>
                      <span style={{ height: 6, width: 6, borderRadius: 999, background: signalColor[p.signal], display: "inline-block" }} />
                      {signalLabel[p.signal]} · {p.id}
                    </span>
                  </span>
                  <ChevronRight size={16} color={COLORS.ink40} />
                </button>
              ))}
            </div>
            <button onClick={() => setStage("scanning")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: `1px solid ${COLORS.ink12}`, padding: "10px 0", fontSize: 12.5, fontWeight: 600, color: COLORS.ink70, background: "none" }}>
              <RefreshCw size={13} /> Scan again
            </button>
          </div>
        )}

        {stage === "connecting" && selectedPrinter && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0" }}>
            <RefreshCw size={32} color={COLORS.green} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Connecting to {selectedPrinter.name}...</p>
            <p style={{ fontSize: 11.5, color: COLORS.ink50 }}>{selectedPrinter.id}</p>
          </div>
        )}

        {stage === "printing" && selectedPrinter && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0" }}>
            <Printer size={32} color={COLORS.green} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Printing receipt {tx.id}...</p>
            <p style={{ fontSize: 11.5, color: COLORS.ink50 }}>via {selectedPrinter.name}</p>
          </div>
        )}

        {stage === "done" && selectedPrinter && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0" }}>
            <span style={{ display: "flex", height: 48, width: 48, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.greenSoft2, color: COLORS.green, marginBottom: 12 }}>
              <CheckCircle2 size={24} />
            </span>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Receipt printed</p>
            <p style={{ fontSize: 11.5, color: COLORS.ink50, marginBottom: 20 }}>via {selectedPrinter.name}</p>
            <button onClick={onClose} style={{ width: "100%", borderRadius: 12, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "12px 0", fontSize: 13.5, border: "none" }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Alerts Panel ---------------- */

function AlertsPanel({ lowFloatNetworks, onClose, onTopUp }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 448, borderRadius: "24px 24px 0 0", background: COLORS.cream, padding: "20px 20px 28px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Alerts</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        {lowFloatNetworks.length === 0 ? (
          <div style={{ borderRadius: 12, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "32px 16px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: COLORS.ink55 }}>No alerts right now. Float levels are healthy.</p>
          </div>
        ) : (
          <div style={{ borderRadius: 12, background: COLORS.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 16 }}>
            {lowFloatNetworks.map(([key, value], i) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink06}` }}>
                <span style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.redSoft, color: COLORS.red }}>
                  <AlertTriangle size={16} />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{NETWORKS[key].label} float is low</span>
                  <span style={{ display: "block", fontSize: 11.5, color: COLORS.ink55 }}>Current balance: {money(value)} · below GH₵3,000 threshold</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {lowFloatNetworks.length > 0 && (
          <button onClick={onTopUp} style={{ width: "100%", borderRadius: 12, background: COLORS.green, color: COLORS.white, fontWeight: 700, padding: "14px 0", fontSize: 14.5, border: "none" }}>
            Request Float Top-Up
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- AI Assistant ---------------- */

function answerAssistantQuery(query, ctx) {
  const q = query.toLowerCase();
  const { floatBal, totalFloat, cashOnHand, todayStats, transactions } = ctx;

  if (q.includes("profit") || q.includes("today")) {
    return `Today's commission so far is ${money(todayStats.commission)} across ${todayStats.count} transactions, with total transaction volume of ${money(todayStats.volume)}.`;
  }
  if (q.includes("mtn") && q.includes("float")) return `MTN float balance is currently ${money(floatBal.MTN)}.`;
  if (q.includes("telecel") && q.includes("float")) return `Telecel float balance is currently ${money(floatBal.TELECEL)}.`;
  if ((q.includes("at ") || q.includes("airteltigo") || q.startsWith("at")) && q.includes("float")) return `AT Money float balance is currently ${money(floatBal.AT)}.`;
  if (q.includes("total float") || (q.includes("float") && !q.includes("history"))) {
    return `Total float across all networks is ${money(totalFloat)} — MTN ${money(floatBal.MTN)}, Telecel ${money(floatBal.TELECEL)}, AT ${money(floatBal.AT)}.`;
  }
  if (q.includes("cash-out") || q.includes("cash out")) {
    const cashOuts = transactions.filter((t) => t.type === "Cash-Out");
    const total = cashOuts.reduce((s, t) => s + t.amount, 0);
    return `There ${cashOuts.length === 1 ? "is" : "are"} ${cashOuts.length} cash-out transaction${cashOuts.length === 1 ? "" : "s"} on record, totalling ${money(total)}.`;
  }
  if (q.includes("cash-in") || q.includes("cash in")) {
    const cashIns = transactions.filter((t) => t.type === "Cash-In");
    const total = cashIns.reduce((s, t) => s + t.amount, 0);
    return `There ${cashIns.length === 1 ? "is" : "are"} ${cashIns.length} cash-in transaction${cashIns.length === 1 ? "" : "s"} on record, totalling ${money(total)}.`;
  }
  if (q.includes("weekly") && q.includes("commission")) {
    const total = transactions.reduce((s, t) => s + t.commission, 0);
    return `Commission across all recorded transactions (this demo's full history) is ${money(total)}. A production build would scope this to the last 7 days precisely.`;
  }
  if (q.includes("which network") || (q.includes("network") && q.includes("revenue"))) {
    const byNetwork = {};
    for (const t of transactions) byNetwork[t.network] = (byNetwork[t.network] || 0) + t.commission;
    const top = Object.entries(byNetwork).sort((a, b) => b[1] - a[1])[0];
    return top ? `${NETWORKS[top[0]].label} has generated the most commission, at ${money(top[1])}.` : "No transaction data yet.";
  }
  if (q.includes("customer") && (q.includes("often") || q.includes("most") || q.includes("frequent"))) {
    const counts = {};
    for (const t of transactions) counts[t.customer] = (counts[t.customer] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]} transacts most often, with ${top[1]} recorded transactions.` : "No customer data yet.";
  }
  if (q.includes("cash on hand") || q.includes("cash position")) return `Cash on hand right now is ${money(cashOnHand)}.`;
  return "I can answer questions about today's profit, float balances, cash-ins and cash-outs, commissions, top networks, and frequent customers. Try asking one of those, or tap a suggestion below.";
}

const ASSISTANT_SUGGESTIONS = [
  "What is today's profit?",
  "How much MTN float is left?",
  "Show today's cash-outs",
  "Which network generated the most revenue?",
  "Which customers transact most often?",
];

function AssistantModal({ onClose, context }) {
  const [messages, setMessages] = useState([{ from: "bot", text: "Hi! Ask me about your float, commissions, or customers." }]);
  const [input, setInput] = useState("");

  function send(text) {
    const q = (text !== undefined ? text : input).trim();
    if (!q) return;
    const answer = answerAssistantQuery(q, context);
    setMessages((prev) => [...prev, { from: "user", text: q }, { from: "bot", text: answer }]);
    setInput("");
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 448, borderRadius: "24px 24px 0 0", background: COLORS.cream, display: "flex", flexDirection: "column", height: "78vh", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 999, background: COLORS.gold }}>
              <Sparkles size={15} color={COLORS.ink} />
            </span>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: 0 }}>AgentPro Assistant</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ borderRadius: 999, background: COLORS.ink08, padding: 6, border: "none" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "85%", borderRadius: 16, padding: "10px 14px", fontSize: 13, lineHeight: 1.5, background: m.from === "user" ? COLORS.green : COLORS.white, color: m.from === "user" ? COLORS.white : COLORS.ink, boxShadow: m.from === "user" ? "none" : "0 1px 3px rgba(0,0,0,0.06)" }}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "0 20px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
          {ASSISTANT_SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} style={{ flexShrink: 0, borderRadius: 999, background: COLORS.white, border: `1px solid ${COLORS.ink12}`, padding: "6px 12px", fontSize: 11.5, fontWeight: 600, color: COLORS.ink70 }}>
              {s}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px 20px" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about float, profit, customers..."
            style={{ flex: 1, borderRadius: 12, border: `1px solid ${COLORS.ink12}`, background: COLORS.white, padding: "10px 14px", fontSize: 13.5, outline: "none", boxSizing: "border-box" }}
          />
          <button type="submit" style={{ display: "flex", height: 40, width: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 12, background: COLORS.green, color: COLORS.white, border: "none" }}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
