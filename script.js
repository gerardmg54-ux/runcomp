/* RunComp Ultimate (static demo)
   - competitions + tickets stored in localStorage
   - admin can add/edit/delete competitions
   - PayPal link opens in new tab, then user confirms "I've Paid" to add ticket
   - auto winner when collected >= threshold (default £1000)
   - optional countdown, ticket limit, instant wins list
*/

const LS_KEY = "runcomp_data_v3";
const LS_ADMIN = "runcomp_admin_ok";
const ADMIN_PASSWORD_DEFAULT = "admin123";

const DEFAULT_THRESHOLD = 1000;
const INSTANT_WIN_CHANCE = 0.06; // 6% chance per ticket to trigger an instant win (if prizes exist)

let state = loadState();
let username = "";
let isAdmin = (localStorage.getItem(LS_ADMIN) === "1");

const el = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  el("year").textContent = new Date().getFullYear();

  // UI handlers
  el("confirmNameBtn").addEventListener("click", confirmName);
  el("adminLoginBtn").addEventListener("click", adminLogin);
  el("adminLogoutBtn").addEventListener("click", adminLogout);
  el("saveCompBtn").addEventListener("click", saveCompetitionFromForm);
  el("clearFormBtn").addEventListener("click", clearAdminForm);
  el("resetDataBtn").addEventListener("click", resetLocalData);

  el("searchBox").addEventListener("input", renderAll);
  el("categoryFilter").addEventListener("change", renderAll);

  el("exportWinnersBtn").addEventListener("click", exportWinnersCSV);
  el("clearWinnersBtn").addEventListener("click", () => {
    if (!confirm("Clear all winners?")) return;
    state.winners = [];
    saveState();
    renderAll();
  });

  // Ensure defaults exist
  seedDefaultsIfEmpty();

  // Admin panel show/hide
  syncAdminUI();

  // Render
  buildCategoryFilter();
  renderAll();

  // countdown updates
  setInterval(() => {
    renderCompetitionCards(true);
  }, 1000);
});

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
    limit: Number(limit || 0),                 // max tickets
    threshold: Number(threshold || DEFAULT_THRESHOLD), // money target to trigger a winner
    endsAt: endsAt || "",                      // ISO string or ""
    createdAt: Date.now(),
    round: 1,
    collected: 0,
    ticketsSold: 0,
    tickets: [],                               // {name, time, ref}
    instantPrizes: Array.isArray(instantPrizes) ? instantPrizes : [],
    instantWinners: []                         // {time, name, prize, round}
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
  state = loadState();
  seedDefaultsIfEmpty();
  buildCategoryFilter();
  renderAll();
}

function confirmName(){
  const v = el("username").value.trim();
  if (!v) return alert("Enter your name first.");
  username = v;
  el("userStatus").textContent = `Hello, ${username} ✅`;
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
  el("adminPanel").classList.toggle("hidden", !isAdmin);
  el("adminLogoutBtn").classList.toggle("hidden", !isAdmin);
  el("adminLoginBtn").classList.toggle("hidden", isAdmin);
}

function buildCategoryFilter(){
  const set = new Set(["all"]);
  for (const c of state.competitions) set.add(c.category);
  el("categoryFilter").innerHTML = [...set].map(cat => {
    const label = (cat === "all") ? "All categories" : cat;
    return `<option value="${escapeHtml(cat)}">${escapeHtml(label)}</option>`;
  }).join("");
}

function renderAll(){
  buildCategoryFilter();
  renderCompetitionCards(false);
  renderAdminList();
  renderWinners();
}

function renderCompetitionCards(onlyCountdownUpdate){
  const grid = el("compGrid");
  const q = (el("searchBox").value || "").trim().toLowerCase();
  const cat = el("categoryFilter").value || "all";

  if (!onlyCountdownUpdate) grid.innerHTML = "";

  const comps = state.competitions
    .filter(c => (cat === "all" ? true : c.category === cat))
    .filter(c => !q || c.name.toLowerCase().includes(q));

  if (!onlyCountdownUpdate && comps.length === 0) {
    grid.innerHTML = `<div class="muted">No competitions found.</div>`;
    return;
  }

  if (onlyCountdownUpdate) {
    // only update countdown text nodes
    for (const c of comps) {
      const node = document.querySelector(`[data-countdown="${c.id}"]`);
      if (node) node.textContent = countdownText(c.endsAt);
    }
    return;
  }

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
          <div><b>Collected</b><span>£${fmt2(c.collected)}</span></div>
          <div><b>Tickets sold</b><span>${c.ticketsSold}${c.limit ? ` / ${c.limit}` : ""}</span></div>
          <div><b>Winner at</b><span>£${fmt2(c.threshold || DEFAULT_THRESHOLD)}</span></div>
        </div>

        ${c.instantPrizes?.length ? `<div class="muted small" style="margin-top:8px">Instant wins enabled ✅</div>` : ""}
      </div>

      <div class="comp__actions">
        <button class="btn btn--buy" data-pay="${c.id}" ${(!c.paypal || ended || soldOut) ? "disabled" : ""}>PayPal</button>
        <button class="btn btn--enter" data-enter="${c.id}" ${(ended || soldOut) ? "disabled" : ""}>I’ve Paid</button>
      </div>
    `;

    grid.appendChild(card);
  }

  // Bind buttons
  grid.querySelectorAll("[data-pay]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-pay");
      const c = state.competitions.find(x => x.id === id);
      if (!c?.paypal) return alert("No PayPal link set for this competition (admin can add it).");
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

  // Add 1 ticket
  const ticketRef = `T-${Date.now().toString(36)}-${Math.floor(Math.random()*1e6)}`;
  c.tickets.push({ name: username, time: Date.now(), ref: ticketRef, round: c.round });

  c.ticketsSold += 1;
  c.collected = round2(c.collected + Number(c.price || 0));

  // Instant win logic (optional)
  maybeInstantWin(c, username);

  // Auto-winner at threshold
  if (c.collected >= (c.threshold || DEFAULT_THRESHOLD)) {
    autoPickWinner(c);
  }

  saveState();
  renderAll();

  alert(`Ticket entered ✅\nRef: ${ticketRef}`);
}

function maybeInstantWin(comp, buyerName){
  if (!Array.isArray(comp.instantPrizes) || comp.instantPrizes.length === 0) return;
  // random chance
  if (secureRandom01() > INSTANT_WIN_CHANCE) return;
  // pick a random remaining prize
  const idx = Math.floor(secureRandom01() * comp.instantPrizes.length);
  const prize = comp.instantPrizes.splice(idx, 1)[0];
  comp.instantWinners = comp.instantWinners || [];
  comp.instantWinners.push({ time: Date.now(), name: buyerName, prize, round: comp.round });
}

function autoPickWinner(comp){
  if (!comp.tickets || comp.tickets.length === 0) return;

  // pick a random ticket from current round
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

  // reset for next round
  comp.round += 1;
  comp.collected = 0;
  comp.ticketsSold = 0;
  comp.tickets = [];
  comp.instantWinners = comp.instantWinners || [];
  // NOTE: instant prizes list remains whatever is left; admin can refill/edit anytime

  alert(`🎉 WINNER PICKED!\n${win.winnerName} won ${win.competitionName} (Round ${win.round}).`);
}

function renderAdminList(){
  const box = el("adminList");
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
  const endsAtInput = el("a_ends").value; // datetime-local
  const endsAt = endsAtInput ? new Date(endsAtInput).toISOString() : "";
  const instantPrizes = el("a_instant").value
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  if (!name) return alert("Enter a competition name.");
  if (!Number.isFinite(price) || price <= 0) return alert("Ticket price must be a number > 0.");
  if (limit && limit < 1) return alert("Ticket limit must be blank or 1+.");
  if (!Number.isFinite(threshold) || threshold < 1) return alert("Winner trigger must be 1+.");

  if (id) {
    // edit existing
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
    // new
    state.competitions.push(makeComp({
      name, price, category, image, paypal, limit, threshold, endsAt, instantPrizes
    }));
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
  const rows = [
    ["time","competitionName","round","winnerName","collected"]
  ];
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

function isSoldOut(c){
  return (c.limit && c.ticketsSold >= c.limit);
}
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

// Helpers
function fmt2(n){ return Number(n||0).toFixed(2).replace(/\.00$/,".00"); }
function round2(n){ return Math.round((Number(n)||0)*100)/100; }

function cryptoId(){
  // short stable random id
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
  // convert ISO -> yyyy-MM-ddThh:mm for input[type=datetime-local]
  const d = new Date(iso);
  const pad = (n)=>String(n).padStart(2,"0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}