const CATEGORIES = [
  { name: "Housing", color: "#4c8dff", budget: 0 },
  { name: "Food", color: "#39b6e6", budget: 0 },
  { name: "Transport", color: "#6a8cff", budget: 0 },
  { name: "Bills", color: "#7c74e8", budget: 0 },
  { name: "Health", color: "#5aa6f5", budget: 0 },
  { name: "Shopping", color: "#8aaefc", budget: 0 },
  { name: "Entertainment", color: "#4ec4c8", budget: 0 },
  { name: "Other", color: "#7db7ff", budget: 0 },
  { name: "Income", color: "#2b7fff", budget: 0 },
];

const ACCOUNTS = [
  { name: "Saving Account", inst: "", bal: 0, type: "Savings" },
];
const OLD_DEFAULT_ACCOUNTS = ["Everyday checking", "Rewards card", "High-yield savings"];

function accountInUse(name) {
  const acc = ACCOUNTS.find((a) => a.name === name);
  if (!acc) return false;
  if (acc.bal) return true;
  return tx.some((t) => t.account === name);
}

function migrateDefaultAccounts() {
  ["Everyday checking", "Rewards card"].forEach((name) => {
    if (!accountInUse(name)) {
      const i = ACCOUNTS.findIndex((a) => a.name === name);
      if (i >= 0) ACCOUNTS.splice(i, 1);
    }
  });
  const hy = ACCOUNTS.find((a) => a.name === "High-yield savings");
  if (!hy) {
    if (!ACCOUNTS.length) {
      ACCOUNTS.push({ name: "Saving Account", inst: "", bal: 0, type: "Savings" });
    }
    return;
  }
  const existing = ACCOUNTS.find((a) => a.name === "Saving Account");
  if (existing) {
    if (!accountInUse("High-yield savings")) {
      ACCOUNTS.splice(ACCOUNTS.indexOf(hy), 1);
    }
    return;
  }
  hy.name = "Saving Account";
  hy.type = "Savings";
  tx.forEach((t) => {
    if (t.account === "High-yield savings") t.account = "Saving Account";
  });
}

const GOALS = [];
let tx = [];

const months = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const today = new Date();
let monthIndex = today.getMonth();
let year = today.getFullYear();

const STORE_DATA = "ledger.data.v3";
const STORE_THEME = "ledger.theme";
const STORE_HASH = "ledger.fileHash.v3";
const STORE_FILE = "ledger.fileName.v3";

let profile = { name: "You", initials: "Y" };
let theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
let lastFileHash = null;
let lastFileName = null;
let fileHandle = null;
let localSavedAt = null;
let lastPersistedHash = null;
let announceSignIn = false;
let cloudAuth = null;
let cloudDb = null;
let cloudUser = null;
let cloudStatus = "local";
let applyingCloud = false;
let hydratingCloud = false;
let cloudHydratedUid = null;
let cloudSaveTimer = 0;
let fileSaveTimer = 0;
let fileSyncStatus = "none";
let flowRange = "30";
let flowMonthKey = null;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => (n < 0 ? "-" : "") + "₹" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statsFigures({ hero, heroLabel, pct, leftValue, leftLabel, ofValue, ofLabel, over, barPct, barColor }) {
  const pctEl = pct == null || pct === "" ? "" : `<div class="stat-hero-pct">${pct}%</div>`;
  return `<div class="stat-hero">
      <div>
        <div class="stat-hero-value${over ? " bad" : ""}">${hero}</div>
        <div class="stat-hero-label">${heroLabel}</div>
      </div>
      ${pctEl}
    </div>
    <div class="stat-pair">
      <div>
        <div class="stat-pair-value${over ? " bad" : ""}">${leftValue}</div>
        <div class="stat-pair-label">${leftLabel}</div>
      </div>
      <div>
        <div class="stat-pair-value">${ofValue}</div>
        <div class="stat-pair-label">${ofLabel}</div>
      </div>
    </div>
    <div class="bar thick"><span style="width:${barPct}%;background:${barColor}"></span></div>`;
}

function budgetStatModel(cat, spent) {
  const cap = cat.budget || 0;
  const over = cap > 0 && spent > cap;
  const left = cap - spent;
  const pct = cap ? Math.round(Math.min(999, (spent / cap) * 100)) : null;
  return {
    hero: money(spent),
    heroLabel: "spent",
    pct,
    leftValue: over ? money(spent - cap) : money(Math.max(0, left)),
    leftLabel: over ? "over" : "left",
    ofValue: money(cap),
    ofLabel: "of budget",
    over,
    barPct: cap ? Math.min(100, (spent / cap) * 100) : 0,
    barColor: over ? "var(--coral)" : cat.color,
  };
}

function budgetCardBody(cat, spent) {
  const cap = cat.budget || 0;
  const over = cap > 0 && spent > cap;
  const remain = over ? spent - cap : Math.max(0, cap - spent);
  const pct = cap ? Math.round((spent / cap) * 100) : 0;
  const deg = cap ? Math.min(360, (spent / cap) * 360) : 0;
  const fill = over ? "var(--coral)" : cat.color || "var(--mint)";
  const ring = cap
    ? `conic-gradient(${fill} ${deg}deg, var(--ring-track) 0)`
    : "conic-gradient(var(--ring-track) 0deg, var(--ring-track) 360deg)";
  const center = cap ? `${Math.min(999, pct)}%` : "—";
  const leftLabel = !cap ? "left" : over ? "over" : "left";
  const leftValue = !cap ? "—" : money(remain);
  return `<div class="budget-visual">
    <div class="donut${over ? " over" : ""}" style="background:${ring}" role="img" aria-label="${esc(cat.name)} ${center} of budget">
      <div class="donut-hole">${center}</div>
    </div>
    <div class="budget-metric">
      <div class="goal-metric-label">Spent</div>
      <div class="goal-metric-value${over ? " bad" : ""}">${money(spent)}</div>
    </div>
    <div class="budget-metric">
      <div class="goal-metric-label">${leftLabel}</div>
      <div class="goal-metric-value${over ? " bad" : ""}">${leftValue}</div>
    </div>
  </div>`;
}
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const MERCHANT_CATS = [
  { cat: "Food", keys: ["zepto", "blinkit", "instamart", "bigbasket", "grofers", "dunzo", "swiggy", "zomato", "eatclub", "box8", "faasos", "dominos", "domino's", "mcdonald", "kfc", "burger king", "starbucks", "haldiram", "wow momo"] },
  { cat: "Transport", keys: ["uber", "ola", "rapido", "metro", "irctc", "indigo", "air india", "fastag", "indian oil", "hp petrol", "bharat petroleum"] },
  { cat: "Bills", keys: ["airtel", "jio", "vi prepaid", "vi postpaid", "bsnl", "tata power", "adani electricity", "bescom", "act fibernet", "netflix", "spotify", "hotstar", "jiohotstar", "amazon prime", "prime video", "youtube premium", "apple.com/bill", "chatgpt", "openai"] },
  { cat: "Shopping", keys: ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "croma", "reliance digital"] },
  { cat: "Health", keys: ["apollo", "pharmeasy", "1mg", "netmeds", "practo", "fortis", "medplus"] },
  { cat: "Entertainment", keys: ["bookmyshow", "pvr", "inox", "district by zomato"] },
  { cat: "Housing", keys: ["nobroker", "housing.com", "rent", "society maintenance"] },
];

const MERCHANT_HINTS = [
  "Zepto", "Blinkit", "Swiggy", "Zomato", "BigBasket", "Uber", "Ola", "Rapido",
  "Amazon", "Flipkart", "Myntra", "Netflix", "Spotify", "Airtel", "Jio",
  "Apollo Pharmacy", "PharmEasy", "BookMyShow",
];

const CAT_COLORS = [
  "#4c8dff", "#39b6e6", "#6a8cff", "#7c74e8", "#5aa6f5", "#45c4e0",
  "#8aaefc", "#4ec4c8", "#2b7fff", "#7db7ff", "#5b9dff", "#3ec8e0",
];

const MONEY_QUOTES = [
  { t: "A budget is telling your money where to go instead of wondering where it went.", a: "John C. Maxwell" },
  { t: "Do not save what is left after spending, but spend what is left after saving.", a: "Warren Buffett" },
  { t: "Beware of little expenses; a small leak will sink a great ship.", a: "Benjamin Franklin" },
  { t: "It's not how much money you make, but how much money you keep.", a: "Robert Kiyosaki" },
  { t: "Never spend your money before you have earned it.", a: "Thomas Jefferson" },
  { t: "Wealth consists not in having great possessions, but in having few wants.", a: "Epictetus" },
  { t: "If you would be wealthy, think of saving as well as getting.", a: "Benjamin Franklin" },
  { t: "It's not your salary that makes you rich, it's your spending habits.", a: "Charles A. Jaffe" },
  { t: "You must gain control over your money or the lack of it will forever control you.", a: "Dave Ramsey" },
  { t: "An investment in knowledge pays the best interest.", a: "Benjamin Franklin" },
  { t: "Don't tell me where your priorities are. Show me where you spend your money and I'll tell you what they are.", a: "James W. Frick" },
  { t: "The safest way to double your money is to fold it over once and put it in your pocket.", a: "Kin Hubbard" },
  { t: "Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it.", a: "Attributed to Einstein" },
  { t: "Too many people spend money they haven't earned, to buy things they don't want, to impress people they don't like.", a: "Will Rogers" },
  { t: "Financial peace isn't the acquisition of stuff. It's learning to live on less than you make.", a: "Dave Ramsey" },
  { t: "Time is more valuable than money. You can get more money, but you cannot get more time.", a: "Jim Rohn" },
  { t: "Money is only a tool. It will take you wherever you wish, but it will not replace you as the driver.", a: "Ayn Rand" },
  { t: "The habit of saving is itself an education.", a: "T. T. Munger" },
  { t: "Save money and money will save you.", a: "Jamaican proverb" },
  { t: "Never depend on a single income. Make an investment to create a second source.", a: "Warren Buffett" },
];

const STORE_QUOTE = "cashcache.quote";
const QUOTE_MS = 60 * 60 * 1000;

function pickQuoteIndex(exclude) {
  let i = Math.floor(Math.random() * MONEY_QUOTES.length);
  if (MONEY_QUOTES.length > 1 && i === exclude) i = (i + 1) % MONEY_QUOTES.length;
  return i;
}

function readQuoteSlot() {
  try {
    const slot = JSON.parse(localStorage.getItem(STORE_QUOTE) || "null");
    if (!slot || !Number.isInteger(slot.i) || !slot.at) return null;
    if (!MONEY_QUOTES[slot.i]) return null;
    return slot;
  } catch (err) {
    return null;
  }
}

function paintQuote(q) {
  const text = $("#quoteText");
  const by = $("#quoteBy");
  if (text) text.textContent = q.t;
  if (by) by.textContent = "— " + q.a;
}

function startQuoteClock() {
  let slot = readQuoteSlot();
  const now = Date.now();
  if (!slot || now - slot.at >= QUOTE_MS) {
    slot = { i: pickQuoteIndex(slot ? slot.i : -1), at: now };
    try { localStorage.setItem(STORE_QUOTE, JSON.stringify(slot)); } catch (err) {}
  }
  paintQuote(MONEY_QUOTES[slot.i]);
  const wait = Math.max(1500, QUOTE_MS - (Date.now() - slot.at));
  setTimeout(function tick() {
    slot = { i: pickQuoteIndex(slot.i), at: Date.now() };
    try { localStorage.setItem(STORE_QUOTE, JSON.stringify(slot)); } catch (err) {}
    paintQuote(MONEY_QUOTES[slot.i]);
    setTimeout(tick, QUOTE_MS);
  }, wait);
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

function initialsFrom(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
}

function exportState(savedAt) {
  return {
    version: 1,
    savedAt: savedAt || new Date().toISOString(),
    theme,
    monthIndex,
    year,
    flowRange,
    flowMonthKey,
    profile: { name: profile.name, initials: profile.initials },
    categories: CATEGORIES.map((c) => ({ ...c })),
    accounts: ACCOUNTS.map((a) => ({ ...a })),
    goals: GOALS.map((g) => ({ ...g })),
    transactions: tx.map((t) => ({ ...t })),
  };
}

function dataHash() {
  return JSON.stringify({
    profile,
    categories: CATEGORIES,
    accounts: ACCOUNTS,
    goals: GOALS,
    transactions: tx,
  });
}

function linkedFileName() {
  return (fileHandle && fileHandle.name) || lastFileName || "";
}

function linkedFileTitle() {
  const name = linkedFileName();
  if (!name) return "No linked file. Profile → Save file to choose one.";
  return `Linked file: ${name}\nThe browser does not expose the full disk path.`;
}

function updateSyncUI() {
  const el = $("#syncStatus");
  if (!el) return;
  if (cloudUser) {
    if (cloudStatus === "saving") {
      el.textContent = "Saving";
      el.className = "sync-pill saving";
      el.title = `Saving to Firebase as ${cloudUser.email || "Google"}`;
      return;
    }
    if (cloudStatus === "error") {
      el.textContent = "Offline";
      el.className = "sync-pill unsynced";
      el.title = "Cloud save failed. Data stays in this browser until you are back online.";
      return;
    }
    el.textContent = "Cloud";
    el.className = "sync-pill synced";
    el.title = `Synced to Firebase as ${cloudUser.email || "Google"}`;
    return;
  }
  const name = linkedFileName();
  if (fileHandle || lastFileHash) {
    if (fileSyncStatus === "saving") {
      el.textContent = "Saving";
      el.className = "sync-pill saving";
      el.title = name ? `Auto-saving ${name}` : "Saving linked file";
      return;
    }
    if (fileSyncStatus === "denied") {
      el.textContent = "Not synced";
      el.className = "sync-pill unsynced";
      el.title = `${linkedFileTitle()}\nClick Save file in Profile to grant write permission.`;
      return;
    }
    if (lastFileHash && lastFileHash === dataHash()) {
      el.textContent = "Synced";
      el.className = "sync-pill synced";
      el.title = linkedFileTitle();
      return;
    }
    el.textContent = "Not synced";
    el.className = "sync-pill unsynced";
    el.title = name
      ? `${linkedFileTitle()}\nUnsaved changes — will auto-save if permission is granted.`
      : "Save a JSON file in Profile to keep a linked copy.";
    return;
  }
  el.textContent = "Local";
  el.className = "sync-pill unsynced";
  el.title = "Stored in this browser. Profile → Save file to link a JSON file, or sign in with Google.";
}

function persist(opts = {}) {
  try {
    const hash = dataHash();
    const savedAt = opts.savedAt
      || (hash === lastPersistedHash && localSavedAt)
      || new Date().toISOString();
    const state = exportState(savedAt);
    localSavedAt = state.savedAt;
    lastPersistedHash = hash;
    localStorage.setItem(STORE_DATA, JSON.stringify(state));
    localStorage.setItem(STORE_THEME, theme);
    if (lastFileHash) localStorage.setItem(STORE_HASH, lastFileHash);
    else localStorage.removeItem(STORE_HASH);
    if (lastFileName) localStorage.setItem(STORE_FILE, lastFileName);
    else localStorage.removeItem(STORE_FILE);
  } catch (err) {}
  updateSyncUI();
  if (!opts.skipCloud) scheduleCloudSave();
  if (!opts.skipFile) scheduleFileSave();
}

function replaceArr(target, next) {
  if (!Array.isArray(next)) return;
  target.length = 0;
  next.forEach((item) => target.push(item));
}

function applyTheme(next, { silent = false } = {}) {
  theme = next === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  const meta = $("#themeColor");
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1020" : "#e8f3fc");
  const btn = $("#themeToggle");
  if (btn) {
    const toLight = theme === "dark";
    btn.textContent = toLight ? "☀" : "☾";
    btn.title = toLight ? "Switch to light theme" : "Switch to dark theme";
    btn.setAttribute("aria-label", btn.title);
  }
  try { localStorage.setItem(STORE_THEME, theme); } catch (err) {}
  if (!silent) persist();
}

function applyState(data, { fromFile = false, fileName = null } = {}) {
  if (!data || typeof data !== "object") throw new Error("Invalid ledger file");
  const transactions = data.transactions || data.tx;
  if (transactions && !Array.isArray(transactions)) throw new Error("Invalid transactions");
  if (data.categories) replaceArr(CATEGORIES, data.categories);
  if (data.accounts) replaceArr(ACCOUNTS, data.accounts);
  if (data.goals) replaceArr(GOALS, data.goals);
  if (transactions) {
    tx = transactions.map((t) => ({
      date: t.date,
      merchant: t.merchant,
      category: t.category,
      account: t.account,
      amount: Number(t.amount),
      type: t.type || (Number(t.amount) >= 0 ? "income" : "expense"),
    }));
  }
  if (data.profile && data.profile.name) {
    profile.name = String(data.profile.name).trim();
    profile.initials = String(data.profile.initials || initialsFrom(profile.name))
      .slice(0, 3)
      .toUpperCase();
  }
  if (Number.isInteger(data.monthIndex)) monthIndex = ((data.monthIndex % 12) + 12) % 12;
  if (Number.isInteger(data.year)) year = data.year;
  if (data.theme === "dark" || data.theme === "light") applyTheme(data.theme, { silent: true });
  if (data.flowRange === "30" || data.flowRange === "month") flowRange = data.flowRange;
  if (typeof data.flowMonthKey === "string" || data.flowMonthKey === null) flowMonthKey = data.flowMonthKey;
  if (fromFile) {
    lastFileHash = dataHash();
    if (fileName) lastFileName = fileName;
  }
}

function loadLocal() {
  try {
    lastFileHash = localStorage.getItem(STORE_HASH);
    lastFileName = localStorage.getItem(STORE_FILE);
    const raw = localStorage.getItem(STORE_DATA);
    if (raw) {
      const data = JSON.parse(raw);
      localSavedAt = data.savedAt || null;
      applyState(data);
      lastPersistedHash = dataHash();
    }
  } catch (err) {}
}

function renderProfile() {
  const av = $("#openProfile");
  if (av) {
    av.textContent = profile.initials;
    av.title = `${profile.name} — edit profile`;
  }
  const plan = $("#planName");
  if (plan) {
    const first = profile.name.trim().split(/\s+/)[0] || "Personal";
    plan.textContent = `${first} · ${months[monthIndex].slice(0, 3)} ${year}`;
  }
  const prev = $("#profilePreview");
  if (prev) prev.textContent = profile.initials;
  const pname = $("#profilePreviewName");
  if (pname) pname.textContent = profile.name;
  renderAuth();
}

function downloadJson(json) {
  lastFileName = lastFileName || "cashcache.json";
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = lastFileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("cashcache", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("handles")) req.result.createObjectStore("handles");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function rememberFileHandle(handle) {
  if (!handle) return;
  try {
    const db = await idbOpen();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "ledger");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {}
}

async function rememberedFileHandle() {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("ledger");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return null;
  }
}

async function ensureFilePermission(handle) {
  if (!handle || !handle.queryPermission) return true;
  const opts = { mode: "readwrite" };
  try {
    let perm = await handle.queryPermission(opts);
    if (perm === "granted") return true;
    if (perm === "prompt") {
      perm = await handle.requestPermission(opts);
      return perm === "granted";
    }
  } catch (err) {}
  return false;
}

async function writeLinkedFile() {
  if (!fileHandle) return false;
  const json = JSON.stringify(exportState(localSavedAt), null, 2);
  const writable = await fileHandle.createWritable();
  await writable.write(json);
  await writable.close();
  lastFileName = fileHandle.name || lastFileName || "cashcache.json";
  lastFileHash = dataHash();
  fileSyncStatus = "synced";
  return true;
}

function scheduleFileSave() {
  if (cloudUser || !fileHandle) return;
  if (lastFileHash === dataHash()) {
    fileSyncStatus = "synced";
    updateSyncUI();
    return;
  }
  fileSyncStatus = "saving";
  updateSyncUI();
  clearTimeout(fileSaveTimer);
  fileSaveTimer = setTimeout(() => { autoSaveLinkedFile(); }, 800);
}

async function autoSaveLinkedFile() {
  if (cloudUser || !fileHandle) return;
  if (lastFileHash === dataHash()) {
    fileSyncStatus = "synced";
    updateSyncUI();
    return;
  }
  try {
    const ok = await ensureFilePermission(fileHandle);
    if (!ok) {
      fileSyncStatus = "denied";
      updateSyncUI();
      return;
    }
    fileSyncStatus = "saving";
    updateSyncUI();
    await writeLinkedFile();
    persist({ skipCloud: true, skipFile: true });
  } catch (err) {
    fileSyncStatus = "denied";
  }
  updateSyncUI();
}

async function restoreLinkedFile() {
  const handle = await rememberedFileHandle();
  if (!handle) return;
  fileHandle = handle;
  lastFileName = handle.name || lastFileName;
  try {
    const perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") {
      fileSyncStatus = lastFileHash === dataHash() ? "synced" : "unsynced";
      if (fileSyncStatus === "unsynced") scheduleFileSave();
    } else {
      fileSyncStatus = "denied";
    }
  } catch (err) {
    fileSyncStatus = "denied";
  }
  updateSyncUI();
}

async function saveJsonFile() {
  const json = JSON.stringify(exportState(localSavedAt), null, 2);
  try {
    if (window.showSaveFilePicker) {
      if (!fileHandle) {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: lastFileName || "cashcache.json",
          types: [{ description: "Ledger JSON", accept: { "application/json": [".json"] } }],
        });
        await rememberFileHandle(fileHandle);
      }
      const ok = await ensureFilePermission(fileHandle);
      if (!ok) throw new Error("permission");
      await writeLinkedFile();
    } else {
      downloadJson(json);
      lastFileHash = dataHash();
      fileSyncStatus = "synced";
    }
    persist({ skipFile: true });
    toast(`Saved ${lastFileName || "cashcache.json"}`);
  } catch (err) {
    if (err && err.name === "AbortError") return;
    downloadJson(json);
    lastFileHash = dataHash();
    fileSyncStatus = "synced";
    persist({ skipFile: true });
    toast("Downloaded cashcache.json");
  }
}

async function loadFromFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    toast("That file is not valid JSON.");
    return;
  }
  try {
    applyState(data, { fromFile: true, fileName: file.name });
  } catch (err) {
    toast("Could not read that ledger file.");
    return;
  }
  populateSelects();
  refresh();
  toast(`Reloaded ${file.name}`);
}

async function reloadJsonFile() {
  try {
    if (fileHandle) {
      const file = await fileHandle.getFile();
      await loadFromFile(file);
      return;
    }
  } catch (err) {}
  $("#jsonFile").click();
}

function firebaseConfigured() {
  const c = window.FIREBASE_CONFIG || {};
  return Boolean(window.firebase && c.apiKey && c.projectId);
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function asIso(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  } catch (err) {}
  return "";
}

function timeMs(iso) {
  const n = Date.parse(asIso(iso));
  return Number.isFinite(n) ? n : 0;
}

function workspaceLooksEmpty() {
  return tx.length === 0 && GOALS.length === 0 && (!profile.name || profile.name === "You");
}

function cloudHasWorkspace(data) {
  if (!data || typeof data !== "object") return false;
  if (Array.isArray(data.transactions) && data.transactions.length) return true;
  if (Array.isArray(data.goals) && data.goals.length) return true;
  if (data.profile && data.profile.name && data.profile.name !== "You") return true;
  return false;
}

function shouldUseCloud(data) {
  if (!cloudHasWorkspace(data)) return false;
  if (workspaceLooksEmpty()) return true;
  return timeMs(data.savedAt) >= timeMs(localSavedAt);
}

function cloudDoc(uid) {
  return cloudDb.collection("users").doc(uid);
}

function authErrorMessage(err) {
  const code = err && err.code;
  if (code === "auth/unauthorized-domain") {
    return `Add ${location.hostname} to Firebase Authentication → Settings → Authorized domains.`;
  }
  if (code === "auth/operation-not-allowed") return "Enable Google as a sign-in provider in Firebase Authentication.";
  if (code === "auth/invalid-api-key" || code === "auth/api-key-not-valid") return "Firebase API key looks invalid.";
  if (code === "auth/configuration-not-found") return "Firebase Auth isn’t set up for this app yet.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
  return (err && err.message) || "Google sign-in failed.";
}

function renderAuth() {
  const btn = $("#googleSignIn");
  const signed = $("#authSignedIn");
  const email = $("#authEmail");
  const hint = $("#authHint");
  const sub = $("#profilePreviewSub");
  const localBox = $("#localBackupBox");
  if (cloudUser) {
    if (btn) btn.hidden = true;
    if (signed) signed.hidden = false;
    if (email) email.textContent = cloudUser.email || cloudUser.displayName || "Signed in";
    if (hint) {
      hint.hidden = false;
      hint.textContent = "Workspace syncs to Firebase only.";
    }
    if (sub) sub.textContent = cloudUser.email || "Signed in";
    if (localBox) localBox.hidden = true;
    return;
  }
  if (btn) btn.hidden = false;
  if (signed) signed.hidden = true;
  if (localBox) localBox.hidden = false;
  if (sub) sub.textContent = "Personal workspace";
  if (hint) {
    hint.hidden = false;
    hint.textContent = firebaseConfigured()
      ? "Sync this workspace across devices."
      : "Cloud sync needs a Firebase web config in firebase-config.js.";
  }
}

function adoptGoogleProfile(user) {
  if (!user || !user.displayName) return;
  if (profile.name && profile.name !== "You") return;
  profile.name = user.displayName.trim();
  profile.initials = initialsFrom(profile.name);
}

function scheduleCloudSave() {
  if (!cloudUser || !cloudDb || applyingCloud || hydratingCloud) return;
  cloudStatus = "saving";
  updateSyncUI();
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => { saveToCloud(); }, 800);
}

async function saveToCloud() {
  if (!cloudUser || !cloudDb || applyingCloud) return;
  cloudStatus = "saving";
  updateSyncUI();
  try {
    await cloudDoc(cloudUser.uid).set(jsonSafe(exportState(localSavedAt)));
    cloudStatus = "ok";
  } catch (err) {
    cloudStatus = "error";
    console.warn("Cloud save failed", err);
  }
  updateSyncUI();
}

async function hydrateFromCloud(user) {
  if (!user || !cloudDb || hydratingCloud) return;
  if (cloudHydratedUid === user.uid) {
    scheduleCloudSave();
    return;
  }
  const announce = announceSignIn;
  announceSignIn = false;
  hydratingCloud = true;
  applyingCloud = true;
  try {
    const snap = await cloudDoc(user.uid).get();
    const data = snap.exists ? snap.data() : null;
    if (data && shouldUseCloud(data)) {
      if (timeMs(data.savedAt) !== timeMs(localSavedAt)) {
        applyState(data);
        populateSelects();
        refresh({ skipPersist: true });
        persist({ savedAt: asIso(data.savedAt) || localSavedAt, skipCloud: true, skipFile: true });
        toast("Loaded your cloud workspace.");
      }
    } else {
      adoptGoogleProfile(user);
      applyingCloud = false;
      persist({ skipCloud: true, skipFile: true });
      await saveToCloud();
      refresh({ skipPersist: true });
      if (announce) {
        toast(snap.exists
          ? "Signed in — this device’s data is now in the cloud."
          : "Signed in — workspace will sync.");
      }
    }
    cloudHydratedUid = user.uid;
  } catch (err) {
    cloudStatus = "error";
    updateSyncUI();
    toast("Signed in, but the cloud copy could not be loaded.");
    console.warn("Cloud load failed", err);
  } finally {
    applyingCloud = false;
    hydratingCloud = false;
  }
}

async function signInWithGoogle() {
  if (!window.firebase) {
    toast("Firebase did not load. Check your network and refresh.");
    return;
  }
  if (!firebaseConfigured() || !cloudAuth) {
    toast("Paste your Firebase web config into firebase-config.js, then refresh.");
    return;
  }
  announceSignIn = true;
  const btn = $("#googleSignIn");
  if (btn) {
    btn.disabled = true;
    const label = btn.querySelector(".google-btn-label");
    if (label) label.textContent = "Signing in…";
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await cloudAuth.signInWithPopup(provider);
  } catch (err) {
    if (err && (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment")) {
      try {
        await cloudAuth.signInWithRedirect(provider);
        return;
      } catch (redirectErr) {
        const msg = authErrorMessage(redirectErr);
        if (msg) toast(msg);
      }
    } else {
      const msg = authErrorMessage(err);
      if (msg) toast(msg);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      const label = btn.querySelector(".google-btn-label");
      if (label) label.textContent = "Continue with Google";
    }
  }
}

async function signOutGoogle() {
  if (!cloudAuth) return;
  try {
    await cloudAuth.signOut();
    toast("Signed out. Data stays on this device and in the cloud.");
  } catch (err) {
    toast("Could not sign out.");
  }
}

function initCloud() {
  $("#googleSignIn")?.addEventListener("click", () => { signInWithGoogle(); });
  $("#googleSignOut")?.addEventListener("click", () => { signOutGoogle(); });
  renderAuth();
  if (!firebaseConfigured()) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    cloudAuth = firebase.auth();
    cloudDb = firebase.firestore();
    try { cloudDb.settings({ ignoreUndefinedProperties: true }); } catch (err) {}
    cloudDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch (err) {
    console.warn("Firebase init failed", err);
    toast("Firebase could not start. Check firebase-config.js.");
    renderAuth();
    return;
  }
  cloudAuth.getRedirectResult().then((result) => {
    if (result && result.user) announceSignIn = true;
  }).catch((err) => {
    const msg = authErrorMessage(err);
    if (msg) toast(msg);
  });
  cloudAuth.onAuthStateChanged(async (user) => {
    cloudUser = user || null;
    if (!user) {
      cloudHydratedUid = null;
      cloudStatus = "local";
      renderAuth();
      updateSyncUI();
      return;
    }
    cloudStatus = "ok";
    renderAuth();
    updateSyncUI();
    await hydrateFromCloud(user);
  });
}

function inMonth(t, y = year, m = monthIndex) {
  const [ys, ms] = String(t.date).split("-").map(Number);
  return ys === y && ms === m + 1;
}

function spentByCategory(y = year, m = monthIndex) {
  const map = {};
  CATEGORIES.forEach((c) => { if (c.name !== "Income") map[c.name] = 0; });
  tx.filter((t) => t.amount < 0 && inMonth(t, y, m)).forEach((t) => {
    map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
  });
  return map;
}

function totalsFor(y = year, m = monthIndex) {
  const rows = tx.filter((t) => inMonth(t, y, m));
  const income = rows.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const spent = rows.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);
  return { income, spent, saved: income - spent };
}

function totals() {
  const month = totalsFor();
  const net = ACCOUNTS.reduce((a, x) => a + x.bal, 0);
  return { ...month, net };
}

function prevMonth() {
  return monthIndex === 0 ? { y: year - 1, m: 11 } : { y: year, m: monthIndex - 1 };
}

function setDelta(el, text, dir) {
  if (!el) return;
  el.textContent = text;
  el.className = "kpi-delta" + (dir ? ` ${dir}` : "");
}

function renderPlan() {
  const t = totals();
  const budgetTotal = CATEGORIES.reduce((a, c) => a + (c.budget || 0), 0);
  const used = budgetTotal ? Math.min(100, Math.round((t.spent / budgetTotal) * 100)) : 0;
  const bar = $("#planBar");
  const meta = $("#planMeta");
  if (bar) bar.style.width = `${used}%`;
  if (meta) {
    meta.textContent = budgetTotal
      ? `${used}% of monthly budget used`
      : "Set a budget to track this month";
  }
}

function renderKpis() {
  const t = totals();
  const prev = totalsFor(prevMonth().y, prevMonth().m);
  const budgetTotal = CATEGORIES.reduce((a, c) => a + (c.budget || 0), 0);
  const rate = t.income ? ((t.saved / t.income) * 100).toFixed(1) : "0.0";
  const used = budgetTotal ? Math.round((t.spent / budgetTotal) * 100) : 0;
  $("#kpiNet").textContent = money(t.net);
  $("#kpiIncome").textContent = money(t.income);
  $("#kpiSpent").textContent = money(t.spent);
  $("#kpiSaved").textContent = money(t.saved);

  const lastIn = tx.filter((x) => x.amount > 0 && inMonth(x)).sort((a, b) => b.date.localeCompare(a.date))[0];
  setDelta($("#kpiNetDelta"), t.net ? "Across linked accounts" : "Add accounts and activity");
  setDelta(
    $("#kpiIncomeDelta"),
    lastIn ? `Last · ${lastIn.date}` : "No income this month",
    t.income ? "up" : ""
  );
  setDelta(
    $("#kpiSpentDelta"),
    budgetTotal ? `${used}% of ${money(budgetTotal)} budget` : "No budget set"
  );
  const savedDir = t.income ? (t.saved >= 0 ? "up" : "down") : "";
  setDelta($("#kpiSavedDelta"), t.income ? `${rate}% savings rate` : "Add income to see a rate", savedDir);

  const incChg = t.income - prev.income;
  if (prev.income || t.income) {
    setDelta(
      $("#kpiIncomeDelta"),
      `${incChg >= 0 ? "▲" : "▼"} ${money(Math.abs(incChg))} vs ${months[prevMonth().m].slice(0, 3)}`,
      incChg >= 0 ? "up" : "down"
    );
  }
  renderPlan();
}

function renderMerchants() {
  const el = $("#merchantBars");
  if (!el) return;
  const map = {};
  let monthSpend = 0;
  tx.filter((t) => t.amount < 0 && inMonth(t)).forEach((t) => {
    const name = String(t.merchant || "").trim() || "Unknown";
    if (!map[name]) map[name] = { name, amount: 0, n: 0, category: t.category };
    map[name].amount += Math.abs(t.amount);
    map[name].n += 1;
    monthSpend += Math.abs(t.amount);
  });
  const rows = Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 6);
  if (!rows.length) {
    el.innerHTML = `<div class="empty">No spending this month.</div>`;
    return;
  }
  const max = Math.max(...rows.map((r) => r.amount), 1);
  el.innerHTML = rows
    .map((r) => {
      const cat = CATEGORIES.find((c) => c.name === r.category);
      const share = monthSpend ? Math.round((r.amount / monthSpend) * 100) : 0;
      const count = r.n === 1 ? "1 tx" : `${r.n} txs`;
      return `<div class="cat-row merchant-row">
        <div>
          <div class="tx-name">${esc(r.name)}</div>
          <div class="tx-meta">${esc(r.category)} · ${count} · ${share}% of spend</div>
        </div>
        <div class="bar"><span style="width:${(r.amount / max) * 100}%;background:${cat?.color || "#4c8dff"}"></span></div>
        <div class="amt">${money(r.amount)}</div>
      </div>`;
    })
    .join("");
}

function compactINR(n) {
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 100000) return `${sign}₹${+(a / 100000).toFixed(1)}L`;
  if (a >= 1000) return `${sign}₹${+(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}k`;
  return `${sign}₹${Math.round(a)}`;
}

function niceMax(n) {
  if (n <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(n));
  const m = n / exp;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return nice * exp;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function flowMonthParts() {
  if (flowMonthKey && /^\d{4}-\d{2}$/.test(flowMonthKey)) {
    const [y, m] = flowMonthKey.split("-").map(Number);
    return { y, m: m - 1 };
  }
  return { y: year, m: monthIndex };
}

function dashboardMonthKey() {
  return `${year}-${pad2(monthIndex + 1)}`;
}

function flowWindow() {
  if (flowRange === "month") {
    const { y, m } = flowMonthParts();
    const n = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => {
      const date = new Date(y, m, i + 1);
      return { date, day: i + 1, y, m };
    });
  }
  const end = new Date(year, monthIndex + 1, 0);
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date(end);
    date.setDate(end.getDate() - 29 + i);
    return { date, day: date.getDate(), y: date.getFullYear(), m: date.getMonth() };
  });
}

function flowSeries() {
  const points = flowWindow();
  const byIso = {};
  points.forEach((p) => {
    byIso[toISO(p.date)] = { ...p, in: 0, out: 0, notes: [] };
  });

  tx.forEach((t) => {
    const b = byIso[t.date];
    if (!b) return;
    if (t.amount >= 0) b.in += t.amount;
    else b.out += Math.abs(t.amount);
    b.notes.push(t.merchant);
  });

  return points.map((p) => byIso[toISO(p.date)]);
}

let flowPopYear = null;

function closeFlowPop() {
  const pop = $("#flowMonthPop");
  const label = $("#flowMonthLabel");
  if (pop) pop.hidden = true;
  if (label) label.setAttribute("aria-expanded", "false");
}

function paintFlowPop() {
  const grid = $("#flowMonthGrid");
  const yearLabel = $("#flowYearLabel");
  if (!grid || !yearLabel) return;
  const { y: selY, m: selM } = flowMonthParts();
  const py = flowPopYear ?? selY;
  yearLabel.textContent = py;
  grid.innerHTML = months
    .map((name, i) => {
      const on = py === selY && i === selM;
      const dash = py === year && i === monthIndex && !on;
      return `<button type="button" class="month-cell${on ? " on" : ""}${dash ? " dash" : ""}" data-m="${i}">${name.slice(0, 3)}</button>`;
    })
    .join("");
}

function openFlowPop() {
  const pop = $("#flowMonthPop");
  const label = $("#flowMonthLabel");
  if (!pop) return;
  flowPopYear = flowMonthParts().y;
  paintFlowPop();
  pop.hidden = false;
  if (label) label.setAttribute("aria-expanded", "true");
}

function setFlowMonth(y, m) {
  flowRange = "month";
  flowMonthKey = `${y}-${pad2(m + 1)}`;
  closeFlowPop();
  renderFlow();
  persist();
}

function shiftFlowMonth(delta) {
  const { y, m } = flowMonthParts();
  const d = new Date(y, m + delta, 1);
  setFlowMonth(d.getFullYear(), d.getMonth());
}

function syncFlowControls() {
  $$("#flowRangeSeg [data-range]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.range === flowRange);
  });
  const nav = $("#flowMonthNav");
  if (nav) nav.hidden = flowRange !== "month";
  const { y, m } = flowMonthParts();
  const label = $("#flowMonthLabel");
  if (label) label.textContent = `${months[m]} ${y}`;
  const title = $("#flowTitle");
  if (title) {
    title.textContent = flowRange === "month" ? `${months[m]} cash flow` : "30-day cash flow";
  }
  if (!$("#flowMonthPop")?.hidden) paintFlowPop();
}

function renderFlow() {
  syncFlowControls();
  const series = flowSeries();
  const days = series.length;
  const peak = Math.max(...series.flatMap((d) => [d.in, d.out]), 0);
  const max = niceMax(peak || 1000);
  const totalIn = series.reduce((a, d) => a + d.in, 0);
  const totalOut = series.reduce((a, d) => a + d.out, 0);
  const net = totalIn - totalOut;

  const plot = $("#flowChart");
  plot.style.setProperty("--days", days);
  $("#flowXAxis").style.setProperty("--days", days);
  plot.setAttribute(
    "aria-label",
    flowRange === "month"
      ? `Daily inflow and outflow for ${$("#flowTitle").textContent}`
      : "Daily inflow and outflow for the last 30 days"
  );

  $("#flowYAxis").innerHTML = [max, max / 2, 0, -max / 2, -max]
    .map((v) => `<span>${compactINR(v)}</span>`)
    .join("");

  $("#flowStats").innerHTML = `
    <span class="chip good">In ${compactINR(totalIn)}</span>
    <span class="chip bad">Out ${compactINR(totalOut)}</span>
    <span class="chip">${net >= 0 ? "+" : ""}${compactINR(net)} net</span>
  `;

  plot.innerHTML = series
    .map((d, i) => {
      const inH = d.in ? Math.max(8, (d.in / max) * 100) : 0;
      const outH = d.out ? Math.max(8, (d.out / max) * 100) : 0;
      const weekend = [0, 6].includes(d.date.getDay());
      const label = `${d.day} ${months[d.m].slice(0, 3)} ${d.y}`;
      const notes = d.notes.slice(0, 3).join(" · ");
      return `<div class="flow-col${weekend ? " wknd" : ""}" style="--i:${i}"
        data-in="${d.in}" data-out="${d.out}" data-label="${esc(label)}" data-notes="${esc(notes)}"
        role="listitem" aria-label="${esc(label)}: inflow ${money(d.in)}, outflow ${money(d.out)}">
        <div class="flow-up">${d.in ? `<div class="in" style="height:${inH}%"></div>` : ""}</div>
        <div class="flow-dn">${d.out ? `<div class="out" style="height:${outH}%"></div>` : ""}</div>
      </div>`;
    })
    .join("");

  $("#flowXAxis").innerHTML = series
    .map((d, i) => {
      const isLast = i === days - 1;
      const isTick = flowRange === "month"
        ? d.day === 1 || d.day % 5 === 0
        : i === 0 || (i + 1) % 5 === 0;
      const show = isLast || (isTick && i < days - 2);
      if (!show) return "<span></span>";
      const spansMonth = flowRange === "30" && d.m !== monthIndex;
      const text = spansMonth ? `${d.day} ${months[d.m].slice(0, 3)}` : String(d.day);
      return `<span>${text}</span>`;
    })
    .join("");
}

function bindFlowChart() {
  const chart = $("#flowChart");
  const tip = $("#flowTip");
  const card = chart.closest(".flow-card");
  if (!chart || !tip || !card) return;

  chart.addEventListener("pointerover", (e) => {
    const col = e.target.closest(".flow-col");
    if (!col) return;
    $$(".flow-col.active", chart).forEach((c) => c.classList.remove("active"));
    col.classList.add("active");
    const inn = Number(col.dataset.in);
    const out = Number(col.dataset.out);
    const net = inn - out;
    const notes = col.dataset.notes;
    tip.hidden = false;
    tip.innerHTML = `
      <div class="tip-date">${col.dataset.label}</div>
      ${notes ? `<div class="tip-notes">${notes}</div>` : ""}
      <div class="tip-row"><span>Inflow</span><b class="in">${inn ? money(inn) : "—"}</b></div>
      <div class="tip-row"><span>Outflow</span><b class="out">${out ? money(out) : "—"}</b></div>
      <div class="tip-row total"><span>Net</span><b class="${net >= 0 ? "up" : "down"}">${net >= 0 ? "+" : ""}${money(net)}</b></div>
    `;
  });

  chart.addEventListener("pointermove", (e) => {
    if (tip.hidden) return;
    const r = card.getBoundingClientRect();
    const tw = tip.offsetWidth || 180;
    const th = tip.offsetHeight || 110;
    let x = e.clientX - r.left + 14;
    let y = e.clientY - r.top + 14;
    if (x + tw > r.width - 8) x = e.clientX - r.left - tw - 12;
    if (y + th > r.height - 8) y = e.clientY - r.top - th - 12;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  });

  chart.addEventListener("pointerleave", () => {
    tip.hidden = true;
    $$(".flow-col.active", chart).forEach((c) => c.classList.remove("active"));
  });
}

function bindFlowRange() {
  const seg = $("#flowRangeSeg");
  if (seg) {
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-range]");
      if (!btn) return;
      flowRange = btn.dataset.range;
      if (flowRange === "month" && !flowMonthKey) flowMonthKey = dashboardMonthKey();
      if (flowRange !== "month") closeFlowPop();
      renderFlow();
      persist();
    });
  }
  $("#flowMonthPrev")?.addEventListener("click", () => shiftFlowMonth(-1));
  $("#flowMonthNext")?.addEventListener("click", () => shiftFlowMonth(1));
  $("#flowMonthLabel")?.addEventListener("click", () => {
    const pop = $("#flowMonthPop");
    if (!pop) return;
    if (pop.hidden) openFlowPop();
    else closeFlowPop();
  });
  $("#flowYearPrev")?.addEventListener("click", () => {
    flowPopYear = (flowPopYear ?? flowMonthParts().y) - 1;
    paintFlowPop();
  });
  $("#flowYearNext")?.addEventListener("click", () => {
    flowPopYear = (flowPopYear ?? flowMonthParts().y) + 1;
    paintFlowPop();
  });
  $("#flowMonthGrid")?.addEventListener("click", (e) => {
    const cell = e.target.closest("[data-m]");
    if (!cell) return;
    const py = flowPopYear ?? flowMonthParts().y;
    setFlowMonth(py, Number(cell.dataset.m));
  });
  $("#flowMonthNow")?.addEventListener("click", () => {
    setFlowMonth(year, monthIndex);
  });
  document.addEventListener("click", (e) => {
    const nav = $("#flowMonthNav");
    if (nav && !nav.contains(e.target)) closeFlowPop();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFlowPop();
  });
}

function renderBudgetPreview() {
  const spent = spentByCategory();
  const rows = CATEGORIES.filter((c) => c.budget)
    .slice(0, 5)
    .map((c) => {
      const used = spent[c.name] || 0;
      const over = used > c.budget;
      const pct = Math.round(Math.min(999, (used / c.budget) * 100));
      const left = c.budget - used;
      return `<div class="bp ${over ? "over" : ""}">
        <div class="bp-name">${esc(c.name)}</div>
        <div class="bp-pct">${pct}%</div>
        <div class="bp-hero">${money(used)}</div>
        <div class="bp-of">${over ? "over by " + money(used - c.budget) : money(Math.max(0, left)) + " left"} · of ${money(c.budget)}</div>
        <div class="bar thick"><span style="width:${Math.min(100, pct)}%;background:${over ? "var(--coral)" : c.color}"></span></div>
      </div>`;
    })
    .join("");
  $("#budgetPreview").innerHTML = rows || `<div class="empty">Set a category budget to track health.</div>`;
}

function renderRecent() {
  const rows = tx
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  $("#recentTx").innerHTML = rows.length
    ? rows.map(txRow).join("")
    : `<div class="empty">No transactions yet. Add one to get started.</div>`;
}

function txRow(t) {
  const sign = t.amount >= 0 ? "+" : "−";
  return `<div class="tx">
    <div class="tx-ico">${t.amount >= 0 ? "↑" : "↓"}</div>
    <div>
      <div class="tx-name">${t.merchant}</div>
      <div class="tx-meta">${t.date} · ${t.category} · ${t.account}</div>
    </div>
    <div class="tx-amt ${t.amount >= 0 ? "income" : ""}">${sign}${money(Math.abs(t.amount))}</div>
  </div>`;
}

function renderTable() {
  const type = $("#filterType").value;
  const cat = $("#filterCat").value;
  const q = ($("#txSearch")?.value || "").trim().toLowerCase();
  const rows = tx
    .filter((t) => (type === "all" ? true : t.type === type))
    .filter((t) => (cat === "all" ? true : t.category === cat))
    .filter((t) => {
      if (!q) return true;
      return [t.merchant, t.category, t.account, t.date].some((v) =>
        String(v).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!rows.length) {
    const msg = tx.length && (q || type !== "all" || cat !== "all")
      ? "No matching transactions."
      : "No transactions yet.";
    $("#txTable tbody").innerHTML = `<tr><td colspan="5" class="empty">${msg}</td></tr>`;
    return;
  }

  $("#txTable tbody").innerHTML = rows
    .map(
      (t) => `<tr>
        <td>${t.date}</td>
        <td>${t.merchant}</td>
        <td><span class="cat-pill">${t.category}</span></td>
        <td>${t.account}</td>
        <td class="num ${t.amount >= 0 ? "income" : ""}" style="${t.amount >= 0 ? "color:var(--mint)" : ""}">${money(t.amount)}</td>
      </tr>`
    )
    .join("");
}

function budgetCardEl(name) {
  return $$("#budgetGrid [data-cat]").find((el) => el.dataset.cat === name);
}

function updateBudgetSummary() {
  const spent = spentByCategory();
  let allocated = 0;
  let used = 0;
  CATEGORIES.filter((c) => c.name !== "Income").forEach((c) => {
    allocated += c.budget || 0;
    used += spent[c.name] || 0;
  });
  const el = $("#budgetSummary");
  if (el) el.textContent = `${money(used)} used of ${money(allocated)} allocated`;
}

function paintBudgetCard(card, cat) {
  const spent = spentByCategory()[cat.name] || 0;
  const block = card.querySelector(".stat-block");
  if (block) block.innerHTML = budgetCardBody(cat, spent);
}

function applyBudget(name, value, source) {
  const cat = CATEGORIES.find((c) => c.name === name);
  if (!cat) return;
  const n = Math.max(0, Math.round(Number(value)));
  if (!Number.isFinite(n)) return;
  cat.budget = n;
  const card = budgetCardEl(name);
  if (card) {
    paintBudgetCard(card, cat);
    const num = card.querySelector("input[type=number]");
    if (num && source !== "number") num.value = n;
  }
  updateBudgetSummary();
  renderBudgetPreview();
  renderKpis();
  persist();
}

function deleteCategory(name) {
  if (name === "Income") {
    toast("Income can't be deleted.");
    return;
  }
  const i = CATEGORIES.findIndex((c) => c.name === name);
  if (i < 0) return;
  if (!confirm(`Delete category “${name}”?`)) return;
  CATEGORIES.splice(i, 1);
  populateSelects();
  refresh();
  toast(`${name} deleted.`);
}

function renderBudgets() {
  const spent = spentByCategory();
  $("#budgetGrid").innerHTML = CATEGORIES.filter((c) => c.name !== "Income")
    .map((c) => {
      const s = spent[c.name] || 0;
      return `<article class="card budget-card" data-cat="${esc(c.name)}">
        <div class="budget-card-head">
          <h3><span class="cat-dot" style="background:${c.color}"></span>${esc(c.name)}</h3>
          <button type="button" class="ghost icon-btn cat-del" data-delete title="Delete ${esc(c.name)}">✕</button>
        </div>
        <div class="stat-block">${budgetCardBody(c, s)}</div>
        <label class="budget-edit">Monthly cap (₹)
          <input type="number" class="budget-num" min="0" step="10" value="${c.budget}" aria-label="${esc(c.name)} monthly cap" />
        </label>
      </article>`;
    })
    .join("") + `<button type="button" class="add-tile" id="openAddCatTile">
      <span class="add-plus">+</span>
      <span>Add category</span>
    </button>`;
  updateBudgetSummary();
}

function bindBudgetGrid() {
  const grid = $("#budgetGrid");
  if (!grid || grid.dataset.bound) return;
  grid.dataset.bound = "1";
  grid.addEventListener("click", (e) => {
    if (e.target.closest("#openAddCatTile")) openCatModal();
    const del = e.target.closest("[data-delete]");
    if (del) {
      const card = del.closest("[data-cat]");
      if (card) deleteCategory(card.dataset.cat);
    }
  });
  grid.addEventListener("input", (e) => {
    const card = e.target.closest("[data-cat]");
    if (!card) return;
    const name = card.dataset.cat;
    if (e.target.matches("input[type=number]")) {
      const n = Number(e.target.value);
      if (Number.isFinite(n) && n >= 0) applyBudget(name, n, "number");
    }
  });
  grid.addEventListener("change", (e) => {
    const card = e.target.closest("[data-cat]");
    if (!card || !e.target.matches("input[type=number]")) return;
    applyBudget(card.dataset.cat, e.target.value, "number");
  });
}

function deleteGoal(name) {
  const i = GOALS.findIndex((g) => g.name === name);
  if (i < 0) return;
  if (!confirm(`Delete goal “${name}”?`)) return;
  GOALS.splice(i, 1);
  refresh();
  toast(`${name} deleted.`);
}

function deleteAccount(name) {
  const i = ACCOUNTS.findIndex((a) => a.name === name);
  if (i < 0) return;
  if (!confirm(`Delete account “${name}”?`)) return;
  ACCOUNTS.splice(i, 1);
  populateSelects();
  refresh();
  toast(`${name} deleted.`);
}

function monthsBetween(y1, m1, y2, m2) {
  return (y2 - y1) * 12 + (m2 - m1);
}

function parseGoalEta(eta) {
  const ym = etaToMonthInput(eta);
  if (!ym) return null;
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return null;
  return { y, m: m - 1 };
}

function goalStatus(g) {
  const target = g.target || 0;
  const saved = Math.max(0, g.saved || 0);
  if (target > 0 && saved >= target) return { key: "good", label: "Good", color: "var(--good)" };
  const eta = parseGoalEta(g.eta);
  if (!eta) return { key: "on-track", label: "On track", color: "var(--amber)" };
  const left = monthsBetween(year, monthIndex, eta.y, eta.m);
  if (left < 0) return { key: "behind", label: "Behind", color: "var(--coral)" };
  const horizon = Math.max(12, left);
  const elapsed = horizon - left;
  const expected = horizon ? elapsed / horizon : 0;
  const progress = target ? saved / target : 0;
  if (expected === 0) return { key: "on-track", label: "On track", color: "var(--amber)" };
  if (progress >= expected * 1.15) return { key: "good", label: "Good", color: "var(--good)" };
  if (progress >= expected * 0.85) return { key: "on-track", label: "On track", color: "var(--amber)" };
  return { key: "behind", label: "Behind", color: "var(--coral)" };
}

function renderGoals() {
  $("#goalsGrid").innerHTML = GOALS.map((g) => {
    const target = g.target || 0;
    const saved = g.saved || 0;
    const over = target > 0 && saved > target;
    const remain = over ? saved - target : Math.max(0, target - saved);
    const pctNum = target ? Math.min(999, Math.round((saved / target) * 100)) : 0;
    const barPct = target ? Math.min(100, (saved / target) * 100) : 0;
    const st = goalStatus(g);
    return `<article class="card goal" data-goal="${esc(g.name)}">
      <div class="budget-card-head">
        <div>
          <h2>${esc(g.name)}</h2>
          <div class="muted">ETA ${esc(g.eta)}</div>
          <span class="goal-status ${st.key}">${st.label}</span>
        </div>
        <div class="goal-head-actions">
          <button type="button" class="ghost icon-btn" data-topup-goal title="Top up ${esc(g.name)}">+</button>
          <button type="button" class="ghost icon-btn cat-del" data-delete-goal title="Delete ${esc(g.name)}">✕</button>
        </div>
      </div>
      <div class="goal-metrics">
        <div>
          <div class="goal-metric-value${over ? " bad" : ""}">${money(saved)}</div>
          <div class="goal-metric-label">saved</div>
        </div>
        <div>
          <div class="goal-metric-value${over ? " bad" : ""}">${money(remain)}</div>
          <div class="goal-metric-label">${over ? "over" : "left"}</div>
        </div>
        <div>
          <div class="goal-metric-value">${money(target)}</div>
          <div class="goal-metric-label">of target</div>
        </div>
      </div>
      <div class="goal-bar-row">
        <div class="bar thick"><span style="width:${barPct}%;background:${st.color}"></span></div>
        <div class="goal-bar-pct ${st.key}">${target ? pctNum + "%" : "—"}</div>
      </div>
    </article>`;
  }).join("") + `<button type="button" class="add-tile" id="openAddGoalTile">
      <span class="add-plus">+</span>
      <span>Add goal</span>
    </button>`;
}

function lastTxForAccount(name) {
  return tx
    .filter((t) => t.account === name)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
}

function renderAccounts() {
  $("#accountsGrid").innerHTML = ACCOUNTS.map((a) => {
    const last = lastTxForAccount(a.name);
    return `<article class="card account" data-account="${esc(a.name)}">
      <div class="budget-card-head">
        <div class="chip">${esc(a.type)}</div>
        <button type="button" class="ghost icon-btn cat-del" data-delete-account title="Delete ${esc(a.name)}">✕</button>
      </div>
      <h2>${esc(a.name)}</h2>
      ${a.inst ? `<div class="inst">${esc(a.inst)}</div>` : ""}
      <div class="bal" style="color:${a.bal < 0 ? "var(--coral)" : "var(--text)"}">${money(a.bal)}</div>
      ${last ? `<div class="last-tx">Last · ${esc(last.merchant)} · ${esc(last.date)}</div>` : `<div class="last-tx">No activity yet</div>`}
    </article>`;
  }).join("") + `<button type="button" class="add-tile" id="openAddAccTile">
      <span class="add-plus">+</span>
      <span>Add account</span>
    </button>`;
}

function renderTrend() {
  const data = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(year, monthIndex - i, 1);
    const tot = totalsFor(d.getFullYear(), d.getMonth());
    data.push([months[d.getMonth()].slice(0, 3), tot.income, tot.spent]);
  }
  const max = Math.max(...data.flatMap((d) => [d[1], d[2]]), 1);
  if (data.every(([, inc, out]) => !inc && !out)) {
    $("#trendChart").innerHTML = `<div class="empty">No activity in the last six months.</div>`;
    return;
  }
  $("#trendChart").innerHTML = data
    .map(
      ([m, inc, out]) => `<div class="trend-col">
        <div class="trend-bars">
          <div class="t-in" style="height:${(inc / max) * 100}%"></div>
          <div class="t-out" style="height:${(out / max) * 100}%"></div>
        </div>
        <div class="trend-amt">${compactINR(inc)}<br>${compactINR(out)}</div>
        <span>${m}</span>
      </div>`
    )
    .join("");
}

function renderReports() {
  const box = $("#reportStats");
  const subEl = $("#rptSubtitle");
  const chip = $("#rptMonthChip");
  const t = totals();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const avg = days ? t.spent / days : 0;
  const prev = prevMonth();
  const prevT = totalsFor(prev.y, prev.m);
  const prevDays = new Date(prev.y, prev.m + 1, 0).getDate();
  const avgPrev = prevDays ? prevT.spent / prevDays : 0;
  const monthName = months[monthIndex];
  if (chip) chip.textContent = `${monthName} ${year}`;
  if (subEl) {
    subEl.textContent = tx.length
      ? `From ${tx.length} transaction${tx.length === 1 ? "" : "s"} in your ledger.`
      : "Add transactions to see live reports.";
  }

  let avgDelta = "No spend yet";
  let avgDir = "";
  if (prevT.spent || t.spent) {
    const chg = avgPrev ? ((avg - avgPrev) / avgPrev) * 100 : 0;
    avgDelta = `${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(1)}% vs ${months[prev.m].slice(0, 3)}`;
    avgDir = chg > 0 ? "down" : "up";
  }

  const ranked = Object.entries(spentByCategory()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const topName = ranked.length ? ranked[0][0] : "—";
  const topDelta = ranked.length
    ? `${money(ranked[0][1])} · ${t.spent ? Math.round((ranked[0][1] / t.spent) * 100) : 0}% of spend`
    : "No spend yet";

  const billsAmt = spentByCategory().Bills || 0;
  const billsCount = tx.filter((x) => inMonth(x) && x.category === "Bills").length;
  const billsDelta = billsCount
    ? `${billsCount} transaction${billsCount === 1 ? "" : "s"} this month`
    : "None this month";

  if (!box) return;
  box.innerHTML = `
    <article class="card stat">
      <div class="kpi-label">Avg daily spend</div>
      <div class="kpi-value">${money(avg)}</div>
      <div class="kpi-delta ${avgDir}">${avgDelta}</div>
    </article>
    <article class="card stat">
      <div class="kpi-label">Largest category</div>
      <div class="kpi-value">${esc(topName)}</div>
      <div class="kpi-delta">${topDelta}</div>
    </article>
    <article class="card stat">
      <div class="kpi-label">Bills</div>
      <div class="kpi-value">${money(billsAmt)}</div>
      <div class="kpi-delta">${billsDelta}</div>
    </article>`;
}

function populateSelects() {
  const cats = CATEGORIES.map((c) => c.name);
  $("#filterCat").innerHTML =
    `<option value="all">All categories</option>` +
    cats.map((c) => `<option>${esc(c)}</option>`).join("");
  $("#formCat").innerHTML = cats
    .filter((c) => c !== "Income")
    .map((c) => `<option>${esc(c)}</option>`)
    .join("");
  const accSel = $("#formAcc");
  if (accSel) {
    accSel.innerHTML = ACCOUNTS.length
      ? ACCOUNTS.map((a) => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join("")
      : `<option value="">Add an account first</option>`;
  }
}

function closeNav() {
  $(".app")?.classList.remove("nav-open");
  const scrim = $("#navScrim");
  if (scrim) scrim.hidden = true;
}

function openNav() {
  $(".app")?.classList.add("nav-open");
  const scrim = $("#navScrim");
  if (scrim) scrim.hidden = false;
}

function showView(name) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  closeNav();
}

function refresh(opts = {}) {
  $("#monthLabel").textContent = `${months[monthIndex]} ${year}`;
  renderKpis();
  renderMerchants();
  renderFlow();
  renderBudgetPreview();
  renderRecent();
  renderTable();
  renderBudgets();
  renderGoals();
  renderAccounts();
  renderTrend();
  renderReports();
  renderProfile();
  if (!opts.skipPersist) persist();
}

$$(".nav-item").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.view)));
$("#menuBtn")?.addEventListener("click", () => {
  if ($(".app")?.classList.contains("nav-open")) closeNav();
  else openNav();
});
$("#navScrim")?.addEventListener("click", closeNav);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeNav();
});
$$("[data-goto]").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.goto)));

$("#monthPrev").addEventListener("click", () => {
  monthIndex = (monthIndex + 11) % 12;
  if (monthIndex === 11) year -= 1;
  refresh();
});
$("#monthNext").addEventListener("click", () => {
  monthIndex = (monthIndex + 1) % 12;
  if (monthIndex === 0) year += 1;
  refresh();
});

$("#filterType").addEventListener("change", renderTable);
$("#filterCat").addEventListener("change", renderTable);
$("#txSearch")?.addEventListener("input", renderTable);

const modal = $("#modal");

function hasMerchantKey(text, key) {
  const t = text.toLowerCase();
  const k = key.toLowerCase();
  if (k.includes(" ")) return t.includes(k);
  const safe = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${safe}([^a-z0-9]|$)`, "i").test(t);
}

function guessCategory(merchant) {
  const q = String(merchant || "").trim().toLowerCase();
  if (q.length < 3) return null;
  const past = [...tx].reverse().find(
    (t) => t.type === "expense" && String(t.merchant).trim().toLowerCase() === q && t.category !== "Income"
  );
  if (past && CATEGORIES.some((c) => c.name === past.category)) {
    return { cat: past.category, from: "history" };
  }
  for (const row of MERCHANT_CATS) {
    if (!CATEGORIES.some((c) => c.name === row.cat)) continue;
    if (row.keys.some((k) => hasMerchantKey(q, k))) return { cat: row.cat, from: "name" };
  }
  return null;
}

function fillMerchantHints() {
  const list = $("#merchantHints");
  if (!list) return;
  const names = new Set(MERCHANT_HINTS);
  tx.forEach((t) => { if (t.merchant) names.add(t.merchant); });
  list.innerHTML = [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((n) => `<option value="${esc(n)}"></option>`)
    .join("");
}

let catOverridden = false;
let applyingGuess = false;
let lastGuessCat = null;

function applyMerchantGuess() {
  const hint = $("#txCatHint");
  const catSel = $("#formCat");
  if ($("#txForm [name=type]").value === "income" || !catSel) {
    if (hint) hint.hidden = true;
    return;
  }
  const guess = guessCategory($("#txForm [name=merchant]").value);
  const next = guess ? guess.cat : null;
  if (next !== lastGuessCat) {
    catOverridden = false;
    lastGuessCat = next;
  }
  if (!guess) {
    if (hint) hint.hidden = true;
    return;
  }
  if (!catOverridden) {
    applyingGuess = true;
    catSel.value = guess.cat;
    applyingGuess = false;
  }
  if (hint) {
    const same = catSel.value === guess.cat;
    hint.hidden = false;
    hint.classList.toggle("over", !same);
    hint.textContent = same
      ? `Set to ${guess.cat}. You can change it.`
      : `Usually ${guess.cat}. You picked ${catSel.value}.`;
  }
}

function syncTxFormType() {
  const isIncome = $("#txForm [name=type]").value === "income";
  const wrap = $("#txCatWrap");
  const row = $("#txCatRow");
  const who = $("#txWhoName");
  const merchant = $("#txForm [name=merchant]");
  if (wrap) wrap.hidden = isIncome;
  if (row) row.classList.toggle("single", isIncome);
  if (who) who.textContent = isIncome ? "Source" : "Merchant";
  if (merchant) merchant.placeholder = isIncome ? "Salary, freelance, refund…" : "Zepto, Swiggy, Amazon…";
  applyMerchantGuess();
}

$("#txForm [name=type]").addEventListener("change", syncTxFormType);
$("#txForm [name=merchant]").addEventListener("input", applyMerchantGuess);
$("#formCat").addEventListener("change", () => {
  if (applyingGuess) return;
  catOverridden = true;
  applyMerchantGuess();
});

$("#openAdd").addEventListener("click", () => {
  modal.classList.add("open");
  const d = new Date(year, monthIndex, Math.min(28, new Date().getDate()));
  $("#txForm [name=date]").value = d.toISOString().slice(0, 10);
  catOverridden = false;
  lastGuessCat = null;
  fillMerchantHints();
  syncTxFormType();
});
$("#closeAdd").addEventListener("click", () => modal.classList.remove("open"));
$("#cancelAdd").addEventListener("click", () => modal.classList.remove("open"));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.remove("open");
});

$("#txForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const type = fd.get("type");
  let amount = Number(fd.get("amount"));
  if (!ACCOUNTS.length) {
    toast("Add an account first.");
    return;
  }
  if (type === "expense") amount = -Math.abs(amount);
  tx.unshift({
    date: fd.get("date"),
    merchant: fd.get("merchant"),
    category: type === "income" ? "Income" : fd.get("category"),
    account: fd.get("account"),
    amount,
    type,
  });
  const acc = ACCOUNTS.find((a) => a.name === fd.get("account"));
  if (acc) acc.bal += amount;
  modal.classList.remove("open");
  e.target.reset();
  refresh();
  toast("Transaction saved.");
});

function nextCatColor() {
  const used = new Set(CATEGORIES.map((c) => c.color));
  return CAT_COLORS.find((c) => !used.has(c)) || CAT_COLORS[CATEGORIES.length % CAT_COLORS.length];
}

function paintSwatches(selected) {
  $("#catColorValue").value = selected;
  $("#catColors").innerHTML = CAT_COLORS.map(
    (c) =>
      `<button type="button" class="swatch${c === selected ? " selected" : ""}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`
  ).join("");
}

function openCatModal() {
  $("#catForm").reset();
  paintSwatches(nextCatColor());
  $("#catModal").classList.add("open");
  $("#catForm [name=name]").focus();
}

function closeCatModal() {
  $("#catModal").classList.remove("open");
}

function formatEta(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${months[m - 1].slice(0, 3)} ${y}`;
}

function etaToMonthInput(eta) {
  const parts = String(eta || "").trim().split(/\s+/);
  if (parts.length < 2) return "";
  const m = months.findIndex((n) => n.slice(0, 3).toLowerCase() === parts[0].toLowerCase());
  const y = Number(parts[1]);
  if (m < 0 || !y) return "";
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

let editingGoalName = null;

function openGoalModal(existing) {
  const form = $("#goalForm");
  form.reset();
  editingGoalName = existing ? existing.name : null;
  const title = $("#goalModalTitle");
  const submit = $("#goalSubmit");
  if (existing) {
    if (title) title.textContent = "Edit goal";
    if (submit) submit.textContent = "Update goal";
    form.elements.name.value = existing.name;
    form.elements.target.value = existing.target;
    form.elements.saved.value = existing.saved || 0;
    form.elements.eta.value = etaToMonthInput(existing.eta);
  } else {
    if (title) title.textContent = "Add goal";
    if (submit) submit.textContent = "Save goal";
    const eta = new Date(year, monthIndex + 6, 1);
    form.elements.eta.value = `${eta.getFullYear()}-${String(eta.getMonth() + 1).padStart(2, "0")}`;
    form.elements.saved.value = "0";
  }
  $("#goalModal").classList.add("open");
  form.elements.name.focus();
}

function closeGoalModal() {
  editingGoalName = null;
  $("#goalModal").classList.remove("open");
}

$("#openAddCat").addEventListener("click", openCatModal);
$("#closeAddCat").addEventListener("click", closeCatModal);
$("#cancelAddCat").addEventListener("click", closeCatModal);
$("#catModal").addEventListener("click", (e) => {
  if (e.target === $("#catModal")) closeCatModal();
});
$("#catColors").addEventListener("click", (e) => {
  const swatch = e.target.closest(".swatch");
  if (swatch) paintSwatches(swatch.dataset.color);
});
$("#catForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const name = String(fd.get("name") || "").trim();
  const budget = Number(fd.get("budget"));
  const color = fd.get("color") || nextCatColor();
  if (!name) return;
  if (name.toLowerCase() === "income") {
    toast("Income is reserved — pick another name.");
    return;
  }
  if (CATEGORIES.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    toast("That category already exists.");
    return;
  }
  CATEGORIES.push({ name, color, budget });
  populateSelects();
  closeCatModal();
  refresh();
  toast(`${name} added to budgets.`);
});

$("#openAddGoal").addEventListener("click", openGoalModal);
$("#closeAddGoal").addEventListener("click", closeGoalModal);
$("#cancelAddGoal").addEventListener("click", closeGoalModal);
$("#goalModal").addEventListener("click", (e) => {
  if (e.target === $("#goalModal")) closeGoalModal();
});
let toppingUpGoal = null;

function openGoalTopup(g) {
  toppingUpGoal = g;
  const title = $("#goalTopupTitle");
  if (title) title.textContent = `Top up ${g.name}`;
  const form = $("#goalTopupForm");
  form.reset();
  $("#goalTopupModal").classList.add("open");
  form.elements.amount.focus();
}

function closeGoalTopup() {
  toppingUpGoal = null;
  $("#goalTopupModal").classList.remove("open");
}

$("#goalsGrid").addEventListener("click", (e) => {
  if (e.target.closest("#openAddGoalTile")) {
    openGoalModal();
    return;
  }
  const del = e.target.closest("[data-delete-goal]");
  if (del) {
    const card = del.closest("[data-goal]");
    if (card) deleteGoal(card.dataset.goal);
    return;
  }
  const topup = e.target.closest("[data-topup-goal]");
  if (topup) {
    const card = topup.closest("[data-goal]");
    const g = card && GOALS.find((x) => x.name === card.dataset.goal);
    if (g) openGoalTopup(g);
    return;
  }
  const card = e.target.closest("[data-goal]");
  if (card) {
    const g = GOALS.find((x) => x.name === card.dataset.goal);
    if (g) openGoalModal(g);
  }
});
$("#closeGoalTopup")?.addEventListener("click", closeGoalTopup);
$("#cancelGoalTopup")?.addEventListener("click", closeGoalTopup);
$("#goalTopupModal")?.addEventListener("click", (e) => {
  if (e.target === $("#goalTopupModal")) closeGoalTopup();
});
$("#goalTopupForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!toppingUpGoal) return;
  const amount = Number(new FormData(e.target).get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return;
  toppingUpGoal.saved = Math.max(0, (toppingUpGoal.saved || 0) + amount);
  const name = toppingUpGoal.name;
  closeGoalTopup();
  refresh();
  toast(`Added ${money(amount)} to ${name}.`);
});

function openAccModal() {
  $("#accForm").reset();
  $("#accForm [name=bal]").value = "0";
  $("#accModal").classList.add("open");
  $("#accForm [name=name]").focus();
}
function closeAccModal() {
  $("#accModal").classList.remove("open");
}
$("#openAddAcc")?.addEventListener("click", openAccModal);
$("#closeAddAcc")?.addEventListener("click", closeAccModal);
$("#cancelAddAcc")?.addEventListener("click", closeAccModal);
$("#accModal")?.addEventListener("click", (e) => {
  if (e.target === $("#accModal")) closeAccModal();
});
$("#accountsGrid").addEventListener("click", (e) => {
  if (e.target.closest("#openAddAccTile")) openAccModal();
  const del = e.target.closest("[data-delete-account]");
  if (del) {
    const card = del.closest("[data-account]");
    if (card) deleteAccount(card.dataset.account);
  }
});
$("#accForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const name = String(fd.get("name") || "").trim();
  if (!name) return;
  if (ACCOUNTS.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
    toast("That account already exists.");
    return;
  }
  ACCOUNTS.push({
    name,
    inst: String(fd.get("inst") || "").trim(),
    bal: Number(fd.get("bal") || 0),
    type: fd.get("type") || "Checking",
  });
  populateSelects();
  closeAccModal();
  refresh();
  toast(`${name} added.`);
});

$("#goalForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const name = String(fd.get("name") || "").trim();
  const target = Number(fd.get("target"));
  const saved = Number(fd.get("saved") || 0);
  const eta = formatEta(fd.get("eta"));
  if (!name || !target) return;
  const clash = GOALS.some(
    (g) => g.name.toLowerCase() === name.toLowerCase() && g.name !== editingGoalName
  );
  if (clash) {
    toast("That goal already exists.");
    return;
  }
  if (editingGoalName) {
    const g = GOALS.find((x) => x.name === editingGoalName);
    if (!g) return;
    g.name = name;
    g.target = target;
    g.saved = Math.max(0, saved);
    g.eta = eta;
    closeGoalModal();
    refresh();
    toast(`${name} updated.`);
    return;
  }
  GOALS.push({ name, target, saved: Math.max(0, saved), eta });
  closeGoalModal();
  refresh();
  toast(`${name} added to goals.`);
});

$("#themeToggle").addEventListener("click", () => {
  applyTheme(theme === "dark" ? "light" : "dark");
});

$("#saveJson").addEventListener("click", () => { saveJsonFile(); });
$("#reloadJson").addEventListener("click", () => { reloadJsonFile(); });
$("#jsonFile").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (file) loadFromFile(file);
});

function openProfileModal() {
  const nameInput = $("#profileForm [name=name]");
  const initialsInput = $("#profileForm [name=initials]");
  nameInput.value = profile.name;
  initialsInput.value = profile.initials;
  delete initialsInput.dataset.touched;
  renderProfile();
  $("#profileModal").classList.add("open");
}
function closeProfileModal() {
  $("#profileModal").classList.remove("open");
}
$("#openProfile").addEventListener("click", openProfileModal);
$("#closeProfile").addEventListener("click", closeProfileModal);
$("#cancelProfile").addEventListener("click", closeProfileModal);
$("#profileModal").addEventListener("click", (e) => {
  if (e.target === $("#profileModal")) closeProfileModal();
});
$("#profileForm [name=name]").addEventListener("input", (e) => {
  const initialsInput = $("#profileForm [name=initials]");
  if (!initialsInput.dataset.touched) initialsInput.value = initialsFrom(e.target.value);
  $("#profilePreview").textContent = (initialsInput.value || initialsFrom(e.target.value)).toUpperCase();
  $("#profilePreviewName").textContent = e.target.value.trim() || "Your name";
});
$("#profileForm [name=initials]").addEventListener("input", (e) => {
  e.target.dataset.touched = "1";
  e.target.value = e.target.value.toUpperCase();
  $("#profilePreview").textContent = e.target.value || "?";
});
$("#profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = String(new FormData(e.target).get("name") || "").trim();
  let initials = String(new FormData(e.target).get("initials") || "").trim().toUpperCase();
  if (!name) return;
  if (!initials) initials = initialsFrom(name);
  profile.name = name;
  profile.initials = initials.slice(0, 3);
  closeProfileModal();
  refresh();
  toast("Profile updated.");
});

loadLocal();
migrateDefaultAccounts();
applyTheme(theme, { silent: true });
populateSelects();
bindFlowChart();
bindFlowRange();
bindBudgetGrid();
startQuoteClock();
refresh();
initCloud();
restoreLinkedFile();
const boot = new URLSearchParams(location.search);
if (boot.get("view")) showView(boot.get("view"));
if (boot.get("theme") === "dark" || boot.get("theme") === "light") applyTheme(boot.get("theme"), { silent: true });
if (boot.get("modal") === "profile") openProfileModal();
if (boot.get("flow") === "month" || boot.get("flow") === "30") {
  flowRange = boot.get("flow");
  if (flowRange === "month") flowMonthKey = flowMonthKey || dashboardMonthKey();
  renderFlow();
}
if (boot.get("monthpop")) openFlowPop();
if (boot.get("nav")) openNav();
