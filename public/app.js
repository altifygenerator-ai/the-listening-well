const STORAGE_KEY = "listening-well-state-v1";
const SHARE_NAME = "The Listening Well";
const TOSS_DURATION_MS = 1450;
const SPLASH_TRIGGER_MS = 1220;

const memoryStorage = new Map();

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

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const elements = {
  appShell: $("#appShell"),
  wishInput: $("#wishInput"),
  characterCount: $("#characterCount"),
  readyButton: $("#readyButton"),
  wishComposer: $("#wishComposer"),
  introCopy: $("#introCopy"),
  coinDock: $("#coinDock"),
  penny: $("#penny"),
  coinChoice: $("#coinChoice"),
  coinChoiceButtons: $$('[data-coin-choice]'),
  dailyChoiceCount: $("#dailyChoiceCount"),
  copperChoiceCount: $("#copperChoiceCount"),
  moonChoiceCount: $("#moonChoiceCount"),
  editWishButton: $("#editWishButton"),
  listeningState: $("#listeningState"),
  waterSurface: $("#waterSurface"),
  responseCard: $("#responseCard"),
  answerText: $("#answerText"),
  meaningText: $("#meaningText"),
  nextStepText: $("#nextStepText"),
  responseModeLabel: $("#responseModeLabel"),
  upgradeOffer: $("#upgradeOffer"),
  upgradeTitle: $("#upgradeTitle"),
  upgradeText: $("#upgradeText"),
  upgradeButton: $("#upgradeButton"),
  giftFromResponseButton: $("#giftFromResponseButton"),
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
  config: { ai: false, database: false, payments: false },
  installPrompt: null,
  pointerStart: null,
  toastTimer: null,
  returnedWish: null
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    version: 2,
    sessionId: createId(),
    createdAt: new Date().toISOString(),
    dailyRefreshDate: localDateKey(),
    dailyAvailable: true,
    copperCredits: 0,
    moonCredits: 0,
    selectedCoin: "daily",
    subscriptionActive: false,
    visitDays: [localDateKey()],
    wishes: [],
    monthlyReflections: [],
    conversionEvents: [],
    settings: { sound: true, gentleReminders: true }
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(storageGet(STORAGE_KEY));
    if (!parsed || !parsed.sessionId) return freshState();
    const migratedCopper = Number(parsed.copperCredits ?? parsed.paidCredits ?? 0);
    return {
      ...freshState(),
      ...parsed,
      version: 2,
      copperCredits: Math.max(0, migratedCopper),
      moonCredits: Math.max(0, Number(parsed.moonCredits || 0)),
      selectedCoin: ["daily", "copper", "moon"].includes(parsed.selectedCoin) ? parsed.selectedCoin : "daily",
      visitDays: Array.isArray(parsed.visitDays) ? parsed.visitDays : [],
      wishes: Array.isArray(parsed.wishes) ? parsed.wishes : [],
      monthlyReflections: Array.isArray(parsed.monthlyReflections) ? parsed.monthlyReflections : [],
      conversionEvents: Array.isArray(parsed.conversionEvents) ? parsed.conversionEvents : []
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
  const today = localDateKey();
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

function defaultCoinSource() {
  if (coinBalance(state.selectedCoin) > 0) return state.selectedCoin;
  if (state.dailyAvailable) return "daily";
  if (state.copperCredits > 0) return "copper";
  if (state.moonCredits > 0) return "moon";
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
    window.va?.track?.(name, details);
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
  elements.pennyCount.textContent = String(availablePennies());
  if (elements.walletDaily) elements.walletDaily.textContent = state.dailyAvailable ? "1" : "0";
  if (elements.walletCopper) elements.walletCopper.textContent = String(Math.max(0, Number(state.copperCredits || 0)));
  if (elements.walletMoon) elements.walletMoon.textContent = String(Math.max(0, Number(state.moonCredits || 0)));
  if (elements.dailyChoiceCount) elements.dailyChoiceCount.textContent = state.dailyAvailable ? "1 ready" : "used today";
  if (elements.copperChoiceCount) elements.copperChoiceCount.textContent = `${Math.max(0, Number(state.copperCredits || 0))} ready`;
  if (elements.moonChoiceCount) elements.moonChoiceCount.textContent = `${Math.max(0, Number(state.moonCredits || 0))} ready`;
  elements.totalRipples.textContent = String(state.wishes.length);
  elements.daysVisited.textContent = String(state.visitDays.length);
  const level = getGardenLevel();
  elements.gardenDepth.textContent = depthLabel(level);
  elements.garden.className = `garden level-${level}`;
  const thisMonth = currentMonthReflection();
  if (state.wishes.length < 3) {
    elements.monthlyButton.disabled = true;
    elements.monthlyButton.textContent = `Needs ${3 - state.wishes.length} more`;
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
  for (let i = 0; i < 54; i += 1) {
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
  for (let i = 0; i < 15; i += 1) {
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

function renderCoinChoices() {
  const availableTypes = ["daily", "copper", "moon"].filter(type => coinBalance(type) > 0);
  elements.coinChoice.hidden = availableTypes.length < 2;
  for (const button of elements.coinChoiceButtons) button.hidden = coinBalance(button.dataset.coinChoice) < 1;
}

function resetExperience({ preserveText = false } = {}) {
  runtime.busy = false;
  runtime.currentRecord = null;
  runtime.currentWish = preserveText ? elements.wishInput.value.trim() : "";
  elements.responseCard.hidden = true;
  elements.responseCard.classList.remove("deep-water-response", "copper-water-response", "moon-water-response");
  elements.upgradeOffer.hidden = true;
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
  if (!preserveText) {
    elements.wishInput.value = "";
    elements.characterCount.textContent = "0 / 600";
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => elements.wishInput.focus({ preventScroll: true }), 220);
}

function preparePenny() {
  const wish = elements.wishInput.value.trim();
  if (wish.length < 3) {
    showToast("Give the well a little more to listen to.");
    elements.wishInput.focus();
    return;
  }
  if (!availablePennies()) {
    openOverlay(elements.pennyModal);
    return;
  }
  runtime.currentWish = wish;
  const source = defaultCoinSource();
  setCoinVisual(source);
  renderCoinChoices();
  trackEvent("wish_ready", { coin: source, wishNumber: state.wishes.length + 1 });
  elements.wishComposer.hidden = true;
  elements.coinDock.hidden = false;
  elements.introCopy.style.opacity = ".32";
  elements.introCopy.style.transform = "scale(.96)";
  if (navigator.vibrate) navigator.vibrate(18);
}

function editWish() {
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

  const animation = flyer.animate([
    { transform: "translate3d(0,0,0) rotateZ(0deg) scale(1)", opacity: 1, offset: 0 },
    { transform: `translate3d(${destinationX * .45}px,${destinationY * .34 - arcHeight}px,0) rotateZ(360deg) scale(.82)`, opacity: 1, offset: .52 },
    { transform: `translate3d(${destinationX}px,${destinationY}px,0) rotateZ(810deg) scale(.18)`, opacity: .9, offset: .91 },
    { transform: `translate3d(${destinationX}px,${destinationY + 14}px,0) rotateZ(900deg) scale(.05)`, opacity: 0, offset: 1 }
  ], {
    duration: TOSS_DURATION_MS,
    easing: "cubic-bezier(.18,.68,.22,1)",
    fill: "forwards"
  });

  setTimeout(() => {
    elements.waterSurface.classList.add("splashing", "active");
    if (navigator.vibrate) navigator.vibrate([24, 30, 45]);
    setTimeout(() => elements.waterSurface.classList.remove("splashing"), 1550);
  }, SPLASH_TRIGGER_MS);

  await animation.finished.catch(() => {});
  flyer.remove();
}

function priorThemes() {
  return state.wishes.slice(-5).map(record => record.response?.theme || "").filter(Boolean);
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

function clientFallbackResponse(wish, { deep = false } = {}) {
  const text = wish.toLowerCase();
  const isWork = /business|work|job|customer|client|money|income|success/.test(text);
  const isLove = /love|relationship|partner|marriage|husband|wife/.test(text);
  const isChange = /change|move|start|leave|decision|new/.test(text);
  if (isWork) return {
    answer: "The water does not hear a lack of effort. It hears your energy dividing itself among too many currents. One direction may need your full weight before it can carry you forward.",
    meaning: "This wish may be asking for traction more than luck. A smaller result you can repeat could matter more than one dramatic breakthrough.",
    nextStep: "Choose the one task most likely to create a real result and give it one uninterrupted hour.",
    shareLine: "One clear current can carry more than ten scattered ones.",
    followUpQuestion: "Which direction created the strongest ripple?",
    mood: "steady",
    theme: "work",
    source: "offline"
  };
  if (isLove) return {
    answer: "The well hears a wish to be met, not merely noticed. Water cannot force two shores together, but it can reveal where you have been crossing too far alone.",
    meaning: "Underneath this wish may be a need for honesty, safety, and care that is returned. That need deserves to be named plainly.",
    nextStep: "Write down one honest thing you need from this connection before deciding how to express it.",
    shareLine: "The right closeness should not require you to disappear.",
    followUpQuestion: "Do you feel more seen than you did when you made this wish?",
    mood: "tender",
    theme: "love",
    source: "offline"
  };
  if (isChange) return {
    answer: "The wish sinks, but the ripple moves outward. Part of you may already know the old shape no longer fits, even while the new one remains unclear.",
    meaning: "You may be waiting for certainty before beginning. The next useful step may simply be one that gives you better information.",
    nextStep: "Take one reversible step that moves you closer without requiring a final decision.",
    shareLine: "You do not need the whole map to honor the direction.",
    followUpQuestion: "What became clearer after you moved one step?",
    mood: "brave",
    theme: "change",
    source: "offline"
  };
  return {
    answer: "The penny disappears, but the wish does not. It settles beneath the noise where the truest part of it can finally be heard.",
    meaning: "This may be less a request for a miracle than an honest admission that something matters deeply to you. Giving it words is already movement.",
    nextStep: "Complete this sentence: ‘The part I can influence is…’ and act on what follows.",
    shareLine: "Some answers begin when the wish is finally spoken plainly.",
    followUpQuestion: "What has shifted since you placed this wish in the water?",
    mood: "moonlit",
    theme: "uncertainty",
    source: "offline"
  };
}

function deepenFallback(response) {
  if (!response) return response;
  return {
    ...response,
    answer: `${response.answer} Beneath that first echo, the well also hears a question about what you are willing to choose, protect, or release so the wish has room to become real.`,
    meaning: `${response.meaning} The repeated feeling underneath it may be the useful clue: it points toward the need that deserves a clearer boundary or a more deliberate commitment.`,
    nextStep: `${response.nextStep} Then write one sentence about what you will stop giving energy to while you do it.`,
    source: `${response.source || "offline"}-deep`
  };
}

function moonifyFallback(response) {
  const deep = deepenFallback(response);
  return {
    ...deep,
    answer: `${deep.answer} In moonlight, the deeper question is what would change if you stopped carrying this wish in the same familiar way.`,
    meaning: `${deep.meaning} Try asking what the wish is attempting to protect, not only what it is attempting to obtain.`,
    nextStep: `${deep.nextStep} Before the day ends, complete one sentence beginning with “For the next seven days, I will…”`,
    followUpQuestion: "What looked different once you stopped carrying the wish in the old way?",
    mood: "moonlit",
    source: `${deep.source || "offline"}-moon`
  };
}

async function requestWishResponse(wish, coinIntent) {
  const response = await fetch("/api/wish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: state.sessionId, wish, priorThemes: priorThemes(), coinIntent })
  });
  const data = await response.json().catch(() => ({}));
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
  const responsePromise = requestWishResponse(runtime.currentWish, localCoinSource).catch(error => {
    if (error.code === "NO_COIN") throw error;
    console.warn("Using offline well response:", error);
    const safety = clientSafetyResponse(runtime.currentWish);
    const fallback = clientFallbackResponse(runtime.currentWish);
    return safety || (localCoinSource === "moon"
      ? moonifyFallback(fallback)
      : localCoinSource === "copper" ? deepenFallback(fallback) : fallback);
  });

  await animateToss();
  elements.listeningState.hidden = false;
  elements.waterSurface.classList.add("listening");

  try {
    const response = await responsePromise;
    const remaining = Math.max(0, 1900 - (Date.now() - started));
    if (remaining) await new Promise(resolve => setTimeout(resolve, remaining));
    if (response.safety) {
      restoreLocalCoin(localCoinSource);
      updateUI();
    }
    const record = {
      id: createId(),
      cloudId: response.wishId || null,
      wish: runtime.currentWish,
      response: {
        answer: response.answer,
        meaning: response.meaning,
        nextStep: response.nextStep,
        shareLine: response.shareLine,
        followUpQuestion: response.followUpQuestion,
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
    trackEvent("wish_completed", { coin: record.coinSource, theme: record.response.theme, wishNumber: state.wishes.length });
    saveState();
    showResponse(record);
    updateUI();
  } catch (error) {
    restoreLocalCoin(localCoinSource);
    updateUI();
    elements.listeningState.hidden = true;
    elements.waterSurface.classList.remove("listening", "active");
    elements.appShell.classList.remove("tossing");
    elements.coinDock.hidden = false;
    showToast(error.message || "The well went quiet. Your penny was returned.", 3500);
    runtime.busy = false;
  }
}

function showResponse(record) {
  runtime.currentRecord = record;
  runtime.currentWish = record.wish || "";
  const isMoon = record.coinSource === "moon" || record.response.source?.includes("moon");
  const isCopper = record.coinSource === "copper" || (!isMoon && record.response.source?.includes("deep"));
  const isPremium = isCopper || isMoon;
  elements.answerText.textContent = record.response.answer;
  elements.meaningText.textContent = record.response.meaning;
  elements.nextStepText.textContent = record.response.nextStep;
  elements.responseModeLabel.textContent = isMoon ? "A Moon Water echo" : isCopper ? "A Deep Water echo" : "The water answers";
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
  const showUpgrade = !record.isMonthly && !safetyResponse && !isPremium;
  elements.upgradeOffer.hidden = !showUpgrade;
  if (showUpgrade) {
    const isFirstWish = state.wishes.filter(wish => !wish.response?.safety).length <= 1;
    elements.upgradeTitle.textContent = isFirstWish ? "Choose a deeper penny" : "Keep the water moving";
    elements.upgradeText.textContent = isFirstWish
      ? "Copper pennies open a deeper answer. Moon pennies add a longer pattern insight, a perspective shift, and their own moonlit share card."
      : "Your daily echo is complete. Copper and moon pennies each unlock a distinct premium response.";
    trackEvent("upgrade_offer_viewed", { firstWish: isFirstWish, theme: record.response.theme });
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
  ctx.fillText("The Listening Well", width / 2, 1300);
  ctx.fillStyle = "#99aa9f";
  ctx.font = "19px Arial";
  ctx.fillText(isMoon ? "A moon penny. A longer look beneath the surface." : isCopper ? "A copper penny. A deeper personal echo." : "Throw in a penny. Hear what the water has to say.", width / 2, 1330);
}

async function canvasBlob() {
  return new Promise(resolve => elements.shareCanvas.toBlob(resolve, "image/png", .95));
}

function openShare() {
  if (!runtime.currentRecord) return;
  renderShareCard(runtime.currentRecord);
  openOverlay(elements.shareModal);
}

async function shareCard() {
  if (!runtime.currentRecord) return;
  const blob = await canvasBlob();
  const file = new File([blob], "the-listening-well.png", { type: "image/png" });
  const shareData = {
    title: SHARE_NAME,
    text: `The well told me: “${runtime.currentRecord.response.shareLine}”`,
    url: location.origin,
    files: [file]
  };
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share(shareData);
      runtime.currentRecord.sharedAt = new Date().toISOString();
      trackEvent("echo_shared", { coin: runtime.currentRecord.coinSource, theme: runtime.currentRecord.response.theme });
      saveState();
      showToast("Your echo was shared. Your wish stayed private.");
    } else {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "the-listening-well.png";
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
  if (state.wishes.length < 3 || runtime.busy) return;
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
      body: JSON.stringify({ sessionId: state.sessionId, wishes: state.wishes.slice(-12).map(record => record.wish) })
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

async function startCheckout(pack) {
  trackEvent("checkout_started", { pack, source: runtime.currentRecord ? "response" : "penny_menu" });
  if (!runtime.config.payments) {
    elements.paymentNote.textContent = "The payment flow is built and waiting for Stripe price IDs and a secret key.";
    showToast("Payments are ready for Stripe keys, but not connected yet.");
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
      state.dailyAvailable = profile.daily_claim_date !== localDateKey();
    }
    if (Array.isArray(data.wishes) && data.wishes.length) {
      const existingCloudIds = new Set(state.wishes.map(record => record.cloudId).filter(Boolean));
      for (const cloud of data.wishes.reverse()) {
        if (existingCloudIds.has(cloud.id)) continue;
        const likelyMatch = state.wishes.find(record => !record.cloudId && Math.abs(new Date(record.createdAt).getTime() - new Date(cloud.created_at).getTime()) < 120000 && record.wish === cloud.wish_text);
        if (likelyMatch) {
          likelyMatch.cloudId = cloud.id;
          likelyMatch.sealedUntil = cloud.sealed_until || likelyMatch.sealedUntil;
          continue;
        }
        state.wishes.push({
          id: createId(),
          cloudId: cloud.id,
          wish: cloud.wish_text,
          response: {
            answer: cloud.answer,
            meaning: cloud.meaning,
            nextStep: cloud.next_step,
            shareLine: cloud.share_line,
            followUpQuestion: cloud.follow_up_question,
            mood: cloud.mood,
            theme: cloud.theme || "uncertainty",
            safety: cloud.safety || null,
            source: "cloud"
          },
          coinSource: cloud.coin_source,
          createdAt: cloud.created_at,
          sealedUntil: cloud.sealed_until,
          revisitedAt: null,
          sharedAt: null
        });
      }
    }
    if (Array.isArray(data.monthlyReflections) && data.monthlyReflections.length) {
      const existingReflectionIds = new Set(state.monthlyReflections.map(record => record.cloudId).filter(Boolean));
      for (const cloud of data.monthlyReflections.reverse()) {
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
    elements.paymentNote.textContent = runtime.config.payments
      ? "Secure checkout opens through Stripe. Purchased credits are added after the signed webhook confirms payment."
      : "Payments stay in preview until both Supabase and Stripe are connected.";
    await syncCloudState();
  } catch {
    runtime.config = { ai: false, database: false, payments: false };
  }
}

function exportJournal() {
  const safeExport = {
    exportedAt: new Date().toISOString(),
    app: SHARE_NAME,
    wishes: state.wishes.map(record => ({
      wish: record.wish,
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
  anchor.download = `listening-well-journal-${localDateKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Your private journal export is ready.");
}

async function clearDevice() {
  const confirmed = window.confirm("Clear every wish and setting saved on this device? This cannot be undone.");
  if (!confirmed) return;
  const sessionId = state.sessionId;
  if (runtime.config.database) {
    try {
      await fetch("/api/delete-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
    } catch {
      showToast("Local data was cleared, but the cloud deletion could not be confirmed.", 4200);
    }
  }
  storageRemove(STORAGE_KEY);
  state = freshState();
  saveState();
  closeOverlay(elements.journalDrawer);
  resetExperience();
  updateUI();
  showToast("This device has been cleared.");
}

async function confirmPurchasedCredits(startingWallet, expectedCoin = null) {
  const delays = [900, 1800, 3200, 5200, 8000];
  for (const delay of delays) {
    await new Promise(resolve => setTimeout(resolve, delay));
    await syncCloudState();
    const copperAdded = state.copperCredits - startingWallet.copper;
    const moonAdded = state.moonCredits - startingWallet.moon;
    if (copperAdded > 0 || moonAdded > 0) {
      const deliveredCoin = moonAdded > 0 ? "moon" : "copper";
      const added = Math.max(moonAdded, copperAdded);
      trackEvent("credits_delivered", { added, coin: deliveredCoin, expectedCoin });
      showToast(`${added} ${deliveredCoin} pennies are ready.`, 3800);
      return true;
    }
  }
  showToast("Stripe is still confirming your pennies. The webhook log in Admin will show the result.", 5600);
  return false;
}

function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  if (!payment) return;
  const pack = params.get("pack");
  const expectedCoin = pack === "moon_30" || pack === "keeper_monthly" ? "moon" : pack === "copper_10" ? "copper" : null;
  history.replaceState({}, "", window.location.pathname);
  if (payment === "success") {
    const startingWallet = { copper: Number(state.copperCredits || 0), moon: Number(state.moonCredits || 0) };
    trackEvent("checkout_returned_success", { pack, expectedCoin });
    showToast(`Stripe is confirming your ${expectedCoin || "purchased"} pennies.`, 3800);
    confirmPurchasedCredits(startingWallet, expectedCoin);
  } else if (payment === "cancelled") {
    trackEvent("checkout_cancelled");
    showToast("Nothing was charged. Your available pennies are still here.");
  }
}

function registerPWA() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    runtime.installPrompt = event;
    elements.installButton.hidden = false;
  });
  elements.installButton.addEventListener("click", async () => {
    if (!runtime.installPrompt) return;
    runtime.installPrompt.prompt();
    await runtime.installPrompt.userChoice;
    runtime.installPrompt = null;
    elements.installButton.hidden = true;
  });
}

function bindEvents() {
  elements.wishInput.addEventListener("input", () => {
    elements.characterCount.textContent = `${elements.wishInput.value.length} / 600`;
  });
  elements.wishInput.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") preparePenny();
  });
  elements.readyButton.addEventListener("click", preparePenny);
  elements.editWishButton.addEventListener("click", editWish);
  for (const button of elements.coinChoiceButtons) {
    button.addEventListener("click", () => {
      const source = button.dataset.coinChoice;
      if (coinBalance(source) < 1) return;
      setCoinVisual(source);
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

  elements.closeResponse.addEventListener("click", () => resetExperience());
  elements.newWishButton.addEventListener("click", () => resetExperience());
  elements.homeButton.addEventListener("click", () => resetExperience());
  elements.sealButton.addEventListener("click", openSealModal);
  elements.shareButton.addEventListener("click", openShare);
  elements.journalButton.addEventListener("click", openJournal);
  elements.pennyButton.addEventListener("click", () => openOverlay(elements.pennyModal));
  elements.upgradeButton.addEventListener("click", () => {
    trackEvent("upgrade_offer_clicked", { theme: runtime.currentRecord?.response?.theme || "unknown" });
    openOverlay(elements.pennyModal);
  });
  elements.giftFromResponseButton.addEventListener("click", shareGiftPenny);
  elements.giftButton.addEventListener("click", shareGiftPenny);
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

  $$('[data-close-drawer]').forEach(node => node.addEventListener("click", () => closeOverlay(elements.journalDrawer)));
  $$('[data-close-modal]').forEach(node => node.addEventListener("click", () => closeOverlay(elements.pennyModal)));
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
  updateUI();
  registerPWA();
  handlePaymentReturn();
  await loadConfig();
}

init();
