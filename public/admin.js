const $ = selector => document.querySelector(selector);
const authPanel = $("#authPanel");
const dashboard = $("#dashboard");
const authMessage = $("#authMessage");
const loginEmail = $("#loginEmail");
const logoutButton = $("#logoutButton");
let dashboardData = null;

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = `message ${type}`.trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function currentDeviceSession() {
  try {
    return JSON.parse(localStorage.getItem("listening-well-state-v1") || "null")?.sessionId || "";
  } catch { return ""; }
}

function stat(label, value) {
  const item = document.createElement("div");
  item.className = "stat";
  item.innerHTML = `<strong>${Number(value || 0).toLocaleString()}</strong><span>${escapeHtml(label)}</span>`;
  return item;
}

function renderHealth(health) {
  const labels = {
    database: "Supabase",
    stripeSecret: "Stripe key",
    webhookSecret: "Webhook secret",
    copperPrice: "Copper price",
    moonPrice: "Moon price",
    keeperPrice: "Keeper price",
    stripeCatalog: "Stripe catalog matches",
    openai: "OpenAI"
  };
  const list = $("#healthList");
  list.replaceChildren();
  for (const [key, label] of Object.entries(labels)) {
    const item = document.createElement("span");
    item.className = `health-item ${health[key] ? "good" : ""}`;
    item.innerHTML = `<i></i>${escapeHtml(label)}`;
    list.append(item);
  }
}


function renderStripeCatalog(catalog) {
  const list = $("#stripeCatalog");
  list.replaceChildren();
  const labels = { copper_10: "10 Copper", moon_30: "30 Moon", keeper_monthly: "Well Keeper" };
  for (const row of catalog?.rows || []) {
    const item = document.createElement("article");
    item.className = `catalog-item ${row.aligned ? "aligned" : "misaligned"}`;
    const amount = Number(row.unitAmount || row.expectedAmount || 0) / 100;
    const cadence = row.recurring ? ` / ${row.recurring}` : " one-time";
    item.innerHTML = `<div><strong>${escapeHtml(labels[row.key] || row.key)}</strong><span>${escapeHtml(amount ? `$${amount.toFixed(2)}${cadence}` : "Not configured")}</span></div><b>${row.aligned ? "Matched" : "Check"}</b><small>${escapeHtml(row.reason || "")}</small>`;
    list.append(item);
  }
  if (!catalog?.rows?.length) {
    const empty = document.createElement("p");
    empty.className = "message";
    empty.textContent = "Stripe catalog information is unavailable.";
    list.append(empty);
  }
}

function renderBars(values) {
  const list = $("#coinUsage");
  list.replaceChildren();
  const entries = ["daily", "copper", "moon", "safety"].map(key => [key, Number(values[key] || 0)]);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  for (const [key, value] of entries) {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `<span>${escapeHtml(key)}</span><div class="bar"><i style="width:${(value / max) * 100}%"></i></div><b>${value}</b>`;
    list.append(row);
  }
}

async function grant(sessionId, coinType, credits, messageElement = $("#grantMessage")) {
  if (!sessionId) return setMessage(messageElement, "No Listening Well session is stored on this device.", "error");
  setMessage(messageElement, `Adding ${credits} ${coinType} pennies…`);
  try {
    await api("/api/admin/grant", { method: "POST", body: JSON.stringify({ sessionId, coinType, credits }) });
    setMessage(messageElement, `${credits} ${coinType} pennies added. Refresh the main well to see them.`, "success");
    await loadDashboard();
  } catch (error) {
    setMessage(messageElement, error.message, "error");
  }
}

function renderProfiles(profiles) {
  const body = $("#profileRows");
  body.replaceChildren();
  for (const profile of profiles) {
    const row = document.createElement("tr");
    const shortId = `${profile.session_id.slice(0, 8)}…`;
    row.innerHTML = `<td><code title="${escapeHtml(profile.session_id)}">${escapeHtml(shortId)}</code></td><td>${escapeHtml(formatDate(profile.last_seen))}</td><td>${Number(profile.total_wishes || 0)}</td><td>${Number(profile.copper_credits || 0)}</td><td>${Number(profile.moon_credits || 0)}</td><td>${profile.subscription_active ? "Yes" : "No"}</td><td><div class="mini-actions"><button class="copper-action" data-row-grant="copper">+C</button><button class="moon-action" data-row-grant="moon">+M</button></div></td>`;
    row.querySelector('[data-row-grant="copper"]').addEventListener("click", () => grant(profile.session_id, "copper", 10));
    row.querySelector('[data-row-grant="moon"]').addEventListener("click", () => grant(profile.session_id, "moon", 10));
    body.append(row);
  }
}

function renderEvents(target, events, type) {
  const list = $(target);
  list.replaceChildren();
  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "message";
    empty.textContent = type === "webhook" ? "No Stripe webhook has been recorded yet." : "No credits have been delivered yet.";
    list.append(empty);
    return;
  }
  for (const event of events) {
    const item = document.createElement("div");
    item.className = "event";
    if (type === "webhook") {
      item.innerHTML = `<div class="event-top"><strong>${escapeHtml(event.event_type)}</strong><span class="status-${escapeHtml(event.status)}">${escapeHtml(event.status)}</span></div><p>${escapeHtml(formatDate(event.updated_at))}${event.detail ? ` · ${escapeHtml(event.detail)}` : ""}</p>`;
    } else {
      item.innerHTML = `<div class="event-top"><strong>${Number(event.credits || 0)} ${escapeHtml(event.coin_type)} pennies</strong><span>${escapeHtml(event.pack || event.source)}</span></div><p>${escapeHtml(formatDate(event.created_at))} · ${escapeHtml(String(event.session_id || "").slice(0, 8))}…</p>`;
    }
    list.append(item);
  }
}

function renderDashboard(data) {
  dashboardData = data;
  renderHealth(data.health);
  renderStripeCatalog(data.stripeCatalog);
  const stats = $("#statGrid");
  stats.replaceChildren(
    stat("Profiles", data.totals.profiles),
    stat("All wishes", data.totals.wishes),
    stat("Wishes 24h", data.totals.wishes24h),
    stat("Wishes 7d", data.totals.wishes7d),
    stat("Copper held", data.totals.copperOutstanding),
    stat("Moon held", data.totals.moonOutstanding)
  );
  renderBars(data.coinUsage);
  renderProfiles(data.profiles);
  renderEvents("#webhookList", data.webhookEvents, "webhook");
  renderEvents("#creditList", data.creditEvents, "credit");
  const session = currentDeviceSession();
  $("#deviceSession").textContent = session || "No Listening Well session found on this device";
}

async function loadDashboard() {
  const data = await api("/api/admin/dashboard");
  renderDashboard(data);
}

async function boot() {
  try {
    const me = await api("/api/admin/me");
    loginEmail.value = me.email || "altifygenerator@gmail.com";
    if (me.authenticated) {
      authPanel.hidden = true;
      dashboard.hidden = false;
      logoutButton.hidden = false;
      await loadDashboard();
    }
  } catch (error) {
    setMessage(authMessage, error.message, "error");
  }
}

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  setMessage(authMessage, "Signing in…");
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ email: loginEmail.value, password: $("#loginPassword").value }) });
    location.reload();
  } catch (error) { setMessage(authMessage, error.message, "error"); }
});

$("#setupForm").addEventListener("submit", async event => {
  event.preventDefault();
  setMessage(authMessage, "Creating the admin account…");
  try {
    await api("/api/admin/setup", { method: "POST", body: JSON.stringify({ email: loginEmail.value, password: $("#setupPassword").value, setupToken: $("#setupToken").value }) });
    location.reload();
  } catch (error) { setMessage(authMessage, error.message, "error"); }
});

logoutButton.addEventListener("click", async () => { await api("/api/admin/logout", { method: "POST", body: "{}" }); location.reload(); });
$("#refreshButton").addEventListener("click", loadDashboard);
document.querySelectorAll("[data-grant]").forEach(button => button.addEventListener("click", () => grant(currentDeviceSession(), button.dataset.grant, Number(button.dataset.credits))));

boot();
