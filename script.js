// Students database
let STUDENTS = []; // 

async function loadStudentsFromDB() {
  try {
    const res = await fetch("http://127.0.0.1:8000/students");
    const data = await res.json();

    if (data.success) {
      STUDENTS = data.students; // 🔥 replace local array
      renderStudentGrid(); 
    }

  } catch (err) {
    console.error("Failed to load students", err);
  }
}

let ATTENDANCE = [];
async function loadAttendanceFromDB() {
  try {
    const res = await fetch("http://127.0.0.1:8000/attendance");
    const data = await res.json();

    if (data.success) {
      ATTENDANCE = data.attendance; // 🔥 replace array
    }

  } catch (err) {
    console.error("Failed to load attendance", err);
  }
}
let nextStuId = 9;

// Timetable: one entry per period per day
// Each entry: {id, day, periodNo, subject, teacher, startTime, endTime, class, room}
let TIMETABLE = [];
async function loadTimetableFromDB() {
  try {
    const res = await fetch("http://127.0.0.1:8000/timetable");
    const data = await res.json();

    if (data.success) {
      TIMETABLE = data.timetable;
    }

  } catch (err) {
    console.error("Failed to load timetable", err);
  }
}
let DAY_SETTINGS = {};
async function loadDaySettings(){
  const res = await fetch("http://127.0.0.1:8000/day-settings");
  const data = await res.json();

  if(data.success){
    DAY_SETTINGS = {};

    data.days.forEach(d => {
      DAY_SETTINGS[d.date] = d;
    });
  }
}
let nextTTId = 20;

/* ================================================================
   HELPERS
================================================================ */
function timeToMin(t){const[h,m]=t.split(":").map(Number);return h*60+m}
function minToTime(m){return`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`}
function nowMin(){const n=new Date();return n.getHours()*60+n.getMinutes()}
function todayName(){return["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()]}
function todayStr(){return new Date().toISOString().split("T")[0]}
function fmtTime(d){let h=d.getHours(),m=d.getMinutes(),s=d.getSeconds(),ap=h>=12?"PM":"AM";h=h%12||12;return`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")} ${ap}`}
function fmtTimeMini(t){// "08:30" => "8:30 AM"
  const[h,m]=t.split(":").map(Number);const ap=h>=12?"PM":"AM";const h12=h%12||12;return`${h12}:${String(m).padStart(2,"0")} ${ap}`;
}
function fmtDateLong(d){return d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}

function isSunday(dateStr){
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay() === 0; // 0 = Sunday
}
function getValidPeriodsForDate(dateStr){
  const d = new Date(dateStr + "T12:00:00");
  const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];

  // ❌ Ignore Sunday
  if(dayName === "Sunday") return [];

  // ✅ Only periods with subject (NOT free)
  return TIMETABLE.filter(t => 
    t.day === dayName && 
    t.subject && t.subject.trim() !== ""
  );
}
/** Find what period is currently active / coming up */
function getCurrentPeriod() {
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const today = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()];

  // ❌ 1. Ignore Sunday completely
  if (today === "Sunday") return null;

  // 🔥 2. Filter ONLY valid periods (NOT free)
  const todayPeriods = TIMETABLE
    .filter(t =>
      t.day === today &&
      t.subject && t.subject.trim() !== ""   // ❌ remove free periods
    )
    .sort((a,b) => timeToMin(a.startTime) - timeToMin(b.startTime));

  for (const p of todayPeriods) {
    const start = timeToMin(p.startTime);
    const end = timeToMin(p.endTime);

    // ✅ Active period
    if (currentMin >= start && currentMin <= end) {
      return {
        ...p,
        state: "on",
        minutesLate: Math.max(0, currentMin - start)
      };
    }

    // ✅ Upcoming period
    if (currentMin < start) {
      return {
        ...p,
        state: "upcoming",
        minutesUntil: start - currentMin
      };
    }
  }

  // ❌ No valid class
  return null;
}

function openLoginFromDropdown() {
  const role = document.getElementById("roleSelect").value;
  openLoginModal(role);
}

/** Determine status from time captured vs period start */
function getStatusFromTime(periodStartTime){
  const sm=timeToMin(periodStartTime);
  const nm=nowMin();
  const diff=nm-sm;
  if(diff<0) return "Before"; // too early
  if(diff<=5) return "Present";
  if(diff<=10) return "Late";
  return "Absent";
}

function badgeHTML(s){
  if(s==="Present") return`<span class="bdg bdg-p"><i class="fa-solid fa-check" style="font-size:0.6rem"></i> Present</span>`;
  if(s==="Late")    return`<span class="bdg bdg-l"><i class="fa-solid fa-clock" style="font-size:0.6rem"></i> Late</span>`;
  return `<span class="bdg bdg-a"><i class="fa-solid fa-xmark" style="font-size:0.6rem"></i> Absent</span>`;
}
function av(name){return`<div class="av">${name.charAt(0)}</div>`;}

/* ================================================================
   CLOCK
================================================================ */
function startClocks(){
  function tick(){
    const t=fmtTime(new Date());
    ["markClock","adminClock","adminClockD","teacherClock","teacherClockD"].forEach(id=>{
      const el=document.getElementById(id);if(el)el.textContent=t;
    });
    // update home period banner every tick
    updateHomePeriodBanner();
  }
  tick();setInterval(tick,1000);
}

/* ================================================================
   HOME BANNER
================================================================ */
function updateHomePeriodBanner(){
  const cp=getCurrentPeriod();
  const mainEl=document.getElementById("homePeriodMain");
  const subEl=document.getElementById("homePeriodSub");
  if(!mainEl) return;
  if(!cp){
    mainEl.textContent="No active period right now";
    subEl.textContent=`Today: ${todayName()} — Check timetable for next class`;
  } else if(cp.state==="on"){
    mainEl.textContent=`Period ${cp.periodNo}: ${cp.subject} is ACTIVE`;
    subEl.textContent=`${fmtTimeMini(cp.startTime)} – ${fmtTimeMini(cp.endTime)} · ${cp.teacher}`;
  } else {
    mainEl.textContent=`Next: Period ${cp.periodNo} — ${cp.subject} in ${cp.minutesUntil} min`;
    subEl.textContent=`Starts at ${fmtTimeMini(cp.startTime)} · ${cp.teacher}`;
  }
}

/* ================================================================
   NAVIGATION
================================================================ */
function showPage(id){
  document.querySelectorAll(".page").forEach(p=>{
    p.classList.remove("active");
    p.style.display="none";
  });
  const p=document.getElementById(id);
  if(!p){console.error("showPage: not found ->",id);return;}
  p.style.display="flex";
  p.classList.add("active");
}

function goToMarkPage(){showPage("markPage");updatePeriodStrip();startClocks()}
function leaveMark(){stopCamera();showPage("homePage")}

/* ================================================================
   LOGIN MODAL
================================================================ */
function openLoginModal() {
  const modal = document.getElementById("loginModal");
  const err = document.getElementById("loginErr");

  err.classList.add("hidden");

  // ✅ CLEAR ALL FIELDS
    const userEl = document.getElementById("loginUser");
  const pwEl = document.getElementById("loginPw");

  document.getElementById("roleAdmin").classList.add("active");
  document.getElementById("roleTeacher").classList.remove("active");

  if (userEl) userEl.value = "";
  if (pwEl) pwEl.value = "";

  // Optional: reset role to default
  selectedRole = "admin";

  // Update UI based on role
  updateLoginRoleUI();

  modal.style.display = "flex";
  setTimeout(() => modal.classList.add("open"), 10);
}

function updateLoginRoleUI(role=selectedRole) {

  const badge = document.getElementById("modalRoleBadge");
  const title = document.getElementById("modalTitle");

 // 👉 CLEAR fields every time role changes
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPw").value = "";

  if (role === "admin") {
    title.textContent = "Admin Login";
    badge.className = "modal-role-badge badge-admin";
    badge.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Administrator`;
  } else {
    title.textContent = "Teacher Login";
    badge.className = "modal-role-badge badge-teacher";
    badge.innerHTML = `<i class="fa-solid fa-chalkboard-user"></i> Teacher`;
  }
}
let selectedRole = "admin";
function selectRole(role) {
  selectedRole = role;

  // Toggle active class
  document.getElementById("roleAdmin").classList.remove("active");
  document.getElementById("roleTeacher").classList.remove("active");

  if (role === "admin") {
    document.getElementById("roleAdmin").classList.add("active");
  } else {
    document.getElementById("roleTeacher").classList.add("active");
  }

  // Clear fields
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPw").value = "";

  // Update UI (title + badge)
  updateLoginRoleUI(role);
}

function closeLoginModal(){
  const modal=document.getElementById("loginModal");
  modal.classList.remove("open");
  setTimeout(()=>modal.style.display="none",300);
}
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeLoginModal();if(e.key==="Enter"&&document.getElementById("loginModal").classList.contains("open"))handleLogin()});
document.getElementById("loginModal").addEventListener("click", function(e) {
  if (e.target === this) {
    closeLoginModal();
  }
});

function handleLogin() {
  const user = document.getElementById("loginUser").value.trim();
  const pw = document.getElementById("loginPw").value;
    const role = selectedRole;
  const err = document.getElementById("loginErr");

  const creds = {
    admin: { user: "admin", pw: "6969" },
    teacher: { user: "teacher", pw: "6969" }
  };

  const c = creds[role];

  if (user === c.user && pw === c.pw) {
    err.classList.add("hidden");

    closeLoginModal();

    if (role === "admin") {
      showPage("adminPage");
      initAdmin();
    } else {
      showPage("teacherPage");
      initTeacher();
    }

    startClocks();
  } else {
    err.classList.remove("hidden");
    document.getElementById("loginErrMsg").textContent =
      `Invalid credentials.`;
  }
}
function togglePw(){
  const inp=document.getElementById("loginPw");
  const ico=document.getElementById("eyeIco");
  inp.type=inp.type==="password"?"text":"password";
  ico.className=inp.type==="text"?"fa-regular fa-eye-slash":"fa-regular fa-eye";
}
function resetAdminUI(){

  // ✅ Reset sections (go to dashboard)
  document.querySelectorAll("#adminPage .sec").forEach(s=>{
    s.classList.remove("active");
    s.classList.add("hidden");
  });

  const dash = document.getElementById("adm-dashboard");
  if(dash){
    dash.classList.remove("hidden");
    dash.classList.add("active");
  }

  // ✅ Reset sidebar active state
  document.querySelectorAll("#adminSidebar .nav-a").forEach(a=>{
    a.classList.remove("active");
  });

  document.querySelector("#adminSidebar .nav-a")?.classList.add("active");

  // ✅ Clear register form
  clearRegForm();

  // ✅ Reset preview
  const preview = document.getElementById("regPhotoPreview");
  if(preview) preview.classList.add("hidden");

  // ✅ Reset captured image
  const img = document.getElementById("regCapturedImg");
  if(img) img.src = "";

  regCapturedBlob = null;
}
function logout(role){
  stopCamera();
  stopRegCamera();
  resetAdminUI();
  showPage("homePage");
  showToast("Logged out successfully","info");
}

/* ================================================================
   SIDEBAR TOGGLE
================================================================ */
function toggleSB(role){
  const sb=document.getElementById(role+"Sidebar");
  const ov=document.getElementById(role+"Overlay");
  const open=sb.classList.contains("open");
  if(open){sb.classList.remove("open");ov.classList.add("hidden");ov.classList.remove("vis")}
  else{sb.classList.add("open");ov.classList.remove("hidden");ov.classList.add("vis")}
}

/* ================================================================
   ADMIN NAVIGATION
================================================================ */
function adminNav(sec,el){
  document.querySelectorAll("#adminSidebar .nav-a").forEach(a=>a.classList.remove("active"));
  if(el)el.classList.add("active");
  document.querySelectorAll("#adminPage .sec").forEach(s=>{s.classList.remove("active");s.classList.add("hidden")});
  const target=document.getElementById("adm-"+sec);
  if(target){target.classList.remove("hidden");target.classList.add("active")}
  if(window.innerWidth<=768)toggleSB("admin");
  if(sec==="students")renderStudentGrid();
  if(sec==="timetable"){
    syncTTFromBackend();
    renderTimetableGrid();
  }
  if(sec==="areports"){renderAdminSummary("adm");}
}
async function initAdmin(){
  await loadDaySettings();
  document.getElementById("adminDate").textContent=fmtDateLong(new Date());
  document.getElementById("admTotalStu").textContent=STUDENTS.length;
  document.getElementById("admPeriods").textContent=TIMETABLE.filter(t=>t.day===todayName() && t.subject).length;
  renderTodayPeriodStatus("adm");
}

/* ================================================================
   TEACHER NAVIGATION
================================================================ */
function teacherNav(sec,el){
  document.querySelectorAll("#teacherSidebar .nav-a").forEach(a=>a.classList.remove("active"));
  if(el)el.classList.add("active");
  document.querySelectorAll("#teacherPage .sec").forEach(s=>{s.classList.remove("active");s.classList.add("hidden")});
  const target=document.getElementById("tea-"+sec);
  if(target){target.classList.remove("hidden");target.classList.add("active")}
  if(window.innerWidth<=768)toggleSB("teacher");
  if(sec==="tstudents"){renderTeaStudentGrid();}
  if(sec==="tperiodview"){populatePVFilters();renderPeriodView();}
  if(sec==="tsummary"){
    console.log("Rendering summary...");
    renderAdminSummary("tea");
  }
  if(sec==="tdashboard"){
    initTeacherDash();
    renderTodayPeriodStatus("tea");
  }
}
async function initTeacher(){
  await loadDaySettings();
  document.getElementById("teacherDate").textContent=fmtDateLong(new Date());
  initTeacherDash();
}
function initTeacherDash(){
  const todayRecs=ATTENDANCE.filter(r=>r.date===todayStr());
  document.getElementById("teaTotalStu").textContent=STUDENTS.length;

  const cp = getCurrentPeriod();
  if(cp && cp.state === "on"){
    document.getElementById("teaCurrentPeriod").textContent =
      `${cp.subject} (P${cp.periodNo})`;
  } else {
    document.getElementById("teaCurrentPeriod").textContent = "No Active Class";
  }
  // Absent = (total students * periods today) - records today
    renderTodayPeriodStatus("tea");
}

/* ================================================================
   REGISTER STUDENT
================================================================ */
let regStream = null;
let regCapturedBlob = null;

async function registerStudent() {
  const name = document.getElementById("regName").value.trim();
  const roll = document.getElementById("regRoll").value.trim();
  const cls = document.getElementById("regClass").value;

  if (!name || !roll || !cls) {
    showToast("Please fill required fields", "error");
    return;
  }

  // 🔥 IMPORTANT: Check if photo captured
  if (!regCapturedBlob) {
    showToast("Please capture photo first", "error");
    return;
  }

  try {
    const formData = new FormData();

    formData.append("name", name);
    formData.append("roll", roll);
    formData.append("student_class", cls);

    // extra fields (optional)
    formData.append("phone", document.getElementById("regPhone").value);
    formData.append("dob", document.getElementById("regDob").value);
    formData.append("parent", document.getElementById("regParent").value);
    formData.append("parent_phone",document.getElementById("regParentPh").value);
    formData.append("address", document.getElementById("regAddr").value);

    // 🔥 attach captured image
    formData.append("file", regCapturedBlob, "face.jpg");

    const res = await fetch("http://127.0.0.1:8000/register", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      showToast("Student registered successfully ✅", "success");
      await loadStudentsFromDB();
      document.getElementById("admTotalStu").textContent=STUDENTS.length;
      clearRegForm();

      // reset camera
      regCapturedBlob = null;
      document.getElementById("regPhotoPreview").classList.add("hidden");

    } else {
      showToast(data.message || "Registration failed", "error");
    }

  } catch (err) {
    console.error(err);
    showToast("Server error", "error");
  }
}
function clearRegForm(){
  stopRegCamera();
  ["regName","regRoll","regClass","regPhone","regDob","regParent","regParentPh","regAddr"]
    .forEach(id=>{document.getElementById(id).value=""});
    regCapturedBlob = null;
    document.getElementById("regPhotoPreview").classList.add("hidden");
}

/* ================================================================
   REGISTER STUDENT — CAMERA
================================================================ */
async function startRegCamera() {
  const video = document.getElementById("regCamVideo");

  try {
    regStream = await navigator.mediaDevices.getUserMedia({
      video: true
    });

    video.srcObject = regStream;

    document.getElementById("regStartBtn").classList.add("hidden");
    document.getElementById("regStopBtn").classList.remove("hidden");
    document.getElementById("regCaptureBtn").classList.remove("hidden");

    showToast("Register camera started 🎥", "success");

  } catch (e) {
    console.error(e);
    showToast("Camera access denied", "error");
  }
}

function stopRegCamera() {
  if (regStream) {
    regStream.getTracks().forEach(track => track.stop());
  }

  document.getElementById("regStartBtn").classList.remove("hidden");
  document.getElementById("regStopBtn").classList.add("hidden");
}

function captureRegPhoto() {
  const video = document.getElementById("regCamVideo");
  const canvas = document.getElementById("regCamCanvas");
  const container = document.getElementById("regCamFrame");

  // 👉 use container size (what user sees)
  const cw = container.offsetWidth;
  const ch = container.offsetHeight;

  canvas.width = cw;
  canvas.height = ch;

  const ctx = canvas.getContext("2d");

  // 👉 calculate crop (same as object-fit: cover)
  const videoRatio = video.videoWidth / video.videoHeight;
  const containerRatio = cw / ch;

  let sx, sy, sw, sh;

  if (videoRatio > containerRatio) {
    // crop left & right
    sh = video.videoHeight;
    sw = sh * containerRatio;
    sx = (video.videoWidth - sw) / 2;
    sy = 0;
  } else {
    // crop top & bottom
    sw = video.videoWidth;
    sh = sw / containerRatio;
    sx = 0;
    sy = (video.videoHeight - sh) / 2;
  }

  // 👉 draw ONLY visible part
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);

  canvas.toBlob(blob => {
    regCapturedBlob = blob;

    const img = document.getElementById("regCapturedImg");
    img.src = URL.createObjectURL(blob);

    document.getElementById("regPhotoPreview").classList.remove("hidden");

    showToast("Perfect frame captured ✅", "success");
  }, "image/jpeg");
}

function retakeRegPhoto() {
  regCapturedBlob = null;

  document.getElementById("regPhotoPreview").classList.add("hidden");

  showToast("Retake photo", "info");
}



/* ================================================================
   STUDENT GRID
================================================================ */
function renderStudentGrid(){
  const q=(document.getElementById("stuSearch")?.value||"").toLowerCase();
  const filtered=STUDENTS.filter(s=>
    s.name.toLowerCase().includes(q)||s.roll.toLowerCase().includes(q)
  );
  document.getElementById("stuCountLabel").textContent=`${filtered.length} student${filtered.length!==1?"s":""} registered`;
  document.getElementById("studentGrid").innerHTML=filtered.length===0
    ?`<div style="padding:40px;text-align:center;color:var(--muted);grid-column:1/-1">No students found</div>`
    :filtered.map(s=>`
      <div class="stu-card">
        <div class="stu-av">${s.name.charAt(0)}</div>
        <div style="flex:1;min-width:0">
          <div class="stu-name">${s.name}</div>
          <div class="stu-roll">${s.roll}</div>
          <div class="stu-class"><i class="fa-solid fa-school" style="font-size:0.7rem;margin-right:3px"></i>${s.class}</div>
        </div>
        <div class="stu-actions">
        <button class="ico-btn" title="Details" data-roll="${s.roll}" onclick="handleStuClick(this)">
          <i class="fa-regular fa-eye"></i>
        </button>
        <button class="ico-btn del" title="Delete" data-roll="${s.roll}" onclick="handleDelete(this)">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      </div>
    `).join("");
}
function handleStuClick(btn){
  const roll = btn.dataset.roll;
  showStuDetail(roll);
}
function showStuDetail(roll){
  const s = STUDENTS.find(x => x.roll === roll);
  console.log(s);
  if (!s) return;
  currentStudentRoll = roll;

  document.getElementById("stuDetName").value = s.name || "";
  document.getElementById("stuDetRoll").value = s.roll || "";
  document.getElementById("stuDetClass").value = s.class || "";
  document.getElementById("stuDetPhone").value = s.phone || "";
  document.getElementById("stuDetDob").value = s.dob || "";
  document.getElementById("stuDetParent").value = s.parent || "";
  document.getElementById("stuParentPh").value=s.Parent_Phone || " ";
  document.getElementById("stuDetAddr").value = s.address || "";

  const fields = [
    "stuDetClass",
    "stuDetPhone",
    "stuDetDob",
    "stuDetParent",
    "stuParentPh",
    "stuDetAddr"
  ];

  fields.forEach(id => {
    document.getElementById(id).disabled = true;
  });

  document.getElementById("editBtn").disabled = false;
  document.getElementById("saveBtn").disabled = true;

  document.getElementById("stuPopupWrap").classList.remove("hidden");
}
function closeStuPopup(e){
  if(!e || e.target === document.getElementById("stuPopupWrap")){
    document.getElementById("stuPopupWrap").classList.add("hidden");
  }
}
document.addEventListener("keydown", e => {
  if(e.key === "Escape"){
    document.getElementById("stuPopupWrap")?.classList.add("hidden");
  }
});
function enableEdit(){

  const fields = [
    "stuDetClass",
    "stuDetPhone",
    "stuDetDob",
    "stuDetParent",
    "stuParentPh",
    "stuDetAddr"
  ];

  fields.forEach(id => {
    document.getElementById(id).disabled = false;
  });

  // Toggle buttons
  document.getElementById("editBtn").disabled = true;
  document.getElementById("saveBtn").disabled = false;
}
async function updateStudent(){
  try {
    const data = {
      roll: currentStudentRoll,
      name: document.getElementById("stuDetName").value,
      class: document.getElementById("stuDetClass").value,
      phone: document.getElementById("stuDetPhone").value,
      dob: document.getElementById("stuDetDob").value,
      parent: document.getElementById("stuDetParent").value,
      Parent_Phone:document.getElementById("stuParentPh").value,
      address: document.getElementById("stuDetAddr").value
    };

    const res = await fetch("http://127.0.0.1:8000/update_student", {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if(result.success){
      showToast("Student updated", "success");
        const fields = [
      "stuDetName",
      "stuDetClass",
      "stuDetPhone",
      "stuDetDob",
      "stuDetParent",
      "stuParentPh",
      "stuDetAddr"
    ];

    fields.forEach(id => {
      document.getElementById(id).disabled = true;
    });

    document.getElementById("editBtn").disabled = false;
    document.getElementById("saveBtn").disabled = true;
      await loadStudentsFromDB();
      closeStuPopup();
    } else {
      showToast("Update failed", "error");
    }

  } catch(e){
    console.error(e);
    showToast("Server error", "error");
  }
}
function handleDelete(btn){
  const roll = btn.dataset.roll;
  removeStu(roll);
}
async function removeStu(roll){

  const s = STUDENTS.find(x => x.roll === roll);
  if (!s) return;

  if (!confirm(`Delete ${s.name}? This will remove ALL attendance.`)) return;

  try {
    const res = await fetch(`http://127.0.0.1:8000/delete_student/${roll}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if(data.success){
      showToast(`${s.name} deleted`, "success");

      // 🔥 refresh data
      await loadStudentsFromDB();
      await loadAttendanceFromDB();

      document.getElementById("admTotalStu").textContent = STUDENTS.length;

    } else {
      showToast("Delete failed", "error");
    }

  } catch(err){
    console.error(err);
    showToast("Server error", "error");
  }
}
/* ================================================================
   TIMETABLE — Fixed time grid
================================================================ */
const TT_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TT_PERIODS = [
  {n:1, s:"08:15", e:"09:05"},
  {n:2, s:"09:05", e:"09:55"},
  {n:3, s:"10:10", e:"11:00"},
  {n:4, s:"11:00", e:"11:50"},
  {n:5, s:"11:50", e:"12:40"},
  {n:6, s:"13:40", e:"14:30"},
  {n:7, s:"14:30", e:"15:20"},
];

let TT = {};
TT_DAYS.forEach(d => {
  TT[d] = {};
  TT_PERIODS.forEach(p => TT[d][p.n] = null);
});

// Pre-fill from existing TIMETABLE array
TIMETABLE.forEach(t => {
  if(TT[t.day]) TT[t.day][t.periodNo] = {
    subject: t.subject,
    teacher: t.teacher
  };
});

let ttActiveDay = null, ttActivePeriod = null;

function fmtT(t) {
  const [h, m] = t.split(":");
  const ap = +h >= 12 ? "PM" : "AM";
  const h12 = +h % 12 || 12;
  return `${h12}:${m} ${ap}`;
}

function renderTimetableGrid() {
  const head = document.getElementById("ttHead");
  const body = document.getElementById("ttBody");
  if(!head || !body) return;

  // Header row
  head.innerHTML = `<tr>
    <th style="text-align:left;padding-left:12px">Day</th>
    ${TT_PERIODS.map(p => `
      <th>
        <div class="tt-p-num">P${p.n}</div>
        <div class="tt-p-time">${fmtT(p.s)}–${fmtT(p.e)}</div>
      </th>`).join("")}
  </tr>`;

  // Body rows
  body.innerHTML = TT_DAYS.map(d => `
    <tr>
      <td style="padding:5px 5px 5px 12px;vertical-align:middle">
        <div class="tt-day-lbl">${d}</div>
      </td>
      ${TT_PERIODS.map(p => {
        const c = TT[d][p.n];
        return `<td style="padding:4px">
          <div class="tt-cell ${c ? "filled" : "free"}"
               onclick="openTTPopup('${d}',${p.n})">
            ${c
              ? `<div class="tt-cell-subj">${c.subject}</div>
                 <div class="tt-cell-tchr">${c.teacher || "—"}</div>`
              : `<div class="tt-cell-free">Free</div>`
            }
          </div>
        </td>`;
      }).join("")}
    </tr>
  `).join("");
}

function openTTPopup(day, period) {
  ttActiveDay = day;
  ttActivePeriod = period;
  const c = TT[day][period];
  const p = TT_PERIODS.find(x => x.n === period);
  document.getElementById("ttPopupTitle").textContent = `${day} · Period ${period}`;
  document.getElementById("ttPopupTime").textContent = `${fmtT(p.s)} – ${fmtT(p.e)}`;
  document.getElementById("ttppSubj").value = c?.subject || "";
  document.getElementById("ttppTeacher").value = c?.teacher || "";
  document.getElementById("ttPopupWrap").classList.remove("hidden");
  setTimeout(() => document.getElementById("ttppSubj").focus(), 50);
}

function closeTTPopup(e) {
  if(!e || e.target === document.getElementById("ttPopupWrap"))
    document.getElementById("ttPopupWrap").classList.add("hidden");
}

function saveTTCell() {
  const subj = document.getElementById("ttppSubj").value.trim();
  if(!subj) { showToast("Enter a subject name", "error"); return; }
  TT[ttActiveDay][ttActivePeriod] = {
    subject: subj,
    teacher: document.getElementById("ttppTeacher").value.trim()
  };
  document.getElementById("ttPopupWrap").classList.add("hidden");
  renderTimetableGrid();
  showToast(`${ttActiveDay} P${ttActivePeriod} — ${subj} saved`, "success");
}

function freeTTCell() {
  TT[ttActiveDay][ttActivePeriod] = null;
  document.getElementById("ttPopupWrap").classList.add("hidden");
  renderTimetableGrid();
  showToast("Marked as free period", "info");
}

async function saveTimetable() {
  TIMETABLE = [];
  let id = 1;

  TT_DAYS.forEach(day => {
    TT_PERIODS.forEach(p => {
      const c = TT[day][p.n];
      if (c && c.subject) {
        TIMETABLE.push({
          id: id++,
          day,
          periodNo: p.n,
          subject: c.subject,
          teacher: c.teacher || "",
          startTime: p.s,
          endTime: p.e,
          class: "AIML-A",
          room: ""
        });
      }
    });
  });

  try {
    await fetch("http://127.0.0.1:8000/timetable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TIMETABLE)
    });

    showToast("Timetable saved to DB ✅", "success");

  } catch (e) {
    console.error(e);
    showToast("Failed to save timetable", "error");
  }

  populateARFilters();
  populateTRFilters();
  populatePVFilters();
}

// Keyboard shortcuts
document.addEventListener("keydown", e => {
  if(e.key === "Escape") document.getElementById("ttPopupWrap")?.classList.add("hidden");
  if(e.key === "Enter" && !document.getElementById("ttPopupWrap")?.classList.contains("hidden"))
    saveTTCell();
});

function syncTTFromBackend() {
  // Reset TT
  TT_DAYS.forEach(d => {
    TT[d] = {};
    TT_PERIODS.forEach(p => TT[d][p.n] = null);
  });

  // Fill from backend TIMETABLE
  TIMETABLE.forEach(t => {
    if (TT[t.day]) {
      TT[t.day][t.periodNo] = {
        subject: t.subject,
        teacher: t.teacher
      };
    }
  });
}

function renderTodayPeriodStatus(prefix="adm"){
  const day    = todayName();
  const todayS = todayStr(); // ✅ defined properly
  const nm     = nowMin();

  const id = prefix === "adm" ? "todayPeriodStatus" : "teaTodayPeriodStatus";
  const el = document.getElementById(id);
  if(!el) return;

    // ✅ Disabled day check — using todayS not today
  const setting = DAY_SETTINGS[todayS];
  if(setting && setting.active === false){
    el.innerHTML = `
      <div style="text-align:center;padding:12px;color:var(--muted)">
        <div style="font-weight:600;color:var(--text)">Attendance Disabled Today</div>
        <div style="font-size:0.82rem;margin-top:4px">No periods will be counted for today</div>
      </div>`;
    return;
  }

  // ✅ Sunday check
  if(day === "Sunday"){
    el.innerHTML = `
      <div style="text-align:center;padding:12px;color:var(--muted)">
        <div style="font-weight:600;color:var(--text)">Sunday — No Classes</div>
      </div>`;
    return;
  }

  // ✅ No timetable
  const periods = TIMETABLE
    .filter(t => t.day === day && t.subject)
    .sort((a,b) => timeToMin(a.startTime) - timeToMin(b.startTime));

  if(!periods.length){
    el.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px">No classes scheduled for ${day}</p>`;
    return;
  }

  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:0">${periods.map(p => {
    const sm = timeToMin(p.startTime), em = timeToMin(p.endTime);
    const recs    = ATTENDANCE.filter(r => r.date===todayS && r.periodNo===p.periodNo && r.subject===p.subject);
    const present = recs.filter(r => r.status==="Present").length;
    const late    = recs.filter(r => r.status==="Late").length;
    const absent  = Math.max(0, STUDENTS.length - (present + late));

    let tag = "";
    if(nm > em)           tag = `<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:#F1F5F9;color:var(--muted)">Done</span>`;
    else if(nm>=sm&&nm<=em) tag = `<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.12);color:var(--green);font-weight:700">ACTIVE</span>`;
    else                  tag = `<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:#F8FAFC;color:#94A3B8">Upcoming</span>`;

    return `<div style="display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid #F1F5F9">
      <div style="width:26px;height:26px;border-radius:7px;background:#EFF6FF;color:var(--blue);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;flex-shrink:0">${p.periodNo}</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:0.88rem">${p.subject}</div>
        <div style="font-size:0.74rem;color:var(--muted)">${fmtTimeMini(p.startTime)} – ${fmtTimeMini(p.endTime)}</div>
      </div>
      <div style="display:flex;gap:16px;font-size:0.82rem">
        <span style="color:var(--green)"><b>${present}</b> Present</span>
        <span style="color:var(--orange)"><b>${late}</b> Late</span>
        <span style="color:var(--red)"><b>${absent}</b> Absent</span>
      </div>
      ${tag}
    </div>`;
  }).join("")}</div>`;
}
function getCompletedPeriods() {
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const today = todayName();

  return TIMETABLE.filter(t => {
    if (t.day !== today) return true; // previous days = completed

    const end = timeToMin(t.endTime);
    return currentMin > end; // only completed periods
  });
}
function getStudentStatsMap(globalTotal){
  const map = {};

  STUDENTS.forEach(s => {
    map[s.roll] = calculateStudentAttendance(s, globalTotal);
  });

  return map;
}
let dayActive = true;

async function loadDayStatus(){
  const res = await fetch("http://127.0.0.1:8000/day-status");
  const data = await res.json();

  dayActive = data.active;
  updateToggleUI();
}

function updateToggleUI(){
  const btn = document.getElementById("toggleDayBtn");

  if(dayActive){
    btn.textContent = "Disable Today";
    btn.style.background = "red";
  } else {
    btn.textContent = "Enable Today";
    btn.style.background = "green";
  }
}
async function toggleDay(){

  const res = await fetch("http://127.0.0.1:8000/toggle-day", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ active: !dayActive })
  });

  const data = await res.json();

  if(data.success){
    dayActive = !dayActive;
    updateToggleUI();

    showToast(
      dayActive ? "Attendance Enabled" : "Attendance Disabled",
      "info"
    );
  }
}
function renderAdminSummary(prefix="adm"){

  const head = document.getElementById(prefix + "SubjHead");
  const body = document.getElementById(prefix + "SummaryBody");
  if(!body ||  !head) return;

  renderSubjectHeader(prefix); // 🔥 important

  const subjects = getSubjects();
  body.innerHTML = STUDENTS.filter(s =>s.class==="AIML-A").map(s => {

    const subjStats = calculateSubjectWise(s);

    let totalAll = 0;
    let presentAll = 0;

    const cells = subjects.map(sub => {

      const data = subjStats[sub];

      totalAll += data.total;
      presentAll += data.present;

      const color =
        data.pct >= 75 ? "var(--green)" :
        data.pct >= 60 ? "var(--orange)" :
        "var(--red)";

      return `
        <td style="color:${color};font-weight:700">
          ${data.pct}%
        </td>
      `;
    }).join("");

    const overallPct = totalAll > 0
      ? Math.round((presentAll / totalAll) * 100)
      : 0;

    const overallColor =
      overallPct >= 75 ? "var(--green)" :
      overallPct >= 60 ? "var(--orange)" :
      "var(--red)";

    return `
      <tr>
        <td>${s.name}</td>
        <td>${s.roll}</td>
        <td>${s.class}</td>

        ${cells}

        <td style="color:${overallColor};font-weight:800">
          ${overallPct}%
        </td>
      </tr>
    `;
  }).join("");
}
function calculateGlobalTotalPeriods(){

  const startDate = new Date("2026-03-21"); // 🔥 set your system start date
  const today = new Date();

  let total = 0;

  for(let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)){

    const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];

    // ❌ Skip Sunday
    if(dayName === "Sunday") continue;

    // ✅ Count only valid periods (NOT free)
    const validPeriods = TIMETABLE.filter(t =>
      t.day === dayName &&
      t.subject && t.subject.trim() !== ""
    );

    total += validPeriods.length;
  }

  return total;
}
function calculateStudentAttendance(student, globalTotal){

  const records = ATTENDANCE.filter(r => r.roll === student.roll);

  let presentCount = 0;

  records.forEach(r => {
    if(r.status === "Present"){
      presentCount++;
    }
  });

  const percentage = globalTotal > 0
    ? Math.round((presentCount / globalTotal) * 100)
    : 0;

  return {
    total: globalTotal,
    present: presentCount,
    absent: globalTotal - presentCount,
    percentage
  };
}
function getSubjects(){
  const subjects = new Set();

  TIMETABLE.forEach(t => {
    if(t.subject && t.subject.trim() !== ""){
      subjects.add(t.subject);
    }
  });

  return Array.from(subjects);
}
function renderSubjectHeader(prefix){
  const head = document.getElementById(prefix + "SubjHead");;
  if(!head) return;

  const subjects = getSubjects();

  head.innerHTML = `
    <tr>
      <th>Name</th>
      <th>Roll</th>
      <th>Class</th>
      ${subjects.map(sub =>{
        const total = getSubjectTotalTillToday(sub);  // 🔥 count
        return `<th>${sub} (${total})</th>`;
      }).join("")}
      <th>%</th>
    </tr>
  `;
}
function getStartDate(){

  if(ATTENDANCE.length === 0){
    return new Date(); // fallback
  }

  const dates = ATTENDANCE.map(r => new Date(r.date));
  return new Date(Math.min(...dates));
}
function isDisabledDay(dateStr){
  // temporary simple check (we’ll improve later)
  return DISABLED_DAYS.includes(dateStr);
}
function getSubjectTotalTillToday(subject){

  let total = 0;
  const now = new Date();

  for(let d = new Date(getStartDate()); d <= now; d.setDate(d.getDate()+1)){

    const dateStr = d.toISOString().split("T")[0];
    const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];

    // ❌ skip Sunday
    if(dayName === "Sunday") continue;

    const setting = DAY_SETTINGS[dateStr];

    // ❌ skip fully disabled day
    if(setting && setting.active === false) continue;

    TIMETABLE.forEach(p => {

      if(
        p.day === dayName &&
        p.subject === subject &&
        p.subject.trim() !== ""
      ){

        const periodEnd = timeToMin(p.endTime);
        const periodStart = timeToMin(p.startTime);

        // 🟢 past day → count fully
        if(dateStr < now.toISOString().split("T")[0]){
          total++;
        }

        // 🟡 today → only completed periods
        else if(dateStr === now.toISOString().split("T")[0]){

          const currentMin = now.getHours()*60 + now.getMinutes();

          // ❌ not completed
          if(currentMin < periodEnd) return;

          // 🔥 check enable time
          if(setting && setting.enabled_at){
            const enabledMin = timeToMin(setting.enabled_at);

            // ❌ skip periods before enabling
            if(periodStart < enabledMin) return;
          }

          total++;
        }
      }
    });
  }

  return total;
}
function calculateSubjectWise(student){

  const subjects = getSubjects();
  const result = {};

  subjects.forEach(sub => {

    // 👉 total classes for this subject
    const total = getSubjectTotalTillToday(sub);

    // 👉 present count
    const present = ATTENDANCE.filter(r =>
      r.roll === student.roll &&
      r.subject === sub &&
      r.status === "Present"
    ).length;

    const pct = total > 0
      ? Math.round((present / total) * 100)
      : 0;

    result[sub] = {
      total,
      present,
      pct
    };
  });

  return result;
}
function exportAdminCSV(){

  const subjects = getSubjects();

  const header = [
    "Name","Roll","Class",
    ...subjects,
    "Total %"
  ];

  const rows = STUDENTS
    .filter(s => s.class === "AIML-A")
    .map(s => {

      const subjStats = calculateSubjectWise(s);

      let totalAll = 0;
      let presentAll = 0;

      const subjectData = subjects.map(sub => {
        const data = subjStats[sub];

        totalAll += data.total;
        presentAll += data.present;

        return data.pct + "%";
      });

      const overall = totalAll > 0
        ? Math.round((presentAll / totalAll) * 100)
        : 0;

      return [
        s.name,
        s.roll,
        s.class,
        ...subjectData,
        overall + "%"
      ].join(",");
    });

  const csv = [header.join(","), ...rows].join("\n");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "AIML-A.csv";
  a.click();

  showToast("Attedance exported!", "success");
}
/* ================================================================
   TEACHER PERIOD SUMMARY
================================================================ */
function renderTeacherPeriodSummary(){
  const day=todayName();
  const periods=TIMETABLE.filter(t=>t.day===day).sort((a,b)=>timeToMin(a.startTime)-timeToMin(b.startTime));
  const body=document.getElementById("teaPeriodSummary");
  if(!body)return;
  if(!periods.length){body.innerHTML=`<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px">No classes today</td></tr>`;return}
  body.innerHTML=periods.map(p=>{
    const recs=ATTENDANCE.filter(r=>r.date===todayStr()&&r.periodNo===p.periodNo&&r.subject===p.subject);
    const present=recs.filter(r=>r.status==="Present").length;
    const late=recs.filter(r=>r.status==="Late").length;
    const absent=STUDENTS.length-present-late;
    return`<tr>
      <td>${p.periodNo}</td>
      <td><b>${p.subject}</b></td>
      <td style="font-family:'DM Mono',monospace;font-size:0.8rem">${fmtTimeMini(p.startTime)}–${fmtTimeMini(p.endTime)}</td>
      <td style="color:var(--green);font-weight:700">${present}</td>
      <td style="color:var(--orange);font-weight:700">${late}</td>
      <td style="color:var(--red);font-weight:700">${Math.max(0,absent)}</td>
      <td><button class="btn-sm" onclick="teacherNav('tperiodview',document.querySelectorAll('#teacherSidebar .nav-a')[2]);document.getElementById('pvPeriod').value='${p.periodNo}-${p.subject}';renderPeriodView()">View <i class="fa-solid fa-arrow-right"></i></button></td>
    </tr>`;
  }).join("");
}
/*Teacher-students*/
/* ================================================================
   TEACHER — STUDENT GRID
================================================================ */
function renderTeaStudentGrid() {
  const q = (document.getElementById("teaStuSearch")?.value || "").toLowerCase();
  const filtered = STUDENTS.filter(s =>
    s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)
  );
  document.getElementById("teaStuCountLabel").textContent =
    `${filtered.length} student${filtered.length !== 1 ? "s" : ""}`;

  document.getElementById("teaStudentGrid").innerHTML = filtered.length === 0
    ? `<div style="padding:40px;text-align:center;color:var(--muted);grid-column:1/-1">No students found</div>`
    : filtered.map(s => `
        <div class="stu-card">
          <div class="stu-av">${s.name.charAt(0)}</div>
          <div style="flex:1;min-width:0">
            <div class="stu-name">${s.name}</div>
            <div class="stu-roll">${s.roll}</div>
            <div class="stu-class">
              <i class="fa-solid fa-school" style="font-size:0.7rem;margin-right:3px"></i>${s.class}
            </div>
          </div>
          <div class="stu-actions">
            <button class="ico-btn" title="View Details" onclick="showTeaStuDetail('${s.roll}')">
              <i class="fa-regular fa-eye"></i>
            </button>
          </div>
        </div>
      `).join("");
}

/* ================================================================
   TEACHER — STUDENT DETAIL POPUP
================================================================ */
function showTeaStuDetail(roll) {
  console.log("Hello");
  const s = STUDENTS.find(x => x.roll === roll);
  if (!s) return;

  // Header
  document.getElementById("teaStuAv").textContent = s.name.charAt(0);
  document.getElementById("teaStuPopupName").textContent = s.name;
  document.getElementById("teaStuPopupRoll").textContent = s.roll + " · " + (s.class || "");

  // Details
  const fields = [
    { label: "Full Name",       value: s.name },
    { label: "Roll Number",     value: s.roll },
    { label: "Class / Section", value: s.class },
    { label: "Date of Birth",   value: s.dob || "—" },
    { label: "Phone",           value: s.phone || "—" },
    { label: "Parent / Guardian", value: s.parent || "—" },
    { label: "Parent Phone",    value: s.Parent_Phone || "—" },
    { label: "Address",         value: s.address || "—" },
  ];

  document.getElementById("teaStuDetails").innerHTML = fields.map(f => `
    <div class="tea-det-row">
      <div class="tea-det-lbl">${f.label}</div>
      <div class="tea-det-val">${f.value}</div>
    </div>
  `).join("");

  // Analytics
  renderTeaStuAnalytics(s);

  // Show popup
    const popup = document.getElementById("teaStuPopupWrap");
    popup.classList.remove("hidden");  // remove hidden first
    popup.classList.add("open");       // then add open (your CSS uses .open for display:flex)
}

function closeTeaStuPopup(e) {
  if (!e || e.target === document.getElementById("teaStuPopupWrap")) {
    const popup = document.getElementById("teaStuPopupWrap");
    popup.classList.remove("open");
    popup.classList.add("hidden");
  }
}

function renderTeaStuAnalytics(s) {
  const el = document.getElementById("teaStuAnalytics");
  if (!el) return;

  // ✅ Use exact same logic as reports
  const subjStats = calculateSubjectWise(s);
  const subjects  = getSubjects();

  let totalAll   = 0;
  let presentAll = 0;
  let lateAll    = 0;

  const subjectRows = subjects.map(sub => {
    const data = subjStats[sub];

    // also count late from ATTENDANCE
    const lateCount = ATTENDANCE.filter(r =>
      r.roll === s.roll &&
      r.subject === sub &&
      r.status === "Late"
    ).length;

    totalAll   += data.total;
    presentAll += data.present;
    lateAll    += lateCount;

    const pctColor = data.pct >= 75 ? "#10B981" : data.pct >= 60 ? "#F59E0B" : "#EF4444";
    return { sub, pct: data.pct, barColor: pctColor };
  }).sort((a, b) => b.pct - a.pct);

  const absentAll  = Math.max(0, totalAll - presentAll - lateAll);
  const overallPct = totalAll > 0 ? Math.round(((presentAll + lateAll) / totalAll) * 100) : 0;
  const pctColor   = overallPct >= 75 ? "var(--green)" : overallPct >= 60 ? "var(--orange)" : "var(--red)";

  const r = 28, circ = 2 * Math.PI * r;
  const dash = (overallPct / 100) * circ;

  el.innerHTML = `
    <div class="tea-ring-wrap">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="${r}" fill="none" stroke="#F1F5F9" stroke-width="8"/>
        <circle cx="36" cy="36" r="${r}" fill="none" stroke="${pctColor}" stroke-width="8"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
          stroke-dashoffset="${(circ/4).toFixed(1)}" stroke-linecap="round"/>
        <text x="36" y="40" text-anchor="middle"
          style="font-family:'Syne',sans-serif;font-size:13px;font-weight:800;fill:${pctColor}">
          ${overallPct}%
        </text>
      </svg>
      <div>
        <div style="font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800;color:${pctColor}">${overallPct}%</div>
        <div style="font-size:0.75rem;color:var(--muted)">Overall Attendance</div>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:4px">${presentAll + lateAll} of ${totalAll} periods</div>
      </div>
    </div>

    <div class="tea-analytics-stat">
      <div class="tea-a-card a-green"><div class="a-val">${presentAll}</div><div class="a-lbl">Present</div></div>
      <div class="tea-a-card a-orange"><div class="a-val">${lateAll}</div><div class="a-lbl">Late</div></div>
      <div class="tea-a-card a-red"><div class="a-val">${absentAll}</div><div class="a-lbl">Absent</div></div>
    </div>

    <div class="tea-bar-section">
      <div class="tea-bar-title">Subject-wise Attendance</div>
      ${subjectRows.length === 0
        ? `<p style="color:var(--muted);font-size:0.82rem">No attendance data yet</p>`
        : subjectRows.map(({ sub, pct, barColor }) => `
            <div class="tea-bar-row">
              <div class="tea-bar-lbl" title="${sub}">${sub}</div>
              <div class="tea-bar-track">
                <div class="tea-bar-fill" style="width:${pct}%;background:${barColor}"></div>
              </div>
              <div class="tea-bar-pct">${pct}%</div>
            </div>`).join("")
      }
    </div>
  `;
}

/* ================================================================
   ADMIN REPORT FILTERS
================================================================ */
function populateARFilters(){
  const sel=document.getElementById("arPeriod");if(!sel)return;
  const periods=[...new Set(TIMETABLE.map(t=>`${t.periodNo}-${t.subject}`))].sort();
  sel.innerHTML=`<option value="">All Periods</option>`+periods.map(p=>`<option>${p}</option>`).join("");
}

let arFiltered=[...ATTENDANCE],arPage=1;
function filterAdminReport(){
  const q=(document.getElementById("arSearch")?.value||"").toLowerCase();
  const date=document.getElementById("arDate")?.value||"";
  const period=document.getElementById("arPeriod")?.value||"";
  const status=document.getElementById("arStatus")?.value||"";
  arFiltered=ATTENDANCE.filter(r=>{
    const mq=!q||(r.name.toLowerCase().includes(q)||r.roll.toLowerCase().includes(q));
    const md=!date||r.date===date;
    const mp=!period||`${r.periodNo}-${r.subject}`===period;
    const ms=!status||r.status===status;
    return mq&&md&&mp&&ms;
  });
  arPage=1;renderARTable();
}
const globalTotal = calculateGlobalTotalPeriods();
const statsMap = getStudentStatsMap(globalTotal);
function renderARTable(){
  const start=(arPage-1)*15,end=start+15,page=arFiltered.slice(start,end);
  document.getElementById("arCount").textContent=`${arFiltered.length} records`;
  document.getElementById("arBody").innerHTML = page.map(r => {

    const stats = statsMap[r.roll];

    return `
    <tr>
      <td>${r.name}</td>
      <td>${r.roll}</td>
      <td>${r.date}</td>
      <td>#${r.periodNo}</td>
      <td>${r.subject}</td>
      <td>${r.markedTime}</td>
      <td>${badgeHTML(r.status)}</td>

      <!-- 🔥 NEW COLUMNS -->
      <td>${stats.total}</td>
      <td style="color:var(--green)">${stats.present}</td>
      <td style="color:var(--red)">${stats.absent}</td>
      <td><b>${stats.percentage}%</b></td>
    </tr>
    `;
  }).join("");
  renderPag("arPag",arPage,Math.ceil(arFiltered.length/15),n=>{arPage=n;renderARTable()});
}
function resetAdminReport(){
  ["arSearch","arDate","arPeriod","arStatus"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});
  arFiltered=[...ATTENDANCE];arPage=1;renderARTable();
  showToast("Filters reset","info");
}

/* ================================================================
   TEACHER RECORD FILTERS
================================================================ */
function populateTRFilters(){
  const pSel=document.getElementById("trPeriod");
  const sSel=document.getElementById("trSubject");
  if(!pSel||!sSel)return;
  const periods=[...new Set(TIMETABLE.map(t=>`${t.periodNo}-${t.subject}`))].sort();
  const subjects=[...new Set(TIMETABLE.map(t=>t.subject))].sort();
  pSel.innerHTML=`<option value="">All Periods</option>`+periods.map(p=>`<option>${p}</option>`).join("");
  sSel.innerHTML=`<option value="">All Subjects</option>`+subjects.map(s=>`<option>${s}</option>`).join("");
  const d=todayStr();document.getElementById("trDate").value=d;
}

let trFiltered=[...ATTENDANCE],trPage=1;
function filterTeacherRecords(){
  const q=(document.getElementById("trSearch")?.value||"").toLowerCase();
  const date=document.getElementById("trDate")?.value||"";
  const period=document.getElementById("trPeriod")?.value||"";
  const subject=document.getElementById("trSubject")?.value||"";
  const status=document.getElementById("trStatus")?.value||"";
  trFiltered=ATTENDANCE.filter(r=>{
    const mq=!q||(r.name.toLowerCase().includes(q)||r.roll.toLowerCase().includes(q));
    const md=!date||r.date===date;
    const mp=!period||`${r.periodNo}-${r.subject}`===period;
    const ms=!subject||r.subject===subject;
    const mst=!status||r.status===status;
    return mq&&md&&mp&&ms&&mst;
  });
  trPage=1;renderTRTable();
}
function renderTRTable(){
  const start=(trPage-1)*15,end=start+15,page=trFiltered.slice(start,end);
  document.getElementById("trCount").textContent=`${trFiltered.length} records`;
  document.getElementById("trBody").innerHTML=page.map(r=>`<tr>
    <td><div style="display:flex;align-items:center;gap:8px">${av(r.name)}${r.name}</div></td>
    <td style="font-family:'DM Mono',monospace;font-size:0.79rem;color:var(--muted)">${r.roll}</td>
    <td>${r.date}</td>
    <td><span style="background:#EFF6FF;color:var(--blue);padding:2px 8px;border-radius:8px;font-size:0.72rem;font-weight:700">#${r.periodNo}</span></td>
    <td>${r.subject}</td>
    <td style="font-family:'DM Mono',monospace;font-size:0.79rem">${r.markedTime}</td>
    <td>${badgeHTML(r.status)}</td>
  </tr>`).join("");
  renderPag("trPag",trPage,Math.ceil(trFiltered.length/15),n=>{trPage=n;renderTRTable()});
}
function resetTeacherRecords(){
  ["trSearch","trDate","trPeriod","trSubject","trStatus"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});
  trFiltered=[...ATTENDANCE];trPage=1;renderTRTable();showToast("Filters reset","info");
}

/* ================================================================
   PERIOD-WISE VIEW (Teacher)
================================================================ */
function populatePVFilters(){
  const sSel = document.getElementById("pvSubject");
  if(!sSel) return;

  // Populate subjects from timetable
  const subjects = [...new Set(
    TIMETABLE.filter(t => t.subject && t.subject.trim() !== "")
             .map(t => t.subject)
  )].sort();

  sSel.innerHTML = `<option value="">All Subjects</option>` +
    subjects.map(s => `<option>${s}</option>`).join("");

  // Set today as default date
  const startStr = getStartDate().toISOString().split("T")[0];
  const dateInput = document.getElementById("pvDate");
  dateInput.min   = startStr;   // greys out dates before semester start
  dateInput.value = todayStr();
}

function renderPeriodView(){
  const date          = document.getElementById("pvDate")?.value || todayStr();
  const periodFilter  = document.getElementById("pvPeriod")?.value  || "";
  const subjectFilter = document.getElementById("pvSubject")?.value || "";
  const container     = document.getElementById("pvCards");

  // ── 1. Get day name from selected date ──
  const dt  = new Date(date + "T12:00:00");
  const day = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dt.getDay()];

  // ── 2. Sunday check ──
  if(day === "Sunday"){
    container.innerHTML = noResultCard("Sunday — No classes scheduled");
    return;
  }

  // ── 3. Disabled day check ──
  const setting = DAY_SETTINGS[date];
  if(setting && setting.active === false){
    container.innerHTML = noResultCard("Attendance was disabled for this day");
    return;
  }

  const startDate = getStartDate();
  const startStr  = startDate.toISOString().split("T")[0];
  if(date < startStr){
    container.innerHTML = noResultCard("Semester not started — No records before " + startStr);
    return;
  }
  // ── 4. Future date check ──
  const today     = todayStr();
  const isFuture  = date > today;
  const isPast    = date < today;

  // ── 5. Get periods for that day from timetable ──
  let periods = TIMETABLE
    .filter(t =>
      t.day === day &&
      t.subject && t.subject.trim() !== ""
    )
    .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

  // ── 6. Apply period number filter ──
  if(periodFilter){
    periods = periods.filter(p => String(p.periodNo) === String(periodFilter));
  }

  // ── 7. Apply subject filter ──
  if(subjectFilter){
    periods = periods.filter(p => p.subject === subjectFilter);
  }

  // ── 8. No periods found ──
  if(!periods.length){
    container.innerHTML = noResultCard("No results available");
    return;
  }

  // ── 9. Render each period card ──
  container.innerHTML = periods.map(p => {

    // Future period → show "Upcoming"
    if(isFuture){
      return `
        <div class="card">
          <div class="card-hd">
            <h3>
              <span style="background:#EFF6FF;color:var(--blue);padding:3px 10px;border-radius:8px;font-size:0.8rem;font-weight:800;margin-right:8px">#${p.periodNo}</span>
              ${p.subject}
              <span style="font-size:0.78rem;font-weight:400;color:var(--muted)">
                · ${fmtTimeMini(p.startTime)} – ${fmtTimeMini(p.endTime)}
              </span>
            </h3>
          </div>
          <div style="padding:32px;text-align:center;color:var(--muted)">
            <i class="fa-regular fa-clock" style="font-size:1.6rem;margin-bottom:10px;display:block;color:#CBD5E1"></i>
            <div style="font-weight:600;color:var(--text)">Upcoming</div>
          </div>
        </div>`;
    }

    // Past or today → show actual attendance
    const recs      = ATTENDANCE.filter(r =>
      r.date === date &&
      r.periodNo === p.periodNo &&
      r.subject  === p.subject
    );
    const markedRolls = new Set(recs.map(r => r.roll));
    const absentStu   = STUDENTS.filter(s => !markedRolls.has(s.roll));

    const presentCount = recs.filter(r => r.status === "Present").length;
    const lateCount    = recs.filter(r => r.status === "Late").length;
    const absentCount  = absentStu.length;

    return `
      <div class="card">
        <div class="card-hd">
          <h3>
            <span style="background:#EFF6FF;color:var(--blue);padding:3px 10px;border-radius:8px;font-size:0.8rem;font-weight:800;margin-right:8px">#${p.periodNo}</span>
            ${p.subject}
            <span style="font-size:0.78rem;font-weight:400;color:var(--muted)">
              · ${fmtTimeMini(p.startTime)} – ${fmtTimeMini(p.endTime)}
            </span>
          </h3>
          <div style="display:flex;gap:14px;font-size:0.82rem">
            <span style="color:var(--green)"><b>${presentCount}</b> Present</span>
            <span style="color:var(--orange)"><b>${lateCount}</b> Late</span>
            <span style="color:var(--red)"><b>${absentCount}</b> Absent</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;padding:16px">

          ${recs.map(r => `
            <div style="display:flex;align-items:center;gap:9px;padding:9px 12px;background:var(--bg);border:1px solid var(--border);border-radius:10px">
              ${av(r.name)}
              <div style="flex:1">
                <div style="font-size:0.85rem;font-weight:600">${r.name}</div>
                <div style="font-size:0.73rem;color:var(--muted);font-family:'DM Mono',monospace">${r.roll}</div>
              </div>
              ${badgeHTML(r.status)}
            </div>`).join("")}

          ${absentStu.map(s => `
            <div style="display:flex;align-items:center;gap:9px;padding:9px 12px;background:#FFF1F2;border:1px solid #FECDD3;border-radius:10px">
              <div class="av" style="background:#FFE4E6;border-color:#FECDD3;color:var(--red)">${s.name.charAt(0)}</div>
              <div style="flex:1">
                <div style="font-size:0.85rem;font-weight:600">${s.name}</div>
                <div style="font-size:0.73rem;color:var(--muted);font-family:'DM Mono',monospace">${s.roll}</div>
              </div>
              ${badgeHTML("Absent")}
            </div>`).join("")}

        </div>
      </div>`;

  }).join("");
}

// Helper: consistent "no result" card
function noResultCard(msg){
  return `
    <div class="card" style="padding:48px;text-align:center;color:var(--muted)">
      <i class="fa-regular fa-calendar-xmark" style="font-size:2rem;margin-bottom:12px;display:block;color:#CBD5E1"></i>
      <div style="font-weight:600;color:var(--text);margin-bottom:4px">${msg}</div>
    </div>`;
}



/* ================================================================
   PAGINATION
================================================================ */
function renderPag(id,cur,total,cb){
  const el=document.getElementById(id);if(!el)return;
  if(total<=1){el.innerHTML="";return}
  let h=`<button class="pg-btn" onclick="(${cb.toString()})(${cur-1})" ${cur<=1?"disabled":""}>‹</button>`;
  for(let i=1;i<=Math.min(total,6);i++) h+=`<button class="pg-btn ${i===cur?"active":""}" onclick="(${cb.toString()})(${i})">${i}</button>`;
  h+=`<button class="pg-btn" onclick="(${cb.toString()})(${cur+1})" ${cur>=total?"disabled":""}>›</button>`;
  el.innerHTML=h;
}

/* ================================================================
   EXPORT CSV
================================================================ */
function exportCSV(role){
  const data=role==="admin"?arFiltered:trFiltered;
  const header=["Name","Roll","Class","Date","Period","Subject","Marked Time","Status"];
  const rows=data.map(r=>[r.name,r.roll,r.class,r.date,r.periodNo,r.subject,r.markedTime,r.status].join(","));
  const csv=[header.join(","),...rows].join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download=`attendance_${todayStr()}.csv`;a.click();
  showToast("CSV exported!","success");
}

/* ================================================================
   MARK ATTENDANCE — Period Strip
================================================================ */
function updatePeriodStrip(){
  const cp=getCurrentPeriod();
  const stripPeriod=document.getElementById("stripPeriod");
  const stripSubject=document.getElementById("stripSubject");
  const stripTeacher=document.getElementById("stripTeacher");
  const stripTiming=document.getElementById("stripTiming");
  const stripStatus=document.getElementById("stripStatus");
  if(!cp){
    stripPeriod.textContent="—";stripSubject.textContent="No active class";
    stripTeacher.textContent="—";stripTiming.textContent="—";
    stripStatus.className="ps-status-chip ps-off";
    stripStatus.innerHTML=`<i class="fa-regular fa-clock"></i> No Active Period`;
    return;
  }
  stripPeriod.textContent=`P${cp.periodNo}`;
  stripSubject.textContent=cp.subject;
  stripTeacher.textContent=cp.teacher||"—";
  stripTiming.textContent=`${fmtTimeMini(cp.startTime)} – ${fmtTimeMini(cp.endTime)}`;
  if(cp.state==="on"){
    stripStatus.className="ps-status-chip ps-on";
    const ml=cp.minutesLate;
    if(ml<=5) stripStatus.innerHTML=`<i class="fa-solid fa-circle-check"></i> On Time`;
    else if(ml<=10) stripStatus.innerHTML=`<i class="fa-solid fa-clock"></i> Late`;
    else stripStatus.innerHTML=`<i class="fa-solid fa-circle-xmark"></i> Attendance Closed`;
  } else {
    stripStatus.className="ps-status-chip ps-late";
    stripStatus.innerHTML=`<i class="fa-regular fa-clock"></i> Starts in ${cp.minutesUntil} min`;
  }
}

/* ================================================================
   CAMERA
================================================================ */
let camStream = null;

async function startCamera() {
  setCamStatus("active");
  const video = document.getElementById("camVideo");

  if (!video) {
    console.error("camVideo not found ❌");
    return;
  }

  try {
    // 🔥 FIX: stop previous stream if exists
    if (camStream) {
      camStream.getTracks().forEach(track => track.stop());
    }

    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" } // safer
    });

    video.srcObject = camStream;
    await video.play();

    document.getElementById("startBtn")?.classList.add("hidden");
    document.getElementById("stopBtn")?.classList.remove("hidden");
    document.getElementById("captureBtn")?.classList.remove("hidden");

    showToast("Camera ready", "success");

  } catch (e) {
    console.error(e);

    // Better error message
    if (e.name === "NotReadableError") {
      showToast("Camera is already in use", "error");
    } else if (e.name === "NotAllowedError") {
      showToast("Permission denied", "error");
    } else {
      showToast("Camera error", "error");
    }
  }

  updatePeriodStrip();
}

function showCamPlaceholder(){
  const frame=document.getElementById("camFrame");
  const canvas=document.getElementById("camCanvas");
  canvas.classList.remove("hidden");
  canvas.style.cssText="position:absolute;inset:0;width:100%;height:100%";
  const ctx=canvas.getContext("2d");
  canvas.width=frame.offsetWidth||640;canvas.height=frame.offsetHeight||360;
  function draw(){
    ctx.fillStyle="#060C20";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle="rgba(37,99,235,0.07)";ctx.lineWidth=1;
    for(let x=0;x<canvas.width;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}
    for(let y=0;y<canvas.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}
    const cx=canvas.width/2,cy=canvas.height/2-20;
    ctx.fillStyle="rgba(255,255,255,0.04)";ctx.beginPath();ctx.arc(cx,cy-45,50,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.03)";ctx.beginPath();ctx.ellipse(cx,cy+55,70,50,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="rgba(14,165,233,0.5)";ctx.font="11px 'DM Mono',monospace";
    ctx.fillText("DEMO FEED · "+fmtTime(new Date()),12,22);
    requestAnimationFrame(draw);
  }
  draw();
  document.getElementById("faceOvl").classList.remove("hidden");
}

function stopCamera() {
  setCamStatus("off");
  if (camStream) {
    camStream.getTracks().forEach(track => track.stop());
    camStream = null;
  }

  const video = document.getElementById("camVideo");
  if (video) video.srcObject = null;

  document.getElementById("startBtn")?.classList.remove("hidden");
  document.getElementById("stopBtn")?.classList.add("hidden");
  document.getElementById("captureBtn")?.classList.add("hidden");
  showToast("Camera stopped", "info");
}

function setCamStatus(state){
  const chip=document.getElementById("camStatusChip");
  const dot=document.getElementById("camDot");
  if(!chip)return;
  if(state==="active"){
    chip.className="ps-status-chip ps-on";dot.style.background="var(--green)";
    chip.innerHTML=`<span id="camDot" style="width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block;animation:cpbPulse 1.5s infinite"></span>&nbsp;Live`;
  } else {
    chip.className="ps-status-chip ps-off";
    chip.innerHTML=`<span id="camDot" style="width:7px;height:7px;border-radius:50%;background:#94A3B8;display:inline-block"></span>&nbsp;Off`;
  }
}

/* ================================================================
   CAPTURE & RECOGNIZE
================================================================ */
let sessionMarked=[];

async function captureAndRecognize() {
  const video = document.getElementById("camVideo");
  const canvas = document.getElementById("camCanvas");

  // Show processing UI
  showResState("proc");

  // Capture frame
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  // Convert to blob
  canvas.toBlob(async (blob) => {
    try {
      const formData = new FormData();
      formData.append("file", blob, "face.jpg");

      const res = await fetch("http://127.0.0.1:8000/recognize", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      // ❌ If not recognized
      if (!data.success) {

          // 🔥 HANDLE DISABLED DAY / HOLIDAY
          if (data.reason === "disabled_day" || data.reason === "holiday") {
            showToast(data.message, "info");
            showResState("wait");   // don't show error UI
            return;
          }

          // ❌ ACTUAL ERROR (face not recognized)
          showResState("err");
          document.getElementById("errMsg").textContent =
            data.message || "Face Not Recognized";

          showToast("Could not recognize — try again", "error");

          setTimeout(() => showResState("wait"), 2500);
          return;
      }
      await loadAttendanceFromDB();
      // ✅ If recognized
      const s = data;

      const timeStr = new Date().toLocaleTimeString();

      // Show success UI
      showResState("suc");
      document.getElementById("resName").textContent = s.name;
      document.getElementById("resRoll").textContent = "Roll: " + s.roll;
      document.getElementById("resTime").textContent = timeStr;
      document.getElementById("resPeriodInfo").textContent = data.period || "Active Period";

      const badge = document.getElementById("resStatusBadge");

      // 🔥 HANDLE STATUS PROPERLY
      // 🔥 HANDLE STATUS PROPERLY
    if (data.status === "marked") {

      if (data.attendance_status === "Present") {
        badge.innerHTML =
          `<div class="suc-badge"><i class="fa-solid fa-check"></i> Present</div>`;

        showToast(`${s.name} marked ${data.attendance_status}`, "success");

      } 
      else if (data.attendance_status === "Late") {
        badge.innerHTML =
          `<div class="late-badge"><i class="fa-solid fa-clock"></i> Late</div>`;

        showToast(`${s.name} marked Late`, "info");

      } 
      else if (data.attendance_status === "Absent") {
        badge.innerHTML =
          `<div class="err-badge"><i class="fa-solid fa-xmark"></i> Absent</div>`;

        showToast(`${s.name} marked Absent`, "error");
      }

    } 
    else if (data.status === "already_marked") {

      badge.innerHTML =
        `<div class="late-badge"><i class="fa-solid fa-clock"></i> Already Marked</div>`;

      showToast(`${s.name} already marked`, "info");

    } 
    else if (data.status === "too_early") {

      showResState("err");
      document.getElementById("errMsg").textContent = "Class not started yet";

      showToast("Too early to mark attendance", "info");
      return;
    }

      setTimeout(() => showResState("wait"), 3500);

    } catch (err) {
      console.error(err);
      showResState("err");
      document.getElementById("errMsg").textContent = "Server Error";
      showToast("Backend not reachable", "error");
    }
  }, "image/jpeg");
}

function showResState(state){
  ["resWait","resProc","resSuc","resErr"].forEach(id=>{
    const el=document.getElementById(id);
    if(el){if(id===`res${state.charAt(0).toUpperCase()+state.slice(1)}`||id===`res${state}`)el.classList.remove("hidden");else el.classList.add("hidden")}
  });
  // Map state names
  const map={wait:"resWait",proc:"resProc",suc:"resSuc",err:"resErr"};
  Object.entries(map).forEach(([k,v])=>{
    const el=document.getElementById(v);if(!el)return;
    if(k===state)el.classList.remove("hidden");else el.classList.add("hidden");
  });
}


/* ================================================================
   TOAST
================================================================ */
function showToast(msg,type="info"){
  const t=document.getElementById("toast");
  const icons={success:"fa-solid fa-circle-check",error:"fa-solid fa-circle-xmark",info:"fa-solid fa-circle-info"};
  t.className=`toast toast-${type}`;
  document.getElementById("toastIco").className=icons[type]||icons.info;
  document.getElementById("toastMsg").textContent=msg;
  t.classList.add("vis");clearTimeout(t._t);
  t._t=setTimeout(()=>t.classList.remove("vis"),3200);
}

/* ================================================================
   INIT
================================================================ */
document.addEventListener("DOMContentLoaded",async()=>{
  await loadStudentsFromDB();
  await loadAttendanceFromDB();
  await loadTimetableFromDB();
  await loadDayStatus();
  await loadDaySettings();
  // Hide all pages, show only home
  document.querySelectorAll(".page").forEach(p=>{
    p.style.display="none";
    p.classList.remove("active");
  });
  const home=document.getElementById("homePage");
  home.style.display="flex";
  home.classList.add("active");
  updateHomePeriodBanner();
  startClocks();
  setInterval(updatePeriodStrip,30000);
});
window.addEventListener("beforeunload",stopCamera);