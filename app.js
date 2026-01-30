// public/app.js (ES Modules)

// 1) Firebase SDK (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  update,
  remove,
  onValue,
  get,
  child
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ======================
// 2) PASTE YOUR CONFIG
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyC960bEEJzREsiZeDtiSYCIq17K8PGuNrI",
  authDomain: "my-key-system-9b3e9.firebaseapp.com",
  databaseURL: "https://my-key-system-9b3e9-default-rtdb.firebaseio.com",
  projectId: "my-key-system-9b3e9",
  storageBucket: "my-key-system-9b3e9.firebasestorage.app",
  messagingSenderId: "33115342912",
  appId: "1:33115342912:web:7bd69ea31b582a6de1f7a5",
  measurementId: "G-H1J22ESWZ5"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// UI helpers
const $ = (id) => document.getElementById(id);

function msg(el, text, type = "") {
  el.textContent = text;
  el.className = "msg show " + type;
}

function clearMsg(el){
  el.textContent = "";
  el.className = "msg";
}

function genDeviceId(){
  const part = (n) => [...crypto.getRandomValues(new Uint8Array(n))]
    .map(b => b.toString(16).padStart(2,'0')).join('');
  return (part(4) + "-" + part(2) + "-" + part(2)).toUpperCase();
}

function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function isExpired(expiry){
  if(!expiry) return true;
  const now = new Date();
  const exp = new Date(expiry + "T23:59:59");
  return now > exp;
}

// Paths
const licensesPath = "licenses";

// Render table
let licensesCache = {};

function renderTable(filterText=""){
  const tbody = $("tbody");
  tbody.innerHTML = "";

  const q = (filterText || "").toLowerCase().trim();

  const rows = Object.entries(licensesCache)
    .map(([device_id, data]) => ({ device_id, ...data }))
    .sort((a,b) => (b.updated_at||"").localeCompare(a.updated_at||""));

  for(const row of rows){
    const match = !q ||
      (row.device_id||"").toLowerCase().includes(q) ||
      (row.username||"").toLowerCase().includes(q);

    if(!match) continue;

    const tr = document.createElement("tr");
    const status = row.status || "active";
    const expiry = row.expiry_date || "-";
    const upd = row.updated_at ? new Date(row.updated_at).toLocaleString() : "-";

    // expiry status hint
    let statusShow = status;
    if(status === "active" && isExpired(expiry)) statusShow = "expired";

    tr.innerHTML = `
      <td class="mono">${row.device_id}</td>
      <td>${row.username || "-"}</td>
      <td class="mono">${expiry}</td>
      <td>${statusShow}</td>
      <td>${upd}</td>
    `;

    tr.addEventListener("click", () => {
      $("deviceId").value = row.device_id || "";
      $("username").value = row.username || "";
      $("expiry").value = row.expiry_date || "";
      clearMsg($("panelMsg"));
    });

    tbody.appendChild(tr);
  }
}

// Listen DB changes
function subscribeLicenses(){
  const r = ref(db, licensesPath);
  onValue(r, (snap) => {
    licensesCache = snap.val() || {};
    renderTable($("search").value);
  });
}

// Auth state
onAuthStateChanged(auth, (user) => {
  const loginCard = $("loginCard");
  const panelCard = $("panelCard");
  const logoutBtn = $("logoutBtn");
  const userTag = $("userTag");

  if(user){
    userTag.textContent = "Logged in: " + (user.email || "admin");
    logoutBtn.style.display = "inline-block";
    loginCard.style.display = "none";
    panelCard.style.display = "block";
    subscribeLicenses();

    // show public endpoint hint for python
    // Format: https://<project>-default-rtdb.firebaseio.com/licenses/<DEVICE_ID>.json
    const dbUrl = firebaseConfig.databaseURL.replace(/\/$/, "");
    $("endpointHint").textContent = `${dbUrl}/${licensesPath}/<DEVICE_ID>.json`;
  } else {
    userTag.textContent = "Not logged in";
    logoutBtn.style.display = "none";
    loginCard.style.display = "block";
    panelCard.style.display = "none";
  }
});

// Buttons
$("loginBtn").addEventListener("click", async () => {
  clearMsg($("loginMsg"));
  const email = $("email").value.trim();
  const pass = $("password").value.trim();
  if(!email || !pass) return msg($("loginMsg"), "Email/password required", "err");

  try{
    await signInWithEmailAndPassword(auth, email, pass);
    msg($("loginMsg"), "Login success ✅", "ok");
  }catch(e){
    msg($("loginMsg"), e.message, "err");
  }
});

$("signupBtn").addEventListener("click", async () => {
  clearMsg($("loginMsg"));
  const email = $("email").value.trim();
  const pass = $("password").value.trim();
  if(!email || !pass) return msg($("loginMsg"), "Email/password required", "err");

  try{
    await createUserWithEmailAndPassword(auth, email, pass);
    msg($("loginMsg"), "Admin created ✅ (now logged in)", "ok");
  }catch(e){
    msg($("loginMsg"), e.message, "err");
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
});

// Save / Update
$("saveBtn").addEventListener("click", async () => {
  clearMsg($("panelMsg"));

  const device_id = $("deviceId").value.trim();
  const username = $("username").value.trim();
  const expiry_date = $("expiry").value;

  if(device_id.length < 6) return msg($("panelMsg"), "Device ID too short", "err");
  if(username.length < 3) return msg($("panelMsg"), "Username too short", "err");
  if(!expiry_date) return msg($("panelMsg"), "Expiry date required", "err");

  const payload = {
    username,
    expiry_date,
    status: "active",
    updated_at: new Date().toISOString()
  };

  try{
    await set(ref(db, `${licensesPath}/${device_id}`), payload);
    msg($("panelMsg"), "Saved ✅", "ok");
  }catch(e){
    msg($("panelMsg"), e.message, "err");
  }
});

// Generate device id
$("genBtn").addEventListener("click", () => {
  $("deviceId").value = genDeviceId();
  if(!$("expiry").value) $("expiry").value = todayISO();
  msg($("panelMsg"), "Generated ✅", "ok");
});

// Block / Unblock / Delete
$("blockBtn").addEventListener("click", async () => {
  clearMsg($("panelMsg"));
  const device_id = $("deviceId").value.trim();
  if(!device_id) return msg($("panelMsg"), "Select/enter device id first", "err");
  try{
    await update(ref(db, `${licensesPath}/${device_id}`), { status:"blocked", updated_at: new Date().toISOString() });
    msg($("panelMsg"), "Blocked ⛔", "warn");
  }catch(e){
    msg($("panelMsg"), e.message, "err");
  }
});

$("unblockBtn").addEventListener("click", async () => {
  clearMsg($("panelMsg"));
  const device_id = $("deviceId").value.trim();
  if(!device_id) return msg($("panelMsg"), "Select/enter device id first", "err");
  try{
    await update(ref(db, `${licensesPath}/${device_id}`), { status:"active", updated_at: new Date().toISOString() });
    msg($("panelMsg"), "Unblocked ✅", "ok");
  }catch(e){
    msg($("panelMsg"), e.message, "err");
  }
});

$("deleteBtn").addEventListener("click", async () => {
  clearMsg($("panelMsg"));
  const device_id = $("deviceId").value.trim();
  if(!device_id) return msg($("panelMsg"), "Select/enter device id first", "err");

  const sure = confirm("Delete this license? " + device_id);
  if(!sure) return;

  try{
    await remove(ref(db, `${licensesPath}/${device_id}`));
    msg($("panelMsg"), "Deleted ✅", "ok");
  }catch(e){
    msg($("panelMsg"), e.message, "err");
  }
});

// Search + Refresh
$("search").addEventListener("input", (e) => renderTable(e.target.value));
$("refreshBtn").addEventListener("click", async () => {
  // Force fetch once (optional)
  const snap = await get(child(ref(db), licensesPath));
  licensesCache = snap.val() || {};
  renderTable($("search").value);
  msg($("panelMsg"), "Refreshed ✅", "ok");
});
