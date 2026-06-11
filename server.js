
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


function fakeDistanceKm() {
  return Math.floor(Math.random() * 11) + 2; 
}
function calcPrice(km, service = "Standard") {
  const base = 200; 
  const perKm = service === "Premium" ? 150 : 100;
  return base + km * perKm;
}
function validLuhn(number = "") {
  const digits = (number + "").replace(/\s/g, "");
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}


function parseDay(str, endOfDay = false) {
  if (!str) return null;
  const s = String(str).trim();

  let y, m, d;

  
  let m1 = s.match(/^(\d{1,2})[.\-\/\s](\d{1,2})[.\-\/\s](\d{4})$/);
  if (m1) {
    d = parseInt(m1[1], 10);
    m = parseInt(m1[2], 10) - 1; 
    y = parseInt(m1[3], 10);
  } else {
    
    let m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) {
      y = parseInt(m2[1], 10);
      m = parseInt(m2[2], 10) - 1;
      d = parseInt(m2[3], 10);
    } else {
      
      const dt = new Date(s);
      if (isNaN(dt)) return null;
      if (endOfDay) {
        dt.setHours(23, 59, 59, 999);
      } else {
        dt.setHours(0, 0, 0, 0);
      }
      return dt;
    }
  }

  const dt = new Date(y, m, d, 0, 0, 0, 0);
  if (endOfDay) dt.setHours(23, 59, 59, 999);
  return dt;
}


let users = [];     
let rides = [];     
let payments = [];  


app.post("/api/auth/signup", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  if (users.find(u => u.email === email)) return res.status(409).json({ error: "User exists" });
  users.push({ email, password });
  res.json({ ok: true, email });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const u = users.find(x => x.email === email && x.password === password);
  if (!u) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ ok: true, email });
});




app.post("/api/rides/quote", (req, res) => {
  const { pickup, dropoff, service } = req.body || {};
  if (!pickup || !dropoff) return res.status(400).json({ error: "Missing fields" });

  const distance = fakeDistanceKm();
  const price = calcPrice(distance, service || "Standard");

  
  const eta = Math.min(20, Math.max(1, Math.round(distance * 1.5)));

  res.json({ distance, price, driverEtaMin: eta }); 
});


app.post("/api/rides/create", (req, res) => {
  const {
    email,
    pickup,
    dropoff,
    service = "Standard",
    payMethod = "Card",
    quotedDistance,
    quotedPrice,
    driverEtaMin
  } = req.body || {};

  if (!pickup || !dropoff) return res.status(400).json({ error: "Missing fields" });
  if (!email) return res.status(400).json({ error: "Missing email" });

  const distance = typeof quotedDistance === "number" ? quotedDistance : fakeDistanceKm();
  const price = typeof quotedPrice === "number" ? quotedPrice : calcPrice(distance, service);

  const rideId = rides.length + 1;
  const paymentId = payments.length + 1;
  console.log("Novi ride:", {
    pickup,
    dropoff,
    distance,
    price,
    driverEtaMin
  });
  
  rides.push({
    id: rideId,
    userEmail: email,
    pickup,
    dropoff,
    service,
    price,
    distance,
    method: payMethod,
    status: payMethod === "Card" ? "pending" : "booked",
    createdAt: new Date().toISOString(),
    driverEtaMin: typeof driverEtaMin === "number" ? driverEtaMin : null
  });

  payments.push({ id: paymentId, rideId, method: payMethod, status: "created" });

  res.json({
    ok: true,
    rideId,
    paymentId,
    price,
    distance,
    status: payMethod === "Card" ? "pending" : "booked"
  });
});


app.post("/api/payments/confirm", (req, res) => {
  const { paymentId, cardNumber } = req.body || {};
  const pay = payments.find(p => p.id == paymentId);
  if (!pay) return res.status(404).json({ error: "Payment not found" });

  if (pay.method === "Card" && !validLuhn(cardNumber)) {
    return res.status(400).json({ error: "Card declined" });
  }

  pay.status = "succeeded";
  const ride = rides.find(r => r.id === pay.rideId);
  if (ride) ride.status = "paid";

  res.json({ ok: true, status: pay.status });
});


app.post("/api/rides/:id/cancel", (req, res) => {
  const id = Number(req.params.id);
  const ride = rides.find(r => r.id === id);
  if (!ride) return res.status(404).json({ error: "Ride not found" });
  if (ride.method !== "Cash") return res.status(400).json({ error: "Only cash rides can be canceled" });
  if (ride.status !== "booked") return res.status(400).json({ error: "Ride cannot be canceled now" });

  ride.status = "canceled";
  res.json({ ok: true, status: "canceled" });
});


app.get("/api/rides/history", (req, res) => {
  const email = (req.query.email || "").trim();
  const status = (req.query.status || "all").trim().toLowerCase();
  const fromStr = (req.query.from || "").trim();
  const toStr   = (req.query.to   || "").trim();

  const from = parseDay(fromStr, false);       
  const to   = parseDay(toStr,   true);        

  let items = rides.filter(r => !email || r.userEmail === email);

  if (status && status !== "all") {
    items = items.filter(r => r.status === status);
  }

  if (from) {
    items = items.filter(r => new Date(r.createdAt) >= from);
  }
  if (to) {
    items = items.filter(r => new Date(r.createdAt) <= to);
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ items });
});


app.get("/api/test", (_req, res) => res.json({ ok: true }));


app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`TaxiRomania server running at http://localhost:${PORT}`);
});