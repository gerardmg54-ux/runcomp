/* RunComp Ultimate (static demo, GitHub Pages)
   PUBLIC (index.html):
   - shows competitions only
   - hides totals, collected, thresholds, winners

   ADMIN (admin.html?k=YOURKEY):
   - login required
   - add/edit/delete competitions
   - winners + export CSV
*/

const LS_KEY = "runcomp_data_v4";
const LS_ADMIN = "runcomp_admin_ok";

// ✅ CHANGE THESE:
const ADMIN_PASSWORD_DEFAULT = "admin123";       // <- change this
const ADMIN_URL_KEY = "CHANGE_THIS_KEY";         // <- change this (secret URL key)

const DEFAULT_THRESHOLD = 1000;
const INSTANT_WIN_CHANCE = 0.06;

let state = loadState();
let username = "";
let isAdmin = (localStorage.getItem(LS_ADMIN) === "1");

const el = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.getAttribute("data-page") || "public";
  if (el("year")) el("year").textContent = new Date().getFullYear();

  seedDefaultsIfEmpty();

  if (page === "public") initPublic();
  if (page === "admin") initAdmin();

  // countdown updates (for cards)
  setInterval(() => {
    renderCompetitionCards(true);
  }, 1000);
});

function initPublic(){
  el("confirmNameBtn").addEventListener("click", confirmName);
  el("resetDataBtn").addEventListener("click", resetLocalData);
  el("searchBox").addEventListener("input", renderAll);
  el("categoryFilter").addEventListener("change", renderAll);

  buildCategoryFilter();
  renderAll();
}

function initAdmin(){
  // gate admin page by secret URL key
  const ok = adminGateOk();
  const gateStatus = el("adminGateStatus");
  if (gateStatus) {
    gateStatus.textContent = ok ? "Admin page unlocked ✅" : "Wrong / missing admin key ❌";
  }

  if (!ok){
    // Hide app completely if key wrong
    if (el("adminGateCard")) {
      el("adminGateCard").classList.remove("hidden");
      el("adminStatus").textContent = "Access denied. Use the correct admin link.";
    }
    if (el("adminApp")) el("adminApp").classList.add("hidden");
    // still show nothing else
    return;
  }

  el("adminLoginBtn").addEventListener("click", adminLogin);
  el("adminLogoutBtn").addEventListener("click", adminLogout);
  el("saveCompBtn").addEventListener("click", saveCompetitionFromForm);
  el("clearFormBtn").addEventListener("click", clearAdminForm);
  el("resetDataBtn").addEventListener("click", resetLocalData);

  el("exportWinnersBtn").addEventListener("click", exportWinnersCSV);
  el("clearWinnersBtn").addEventListener("click", () => {
    if (!confirm("Clear all winners?")) return;
    state.winners = [];
    saveState();
    renderAll();
  });

  buildCategoryFilter();
  syncAdminUI();
  renderAll();
}

function adminGateOk(){
  const params = new URLSearchParams(location.search);
  const k = params.get("k") || "";
  return k === ADMIN_URL_KEY;
}

function seedDefaultsIfEmpty(){
  if (!Array.isArray(state.competitions)) state.competitions = [];
  if (!Array.isArray(state.winners)) state.winners = [];

  if (state.competitions.length === 0) {
    state.competitions.push(
      makeComp({
        name:"£500 Cash",
        price:1,
        category:"Cash",
        image:"500cash.png",
        paypal:"https://www.paypal.com/ncp/payment/DVSBN5YBYGPG6",
        limit: 2000,
        threshold: 1000,
        endsAt: "",
        instantPrizes: ["Free Ticket","£10 Cash","Mystery Prize"]
      }),
      makeComp({
        name:"£300 Cash",
        price:0.5,
        category:"Cash",
        image:"300cash.png",
        paypal:"https://www.paypal.com/ncp/payment/DVSBN5YBYGPG6",
        limit: 2000,
        threshold: 1000,
        endsAt: "",
        instantPrizes: ["Free Ticket"]
      }),
      makeComp({
        name:"2 Night City Break for 2",
        price:3,
        category:"Travel",
        image:"citybreak.png",
        paypal:"https://www.paypal.com/ncp/payment/DVSBN5YBYGPG6",
        limit: 1000,
        threshold: 1000,
        endsAt: "",
        instantPrizes: []
      })
    );
    saveState();
  }
}

function makeComp({name, price, category, image, paypal, limit, threshold, endsAt, instantPrizes}) {
  return {
    id: cryptoId(),
    name: String(name || "").trim(),
    price: Number(price || 0),
    category: String(category || "Other"),
    image: String(image || "").trim(),
    paypal: String(paypal || "").trim(),
    limit: Number(limit || 0),
    threshold: Number(threshold || DEFAULT_THRESHOLD),
    endsAt: endsAt || "",
    createdAt: Date.now(),
    round: 1,
    collected: 0,
    ticketsSold: 0,
    tickets: [],
    instantPrizes: Array.isArray(instantPrizes) ? instantPrizes : [],
    instantWinners: []
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { competitions: [], winners: [] };
    const parsed = JSON.parse(raw);
    return {
      competitions: Array.isArray(parsed.competitions) ? parsed.competitions : [],
      winners: Array.isArray(parsed.winners) ? parsed.winners : []
    };
  } catch {
    return { competitions: [], winners: [] };
  }
}
function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function resetLocalData(){
  if (!confirm("This clears competitions/tickets/winners ONLY on your device. Continue?")) return;
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_ADMIN);
  isAdmin = false;
  state = loadState();
  seedDefaultsIfEmpty();
  buildCategoryFilter();
  renderAll();
  syncAdminUI();
}

function confirmName(){
  const v = el("username").value.trim();
  if (!v) return alert("Enter your name first.");
  username = v;
  if (el("userStatus")) el("userStatus").textContent = `Hello, ${username} ✅`;
}

function adminLogin(){
  const pass = el("adminPass").value;
  if (pass !== ADMIN_PASSWORD_DEFAULT) {
    el("adminStatus").textContent = "Wrong password.";
    return;
  }
  isAdmin = true;
  localStorage.setItem(LS_ADMIN, "1");
  el("adminStatus").textContent = "Admin logged in ✅";
  syncAdminUI();
  renderAll();
}

function adminLogout(){
  isAdmin = false;
  localStorage.removeItem(LS_ADMIN);
  el("adminStatus").textContent = "Logged out.";
  syncAdminUI();
  renderAll();
}

function syncAdminUI(){
  // Only on admin page
  const page = document.body.getAttribute("data-page");
  if (page !== "admin") return;

  const app = el("adminApp");
  const gate = el("adminGateCard");
  const ok = adminGateOk();
  if (!ok) return;

  // show gate always, app only when logged in
  if (gate) gate.classList.remove("hidden");
  if (app) app.classList.toggle("hidden", !isAdmin);

  el("adminLogoutBtn").classList.toggle("hidden", !isAdmin);
  el("adminLoginBtn").classList.toggle("hidden", isAdmin);
}

function buildCategoryFilter(){
  const sel = el("categoryFilter");
  if (!sel) return;
  const set = new Set(["all"]);
  for (const c of state.competitions) set.add(c.category);
  sel.innerHTML = [...set].map(cat => {
    const label = (cat === "all") ? "All categories" : cat;
    return `<option value="${escapeHtml(cat)}">${escapeHtml(label)}</option>`;
  }).join("");
}

function renderAll(){
  buildCategoryFilter();
  renderCompetitionCards(false);

  // Admin-only sections
  if (document.body.getAttribute("data-page") === "admin" && adminGateOk()){
    renderAdminList();
    renderWinners();
  }
}

function renderCompetitionCards(onlyCountdownUpdate){
  const grid = el("compGrid");
  if (!grid) return;

  const qEl = el("searchBox");
  const catEl = el("categoryFilter");
  const q = (qEl ? qEl.value : "").trim().toLowerCase();
  const cat = (catEl ? catEl.value : "all");

  if (!onlyCountdownUpdate) grid.innerHTML = "";

  const comps = state.competitions
    .filter(c => (cat === "all" ? true : c.category === cat))
    .filter(c => !q || c.name.toLowerCase().includes(q));

  if (!onlyCountdownUpdate && comps.length === 0) {
    grid.innerHTML = `<div class="muted">No competitions found.</div>`;
    return;
  }

  if (onlyCountdownUpdate) {
    for (const c of comps) {
      const node = document.querySelector(`[data-countdown="${c.id}"]`);
      if (node) node.textContent = countdownText(c.endsAt);
    }
    return;
  }

  const page = document.body.getAttribute("data-page") || "public";
  const showPrivateStats = (page === "admin" && isAdmin && adminGateOk());

  for (const c of comps) {
    const ended = isEnded(c);
    const soldOut = isSoldOut(c);

    const card = document.createElement("div");
    card.className = "comp";

    const imgSrc = c.image ? c.image : "";
    const countdown = countdownText(c.endsAt);

    card.innerHTML = `
      <img class="comp__img" src="${escapeAttr(imgSrc)}" alt="${escapeAttr(c.name)}" onerror="this.style.display='none'"/>
      <div class="comp__body">
        <div class="comp__title">${escapeHtml(c.name)}</div>

        <div class="badges">
          <span class="badge badge--accent">${escapeHtml(c.category)}</span>
          <span class="badge">Round ${c.round}</span>
          ${countdown ? `<span class="badge badge--warn" data-countdown="${c.id}">${escapeHtml(countdown)}</span>` : ""}
          ${soldOut ? `<span class="badge badge--warn">Sold out</span>` : ""}
          ${ended ? `<span class="badge badge--warn">Ended</span>` : ""}
        </div>

        <div class="kv">
          <div><b>Ticket</b><span>£${fmt2(c.price)}</span></div>
          <div><b>Category</b><span>${escapeHtml(c.category)}</span></div>
        </div>

        ${showPrivateStats ? `
          <div class="kv" style="margin-top:10px">
            <div><b>Collected</b><span>£${fmt2(c.collected)}</span></div>
            <div><b>Tickets sold</b><span>${c.ticketsSold}${c.limit ? ` / ${c.limit}` : ""}</span></div>
            <div><b>Winner at</b><span>£${fmt2(c.threshold || DEFAULT_THRESHOLD)}</span></div>
            <div><b>Instant wins left</b><span>${(c.instantPrizes || []).length}</span></div>
          </div>
        ` : `<div class="muted small" style="margin-top:8px">* Ticket totals and winners are hidden from the public.</div>`}

        ${c.instantPrizes?.length ? `<div class="muted small" style="margin-top:8px">Instant wins enabled ✅</div>` : ""}
      </div>

      <div class="comp__actions">
        <button class="btn btn--buy" data-pay="${c.id}" ${(!c.paypal || ended || soldOut) ? "disabled" : ""}>PayPal</button>
        <button class="btn btn--enter" data-enter="${c.id}" ${(ended || soldOut) ? "disabled" : ""}>I’ve Paid</button>
      </div>
    `;

    grid.appendChild(card);
  }

  grid.querySelectorAll("[data-pay]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-pay");
      const c = state.competitions.find(x => x.id === id);
      if (!c?.paypal) return alert("No PayPal link set (admin can add it).");
      window.open(c.paypal, "_blank", "noopener,noreferrer");
    });
  });

  grid.querySelectorAll("[data-enter]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-enter");
      enterCompetition(id);
    });
  });
}

function enterCompetition(compId){
  if (!username) return alert("Enter your name first, then Confirm.");
  const c = state.competitions.find(x => x.id === compId);
  if (!c) return;

  if (isEnded(c)) return alert("This competition has ended.");
  if (isSoldOut(c)) return alert("This competition is sold out.");

  const ticketRef = `T-${Date.now().toString(36)}-${Math.floor(Math.random()*1e6)}`;
  c.tickets.push({ name: username, time: Date.now(), ref: ticketRef, round: c.round });

  c.ticketsSold += 1;
  c.collected = round2(c.collected + Number(c.price || 0));

  maybeInstantWin(c, username);

  if (c.collected >= (c.threshold || DEFAULT_THRESHOLD)) {
    autoPickWinner(c);
  }

  saveState();
  renderAll();

  alert(`Ticket entered ✅\nRef: ${ticketRef}`);
}

function maybeInstantWin(comp, buyerName){
  if (!Array.isArray(comp.instantPrizes) || comp.instantPrizes.length === 0) return;
  if (secureRandom01() > INSTANT_WIN_CHANCE) return;

  const idx = Math.floor(secureRandom01() * comp.instantPrizes.length);
  const prize = comp.instantPrizes.splice(idx, 1)[0];
  comp.instantWinners = comp.instantWinners || [];
  comp.instantWinners.push({ time: Date.now(), name: buyerName, prize, round: comp.round });

  alert(`🎁 INSTANT WIN!\n${buyerName} won: ${prize}`);
}

function autoPickWinner(comp){
  if (!comp.tickets || comp.tickets.length === 0) return;

  const roundTickets = comp.tickets.filter(t => t.round === comp.round);
  const pool = roundTickets.length ? roundTickets : comp.tickets;
  const idx = Math.floor(secureRandom01() * pool.length);
  const winnerTicket = pool[idx];

  const win = {
    time: Date.now(),
    competitionId: comp.id,
    competitionName: comp.name,
    winnerName: winnerTicket.name,
    round: comp.round,
    collected: comp.collected
  };
  state.winners.push(win);

  comp.round += 1;
  comp.collected = 0;
  comp.ticketsSold = 0;
  comp.tickets = [];
  comp.instantWinners = comp.instantWinners || [];

  alert(`🎉 WINNER PICKED!\n${win.winnerName} won ${win.competitionName} (Round ${win.round}).`);
}

function renderAdminList(){
  const box = el("adminList");
  if (!box) return;
  if (!isAdmin) { box.innerHTML = `<div class="muted">Login to manage competitions.</div>`; return; }
  if (state.competitions.length === 0) { box.innerHTML = `<div class="muted">No competitions yet.</div>`; return; }

  box.innerHTML = state.competitions.map(c => `
    <div class="adminitem">
      <div class="adminitem__top">
        <div>
          <div class="adminitem__name">${escapeHtml(c.name)}</div>
          <div class="adminitem__meta">
            £${fmt2(c.price)} • ${escapeHtml(c.category)} • Limit: ${c.limit || "∞"} • Winner at: £${fmt2(c.threshold || DEFAULT_THRESHOLD)}
            ${c.endsAt ? ` • Ends: ${escapeHtml(new Date(c.endsAt).toLocaleString())}` : ""}
          </div>
        </div>
        <div class="muted small">ID: ${escapeHtml(c.id.slice(0,8))}</div>
      </div>

      <div class="adminitem__btns">
        <button class="btn btn--primary" data-edit="${c.id}">Edit</button>
        <button class="btn btn--danger" data-del="${c.id}">Delete</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll("[data-edit]").forEach(b => {
    b.addEventListener("click", () => loadCompIntoForm(b.getAttribute("data-edit")));
  });
  box.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", () => deleteComp(b.getAttribute("data-del")));
  });
}

function loadCompIntoForm(id){
  const c = state.competitions.find(x => x.id === id);
  if (!c) return;

  el("a_id").value = c.id;
  el("a_name").value = c.name || "";
  el("a_price").value = (c.price ?? "");
  el("a_category").value = c.category || "Other";
  el("a_image").value = c.image || "";
  el("a_paypal").value = c.paypal || "";
  el("a_limit").value = (c.limit ?? "");
  el("a_threshold").value = (c.threshold ?? DEFAULT_THRESHOLD);
  el("a_ends").value = c.endsAt ? toDatetimeLocal(c.endsAt) : "";
  el("a_instant").value = (c.instantPrizes || []).join("\n");

  el("adminStatus").textContent = `Editing: ${c.name}`;
}

function clearAdminForm(){
  el("a_id").value = "";
  el("a_name").value = "";
  el("a_price").value = "";
  el("a_category").value = "Cash";
  el("a_image").value = "";
  el("a_paypal").value = "";
  el("a_limit").value = "";
  el("a_threshold").value = DEFAULT_THRESHOLD;
  el("a_ends").value = "";
  el("a_instant").value = "";
  el("adminStatus").textContent = "";
}

function saveCompetitionFromForm(){
  const id = el("a_id").value.trim();
  const name = el("a_name").value.trim();
  const price = Number(el("a_price").value);
  const category = el("a_category").value;
  const image = el("a_image").value.trim();
  const paypal = el("a_paypal").value.trim();
  const limit = Number(el("a_limit").value || 0);
  const threshold = Number(el("a_threshold").value || DEFAULT_THRESHOLD);
  const endsAtInput = el("a_ends").value;
  const endsAt = endsAtInput ? new Date(endsAtInput).toISOString() : "";
  const instantPrizes = el("a_instant").value
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  if (!name) return alert("Enter a competition name.");
  if (!Number.isFinite(price) || price <= 0) return alert("Ticket price must be > 0.");
  if (limit && limit < 1) return alert("Ticket limit must be blank or 1+.");
  if (!Number.isFinite(threshold) || threshold < 1) return alert("Winner trigger must be 1+.");

  if (id) {
    const c = state.competitions.find(x => x.id === id);
    if (!c) return;

    c.name = name;
    c.price = price;
    c.category = category;
    c.image = image;
    c.paypal = paypal;
    c.limit = limit;
    c.threshold = threshold;
    c.endsAt = endsAt;
    c.instantPrizes = instantPrizes;

    el("adminStatus").textContent = "Saved ✅";
  } else {
    state.competitions.push(makeComp({ name, price, category, image, paypal, limit, threshold, endsAt, instantPrizes }));
    el("adminStatus").textContent = "Added ✅";
  }

  saveState();
  buildCategoryFilter();
  clearAdminForm();
  renderAll();
}

function deleteComp(id){
  const c = state.competitions.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`Delete "${c.name}"? This removes tickets stored on this device.`)) return;

  state.competitions = state.competitions.filter(x => x.id !== id);
  saveState();
  buildCategoryFilter();
  renderAll();
}

function renderWinners(){
  const box = el("winnersList");
  if (!box) return;

  if (!isAdmin) {
    box.innerHTML = `<div class="muted">Login to view winners list on this device.</div>`;
    return;
  }

  const list = [...state.winners].slice().reverse();
  if (list.length === 0){
    box.innerHTML = `<div class="muted">No winners yet.</div>`;
    return;
  }

  box.innerHTML = list.map(w => `
    <div class="winner">
      <b>${escapeHtml(w.winnerName)}</b>
      <div class="muted small">
        Won: ${escapeHtml(w.competitionName)} • Round ${w.round} • Collected: £${fmt2(w.collected)} • ${escapeHtml(new Date(w.time).toLocaleString())}
      </div>
    </div>
  `).join("");
}

function exportWinnersCSV(){
  if (!isAdmin) return;
  const rows = [["time","competitionName","round","winnerName","collected"]];
  for (const w of state.winners){
    rows.push([new Date(w.time).toISOString(), w.competitionName, w.round, w.winnerName, w.collected]);
  }
  const csv = rows.map(r => r.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "winners.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isSoldOut(c){ return (c.limit && c.ticketsSold >= c.limit); }
function isEnded(c){
  if (!c.endsAt) return false;
  return Date.now() >= Date.parse(c.endsAt);
}

function countdownText(endsAt){
  if (!endsAt) return "";
  const ms = Date.parse(endsAt) - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "Ended";
  const s = Math.floor(ms/1000);
  const d = Math.floor(s/86400);
  const h = Math.floor((s%86400)/3600);
  const m = Math.floor((s%3600)/60);
  const ss = s%60;
  if (d>0) return `${d}d ${h}h ${m}m`;
  if (h>0) return `${h}h ${m}m ${ss}s`;
  return `${m}m ${ss}s`;
}

// helpers
function fmt2(n){ return Number(n||0).toFixed(2); }
function round2(n){ return Math.round((Number(n)||0)*100)/100; }

function cryptoId(){
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2,"0")).join("");
}
function secureRandom01(){
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / 0xFFFFFFFF;
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeAttr(s){ return escapeHtml(s); }

function toDatetimeLocal(iso){
  const d = new Date(iso);
  const pad = (n)=>String(n).padStart(2,"0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}