const STORAGE_KEY = "listening-well-state-v1";
const SHARE_NAME = "Throw a Penny";
const TOSS_DURATION_MS = 2150;
const SPLASH_TRIGGER_MS = 1810;
const MIN_RITUAL_DURATION_MS = 3500;
const PURCHASE_CONFIRMATION_DELAYS_MS = [700, 1400, 2600, 4200, 6500, 9000];
const CLIENT_VERSION = "1.7.5";

const memoryStorage = new Map();

function browserStorageIsPersistent() {
  try {
    const key = "__throwapenny_storage_test__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStorage.has(key) ? memoryStorage.get(key) : null;
  }
}

function storageSet(key, value) {
  memoryStorage.set(key, String(value));
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Memory storage keeps the experience functional in strict privacy modes.
  }
}

function storageRemove(key) {
  memoryStorage.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing else to clear.
  }
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0,4).join("")}-${hex.slice(4,6).join("")}-${hex.slice(6,8).join("")}-${hex.slice(8,10).join("")}-${hex.slice(10).join("")}`;
}

function validSessionId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const elements = {
  appShell: $("#appShell"),
  wishInput: $("#wishInput"),
  wishNudge: $("#wishNudge"),
  wishClarifier: $("#wishClarifier"),
  wishClarifierQuestion: $("#wishClarifierQuestion"),
  wishClarifierInput: $("#wishClarifierInput"),
  clarifierButton: $("#clarifierButton"),
  clarifierSkipButton: $("#clarifierSkipButton"),
  characterCount: $("#characterCount"),
  readyButton: $("#readyButton"),
  wishComposer: $("#wishComposer"),
  introCopy: $("#introCopy"),
  coinDock: $("#coinDock"),
  penny: $("#penny"),
  coinChoice: $("#coinChoice"),
  coinChoiceToggle: $("#coinChoiceToggle"),
  coinChoiceButtons: $$('[data-coin-choice]'),
  coinInstruction: $("#coinInstruction"),
  dailyChoiceCount: $("#dailyChoiceCount"),
  copperChoiceCount: $("#copperChoiceCount"),
  moonChoiceCount: $("#moonChoiceCount"),
  editWishButton: $("#editWishButton"),
  listeningState: $("#listeningState"),
  waterSurface: $("#waterSurface"),
  responseCard: $("#responseCard"),
  answerText: $("#answerText"),
  meaningText: $("#meaningText"),
  responseInsight: $("#responseInsight"),
  responseMore: $("#responseMore"),
  nextStepText: $("#nextStepText"),
  moonNoteCard: $("#moonNoteCard"),
  moonNoteText: $("#moonNoteText"),
  responseModeLabel: $("#responseModeLabel"),
  upgradeOffer: $("#upgradeOffer"),
  upgradeEyebrow: $("#upgradeEyebrow"),
  upgradeTitle: $("#upgradeTitle"),
  upgradeText: $("#upgradeText"),
  upgradeButton: $("#upgradeButton"),
  premiumUpgradeActions: $("#premiumUpgradeActions"),
  upgradeCopperButton: $("#upgradeCopperButton"),
  upgradeMoonButton: $("#upgradeMoonButton"),
  giftFromResponseButton: $("#giftFromResponseButton"),
  followUpModal: $("#followUpModal"),
  followUpKicker: $("#followUpKicker"),
  followUpEcho: $("#followUpEcho"),
  followUpInput: $("#followUpInput"),
  followDirectionButtons: $$('[data-follow-direction]'),
  continueFreeButton: $("#continueFreeButton"),
  freeFollowUpAction: $("#freeFollowUpAction"),
  premiumFollowUpActions: $("#premiumFollowUpActions"),
  followUpNote: $("#followUpNote"),
  continueCopperButton: $("#continueCopperButton"),
  continueMoonButton: $("#continueMoonButton"),
  followCopperBalance: $("#followCopperBalance"),
  followMoonBalance: $("#followMoonBalance"),
  closeResponse: $("#closeResponse"),
  newWishButton: $("#newWishButton"),
  sealButton: $("#sealButton"),
  shareButton: $("#shareButton"),
  journalButton: $("#journalButton"),
  journalDrawer: $("#journalDrawer"),
  wishList: $("#wishList"),
  journalEmpty: $("#journalEmpty"),
  totalRipples: $("#totalRipples"),
  daysVisited: $("#daysVisited"),
  gardenDepth: $("#gardenDepth"),
  journalDot: $("#journalDot"),
  returnCard: $("#returnCard"),
  returnCardText: $("#returnCardText"),
  revisitButton: $("#revisitButton"),
  monthlyButton: $("#monthlyButton"),
  monthlyCard: $("#monthlyCard"),
  reflectionHistory: $("#reflectionHistory"),
  reflectionList: $("#reflectionList"),
  pennyButton: $("#pennyButton"),
  pennyCount: $("#pennyCount"),
  walletDaily: $("#walletDaily"),
  walletCopper: $("#walletCopper"),
  walletMoon: $("#walletMoon"),
  pennyModal: $("#pennyModal"),
  paymentNote: $("#paymentNote"),
  manageKeeperButton: $("#manageKeeperButton"),
  giftButton: $("#giftButton"),
  sealModal: $("#sealModal"),
  shareModal: $("#shareModal"),
  shareCanvas: $("#shareCanvas"),
  copyShareButton: $("#copyShareButton"),
  nativeShareButton: $("#nativeShareButton"),
  toast: $("#toast"),
  garden: $("#garden"),
  fireflies: $("#fireflies"),
  stars: $("#stars"),
  installButton: $("#installButton"),
  exportButton: $("#exportButton"),
  clearButton: $("#clearButton"),
  homeButton: $("#homeButton")
};

const runtime = {
  currentWish: "",
  currentRecord: null,
  pendingCoinSource: null,
  busy: false,
  config: { ai: false, database: false, payments: false, version: null },
  configReady: false,
  persistentStorage: browserStorageIsPersistent(),
  installPrompt: null,
  pointerStart: null,
  toastTimer: null,
  returnedWish: null,
  followUpContext: null,
  followUpDraft: null,
  coinChoicesExpanded: false
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dailyDateKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthReflection() {
  const current = monthKey();
  return state.monthlyReflections.find(record => (record.monthKey || monthKey(record.createdAt)) === current) || null;
}

function freshState() {
  return {
    version: 4,
    sessionId: createId(),
    createdAt: new Date().toISOString(),
    dailyRefreshDate: dailyDateKey(),
    dailyAvailable: true,
    copperCredits: 0,
    moonCredits: 0,
    selectedCoin: "daily",
    subscriptionActive: false,
    visitDays: [localDateKey()],
    wishes: [],
    monthlyReflections: [],
    conversionEvents: [],
    pendingFollowUp: null,
    settings: { sound: true, gentleReminders: true }
  };
}


const RETIRED_RESPONSE_PATTERNS = [
  /a wish is often a direction before it is a destination/i,
  /the water cannot choose for you/i,
  /the part of you that already (?:knows|leans)/i,
  /permission,? clarity,? or relief/i,
  /make this wish five percent more real/i,
  /the part i can influence is/i
];

function isRetiredGenericResponse(record) {
  const text = [record?.response?.answer, record?.response?.meaning, record?.response?.nextStep]
    .filter(Boolean)
    .join(" ");
  return RETIRED_RESPONSE_PATTERNS.some(pattern => pattern.test(text));
}

function responsePayloadIsRetired(data) {
  const text = [data?.answer, data?.meaning, data?.nextStep].filter(Boolean).join(" ");
  return RETIRED_RESPONSE_PATTERNS.some(pattern => pattern.test(text));
}

function loadState() {
  try {
    const parsed = JSON.parse(storageGet(STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") return freshState();

    const base = freshState();
    const sessionValid = validSessionId(parsed.sessionId);
    const migratedCopper = Number(parsed.copperCredits ?? parsed.paidCredits ?? 0);
    const safeWishes = Array.isArray(parsed.wishes)
      ? parsed.wishes.filter(record => record && typeof record.wish === "string" && typeof record.response?.answer === "string" && !isRetiredGenericResponse(record))
      : [];
    const safeReflections = Array.isArray(parsed.monthlyReflections)
      ? parsed.monthlyReflections.filter(record => record && typeof record.response?.answer === "string" && !isRetiredGenericResponse(record))
      : [];

    return {
      ...base,
      ...parsed,
      version: 4,
      // A malformed legacy/local session should not leave the whole app permanently broken.
      // Keep the readable journal, start a clean anonymous session, and let cloud sync rebuild trusted balances.
      sessionId: sessionValid ? parsed.sessionId : base.sessionId,
      copperCredits: sessionValid ? Math.max(0, migratedCopper) : 0,
      moonCredits: sessionValid ? Math.max(0, Number(parsed.moonCredits || 0)) : 0,
      selectedCoin: ["daily", "copper", "moon"].includes(parsed.selectedCoin) ? parsed.selectedCoin : "daily",
      visitDays: Array.isArray(parsed.visitDays) ? parsed.visitDays.filter(Boolean).slice(-400) : [],
      wishes: safeWishes,
      monthlyReflections: safeReflections,
      conversionEvents: Array.isArray(parsed.conversionEvents) ? parsed.conversionEvents.slice(-120) : [],
      pendingFollowUp: sessionValid && parsed.pendingFollowUp && typeof parsed.pendingFollowUp === "object" ? parsed.pendingFollowUp : null
    };
  } catch {
    return freshState();
  }
}

let state = loadState();

function saveState() {
  storageSet(STORAGE_KEY, JSON.stringify(state));
}

function refreshDailyState() {
  const today = dailyDateKey();
  if (state.dailyRefreshDate !== today) {
    state.dailyRefreshDate = today;
    state.dailyAvailable = true;
  }
  if (!state.visitDays.includes(today)) state.visitDays.push(today);
  state.visitDays = [...new Set(state.visitDays)].slice(-400);
  saveState();
}

function coinBalance(source) {
  if (source === "daily") return state.dailyAvailable ? 1 : 0;
  if (source === "copper") return Math.max(0, Number(state.copperCredits || 0));
  if (source === "moon") return Math.max(0, Number(state.moonCredits || 0));
  return 0;
}

function availablePennies() {
  return coinBalance("daily") + coinBalance("copper") + coinBalance("moon");
}

function wishNeedsMoreDetail(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  const words = text.replace(/[’']/g, "").split(/\s+/).filter(Boolean);
  if (words.length <= 3) return true;
  const generic = /^(?:i\s+)?wish(?:\s+(?:i|we)\s+(?:was|were|had|could\s+be|could\s+have))?\s*(?:for\s+)?(?:happ(?:y|iness)|love|money|success|peace|health|luck|a\s+better\s+life|things\s+were\s+better)[.!?]*$/i;
  return generic.test(text);
}

function isFreeFollowUpRecord(record) {
  return Boolean(record && record.responseKind === "follow_up" && (record.followUpTier === "free" || record.coinSource === "free"));
}

function hasFreeFollowUp(record) {
  if (!record) return false;
  if (isFreeFollowUpRecord(record)) return true;
  return state.wishes.some(item =>
    item.responseKind === "follow_up"
    && (item.followUpTier === "free" || item.coinSource === "free")
    && (item.parentId === record.id || (record.cloudId && item.parentCloudId === record.cloudId))
  );
}

function hasAnyFreeFollowUp() {
  return state.wishes.some(item => isFreeFollowUpRecord(item));
}

function freeFollowUpAvailable(record) {
  return Boolean(
    record
    && record.responseKind !== "follow_up"
    && record.coinSource === "daily"
    && !record.response?.safety
    && !record.isMonthly
    && !hasAnyFreeFollowUp()
  );
}

function initialWishCount() {
  return state.wishes.filter(record => record.responseKind !== "follow_up" && !record.isMonthly).length;
}

function defaultCoinSource() {
  if (!runtime.followUpContext && state.dailyAvailable) return "daily";
  if (coinBalance(state.selectedCoin) > 0) return state.selectedCoin;
  if (state.copperCredits > 0) return "copper";
  if (state.moonCredits > 0) return "moon";
  if (state.dailyAvailable) return "daily";
  return null;
}

function consumeLocalCoin(source) {
  if (source === "daily" && state.dailyAvailable) state.dailyAvailable = false;
  else if (source === "copper" && state.copperCredits > 0) state.copperCredits -= 1;
  else if (source === "moon" && state.moonCredits > 0) state.moonCredits -= 1;
  else return null;
  state.selectedCoin = source;
  saveState();
  return source;
}

function restoreLocalCoin(source) {
  if (source === "daily") state.dailyAvailable = true;
  if (source === "copper") state.copperCredits += 1;
  if (source === "moon") state.moonCredits += 1;
  saveState();
}

function showToast(message, duration = 2600) {
  clearTimeout(runtime.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  runtime.toastTimer = setTimeout(() => elements.toast.classList.remove("show"), duration);
}

function trackEvent(name, details = {}) {
  const event = {
    name,
    details,
    at: new Date().toISOString()
  };
  state.conversionEvents.push(event);
  state.conversionEvents = state.conversionEvents.slice(-120);
  saveState();
  try {
    const data = Object.fromEntries(
      Object.entries(details)
        .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
        .slice(0, 2)
    );
    window.va?.("event", { name, data });
  } catch {
    // Analytics is optional. Local events still make launch testing inspectable.
  }
}

function formatDate(value, includeYear = false) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {})
  }).format(date);
}

function isUnlocked(record) {
  return !record.sealedUntil || new Date(record.sealedUntil).getTime() <= Date.now();
}

function getGardenLevel(count = state.wishes.length) {
  if (count >= 12) return 4;
  if (count >= 6) return 3;
  if (count >= 3) return 2;
  if (count >= 1) return 1;
  return 0;
}

function depthLabel(level) {
  return ["Still", "Stirring", "Rooted", "Glowing", "Deep"][level] || "Still";
}

function updateUI() {
  refreshDailyState();
  elements.appShell.classList.toggle("first-visit", state.wishes.length === 0);
  elements.pennyCount.textContent = String(availablePennies());
  if (elements.walletDaily) elements.walletDaily.textContent = state.dailyAvailable ? "1" : "0";
  if (elements.walletCopper) elements.walletCopper.textContent = String(Math.max(0, Number(state.copperCredits || 0)));
  if (elements.walletMoon) elements.walletMoon.textContent = String(Math.max(0, Number(state.moonCredits || 0)));
  if (elements.dailyChoiceCount) elements.dailyChoiceCount.textContent = state.dailyAvailable ? "1 ready" : "used today";
  if (elements.copperChoiceCount) elements.copperChoiceCount.textContent = `${Math.max(0, Number(state.copperCredits || 0))} ready`;
  if (elements.moonChoiceCount) elements.moonChoiceCount.textContent = `${Math.max(0, Number(state.moonCredits || 0))} ready`;
  if (elements.followCopperBalance) elements.followCopperBalance.textContent = state.copperCredits > 0 ? `${state.copperCredits} ready` : "$2.99 · 10 Copper";
  if (elements.followMoonBalance) elements.followMoonBalance.textContent = state.moonCredits > 0 ? `${state.moonCredits} ready` : "$4.99 · 30 Moon";
  if (elements.manageKeeperButton) elements.manageKeeperButton.hidden = !state.subscriptionActive;
  if (runtime.installPrompt) elements.installButton.hidden = state.wishes.length < 1;
  elements.totalRipples.textContent = String(state.wishes.length);
  elements.daysVisited.textContent = String(state.visitDays.length);
  const level = getGardenLevel();
  elements.gardenDepth.textContent = depthLabel(level);
  elements.garden.className = `garden level-${level}`;
  const thisMonth = currentMonthReflection();
  const rootWishCount = initialWishCount();
  if (rootWishCount < 3) {
    elements.monthlyButton.disabled = true;
    elements.monthlyButton.textContent = `Needs ${3 - rootWishCount} more`;
  } else if (thisMonth) {
    elements.monthlyButton.disabled = true;
    elements.monthlyButton.textContent = "Echo gathered";
  } else {
    elements.monthlyButton.disabled = false;
    elements.monthlyButton.textContent = "Hear the echo";
  }
  renderJournal();
  updateReturnPrompt();
}

function seedSky() {
  const starFragment = document.createDocumentFragment();
  for (let i = 0; i < 28; i += 1) {
    const star = document.createElement("i");
    star.className = "star";
    star.style.left = `${(i * 37 + 11) % 98}%`;
    star.style.top = `${(i * 19 + (i % 5) * 7) % 78}%`;
    star.style.setProperty("--duration", `${2.7 + (i % 7) * .55}s`);
    star.style.setProperty("--delay", `${-(i % 9) * .43}s`);
    if (i % 11 === 0) {
      star.style.width = "3px";
      star.style.height = "3px";
    }
    starFragment.append(star);
  }
  elements.stars.append(starFragment);

  const fireflyFragment = document.createDocumentFragment();
  for (let i = 0; i < 6; i += 1) {
    const fly = document.createElement("i");
    fly.className = "firefly";
    fly.style.left = `${8 + ((i * 29) % 84)}%`;
    fly.style.top = `${25 + ((i * 31) % 58)}%`;
    fly.style.setProperty("--dur", `${4 + (i % 6) * .8}s`);
    fly.style.setProperty("--delay", `${-(i % 8) * .67}s`);
    fireflyFragment.append(fly);
  }
  elements.fireflies.append(fireflyFragment);
}

function openOverlay(element) {
  element.classList.add("open");
  element.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
}

function closeOverlay(element) {
  element.classList.remove("open");
  element.setAttribute("aria-hidden", "true");
  if (!$(".modal.open") && !$(".drawer.open")) document.body.classList.remove("locked");
}

function coinCopy(source) {
  if (source === "moon") return { front: "MOON WATER", back: "LOOK DEEPER", symbol: "☾" };
  if (source === "copper") return { front: "DEEP WATER", back: "GO DEEPER", symbol: "1" };
  return { front: "ONE WISH", back: "LISTEN", symbol: "1" };
}

function setCoinVisual(source) {
  runtime.pendingCoinSource = source;
  state.selectedCoin = source || state.selectedCoin;
  elements.penny.classList.remove("deep-water-penny", "copper-penny", "moon-penny");
  elements.appShell.classList.remove("deep-water-mode", "copper-water-mode", "moon-water-mode");
  if (source === "copper") {
    elements.penny.classList.add("copper-penny");
    elements.appShell.classList.add("copper-water-mode");
  }
  if (source === "moon") {
    elements.penny.classList.add("moon-penny");
    elements.appShell.classList.add("moon-water-mode");
  }
  const copy = coinCopy(source);
  const frontBig = elements.penny.querySelector(".penny-front b");
  const backBig = elements.penny.querySelector(".penny-back b");
  const frontSmall = elements.penny.querySelector(".penny-front small");
  const backSmall = elements.penny.querySelector(".penny-back small");
  if (frontBig) frontBig.textContent = copy.symbol;
  if (backBig) backBig.textContent = source === "moon" ? "W" : "W";
  if (frontSmall) frontSmall.textContent = copy.front;
  if (backSmall) backSmall.textContent = copy.back;
  for (const button of elements.coinChoiceButtons) {
    const choice = button.dataset.coinChoice;
    const count = coinBalance(choice);
    button.disabled = count < 1;
    button.classList.toggle("selected", choice === source);
    button.setAttribute("aria-pressed", String(choice === source));
  }
  saveState();
}

function renderCoinChoices({ forceCollapsed = false } = {}) {
  const availableTypes = ["daily", "copper", "moon"].filter(type => coinBalance(type) > 0);
  const canChoose = availableTypes.length > 1 && !runtime.followUpContext;
  if (forceCollapsed || !canChoose) runtime.coinChoicesExpanded = false;
  elements.coinChoiceToggle.hidden = !canChoose;
  elements.coinChoiceToggle.setAttribute("aria-expanded", String(runtime.coinChoicesExpanded));
  elements.coinChoice.hidden = !canChoose || !runtime.coinChoicesExpanded;
  elements.coinChoice.classList.toggle("is-collapsed", !runtime.coinChoicesExpanded);
  for (const button of elements.coinChoiceButtons) button.hidden = coinBalance(button.dataset.coinChoice) < 1;
}

function resetExperience({ preserveText = false } = {}) {
  runtime.busy = false;
  runtime.currentRecord = null;
  runtime.followUpContext = null;
  runtime.followUpDraft = null;
  runtime.wishClarification = "";
  runtime.wishCheckSkipped = false;
  runtime.coinChoicesExpanded = false;
  runtime.currentWish = preserveText ? elements.wishInput.value.trim() : "";
  elements.responseCard.hidden = true;
  elements.responseCard.classList.remove("deep-water-response", "copper-water-response", "moon-water-response");
  elements.upgradeOffer.hidden = true;
  elements.responseInsight.open = false;
  elements.responseMore.open = false;
  elements.listeningState.hidden = true;
  elements.coinDock.hidden = true;
  elements.wishComposer.hidden = false;
  elements.introCopy.hidden = false;
  elements.introCopy.style.opacity = "";
  elements.introCopy.style.transform = "";
  elements.waterSurface.classList.remove("listening", "active", "splashing");
  elements.appShell.classList.remove("tossing", "responded", "crisis-mode", "deep-water-mode", "copper-water-mode", "moon-water-mode");
  elements.penny.classList.remove("deep-water-penny", "copper-penny", "moon-penny");
  runtime.pendingCoinSource = null;
  elements.coinInstruction.textContent = "Tap the penny or flick it toward the water";
  renderCoinChoices({ forceCollapsed: true });
  if (!preserveText) {
    elements.wishInput.value = "";
    elements.characterCount.textContent = "0 / 600";
  }
  if (elements.wishNudge) elements.wishNudge.hidden = true;
  if (elements.wishClarifier) elements.wishClarifier.hidden = true;
  if (elements.wishClarifierInput) elements.wishClarifierInput.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => elements.wishInput.focus({ preventScroll: true }), 220);
}

function showWishClarifier(question, { source = "local" } = {}) {
  if (elements.wishNudge) elements.wishNudge.hidden = true;
  if (elements.wishClarifierQuestion) elements.wishClarifierQuestion.textContent = question || "What would actually be different if this wish came true?";
  if (elements.wishClarifier) elements.wishClarifier.hidden = false;
  if (elements.wishClarifierInput) {
    elements.wishClarifierInput.value = runtime.wishClarification || "";
    setTimeout(() => elements.wishClarifierInput.focus(), 80);
  }
  trackEvent("wish_clarifier_shown", { source });
}

async function checkWishReadiness(wish) {
  if (!runtime.config.ai) {
    return wishNeedsMoreDetail(wish)
      ? { ready: false, question: "What would actually be different in your life if this wish came true?", reason: "missing_context" }
      : { ready: true, question: "", reason: "specific_enough" };
  }
  const response = await fetch("/api/wish-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wish, sessionId: state.sessionId })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The well could not check that wish yet.");
  return data;
}

function proceedToPenny(wish) {
  if (elements.wishNudge) elements.wishNudge.hidden = true;
  if (elements.wishClarifier) elements.wishClarifier.hidden = true;
  if (!availablePennies()) {
    openOverlay(elements.pennyModal);
    return;
  }
  runtime.currentWish = wish;
  runtime.followUpContext = null;
  elements.coinInstruction.textContent = "Tap the penny or flick it toward the water";
  const source = defaultCoinSource();
  setCoinVisual(source);
  runtime.coinChoicesExpanded = false;
  renderCoinChoices({ forceCollapsed: true });
  trackEvent("wish_ready", { coin: source, wishNumber: state.wishes.length + 1 });
  elements.wishComposer.hidden = true;
  elements.coinDock.hidden = false;
  elements.introCopy.style.opacity = ".32";
  elements.introCopy.style.transform = "scale(.96)";
  if (navigator.vibrate) navigator.vibrate(18);
}

async function preparePenny() {
  if (!runtime.configReady) {
    showToast("The well is still waking up. Give it a second and try again.");
    return;
  }
  const wish = elements.wishInput.value.trim();
  if (wish.length < 3) {
    showToast("Give the well a little more to listen to.");
    elements.wishInput.focus();
    return;
  }
  if (runtime.wishClarification || runtime.wishCheckSkipped) {
    proceedToPenny(wish);
    return;
  }

  // Detailed wishes should move straight into the ritual. The readiness check is
  // reserved for short/borderline inputs so better personalization does not add
  // a noticeable extra pause to every visit.
  const wordCount = wish.replace(/[’']/g, "").split(/\s+/).filter(Boolean).length;
  if (wordCount > 8 && !wishNeedsMoreDetail(wish)) {
    trackEvent("wish_readiness_skipped", { reason: "already_specific" });
    proceedToPenny(wish);
    return;
  }

  const originalLabel = elements.readyButton.textContent;
  elements.readyButton.disabled = true;
  elements.readyButton.textContent = "Making sure the well has enough…";
  try {
    const readiness = await checkWishReadiness(wish);
    trackEvent("wish_readiness_checked", { ready: Boolean(readiness.ready), reason: readiness.reason || "unknown" });
    if (!readiness.ready) {
      showWishClarifier(readiness.question, { source: runtime.config.ai ? "ai" : "local" });
      return;
    }
    proceedToPenny(wish);
  } catch (error) {
    // A preflight check should never stop the ritual. The full response still has its own quality gate.
    console.warn("Wish readiness check unavailable:", error);
    if (wishNeedsMoreDetail(wish)) {
      showWishClarifier("What would actually be different in your life if this wish came true?", { source: "fallback" });
      return;
    }
    proceedToPenny(wish);
  } finally {
    elements.readyButton.disabled = false;
    elements.readyButton.textContent = originalLabel;
  }
}

function acceptWishClarification() {
  const detail = String(elements.wishClarifierInput?.value || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (detail.length < 2) {
    showToast("Give the well one useful detail, or use the wish as written.");
    elements.wishClarifierInput?.focus();
    return;
  }
  runtime.wishClarification = detail;
  runtime.wishCheckSkipped = false;
  trackEvent("wish_clarifier_answered", { lengthBucket: detail.length < 40 ? "short" : "detailed" });
  proceedToPenny(elements.wishInput.value.trim());
}

function skipWishClarification() {
  runtime.wishClarification = "";
  runtime.wishCheckSkipped = true;
  trackEvent("wish_clarifier_skipped");
  proceedToPenny(elements.wishInput.value.trim());
}

function editWish() {
  trackEvent("wish_edit_clicked");
  elements.coinDock.hidden = true;
  elements.wishComposer.hidden = false;
  elements.introCopy.style.opacity = "";
  elements.introCopy.style.transform = "";
  elements.wishInput.focus();
}

function cloneFlyingPenny() {
  const rect = elements.penny.getBoundingClientRect();
  const flyer = document.createElement("div");
  const coinClass = runtime.pendingCoinSource === "moon" ? " moon-penny" : runtime.pendingCoinSource === "copper" ? " copper-penny" : "";
  flyer.className = `flying-penny${coinClass}`;
  flyer.style.left = `${rect.left}px`;
  flyer.style.top = `${rect.top}px`;
  const copy = coinCopy(runtime.pendingCoinSource);
  flyer.innerHTML = `<span class="penny-face penny-front"><b>${copy.symbol}</b><small>${copy.front}</small></span>`;
  document.body.append(flyer);
  return { flyer, rect };
}

async function animateToss() {
  const { flyer, rect } = cloneFlyingPenny();
  const waterRect = elements.waterSurface.getBoundingClientRect();
  const destinationX = waterRect.left + waterRect.width / 2 - (rect.left + rect.width / 2);
  const destinationY = waterRect.top + waterRect.height / 2 - (rect.top + rect.height / 2);
  const arcHeight = Math.max(150, Math.abs(destinationY) * .44);
  const isFollowUpToss = Boolean(runtime.followUpContext);
  const tossDuration = isFollowUpToss
    ? (runtime.pendingCoinSource === "moon" ? 1600 : 1120)
    : TOSS_DURATION_MS;
  const splashDelay = isFollowUpToss
    ? (runtime.pendingCoinSource === "moon" ? 1360 : 910)
    : SPLASH_TRIGGER_MS;

  const animation = flyer.animate([
    { transform: "translate3d(0,0,0) rotateZ(0deg) scale(1)", opacity: 1, offset: 0 },
    { transform: `translate3d(${destinationX * .45}px,${destinationY * .34 - arcHeight}px,0) rotateZ(360deg) scale(.82)`, opacity: 1, offset: .52 },
    { transform: `translate3d(${destinationX}px,${destinationY}px,0) rotateZ(810deg) scale(.18)`, opacity: .9, offset: .91 },
    { transform: `translate3d(${destinationX}px,${destinationY + 14}px,0) rotateZ(900deg) scale(.05)`, opacity: 0, offset: 1 }
  ], {
    duration: tossDuration,
    easing: "cubic-bezier(.18,.68,.22,1)",
    fill: "forwards"
  });

  setTimeout(() => {
    elements.waterSurface.classList.add("splashing", "active");
    if (navigator.vibrate) navigator.vibrate([24, 30, 45]);
    setTimeout(() => elements.waterSurface.classList.remove("splashing"), 1550);
  }, splashDelay);

  await animation.finished.catch(() => {});
  flyer.remove();
}

function priorContext(excludeId = null) {
  return state.wishes
    .filter(record => !record.response?.safety && !record.isMonthly && record.responseKind !== "follow_up" && record.id !== excludeId)
    .slice(-3)
    .map(record => ({
      theme: String(record.response?.theme || "uncertainty").slice(0, 40),
      wish: String(record.wish || "").replace(/\s+/g, " ").trim().slice(0, 220)
    }));
}

function clientSafetyResponse(wish) {
  const text = String(wish || "").toLowerCase().replace(/\s+/g, " ");
  if (/(kill myself|end my life|take my own life|want to die|don[’']?t want to live|suicid(?:e|al)|hurt myself|harm myself|self[- ]?harm|better off dead)/i.test(text)) {
    return {
      answer: "I am glad you put this into words. This is too important to leave with a wishing well alone, and you deserve immediate support from a real person who can stay with you through this moment.",
      meaning: "The priority right now is not interpreting the wish. It is helping you get through the next few minutes safely and with someone else involved.",
      nextStep: "Move away from anything you could use to hurt yourself, contact emergency services or a crisis service where you live, and tell a trusted person clearly that you need them with you now.",
      shareLine: "You do not have to carry the next few minutes alone.",
      followUpQuestion: "Who can be physically or verbally present with you right now?",
      mood: "steady",
      theme: "safety",
      safety: "crisis",
      source: "offline-safety",
      coinSource: "safety"
    };
  }
  if (/(kill (?:him|her|them|someone)|hurt (?:him|her|them|someone)|shoot (?:him|her|them|someone)|stab (?:him|her|them|someone)|make (?:him|her|them|someone) pay|attack (?:him|her|them|someone))/i.test(text)) {
    return {
      answer: "The well cannot help plan harm or turn anger into an instruction. It can hold the feeling long enough for you to choose distance, time, and a safer next move.",
      meaning: "Strong anger can narrow the world to one action. Creating space before acting protects you and everyone around you.",
      nextStep: "Step away from the person or situation, put down anything that could be used to hurt someone, and contact a trusted person or emergency support if the danger is immediate.",
      shareLine: "A pause can be the strongest choice in a dangerous moment.",
      followUpQuestion: "What would create the most immediate distance from the situation?",
      mood: "steady",
      theme: "safety",
      safety: "harm",
      source: "offline-safety",
      coinSource: "safety"
    };
  }
  return null;
}

async function requestWishResponse(wish, coinIntent, followUp = null) {
  const response = await fetch("/api/wish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: state.sessionId,
      clientVersion: CLIENT_VERSION,
      wish,
      // Keep everyday answers anchored to the wish in front of the person.
      // Moon is the only mode allowed to notice a relevant pattern from recent saved wishes.
      priorContext: coinIntent === "moon" ? priorContext(followUp?.parentId || null) : [],
      clarification: followUp ? "" : runtime.wishClarification,
      coinIntent,
      followUp
    })
  });
  const data = await response.json().catch(() => ({}));
  if (response.ok && data.responseVersion && data.responseVersion !== CLIENT_VERSION) {
    const error = new Error("A newer version of the well is ready. Refresh once and try your wish again.");
    error.code = "APP_UPDATE_REQUIRED";
    throw error;
  }
  if (response.ok && (!data.responseVersion || responsePayloadIsRetired(data))) {
    const error = new Error("The well caught an outdated response. Your penny was not used. Refresh once and try again.");
    error.code = "STALE_RESPONSE";
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.error || "The well went quiet.");
    error.code = data.code;
    throw error;
  }
  return data;
}

async function tossPenny() {
  if (runtime.busy) return;
  if (!runtime.currentWish) return preparePenny();
  if (!availablePennies()) return openOverlay(elements.pennyModal);

  runtime.busy = true;
  const requestedCoinSource = runtime.pendingCoinSource || defaultCoinSource();
  const localCoinSource = consumeLocalCoin(requestedCoinSource);
  if (!localCoinSource) {
    runtime.busy = false;
    updateUI();
    openOverlay(elements.pennyModal);
    return;
  }
  runtime.pendingCoinSource = localCoinSource;
  trackEvent("penny_tossed", { coin: localCoinSource, wishNumber: state.wishes.length + 1 });
  updateUI();
  elements.coinDock.hidden = true;
  elements.appShell.classList.add("tossing");

  const started = Date.now();
  const followUpContext = runtime.followUpContext ? { ...runtime.followUpContext } : null;
  const responsePromise = requestWishResponse(runtime.currentWish, localCoinSource, followUpContext).catch(error => {
    // Safety guidance may still render if the network is unavailable, but normal
    // wishes never fall back to canned or generic responses.
    const safety = clientSafetyResponse(runtime.currentWish);
    if (safety) return safety;
    throw error;
  });

  await animateToss();
  elements.listeningState.hidden = false;
  elements.waterSurface.classList.add("listening");

  try {
    const response = await responsePromise;
    const ritualMinimum = followUpContext
      ? (localCoinSource === "moon" ? 2200 : 1500)
      : MIN_RITUAL_DURATION_MS;
    const remaining = Math.max(0, ritualMinimum - (Date.now() - started));
    if (remaining) await new Promise(resolve => setTimeout(resolve, remaining));
    if (response.safety) {
      restoreLocalCoin(localCoinSource);
      updateUI();
    }
    const record = {
      id: createId(),
      cloudId: response.wishId || null,
      wish: runtime.currentWish,
      clarification: followUpContext?.originalClarification || runtime.wishClarification || "",
      responseKind: followUpContext ? "follow_up" : "wish",
      parentId: followUpContext?.parentId || null,
      parentCloudId: followUpContext?.parentCloudId || null,
      followUpPrompt: followUpContext?.question || null,
      followUpDirection: followUpContext?.direction || null,
      followUpTier: followUpContext ? (response.followUpTier || "paid") : null,
      response: {
        answer: response.answer,
        meaning: response.meaning,
        nextStep: response.nextStep,
        shareLine: response.shareLine,
        followUpQuestion: response.followUpQuestion,
        moonNote: response.moonNote || null,
        mood: response.mood,
        theme: response.theme || "uncertainty",
        safety: response.safety || null,
        source: response.source || "well"
      },
      coinSource: response.safety
        ? "safety"
        : (response.coinSource && response.coinSource !== "local" ? response.coinSource : localCoinSource),
      createdAt: new Date().toISOString(),
      sealedUntil: null,
      revisitedAt: null,
      sharedAt: null
    };
    state.wishes.push(record);
    trackEvent(followUpContext ? "follow_up_completed" : "wish_completed", {
      coin: record.coinSource,
      theme: record.response.theme,
      wishNumber: state.wishes.length
    });
    state.pendingFollowUp = null;
    saveState();
    showResponse(record);
    runtime.followUpContext = null;
    updateUI();
  } catch (error) {
    restoreLocalCoin(localCoinSource);
    if (error.code === "NO_COIN" && runtime.config.database) {
      await syncCloudState();
    } else {
      updateUI();
    }
    elements.listeningState.hidden = true;
    elements.waterSurface.classList.remove("listening", "active");
    elements.appShell.classList.remove("tossing");
    elements.coinDock.hidden = false;
    showToast(error.code === "NO_COIN"
      ? "That penny was already used. Your well has been refreshed."
      : (error.message || "The well went quiet. Your penny was returned."), 3800);
    if (error.code === "NO_COIN" && !availablePennies()) setTimeout(() => openOverlay(elements.pennyModal), 420);
    runtime.busy = false;
  }
}

function showResponse(record) {
  runtime.currentRecord = record;
  runtime.currentWish = record.wish || "";
  const isFollowUp = record.responseKind === "follow_up";
  const isFreeContinuation = isFreeFollowUpRecord(record);
  const isMoon = record.coinSource === "moon" || record.response.source?.includes("moon");
  const isCopper = record.coinSource === "copper" || (!isMoon && record.response.source?.includes("deep"));
  const isPremium = isCopper || isMoon;
  elements.answerText.textContent = record.response.answer;
  elements.meaningText.textContent = record.response.meaning;
  elements.nextStepText.textContent = record.response.nextStep;
  if (elements.moonNoteText) elements.moonNoteText.textContent = record.response.moonNote || "";
  if (elements.moonNoteCard) elements.moonNoteCard.hidden = !(isMoon && record.response.moonNote);
  elements.responseModeLabel.textContent = isFreeContinuation
    ? "Your follow-up answer"
    : isFollowUp
      ? (isMoon ? "Your Moon Water answer" : "Your deeper answer")
      : isMoon ? "Your Moon Water answer" : isCopper ? "Your Deep Water answer" : "The well’s answer";
  elements.responseInsight.open = Boolean(isPremium || isFollowUp);
  elements.responseMore.open = false;
  elements.responseCard.classList.toggle("deep-water-response", isPremium);
  elements.responseCard.classList.toggle("copper-water-response", isCopper);
  elements.responseCard.classList.toggle("moon-water-response", isMoon);
  elements.appShell.classList.toggle("deep-water-mode", isPremium);
  elements.appShell.classList.toggle("copper-water-mode", isCopper);
  elements.appShell.classList.toggle("moon-water-mode", isMoon);
  elements.listeningState.hidden = true;
  elements.responseCard.hidden = false;
  elements.introCopy.hidden = true;
  elements.waterSurface.classList.remove("listening");
  elements.waterSurface.classList.add("active");
  elements.appShell.classList.remove("tossing");
  elements.appShell.classList.add("responded");
  const safetyResponse = Boolean(record.response.safety);
  elements.appShell.classList.toggle("crisis-mode", record.response.safety === "crisis");
  elements.sealButton.hidden = Boolean(record.isMonthly) || safetyResponse;
  elements.shareButton.hidden = safetyResponse;
  elements.shareButton.parentElement.hidden = safetyResponse;
  elements.responseMore.hidden = safetyResponse;

  const canUseFreeFollowUp = freeFollowUpAvailable(record);
  const rootFreeAlreadyUsed = record.responseKind !== "follow_up" && record.coinSource === "daily" && hasFreeFollowUp(record);
  const freeProofUsed = hasAnyFreeFollowUp();
  const showPremiumContinuation = isFreeContinuation || rootFreeAlreadyUsed || (!isFollowUp && record.coinSource === "daily" && freeProofUsed);
  const showUpgrade = !record.isMonthly && !safetyResponse && !isPremium && (canUseFreeFollowUp || showPremiumContinuation);
  elements.upgradeOffer.hidden = !showUpgrade;

  if (elements.premiumUpgradeActions) elements.premiumUpgradeActions.hidden = true;
  if (elements.upgradeButton) elements.upgradeButton.hidden = false;
  if (showUpgrade && canUseFreeFollowUp) {
    if (elements.upgradeEyebrow) elements.upgradeEyebrow.textContent = "One more question";
    elements.upgradeTitle.textContent = "Your first follow-up is free";
    elements.upgradeText.textContent = "Ask what came up while you were reading. The well stays with this same wish instead of starting over.";
    elements.upgradeButton.textContent = "Ask my free follow-up";
    trackEvent("free_follow_up_offer_viewed", { theme: record.response.theme, firstWish: state.wishes.length <= 1 });
  } else if (showUpgrade) {
    if (elements.upgradeEyebrow) elements.upgradeEyebrow.textContent = "Stay with this wish";
    elements.upgradeTitle.textContent = "What would actually help next?";
    elements.upgradeText.textContent = "Copper is for a practical next move. Moon is for the wish you want to look at from another angle.";
    elements.upgradeButton.hidden = true;
    if (elements.premiumUpgradeActions) elements.premiumUpgradeActions.hidden = false;
    trackEvent("premium_follow_up_offer_viewed", { theme: record.response.theme, source: isFreeContinuation ? "free_follow_up" : "saved_wish" });
  }

  runtime.busy = false;
  setTimeout(() => elements.responseCard.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
}

function createWishItem(record) {
  const unlocked = isUnlocked(record);
  const returned = unlocked && Date.now() - new Date(record.createdAt).getTime() >= 6.5 * 86400000 && !record.revisitedAt;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `wish-item${unlocked ? "" : " sealed"}`;
  button.dataset.id = record.id;
  button.setAttribute("aria-label", unlocked ? `Open wish from ${formatDate(record.createdAt)}` : `Sealed wish returning ${formatDate(record.sealedUntil)}`);

  const top = document.createElement("div");
  top.className = "wish-item-top";
  const date = document.createElement("span");
  date.textContent = formatDate(record.createdAt, new Date(record.createdAt).getFullYear() !== new Date().getFullYear());
  const status = document.createElement("span");
  status.textContent = unlocked ? (returned ? "Ready to revisit" : record.response?.theme || record.response?.mood || "Saved") : `Returns ${formatDate(record.sealedUntil, true)}`;
  if (returned) status.className = "wish-item-returned";
  if (record.responseKind === "follow_up") {
    const followLabel = document.createElement("span");
    followLabel.className = "follow-up-label";
    followLabel.textContent = "Follow-up";
    status.append(followLabel);
  }
  top.append(date, status);

  const wishText = document.createElement("p");
  wishText.textContent = unlocked ? record.wish : "This wish is resting beneath the water.";
  const echo = document.createElement("p");
  echo.className = "echo-preview";
  echo.textContent = unlocked ? record.response.shareLine : "Its words will return when the seal opens.";
  button.append(top, wishText, echo);
  return button;
}

function createReflectionItem(record) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "reflection-item";
  button.dataset.reflectionId = record.id;
  button.setAttribute("aria-label", `Open monthly echo from ${formatDate(record.createdAt, true)}`);

  const top = document.createElement("div");
  top.className = "reflection-item-top";
  const date = document.createElement("span");
  date.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(record.createdAt));
  const label = document.createElement("strong");
  label.textContent = "Monthly echo";
  top.append(date, label);

  const preview = document.createElement("p");
  preview.textContent = record.response?.shareLine || record.response?.answer || "A quiet pattern surfaced here.";
  button.append(top, preview);
  return button;
}

function renderJournal() {
  elements.wishList.replaceChildren();
  const records = [...state.wishes].reverse();
  elements.journalEmpty.hidden = records.length > 0;
  for (const record of records) elements.wishList.append(createWishItem(record));

  elements.reflectionList.replaceChildren();
  const reflections = [...state.monthlyReflections].reverse();
  elements.reflectionHistory.hidden = reflections.length === 0;
  for (const record of reflections) elements.reflectionList.append(createReflectionItem(record));
}

function updateReturnPrompt() {
  const returned = [...state.wishes].reverse().find(record => isUnlocked(record) && Date.now() - new Date(record.createdAt).getTime() >= 6.5 * 86400000 && !record.revisitedAt);
  runtime.returnedWish = returned || null;
  elements.returnCard.hidden = !returned;
  elements.journalDot.hidden = !returned;
  if (returned) {
    const age = Math.max(1, Math.floor((Date.now() - new Date(returned.createdAt).getTime()) / 86400000));
    elements.returnCardText.textContent = `A wish from ${age} day${age === 1 ? "" : "s"} ago is ready to be heard again.`;
  }
}

function openJournal() {
  updateUI();
  openOverlay(elements.journalDrawer);
}

function openSavedWish(record, { revisit = false } = {}) {
  if (!isUnlocked(record)) {
    showToast(`This wish returns on ${formatDate(record.sealedUntil, true)}.`);
    return;
  }
  if (revisit) {
    record.revisitedAt = new Date().toISOString();
    saveState();
  }
  closeOverlay(elements.journalDrawer);
  showResponse(record);
  updateUI();
}

function openSealModal() {
  if (!runtime.currentRecord || runtime.currentRecord.isMonthly) return;
  openOverlay(elements.sealModal);
}

async function sealCurrentWish(days) {
  if (!runtime.currentRecord) return;
  const until = new Date(Date.now() + Number(days) * 86400000);
  runtime.currentRecord.sealedUntil = until.toISOString();
  saveState();
  closeOverlay(elements.sealModal);
  showToast(`The wish will return on ${formatDate(until, true)}.`);
  updateUI();

  if (runtime.currentRecord.cloudId && runtime.config.database) {
    fetch("/api/seal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, wishId: runtime.currentRecord.cloudId, sealedUntil: until.toISOString() })
    }).catch(() => {});
  }
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 8) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const usedWords = lines.join(" ").split(/\s+/).length;
  if (usedWords < words.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:]?$/, "")}…`;
  lines.forEach((textLine, index) => ctx.fillText(textLine, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function renderShareCard(record) {
  const canvas = elements.shareCanvas;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#07150f");
  background.addColorStop(.58, "#0d2b20");
  background.addColorStop(1, "#06120d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const halo = ctx.createRadialGradient(810, 210, 10, 810, 210, 280);
  halo.addColorStop(0, "rgba(239,228,185,.24)");
  halo.addColorStop(1, "rgba(239,228,185,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(520, 0, 560, 500);

  ctx.fillStyle = "#e8dfbb";
  ctx.beginPath();
  ctx.arc(830, 185, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(96,105,84,.13)";
  ctx.beginPath(); ctx.arc(800, 155, 18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(857, 214, 26, 0, Math.PI * 2); ctx.fill();

  for (let i = 0; i < 34; i += 1) {
    const x = 45 + ((i * 137) % 980);
    const y = 60 + ((i * 83) % 430);
    ctx.fillStyle = `rgba(242,235,203,${.2 + (i % 4) * .16})`;
    ctx.beginPath(); ctx.arc(x, y, i % 9 === 0 ? 2.3 : 1.3, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = "#091a14";
  ctx.beginPath();
  ctx.moveTo(0, 560); ctx.lineTo(150, 410); ctx.lineTo(280, 555); ctx.lineTo(450, 380); ctx.lineTo(640, 550); ctx.lineTo(820, 420); ctx.lineTo(1080, 565); ctx.lineTo(1080, 1350); ctx.lineTo(0, 1350); ctx.closePath(); ctx.fill();

  ctx.textAlign = "center";
  const isMoon = record.coinSource === "moon" || record.response?.source?.includes("moon");
  const isCopper = record.coinSource === "copper" || (!isMoon && record.response?.source?.includes("deep"));
  ctx.fillStyle = isMoon ? "#ccebf1" : isCopper ? "#efa977" : "#d7bc78";
  ctx.font = "700 25px Arial";
  ctx.fillText(isMoon ? "A MOON WATER ECHO" : isCopper ? "A DEEP WATER ECHO" : "THE WELL TOLD ME", width / 2, 585);

  ctx.fillStyle = "#f8f0dc";
  ctx.font = "52px Georgia";
  const endY = drawWrappedText(ctx, `“${record.response.shareLine}”`, width / 2, 680, 840, 68, 6);

  ctx.strokeStyle = "rgba(215,188,120,.65)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(430, endY + 35); ctx.lineTo(650, endY + 35); ctx.stroke();

  const wellY = 1055;
  ctx.fillStyle = "#5c5142";
  ctx.beginPath(); ctx.moveTo(365, wellY); ctx.lineTo(715, wellY); ctx.lineTo(675, 1265); ctx.lineTo(405, 1265); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#857562";
  ctx.beginPath(); ctx.ellipse(540, wellY, 196, 58, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#071c1a";
  ctx.beginPath(); ctx.ellipse(540, wellY, 151, 39, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(126,205,190,.55)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(540, wellY + 4, 68, 15, 0, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = "#d7bc78";
  ctx.font = "34px Georgia";
  ctx.fillText("Throw a Penny", width / 2, 1300);
  ctx.fillStyle = "#99aa9f";
  ctx.font = "19px Arial";
  ctx.fillText(isMoon ? "A moon penny. A longer look beneath the surface." : isCopper ? "A copper penny. A deeper personal echo." : "Throw in a penny. Hear what the water has to say.", width / 2, 1330);
}

async function canvasBlob() {
  return new Promise(resolve => elements.shareCanvas.toBlob(resolve, "image/png", .95));
}

function openShare() {
  if (!runtime.currentRecord) return;
  trackEvent("share_card_opened", { coin: runtime.currentRecord.coinSource });
  renderShareCard(runtime.currentRecord);
  openOverlay(elements.shareModal);
}

async function shareCard() {
  if (!runtime.currentRecord) return;
  const blob = await canvasBlob();
  if (!blob) {
    showToast("The share card could not be made on this device.");
    return;
  }
  let file = null;
  try {
    if (typeof File === "function") file = new File([blob], "throw-a-penny-echo.png", { type: "image/png" });
  } catch {
    file = null;
  }
  const shareData = {
    title: SHARE_NAME,
    text: `The well told me: “${runtime.currentRecord.response.shareLine}”`,
    url: location.origin,
    ...(file ? { files: [file] } : {})
  };
  try {
    const canShareFile = Boolean(file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] })));
    if (canShareFile) {
      await navigator.share(shareData);
      runtime.currentRecord.sharedAt = new Date().toISOString();
      trackEvent("echo_shared", { coin: runtime.currentRecord.coinSource, theme: runtime.currentRecord.response.theme });
      saveState();
      showToast("Your echo was shared. Your wish stayed private.");
    } else {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "throw-a-penny-echo.png";
      anchor.click();
      URL.revokeObjectURL(url);
      showToast("Share card saved. Your wish was not included.");
    }
  } catch (error) {
    if (error.name !== "AbortError") showToast("The card could not be shared on this device.");
  }
}

async function copyShareWords() {
  if (!runtime.currentRecord) return;
  const text = `The well told me: “${runtime.currentRecord.response.shareLine}”\n\n${location.origin}`;
  try {
    await navigator.clipboard.writeText(text);
    trackEvent("echo_copied", { coin: runtime.currentRecord.coinSource, theme: runtime.currentRecord.response.theme });
    showToast("The echo was copied. Your wish stayed private.");
  } catch {
    showToast("Copying is not available in this browser.");
  }
}

async function createMonthlyReflection() {
  const rootWishes = state.wishes.filter(record => record.responseKind !== "follow_up" && !record.isMonthly);
  if (rootWishes.length < 3 || runtime.busy) return;
  const existing = currentMonthReflection();
  if (existing) {
    closeOverlay(elements.journalDrawer);
    showResponse(existing);
    return;
  }
  runtime.busy = true;
  elements.monthlyButton.disabled = true;
  elements.monthlyButton.textContent = "Listening…";
  try {
    const response = await fetch("/api/monthly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, wishes: rootWishes.slice(-12).map(record => record.wish) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The month stayed quiet.");
    const record = {
      id: createId(),
      cloudId: data.reflectionId || null,
      isMonthly: true,
      wish: "Monthly reflection",
      response: data,
      createdAt: data.createdAt || new Date().toISOString(),
      monthKey: data.monthKey || monthKey()
    };
    state.monthlyReflections.push(record);
    saveState();
    closeOverlay(elements.journalDrawer);
    showResponse(record);
  } catch (error) {
    showToast(error.message || "The month’s echo could not be gathered.");
  } finally {
    runtime.busy = false;
    updateUI();
  }
}


async function shareGiftPenny() {
  const url = location.origin;
  const share = {
    title: SHARE_NAME,
    text: "I found a little wishing well. Your first penny is waiting.",
    url
  };
  try {
    if (navigator.share) {
      await navigator.share(share);
      trackEvent("friend_invited", { method: "share" });
      showToast("A penny is on its way.");
    } else {
      await navigator.clipboard.writeText(`${share.text} ${url}`);
      trackEvent("friend_invited", { method: "copy" });
      showToast("The invitation link was copied.");
    }
  } catch (error) {
    if (error.name !== "AbortError") showToast("The invitation could not be shared on this device.");
  }
}


function setFollowUpDirection(direction, question = "") {
  runtime.followUpDraft = {
    ...(runtime.followUpDraft || {}),
    direction,
    question: String(question || "").trim()
  };
  for (const button of elements.followDirectionButtons) {
    button.classList.toggle("selected", button.dataset.followDirection === direction);
  }
  if (question) elements.followUpInput.value = question;
  if (direction === "custom") {
    elements.followUpInput.value = runtime.followUpDraft.question || "";
    setTimeout(() => elements.followUpInput.focus(), 60);
  }
}

function buildFollowUpDraft(record = runtime.currentRecord) {
  if (!record) return null;
  const saved = state.pendingFollowUp && state.pendingFollowUp.parentId === record.id ? state.pendingFollowUp : null;
  return {
    parentId: record.id,
    parentCloudId: record.cloudId || null,
    originalWish: record.wish || "",
    originalAnswer: record.response?.answer || "",
    originalMeaning: record.response?.meaning || "",
    originalClarification: record.clarification || "",
    direction: saved?.direction || "clarity",
    question: saved?.question || "What am I overlooking here?"
  };
}

function openFollowUp({ resume = false, preferredCoin = null } = {}) {
  const record = runtime.currentRecord || state.wishes.find(item => item.id === state.pendingFollowUp?.parentId);
  if (!record || record.response?.safety || record.isMonthly) return;
  runtime.currentRecord = record;
  runtime.followUpDraft = buildFollowUpDraft(record);
  const freeAvailable = freeFollowUpAvailable(record);
  if (preferredCoin && !freeAvailable) runtime.followUpDraft.preferredCoin = preferredCoin;

  if (elements.followUpKicker) elements.followUpKicker.textContent = freeAvailable ? "Your first follow-up is free" : "Continue the same wish";
  elements.followUpEcho.textContent = `“${record.response?.shareLine || record.response?.answer || "The well is still listening."}”`;
  elements.followUpInput.value = runtime.followUpDraft.question;
  setFollowUpDirection(runtime.followUpDraft.direction, runtime.followUpDraft.question);

  if (elements.freeFollowUpAction) elements.freeFollowUpAction.hidden = !freeAvailable;
  if (elements.premiumFollowUpActions) elements.premiumFollowUpActions.hidden = freeAvailable;
  if (elements.followUpNote && !freeAvailable) {
    elements.followUpNote.textContent = preferredCoin === "moon"
      ? "Moon is selected: use it when you want a fuller reading and a private Moon note."
      : preferredCoin === "copper"
        ? "Copper is selected: use it when you want clarity, a decision, or a concrete next move."
        : "Copper is for a practical next move. Moon is for a fuller reading and perspective shift.";
  }

  updateUI();
  openOverlay(elements.followUpModal);
  trackEvent(resume ? "follow_up_resumed" : freeAvailable ? "free_follow_up_offer_clicked" : "premium_follow_up_offer_clicked", {
    theme: record.response?.theme || "unknown",
    hasCredits: state.copperCredits + state.moonCredits > 0
  });
}

function purchaseContextForFollowUp(coin) {
  const label = coin === "moon" ? "Moon" : "Copper";
  const title = document.querySelector("#pennyModalTitle");
  const lead = document.querySelector("#pennyModalLead");
  if (title) title.textContent = `Continue this wish with ${label}`;
  if (lead) lead.textContent = coin === "moon"
    ? "Use Moon when this is the wish you keep circling back to: a fuller reading, a different angle, a private Moon note, and the Moon share card."
    : "Use Copper when you want to keep this exact wish moving with a practical question, clearer decision, or concrete next step.";
}

function resetPurchaseContext() {
  const title = document.querySelector("#pennyModalTitle");
  const lead = document.querySelector("#pennyModalLead");
  if (title) title.textContent = "Keep the conversation going";
  if (lead) lead.textContent = "The free penny gives you the first answer. Paid pennies are for continuing a wish you actually care about.";
}

async function beginFreeFollowUp() {
  if (!runtime.followUpDraft || !runtime.currentRecord || runtime.busy) return;
  const parentRecord = runtime.currentRecord;
  if (!freeFollowUpAvailable(parentRecord)) {
    showToast("Your free follow-up has already been used.");
    return;
  }
  const question = String(elements.followUpInput.value || runtime.followUpDraft.question || "").replace(/\s+/g, " ").trim().slice(0, 320);
  if (question.length < 4) {
    showToast("Ask the well one clear follow-up question.");
    elements.followUpInput.focus();
    return;
  }

  const draft = { ...runtime.followUpDraft, question };
  const followUpContext = {
    parentId: draft.parentId,
    parentCloudId: draft.parentCloudId,
    originalWish: draft.originalWish,
    originalAnswer: draft.originalAnswer,
    originalMeaning: draft.originalMeaning,
    originalClarification: draft.originalClarification || "",
    question: draft.question,
    direction: draft.direction
  };

  runtime.busy = true;
  closeOverlay(elements.followUpModal);
  elements.responseCard.hidden = true;
  elements.listeningState.hidden = false;
  elements.waterSurface.classList.add("listening", "active");
  trackEvent("free_follow_up_started", { direction: draft.direction, theme: parentRecord.response?.theme || "unknown" });

  const started = Date.now();
  try {
    const response = await requestWishResponse(draft.originalWish, "free", followUpContext);
    const remaining = Math.max(0, 1250 - (Date.now() - started));
    if (remaining) await new Promise(resolve => setTimeout(resolve, remaining));

    const record = {
      id: createId(),
      cloudId: response.wishId || null,
      wish: draft.originalWish,
      clarification: draft.originalClarification || "",
      responseKind: "follow_up",
      parentId: draft.parentId,
      parentCloudId: draft.parentCloudId,
      followUpPrompt: draft.question,
      followUpDirection: draft.direction,
      followUpTier: "free",
      response: {
        answer: response.answer,
        meaning: response.meaning,
        nextStep: response.nextStep,
        shareLine: response.shareLine,
        followUpQuestion: response.followUpQuestion,
        moonNote: response.moonNote || null,
        mood: response.mood,
        theme: response.theme || "uncertainty",
        safety: response.safety || null,
        source: response.source || "well"
      },
      coinSource: response.safety ? "safety" : "free",
      createdAt: new Date().toISOString(),
      sealedUntil: null,
      revisitedAt: null,
      sharedAt: null
    };
    state.wishes.push(record);
    state.pendingFollowUp = null;
    saveState();
    trackEvent("free_follow_up_completed", { direction: draft.direction, theme: record.response.theme });
    showResponse(record);
    updateUI();
  } catch (error) {
    showResponse(parentRecord);
    if (error.code === "FREE_FOLLOW_UP_USED") {
      showToast("Your free follow-up has already been used. Copper or Moon can keep this wish going.", 4200);
    } else {
      showToast(error.message || "The well could not hear that follow-up. Nothing was charged.", 3800);
    }
  } finally {
    runtime.busy = false;
    elements.listeningState.hidden = true;
    elements.waterSurface.classList.remove("listening");
  }
}

function beginFollowUp(coin) {
  if (!runtime.followUpDraft || !runtime.currentRecord) return;
  const question = String(elements.followUpInput.value || runtime.followUpDraft.question || "").replace(/\s+/g, " ").trim().slice(0, 320);
  if (question.length < 4) {
    showToast("Ask the well one clear follow-up question.");
    elements.followUpInput.focus();
    return;
  }
  const draft = {
    ...runtime.followUpDraft,
    question,
    coin
  };
  runtime.followUpDraft = draft;
  if (coinBalance(coin) < 1) {
    state.pendingFollowUp = draft;
    saveState();
    closeOverlay(elements.followUpModal);
    purchaseContextForFollowUp(coin);
    openOverlay(elements.pennyModal);
    trackEvent("follow_up_purchase_needed", { coin, direction: draft.direction });
    return;
  }

  state.pendingFollowUp = null;
  saveState();
  runtime.followUpContext = {
    parentId: draft.parentId,
    parentCloudId: draft.parentCloudId,
    originalWish: draft.originalWish,
    originalAnswer: draft.originalAnswer,
    originalMeaning: draft.originalMeaning,
    originalClarification: draft.originalClarification || "",
    question: draft.question,
    direction: draft.direction
  };
  runtime.currentWish = draft.originalWish;
  runtime.pendingCoinSource = coin;
  closeOverlay(elements.followUpModal);
  elements.responseCard.hidden = true;
  elements.upgradeOffer.hidden = true;
  elements.wishComposer.hidden = true;
  elements.introCopy.hidden = true;
  elements.coinDock.hidden = false;
  elements.coinInstruction.textContent = coin === "moon"
    ? "The Moon penny is dropping into the same wish…"
    : "The Copper penny is dropping into the same wish…";
  setCoinVisual(coin);
  renderCoinChoices({ forceCollapsed: true });
  trackEvent("paid_follow_up_ready", { coin, direction: draft.direction, autoToss: true });
  // Choosing the paid continuation is the action. Do not make the person tap the same coin a second time.
  setTimeout(() => tossPenny(), 180);
}

function resumePendingFollowUp(deliveredCoin = null) {
  const pending = state.pendingFollowUp;
  if (!pending) return false;
  const coin = pending.coin || deliveredCoin;
  if (coin && coinBalance(coin) < 1) return false;
  const parent = state.wishes.find(record => record.id === pending.parentId);
  if (!parent) {
    state.pendingFollowUp = null;
    saveState();
    return false;
  }
  runtime.currentRecord = parent;
  runtime.followUpDraft = { ...pending };
  showResponse(parent);
  // The user already chose the continuation before checkout. Resume it automatically once Stripe delivers the pennies.
  elements.followUpInput.value = pending.question || "What am I overlooking here?";
  setTimeout(() => beginFollowUp(coin), 220);
  return true;
}

async function startCheckout(pack) {
  const purchaseCoin = pack === "moon_30" || pack === "keeper_monthly" ? "moon" : pack === "copper_10" ? "copper" : null;
  if (state.pendingFollowUp && purchaseCoin) {
    state.pendingFollowUp.coin = purchaseCoin;
    saveState();
  }
  trackEvent("checkout_started", { pack, source: state.pendingFollowUp ? "follow_up" : runtime.currentRecord ? "response" : "penny_menu" });
  if (!runtime.persistentStorage) {
    elements.paymentNote.hidden = false;
    elements.paymentNote.textContent = "Paid pennies can’t be saved in this browser right now. Your free penny still works.";
    showToast("Paid pennies can’t be saved in this browser right now.", 4200);
    return;
  }
  if (!runtime.config.payments) {
    elements.paymentNote.hidden = false;
    elements.paymentNote.textContent = "Purchases are temporarily unavailable. Your free daily penny still works.";
    showToast("Purchases are temporarily unavailable. Please try again a little later.");
    return;
  }
  const target = document.querySelector(`[data-pack="${pack}"]`);
  const original = target?.innerHTML;
  if (target) target.disabled = true;
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack, sessionId: state.sessionId })
    });
    const data = await response.json();
    if (!response.ok || !data.url) throw new Error(data.error || "Checkout could not be opened.");
    window.location.href = data.url;
  } catch (error) {
    showToast(error.message || "Checkout could not be opened.");
    if (target) target.disabled = false;
  } finally {
    if (target && original) target.innerHTML = original;
  }
}

async function cancelWellKeeper() {
  if (!state.subscriptionActive) return;
  const confirmed = window.confirm("Cancel Well Keeper so it will not renew again? Your existing Moon pennies will stay in your well.");
  if (!confirmed) return;
  const button = elements.manageKeeperButton;
  const original = button?.textContent || "Cancel Well Keeper";
  if (button) {
    button.disabled = true;
    button.textContent = "Canceling…";
  }
  try {
    const response = await fetch("/api/cancel-keeper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.cancelled !== true) throw new Error(data.error || "Well Keeper could not be canceled.");
    state.subscriptionActive = false;
    saveState();
    updateUI();
    showToast(data.endsAt
      ? `Well Keeper will end on ${formatDate(data.endsAt, true)}. Your Moon pennies stay yours.`
      : "Well Keeper will not renew again. Your Moon pennies stay yours.", 5600);
  } catch (error) {
    showToast(error.message || "Well Keeper could not be canceled. Please try again later.", 4800);
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

async function syncCloudState() {
  if (!runtime.config.database) return false;
  try {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId }),
      cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok || !data.connected) return false;
    const profile = data.profile;
    if (profile) {
      state.copperCredits = Number(profile.copper_credits || 0);
      state.moonCredits = Number(profile.moon_credits || 0);
      state.subscriptionActive = Boolean(profile.subscription_active);
      state.dailyAvailable = profile.daily_claim_date !== dailyDateKey();
    }
    if (Array.isArray(data.wishes) && data.wishes.length) {
      const existingCloudIds = new Set(state.wishes.map(record => record.cloudId).filter(Boolean));
      for (const cloud of data.wishes.reverse()) {
        const cloudPreview = { response: { answer: cloud.answer, meaning: cloud.meaning, nextStep: cloud.next_step } };
        if (isRetiredGenericResponse(cloudPreview)) continue;
        if (existingCloudIds.has(cloud.id)) continue;
        const likelyMatch = state.wishes.find(record => !record.cloudId && Math.abs(new Date(record.createdAt).getTime() - new Date(cloud.created_at).getTime()) < 120000 && record.wish === cloud.wish_text);
        if (likelyMatch) {
          likelyMatch.cloudId = cloud.id;
          likelyMatch.sealedUntil = cloud.sealed_until || likelyMatch.sealedUntil;
          likelyMatch.responseKind = cloud.response_kind || likelyMatch.responseKind || "wish";
          likelyMatch.parentCloudId = cloud.parent_wish_id || likelyMatch.parentCloudId || null;
          likelyMatch.followUpPrompt = cloud.follow_up_prompt || likelyMatch.followUpPrompt || null;
          likelyMatch.followUpDirection = cloud.follow_up_direction || likelyMatch.followUpDirection || null;
          likelyMatch.clarification = cloud.clarification_text || likelyMatch.clarification || "";
          if (cloud.moon_note) likelyMatch.response.moonNote = cloud.moon_note;
          if (cloud.response_kind === "follow_up" && cloud.coin_source === "local") {
            likelyMatch.coinSource = "free";
            likelyMatch.followUpTier = "free";
          }
          continue;
        }
        state.wishes.push({
          id: createId(),
          cloudId: cloud.id,
          wish: cloud.wish_text,
          clarification: cloud.clarification_text || "",
          responseKind: cloud.response_kind || "wish",
          parentCloudId: cloud.parent_wish_id || null,
          followUpPrompt: cloud.follow_up_prompt || null,
          followUpDirection: cloud.follow_up_direction || null,
          followUpTier: cloud.response_kind === "follow_up" && cloud.coin_source === "local" ? "free" : cloud.response_kind === "follow_up" ? "paid" : null,
          response: {
            answer: cloud.answer,
            meaning: cloud.meaning,
            nextStep: cloud.next_step,
            shareLine: cloud.share_line,
            followUpQuestion: cloud.follow_up_question,
            moonNote: cloud.moon_note || null,
            mood: cloud.mood,
            theme: cloud.theme || "uncertainty",
            safety: cloud.safety || null,
            source: "cloud"
          },
          coinSource: cloud.response_kind === "follow_up" && cloud.coin_source === "local" ? "free" : cloud.coin_source,
          createdAt: cloud.created_at,
          sealedUntil: cloud.sealed_until,
          revisitedAt: null,
          sharedAt: null
        });
      }
      const localByCloudId = new Map(state.wishes.filter(record => record.cloudId).map(record => [record.cloudId, record.id]));
      for (const record of state.wishes) {
        if (!record.parentId && record.parentCloudId && localByCloudId.has(record.parentCloudId)) {
          record.parentId = localByCloudId.get(record.parentCloudId);
        }
      }
    }
    if (Array.isArray(data.monthlyReflections) && data.monthlyReflections.length) {
      const existingReflectionIds = new Set(state.monthlyReflections.map(record => record.cloudId).filter(Boolean));
      for (const cloud of data.monthlyReflections.reverse()) {
        const cloudPreview = { response: { answer: cloud.answer, meaning: cloud.meaning, nextStep: cloud.next_step } };
        if (isRetiredGenericResponse(cloudPreview)) continue;
        if (existingReflectionIds.has(cloud.id)) continue;
        const likelyMatch = state.monthlyReflections.find(record => (record.monthKey || monthKey(record.createdAt)) === cloud.month_key);
        if (likelyMatch) {
          likelyMatch.cloudId = cloud.id;
          continue;
        }
        state.monthlyReflections.push({
          id: createId(),
          cloudId: cloud.id,
          isMonthly: true,
          wish: "Monthly reflection",
          response: {
            answer: cloud.answer,
            meaning: cloud.meaning,
            nextStep: cloud.next_step,
            shareLine: cloud.share_line,
            followUpQuestion: cloud.follow_up_question,
            mood: cloud.mood,
            theme: cloud.theme || "uncertainty",
            source: "cloud"
          },
          createdAt: cloud.created_at,
          monthKey: cloud.month_key
        });
      }
    }
    saveState();
    updateUI();
    return true;
  } catch (error) {
    console.warn("Cloud sync unavailable:", error);
    return false;
  }
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    runtime.config = await response.json();
    if (runtime.config.version !== CLIENT_VERSION) {
      const targetVersion = String(runtime.config.version || "server-update");
      const alreadyRefreshed = sessionStorage.getItem("throwapenny-version-refresh") === targetVersion;
      if (!alreadyRefreshed) {
        sessionStorage.setItem("throwapenny-version-refresh", targetVersion);
        try {
          const registrations = await navigator.serviceWorker?.getRegistrations?.();
          await Promise.all((registrations || []).map(registration => registration.unregister()));
          const keys = await caches?.keys?.();
          await Promise.all((keys || []).map(key => caches.delete(key)));
        } catch {}
        location.replace(`/?refresh=${Date.now()}`);
        return false;
      }
      runtime.configReady = false;
      showToast("The latest well update is still loading. Refresh once more in a few seconds.", 5000);
      return false;
    }
    sessionStorage.removeItem("throwapenny-version-refresh");
    runtime.configReady = true;
    const purchasesReady = Boolean(runtime.config.payments && runtime.persistentStorage);
    elements.paymentNote.hidden = purchasesReady;
    elements.paymentNote.textContent = purchasesReady
      ? ""
      : runtime.persistentStorage
        ? "Purchases are temporarily unavailable. Your free daily penny still works."
        : "Paid pennies can’t be saved in this browser right now. Your free penny still works.";
    await syncCloudState();
  } catch {
    runtime.config = { ai: false, database: false, payments: false, version: null };
    runtime.configReady = false;
  }
}

function exportJournal() {
  const safeExport = {
    exportedAt: new Date().toISOString(),
    app: SHARE_NAME,
    wishes: state.wishes.map(record => ({
      wish: record.wish,
      responseKind: record.responseKind || "wish",
      followUpPrompt: record.followUpPrompt || null,
      followUpDirection: record.followUpDirection || null,
      followUpTier: record.followUpTier || null,
      response: record.response,
      createdAt: record.createdAt,
      sealedUntil: record.sealedUntil,
      revisitedAt: record.revisitedAt
    })),
    monthlyReflections: state.monthlyReflections.map(record => ({
      response: record.response,
      createdAt: record.createdAt,
      monthKey: record.monthKey || monthKey(record.createdAt)
    }))
  };
  const blob = new Blob([JSON.stringify(safeExport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `throw-a-penny-journal-${localDateKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Your private journal export is ready.");
}

async function clearDevice() {
  const confirmed = window.confirm("Clear every wish, penny balance, and setting saved for this browser? This cannot be undone.");
  if (!confirmed) return;

  const sessionId = state.sessionId;
  if (runtime.config.database) {
    try {
      const response = await fetch("/api/delete-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.deleted !== true) {
        throw new Error(data.error || "Deletion could not be confirmed");
      }
    } catch (error) {
      console.warn("Saved journal deletion could not be confirmed:", error);
      showToast("Nothing was cleared because we could not confirm the saved copy was removed. Please try again in a moment.", 5600);
      return;
    }
  }

  storageRemove(STORAGE_KEY);
  state = freshState();
  saveState();
  closeOverlay(elements.journalDrawer);
  resetExperience();
  updateUI();
  showToast("Your saved well has been cleared.");
}

async function confirmPurchasedCredits(startingWallet, expectedCoin = null) {
  const detectDelivery = () => {
    const copperAdded = Number(state.copperCredits || 0) - Number(startingWallet.copper || 0);
    const moonAdded = Number(state.moonCredits || 0) - Number(startingWallet.moon || 0);
    if (copperAdded <= 0 && moonAdded <= 0) return null;
    const deliveredCoin = moonAdded > 0 ? "moon" : "copper";
    const added = Math.max(moonAdded, copperAdded);
    return { added, deliveredCoin };
  };

  // The webhook may finish while the customer is still on Checkout. In that case
  // loadConfig() has already synced the new balance before this function starts.
  let delivered = detectDelivery();
  if (delivered) {
    trackEvent("credits_delivered", { added: delivered.added, coin: delivered.deliveredCoin, expectedCoin, timing: "before_return_check" });
    showToast(`${delivered.added} ${delivered.deliveredCoin} pennies are ready.`, 3800);
    resumePendingFollowUp(delivered.deliveredCoin);
    return true;
  }

  for (const delay of PURCHASE_CONFIRMATION_DELAYS_MS) {
    await new Promise(resolve => setTimeout(resolve, delay));
    await syncCloudState();
    delivered = detectDelivery();
    if (delivered) {
      trackEvent("credits_delivered", { added: delivered.added, coin: delivered.deliveredCoin, expectedCoin, timing: "after_return_poll" });
      showToast(`${delivered.added} ${delivered.deliveredCoin} pennies are ready.`, 3800);
      resumePendingFollowUp(delivered.deliveredCoin);
      return true;
    }
  }

  showToast("Your payment was received, but the pennies are taking longer than usual to arrive. Refresh in a moment and they should appear automatically.", 6200);
  return false;
}

function readPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  if (!payment) return null;
  const pack = params.get("pack");
  const expectedCoin = pack === "moon_30" || pack === "keeper_monthly" ? "moon" : pack === "copper_10" ? "copper" : null;
  return { payment, pack, expectedCoin };
}

async function handlePaymentReturn(paymentReturn, startingWallet) {
  if (!paymentReturn) return false;
  const { payment, pack, expectedCoin } = paymentReturn;
  history.replaceState({}, "", window.location.pathname);

  if (payment === "success") {
    trackEvent("checkout_returned_success", { pack, expectedCoin });
    const alreadyDelivered = (Number(state.copperCredits || 0) > Number(startingWallet.copper || 0))
      || (Number(state.moonCredits || 0) > Number(startingWallet.moon || 0));
    if (!alreadyDelivered) showToast("Payment received. Adding your pennies now…", 3200);
    await confirmPurchasedCredits(startingWallet, expectedCoin);
    return true;
  }

  if (payment === "cancelled") {
    trackEvent("checkout_cancelled", { source: state.pendingFollowUp ? "follow_up" : "wallet" });
    showToast(state.pendingFollowUp
      ? "Nothing was charged. Your follow-up is still waiting when you are ready."
      : "Nothing was charged. Your available pennies are still here.");
    return true;
  }

  return false;
}

function registerPWA() {
  if ("serviceWorker" in navigator) {
    const wasControlled = Boolean(navigator.serviceWorker.controller);
    let reloadingForUpdate = false;
    if (wasControlled) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloadingForUpdate) return;
        reloadingForUpdate = true;
        window.location.reload();
      });
    }
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then(registration => registration.update().catch(() => {}))
      .catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    runtime.installPrompt = event;
    elements.installButton.hidden = state.wishes.length < 1;
  });
  elements.installButton.addEventListener("click", async () => {
    if (!runtime.installPrompt) return;
    trackEvent("install_prompt_clicked");
    runtime.installPrompt.prompt();
    const choice = await runtime.installPrompt.userChoice;
    trackEvent("install_prompt_result", { outcome: choice?.outcome || "unknown" });
    runtime.installPrompt = null;
    elements.installButton.hidden = true;
  });
}

function bindEvents() {
  elements.wishInput.addEventListener("input", () => {
    const length = elements.wishInput.value.length;
    elements.characterCount.textContent = `${length} / 600`;
    elements.characterCount.hidden = length < 450;
    runtime.wishClarification = "";
    runtime.wishCheckSkipped = false;
    if (elements.wishNudge && !wishNeedsMoreDetail(elements.wishInput.value)) elements.wishNudge.hidden = true;
    if (elements.wishClarifier) elements.wishClarifier.hidden = true;
  });
  elements.wishInput.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") preparePenny();
  });
  elements.readyButton.addEventListener("click", preparePenny);
  elements.clarifierButton?.addEventListener("click", acceptWishClarification);
  elements.clarifierSkipButton?.addEventListener("click", skipWishClarification);
  elements.editWishButton.addEventListener("click", editWish);
  elements.coinChoiceToggle.addEventListener("click", () => {
    runtime.coinChoicesExpanded = !runtime.coinChoicesExpanded;
    renderCoinChoices();
    trackEvent("coin_choices_toggled", { expanded: runtime.coinChoicesExpanded });
  });
  for (const button of elements.coinChoiceButtons) {
    button.addEventListener("click", () => {
      const source = button.dataset.coinChoice;
      if (coinBalance(source) < 1) return;
      setCoinVisual(source);
      runtime.coinChoicesExpanded = false;
      renderCoinChoices();
      trackEvent("coin_selected", { coin: source });
    });
  }
  elements.penny.addEventListener("click", event => {
    if (event.detail === 0 || !runtime.pointerStart) tossPenny();
  });
  elements.penny.addEventListener("pointerdown", event => {
    runtime.pointerStart = { x: event.clientX, y: event.clientY, time: Date.now() };
    elements.penny.setPointerCapture?.(event.pointerId);
  });
  elements.penny.addEventListener("pointermove", event => {
    if (!runtime.pointerStart) return;
    const dy = Math.min(0, event.clientY - runtime.pointerStart.y);
    const dx = event.clientX - runtime.pointerStart.x;
    elements.penny.style.transform = `translate(${dx * .18}px,${dy * .42}px) rotate(${dx * .22}deg)`;
  });
  elements.penny.addEventListener("pointerup", event => {
    if (!runtime.pointerStart) return;
    const dy = event.clientY - runtime.pointerStart.y;
    const elapsed = Date.now() - runtime.pointerStart.time;
    runtime.pointerStart = null;
    elements.penny.style.transform = "";
    if (dy < -28 || elapsed < 320) tossPenny();
  });
  elements.penny.addEventListener("pointercancel", () => {
    runtime.pointerStart = null;
    elements.penny.style.transform = "";
  });

  elements.closeResponse.addEventListener("click", () => {
    trackEvent("response_closed");
    resetExperience();
  });
  elements.newWishButton.addEventListener("click", () => {
    trackEvent("return_to_well_clicked", { source: "response" });
    resetExperience();
  });
  elements.homeButton.addEventListener("click", () => {
    trackEvent("return_to_well_clicked", { source: "brand" });
    resetExperience();
  });
  elements.sealButton.addEventListener("click", openSealModal);
  elements.shareButton.addEventListener("click", openShare);
  elements.journalButton.addEventListener("click", openJournal);
  elements.pennyButton.addEventListener("click", () => {
    resetPurchaseContext();
    trackEvent("penny_wallet_opened", { source: "header" });
    openOverlay(elements.pennyModal);
  });
  elements.upgradeButton.addEventListener("click", () => openFollowUp());
  elements.upgradeCopperButton?.addEventListener("click", () => {
    trackEvent("premium_path_selected", { coin: "copper" });
    openFollowUp({ preferredCoin: "copper" });
  });
  elements.upgradeMoonButton?.addEventListener("click", () => {
    trackEvent("premium_path_selected", { coin: "moon" });
    openFollowUp({ preferredCoin: "moon" });
  });
  for (const button of elements.followDirectionButtons) {
    button.addEventListener("click", () => {
      const direction = button.dataset.followDirection;
      const question = button.dataset.followQuestion || (direction === "custom" ? "" : elements.followUpInput.value);
      setFollowUpDirection(direction, question);
      trackEvent("follow_up_direction_selected", { direction });
    });
  }
  elements.followUpInput.addEventListener("input", () => {
    if (!runtime.followUpDraft) return;
    runtime.followUpDraft.question = elements.followUpInput.value;
    if (runtime.followUpDraft.direction !== "custom") {
      runtime.followUpDraft.direction = "custom";
      for (const button of elements.followDirectionButtons) button.classList.toggle("selected", button.dataset.followDirection === "custom");
    }
  });
  elements.continueFreeButton.addEventListener("click", beginFreeFollowUp);
  elements.continueCopperButton.addEventListener("click", () => beginFollowUp("copper"));
  elements.continueMoonButton.addEventListener("click", () => beginFollowUp("moon"));
  elements.giftFromResponseButton.addEventListener("click", shareGiftPenny);
  elements.giftButton.addEventListener("click", shareGiftPenny);
  elements.manageKeeperButton?.addEventListener("click", cancelWellKeeper);
  elements.monthlyButton.addEventListener("click", createMonthlyReflection);
  elements.nativeShareButton.addEventListener("click", shareCard);
  elements.copyShareButton.addEventListener("click", copyShareWords);
  elements.exportButton.addEventListener("click", exportJournal);
  elements.clearButton.addEventListener("click", clearDevice);

  elements.wishList.addEventListener("click", event => {
    const item = event.target.closest(".wish-item");
    if (!item) return;
    const record = state.wishes.find(candidate => candidate.id === item.dataset.id);
    if (record) openSavedWish(record);
  });
  elements.reflectionList.addEventListener("click", event => {
    const item = event.target.closest(".reflection-item");
    if (!item) return;
    const record = state.monthlyReflections.find(candidate => candidate.id === item.dataset.reflectionId);
    if (!record) return;
    closeOverlay(elements.journalDrawer);
    showResponse(record);
  });
  elements.revisitButton.addEventListener("click", () => {
    if (runtime.returnedWish) openSavedWish(runtime.returnedWish, { revisit: true });
  });

  elements.responseInsight.addEventListener("toggle", () => {
    if (elements.responseInsight.open) trackEvent("response_meaning_opened", { coin: runtime.currentRecord?.coinSource || "unknown" });
  });
  elements.responseMore.addEventListener("toggle", () => {
    if (elements.responseMore.open) trackEvent("response_more_opened", { coin: runtime.currentRecord?.coinSource || "unknown" });
  });

  $$(".legal-links a").forEach(link => link.addEventListener("click", () => {
    trackEvent("legal_link_clicked", { page: link.getAttribute("href") || "unknown" });
  }));
  $$('[data-close-drawer]').forEach(node => node.addEventListener("click", () => closeOverlay(elements.journalDrawer)));
  $$('[data-close-modal]').forEach(node => node.addEventListener("click", () => {
    closeOverlay(elements.pennyModal);
    resetPurchaseContext();
  }));
  $$('[data-close-followup]').forEach(node => node.addEventListener("click", () => closeOverlay(elements.followUpModal)));
  $$('[data-close-seal]').forEach(node => node.addEventListener("click", () => closeOverlay(elements.sealModal)));
  $$('[data-close-share]').forEach(node => node.addEventListener("click", () => closeOverlay(elements.shareModal)));
  $$("[data-days]").forEach(button => button.addEventListener("click", () => sealCurrentWish(button.dataset.days)));
  $$("[data-pack]").forEach(button => button.addEventListener("click", () => startCheckout(button.dataset.pack)));

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    $$(".modal.open,.drawer.open").forEach(closeOverlay);
  });
}

async function init() {
  refreshDailyState();
  seedSky();
  bindEvents();
  elements.readyButton.disabled = true;
  updateUI();
  registerPWA();

  // Capture the browser wallet before cloud sync. A successful webhook can update
  // Supabase while the customer is still on Checkout, so this baseline is needed
  // to recognize credits that already arrived before the return page loaded.
  const paymentReturn = readPaymentReturn();
  const walletBeforeSync = {
    copper: Number(state.copperCredits || 0),
    moon: Number(state.moonCredits || 0)
  };

  await loadConfig();
  elements.readyButton.disabled = !runtime.configReady;
  const handledPaymentReturn = await handlePaymentReturn(paymentReturn, walletBeforeSync);
  if (!handledPaymentReturn) resumePendingFollowUp();
}

init();
