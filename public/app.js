console.log("RR app.js loaded");


const LANG_CONF = {
  en: { locale: "en-GB", currency: "EUR", rateFromRSD: 0.0085 },
  ro: { locale: "ro-RO", currency: "RON", rateFromRSD: 0.045 },
};
let LANG = localStorage.getItem("tr_lang") || "en";
let CFG  = LANG_CONF[LANG];

const T = {
  en: {
    book: "Book a ride",
    pickup: "Pickup",
    destination: "Destination",
    service: "Service",
    paywith: "Pay with",
    getprice: "Get price",
    confirm: "Confirm & Book",
    securepay: "Secure payment",
    yourrides: "Your rides",
    refresh: "Refresh",
    noRides: "No rides yet.",
    cardNumber: "Card number",
    expiry: "Expiry",
    cvc: "CVC",
    dist: "Distance",
    price: "Price",
    paid: "PAID",
    booked: "BOOKED",
    canceled: "CANCELED",
    cancel: "Cancel",
    
    filterAll: "All",
    filterBooked: "Booked",
    filterPaid: "Paid",
    filterCanceled: "Canceled",
    
    login: "Log in",
    signup: "Sign up",
    email: "Email",
    password: "Password",
    createAcc: "Create account",
    logout: "Log out",
    arrivesIn: (m) => `Driver arrives in ${m} min`,
  },
  ro: {
    book: "Rezervă o cursă",
    pickup: "Punct de plecare",
    destination: "Destinație",
    service: "Serviciu",
    paywith: "Plătește cu",
    getprice: "Calculează prețul",
    confirm: "Confirmă și rezervă",
    securepay: "Plată securizată",
    yourrides: "Cursele tale",
    refresh: "Reîmprospătează",
    noRides: "Încă nu există curse.",
    cardNumber: "Numărul cardului",
    expiry: "Expiră la",
    cvc: "CVC",
    dist: "Distanța",
    price: "Preț",
    paid: "PLĂTIT",
    booked: "REZERVAT",
    canceled: "ANULAT",
    cancel: "Anulează",
    
    filterAll: "Toate",
    filterBooked: "Rezervate",
    filterPaid: "Plătite",
    filterCanceled: "Anulate",
    
    login: "Autentificare",
    signup: "Înregistrare",
    email: "Email",
    password: "Parolă",
    createAcc: "Creează cont",
    logout: "Delogare",
    arrivesIn: (m) => `Șoferul sosește în ${m} min`,
  }
};
const t = (k, ...args) => {
  const v = (T[LANG] && T[LANG][k]);
  return typeof v === "function" ? v(...args) : (v || k);
};
const fmtMoney = (rsd) =>
  new Intl.NumberFormat(CFG.locale, { style: "currency", currency: CFG.currency })
    .format(rsd * CFG.rateFromRSD);


let currentUserEmail = localStorage.getItem("tr_email") || "";

function applyAuthUI() {
  const out = document.getElementById("authLoggedOut");
  const inn = document.getElementById("authLoggedIn");
  const who = document.getElementById("whoami");
  if (currentUserEmail) {
    out?.classList.add("hidden");
    inn?.classList.remove("hidden");
    if (who) who.textContent = currentUserEmail;
  } else {
    inn?.classList.add("hidden");
    out?.classList.remove("hidden");
  }
}


const $ = (id) => document.getElementById(id);
const val = (id) => ($(id) && $(id).value && $(id).value.trim()) ? $(id).value.trim() : "";

let lastQuote = { km: null, price: null, etaMin: null };


function applyLanguage() {
  const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };

  set("titleBook", t("book"));
  set("lblPickup", t("pickup"));
  set("lblDropoff", t("destination"));
  set("lblService", t("service"));
  set("lblPay", t("paywith"));
  set("getPrice", t("getprice"));
  set("bookRide", t("confirm"));
  set("securePayTitle", t("securepay"));
  set("historyTitle", t("yourrides"));
  set("lblCardNum", t("cardNumber"));
  set("lblExpiry", t("expiry"));
  set("lblCvc", t("cvc"));
  $("findBtn") && ( $("findBtn").textContent = LANG === "ro" ? "Caută" : "Find" );

  
  $("optAll")     && ( $("optAll").textContent = t("filterAll") );
  $("optBooked")  && ( $("optBooked").textContent = t("filterBooked") );
  $("optPaid")    && ( $("optPaid").textContent = t("filterPaid") );
  $("optCanceled")&& ( $("optCanceled").textContent = t("filterCanceled") );

  
  if (lastQuote.price != null) {
    const qt = $("quoteText");
    if (qt) {
      const etaPart = lastQuote.etaMin != null ? `, ${t("arrivesIn", lastQuote.etaMin)}` : "";
      qt.textContent = `${t("dist")}: ${lastQuote.km} km, ${t("price")}: ${fmtMoney(lastQuote.price)}${etaPart}`;
    }
  }

  
  renderHistory(window._lastHistory || []);
}


window._lastHistory = [];

async function loadHistory({status="all", from="", to=""} = {}) {
  try {
    const params = new URLSearchParams();
    if (currentUserEmail) params.set("email", currentUserEmail);
    if (status && status !== "all") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const res = await fetch(`/api/rides/history?${params.toString()}`);
    const data = await res.json();
    const items = data.items || [];
    window._lastHistory = items;
    renderHistory(items);
  } catch (e) {
    console.error("history error", e);
  }
}

function renderHistory(items) {
  const empty = $("ridesEmpty");
  const list = $("ridesList");
  if (!empty || !list) return;

  list.innerHTML = "";
  if (!items.length) {
    empty.classList.remove("hidden");
    empty.textContent = t("noRides");
    return;
  }
  empty.classList.add("hidden");

  items.forEach(it => {
    const row = document.createElement("div");
    row.className = "ride-row";

    const when = new Date(it.createdAt).toLocaleString(CFG.locale);
    const statusKey = it.status === "paid" ? "paid" :
                      it.status === "canceled" ? "canceled" : "booked";
    const canCancel = it.method === "Cash" && it.status === "booked";
    const eta = it.etaMin != null ? ` • ${t("arrivesIn", it.etaMin)}` : "";

    row.innerHTML = `
      <div class="ride-main">
        <div class="ride-route">${it.pickup} → ${it.dropoff}</div>
        <div class="ride-meta">
          <span>${when}</span> •
          <span>${it.service}</span> •
          <span>${t("dist")}: ${it.distance} km</span>${eta}
        </div>
      </div>
      <div class="ride-side">
        <div class="ride-price">${fmtMoney(it.price)}</div>
        <div class="ride-status ${statusKey}">${t(statusKey)}</div>
        ${canCancel ? `<button class="btn ghost sm cancel-btn" data-id="${it.id}">${t("cancel")}</button>` : ""}
      </div>
    `;
    list.appendChild(row);
  });
}


$("ridesList")?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".cancel-btn");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  try {
    const res = await fetch(`/api/rides/${id}/cancel`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Cancel failed"); return; }
    doFind();
  } catch (err) {
    console.error(err);
    alert("Network error");
  }
});


let currentPaymentId = null;

async function onGetPrice(e) {
  e.preventDefault();
  const pickup = val("pickup");
  const dropoff = val("dropoff");
  const service = $("service") ? $("service").value : "Standard";

  if (!pickup || !dropoff) {
    alert(LANG === "ro" ? "Completează Pickup și Destinație" : "Enter Pickup and Destination");
    return;
  }

  try {
    const res = await fetch("/api/rides/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup, dropoff, service })
    });
    const data = await res.json();
    if (!res.ok) { alert("Error: " + (data.error || "quote failed")); return; }

    lastQuote.km = data.distance;
    lastQuote.price = data.price;
    
    lastQuote.etaMin = Math.max(1, Math.min(20, Math.round(data.distance * 2)));

    const etaPart = lastQuote.etaMin != null ? `, ${t("arrivesIn", lastQuote.etaMin)}` : "";
    $("quoteText").textContent =
      `${t("dist")}: ${data.distance} km, ${t("price")}: ${fmtMoney(data.price)}${etaPart}`;
    $("bookRide").disabled = false;
  } catch (err) {
    console.error(err);
    alert(LANG === "ro" ? "Eroare de rețea" : "Network error");
  }
}

async function onBookRide(e) {
  e.preventDefault();
  if (!currentUserEmail) {
    alert(LANG === "ro" ? "Autentifică-te mai întâi." : "Please log in first.");
    return;
  }

  const pickup = val("pickup");
  const dropoff = val("dropoff");
  const service = $("service") ? $("service").value : "Standard";
  const payMethod = $("payMethod") ? $("payMethod").value : "Card";

  if (!pickup || !dropoff) {
    alert(LANG === "ro" ? "Completează Pickup și Destinație" : "Enter Pickup and Destination");
    return;
  }

  try {
    const res = await fetch("/api/rides/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: currentUserEmail,
        pickup, dropoff, service, payMethod,
        quotedDistance: lastQuote.km,
        quotedPrice: lastQuote.price,
        driverEtaMin: lastQuote.etaMin
      })
    });
    const data = await res.json();
    if (!res.ok) { alert("Error: " + (data.error || "create failed")); return; }

    currentPaymentId = data.paymentId;

    if (payMethod === "Card") {
      $("paymentSection").classList.remove("hidden");
    } else {
      $("paymentSection").classList.add("hidden");
      alert(LANG === "ro" ? "✔ Cursa rezervată! Plată cash." : "✔ Ride booked! Pay in cash.");
      doFind();
    }
  } catch (err) {
    console.error(err);
    alert(LANG === "ro" ? "Eroare la rezervare" : "Booking error");
  }
}

async function onConfirmPayment(e) {
  e.preventDefault();

  if (!currentPaymentId) {
    alert(LANG === "ro" ? "Nu există plată activă" : "No active payment — book first.");
    return;
  }
  const cardNumber = $("cardNumber").value.trim();
  const exp = $("expiry").value.trim();
  const cvc = $("cvc").value.trim();

  try {
    const res = await fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: currentPaymentId, cardNumber, exp, cvc })
    });
    const data = await res.json();
    if (!res.ok) { alert("✖ " + (data.error || "Payment failed")); return; }

    $("payResult").textContent = LANG === "ro" ? "✔ Plata reușită" : "✔ Payment succeeded";
    $("payResult").classList.add("success");
    alert(LANG === "ro" ? "✔ Plata reușită — cursă confirmată!" : "✔ Payment succeeded — ride confirmed!");
    $("paymentSection").classList.add("hidden");
    doFind();
  } catch (err) {
    console.error(err);
    alert(LANG === "ro" ? "Eroare la plată" : "Payment error");
  }
}


function getActiveFilters() {
  const status = $("statusFilter")?.value || "all";
  const from = $("dateFrom")?.value || "";
  const to   = $("dateTo")?.value || "";
  return { status, from, to };
}

function doFind() {
  const f = getActiveFilters();
  loadHistory(f);
}


function openDialog(id) { $(id)?.showModal(); }
function closeDialog(id) { $(id)?.close(); }

async function doSignup() {
  const email = $("signupEmail").value.trim();
  const pass = $("signupPass").value.trim();
  if (!email || !pass) return;
  const res = await fetch("/api/auth/signup", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass })
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error || "Signup failed"); return; }
  currentUserEmail = email;
  localStorage.setItem("tr_email", email);
  applyAuthUI(); closeDialog("dlgSignup"); doFind();
}

async function doLogin() {
  const email = $("loginEmail").value.trim();
  const pass = $("loginPass").value.trim();
  if (!email || !pass) return;
  const res = await fetch("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass })
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error || "Login failed"); return; }
  currentUserEmail = email;
  localStorage.setItem("tr_email", email);
  applyAuthUI(); closeDialog("dlgLogin"); doFind();
}

function doLogout() {
  currentUserEmail = "";
  localStorage.removeItem("tr_email");
  applyAuthUI();
  renderHistory([]);
}


document.addEventListener("DOMContentLoaded", () => {
  const langSel = $("langSelect");
  if (langSel) {
    langSel.value = LANG;
    langSel.addEventListener("change", () => {
      LANG = langSel.value;
      CFG = LANG_CONF[LANG];
      localStorage.setItem("tr_lang", LANG);
      applyLanguage();
    });
  }

  $("getPrice")?.addEventListener("click", onGetPrice);
  $("bookRide")?.addEventListener("click", onBookRide);
  $("confirmPayment")?.addEventListener("click", onConfirmPayment);

  $("findBtn")?.addEventListener("click", doFind);

  applyAuthUI();

  $("openLogin")?.addEventListener("click", () => openDialog("dlgLogin"));
  $("openSignup")?.addEventListener("click", () => openDialog("dlgSignup"));
  $("doLogin")?.addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
  $("doSignup")?.addEventListener("click", (e) => { e.preventDefault(); doSignup(); });
  $("logoutBtn")?.addEventListener("click", doLogout);

  applyLanguage();
  if (currentUserEmail) doFind();
});
