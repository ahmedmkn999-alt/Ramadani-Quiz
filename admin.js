// --- 1. الأساسيات ---
let db = null;
let globalGroups = [];
let globalUsers = [];

const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};

// تشغيل مباشر وربط فوري لتجنب تعليق "جاري الاتصال"
document.addEventListener("DOMContentLoaded", () => {
    let status = document.getElementById('conn-status');
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        if(status) {
            status.innerText = "متصل بنجاح 🟢";
            status.classList.replace('text-yellow-500', 'text-green-500');
        }
        startListening();
    } catch(e) {
        console.error(e);
        if(status) {
            status.innerText = "خطأ في الاتصال 🔴";
            status.classList.replace('text-yellow-500', 'text-red-500');
        }
    }
    setupDays();
    setupQuestions();
});

function showTab(t, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    let tab = document.getElementById('tab-'+t);
    if(tab) tab.style.display = 'block';
    if(btn) btn.classList.add('active');
}

function setupDays() {
    let html = "";
    for(let d=1; d<=30; d++) html += `<option value="${d}">اليوم ${d}</option>`;
    if(document.getElementById('q-day')) document.getElementById('q-day').innerHTML = html;
    if(document.getElementById('pub-day')) document.getElementById('pub-day').innerHTML = html;
}

function setupQuestions() {
    let html = "";
    for(let i=1; i<=15; i++) {
        html += `<div class="q-block">
            <p class="text-yellow-500 text-[10px] font-bold mb-1">سؤال ${i}</p>
            <textarea class="qt w-full p-2 text-sm rounded-lg mb-2 h-12" placeholder="السؤال..."></textarea>
            <div class="grid grid-cols-2 gap-2">
                <input class="o1 p-2 text-xs rounded" placeholder="خيار 1"><input class="o2 p-2 text-xs rounded" placeholder="خيار 2">
                <input class="o3 p-2 text-xs rounded" placeholder="خيار 3"><input class="o4 p-2 text-xs rounded" placeholder="خيار 4">
            </div>
            <select class="ca w-full p-1 mt-2 text-xs text-green-400 bg-black rounded">
                <option value="0">الصح 1</option><option value="1">الصح 2</option>
                <option value="2">الصح 3</option><option value="3">الصح 4</option>
            </select>
        </div>`;
    }
    if(document.getElementById('q-area')) document.getElementById('q-area').innerHTML = html;
}

function startListening() {
    db.collection("config").doc("groups_data").onSnapshot(s => {
        globalGroups = s.exists ? (s.data().list || []) : [];
        renderGroups(); 
    });

    db.collection("users").onSnapshot(s => {
        globalUsers = [];
        s.forEach(d => globalUsers.push({id: d.id, ...d.data()}));
        renderUsers();
        calculateGlobalRanking();
    });
}

function renderGroups() {
    let list = document.getElementById('grp-list');
    let select = document.getElementById('u-group');
    if(!list || !select) return;
    
    list.innerHTML = "";
    select.innerHTML = '<option value="">اختر المجموعة</option>';
    
    globalGroups.forEach((g, i) => {
        select.innerHTML += `<option value="${i}">${g.group || "مجهول"}</option>`;
        let teamStr = g.type === 'single' ? "فردي" : (g.teams ? g.teams.join(' vs ') : "مباراة");
        list.innerHTML += `<div class="glass-panel p-3 rounded-xl flex justify-between items-center mb-2">
            <div><b class="text-yellow-500">${g.group || "بدون اسم"}</b><small class="block text-gray-400">${teamStr}</small></div>
            <button onclick="delGrp(${i})" class="text-red-500 text-xs font-bold">حذف</button>
        </div>`;
    });
}

function saveGrp() {
    const name = document.getElementById('g-name').value.trim();
    const type = document.getElementById('g-type').value;
    if(!name) return alert("اكتب اسم المجموعة");
    
    let newG = { group: name, type: type, teams: [] };
    if(type === 'teams') {
        const t1 = document.getElementById('t1').value.trim();
        const t2 = document.getElementById('t2').value.trim();
        if(!t1 || !t2) return alert("اكتب أسماء التيمات");
        newG.teams = [t1, t2];
    }
    globalGroups.push(newG);
    db.collection("config").doc("groups_data").set({ list: globalGroups }).then(() => {
        document.getElementById('g-name').value = "";
        alert("تم الحفظ بنجاح");
    });
}

function loadTeams() {
    let idx = document.getElementById('u-group').value;
    let teamSelect = document.getElementById('u-team');
    if(!teamSelect) return;
    teamSelect.innerHTML = "";
    if(idx !== "" && globalGroups[idx]) {
        let g = globalGroups[idx];
        if(g.type === 'single') teamSelect.innerHTML = '<option value="فردي">فردي</option>';
        else if(g.teams) g.teams.forEach(t => teamSelect.innerHTML += `<option value="${t}">${t}</option>`);
    }
}

function delGrp(i) {
    if(confirm("حذف المجموعة؟")) {
        globalGroups.splice(i, 1);
        db.collection("config").doc("groups_data").set({ list: globalGroups });
    }
}

function addUsr() {
    let n = document.getElementById('u-name').value.trim();
    let gIdx = document.getElementById('u-group').value;
    let t = document.getElementById('u-team').value;
    if(!n || gIdx === "") return alert("اكمل البيانات");

    let groupName = globalGroups[gIdx] ? globalGroups[gIdx].group : "غير معروف";
    let pass = Math.floor(100000 + Math.random() * 900000).toString();
    
    db.collection("users").add({
        name: n, password: pass, group: groupName, team: t || "", score: 0, isBanned: false, isEliminated: false, cheatCount: 0, streak: 0
    }).then(() => {
        document.getElementById('u-name').value = "";
        document.getElementById('copy-modal').style.display = 'flex';
        document.getElementById('cp-btn').onclick = () => { navigator.clipboard.writeText(`الاسم: ${n}\nالكود: ${pass}`); alert("تم النسخ!"); };
    });
}

function renderUsers() {
    let uL = document.getElementById('usr-list');
    if(!uL) return;
    uL.innerHTML = "";
    
    let safeUsers = globalUsers.map(u => ({...u, score: u.score || 0}));
    safeUsers.sort((a,b) => b.score - a.score).forEach(u => {
        let cheatBadge = (u.cheatCount > 0) ? `<span onclick="resetCheat('${u.id}')" style="cursor:pointer;" class="bg-red-600/80 text-white px-2 py-0.5 rounded text-[10px] ml-1"><i class="fas fa-flag"></i> غش (${u.cheatCount})</span>` : '';
        let elimClass = u.isEliminated ? 'text-gray-500 line-through' : '';
        let banClass = u.isBanned ? 'text-red-500 line-through' : '';

        uL.innerHTML += `<tr class="border-b border-gray-800 hover:bg-gray-800/50">
            <td class="p-4 leading-relaxed">
                <b class="${banClass || elimClass}">${u.name || "مجهول"}</b> <span class="text-orange-500 text-xs">🔥 ${u.streak||0}</span> ${cheatBadge}
                <br><small class="text-yellow-500">${u.password || ""} | ${u.team || ""}</small>
            </td>
            <td class="text-center font-bold text-yellow-500 text-lg">${u.score}</td>
            <td class="p-4 flex flex-wrap gap-1 justify-center">
                <button onclick="openProfile('${u.id}')" class="bg-purple-700 hover:bg-purple-600 text-white p-2 rounded text-[10px] w-full mb-1">بروفايل</button>
                <button onclick="edSc('${u.id}',${u.score})" class="bg-blue-600 hover:bg-blue-500 p-2 rounded text-[10px] flex-1">نقط</button>
                <button onclick="eliminateUsr('${u.id}',${u.isEliminated || false})" class="bg-pink-700 hover:bg-pink-600 text-white p-2 rounded text-[10px] flex-1">${u.isEliminated?'فك الإقصاء':'إقصاء'}</button>
                <button onclick="delUsr('${u.id}')" class="bg-red-600 hover:bg-red-500 p-2 rounded text-[10px] flex-1">حذف</button>
            </td>
        </tr>`;
    });
}

function resetCheat(id) { if(confirm("تصفير الغش؟")) db.collection("users").doc(id).update({ cheatCount: 0 }); }
function eliminateUsr(id, s) { if(confirm(s ? "فك الإقصاء؟" : "إقصاء المتسابق؟")) db.collection("users").doc(id).update({ isEliminated: !s }); }
function delUsr(id) { if(confirm("حذف نهائي؟")) db.collection("users").doc(id).delete(); }
function edSc(id, old) { let n = prompt("تعديل النقاط بزيادة أو نقص:", "0"); if(n) db.collection("users").doc(id).update({ score: old + parseInt(n) }); }

let currentOpenedUserId = null;
let currentUserLogs = [];
function openProfile(id) {
    currentOpenedUserId = id;
    let u = globalUsers.find(x => x.id === id);
    if(!u) return;
    document.getElementById('prof-name').innerText = u.name;
    document.getElementById('prof-team').innerText = `${u.group} | ${u.team}`;
    document.getElementById('prof-score').innerText = u.score;
    
    document.getElementById('user-profile-modal').style.display = 'flex';
    db.collection("users").doc(id).collection("game_logs").get().then(snap => {
        currentUserLogs = []; snap.forEach(doc => currentUserLogs.push({docId: doc.id, ...doc.data()}));
        currentUserLogs.sort((a,b) => b.day - a.day);
        renderFilteredLogs();
    });
}

function renderFilteredLogs() {
    let container = document.getElementById('logs-container');
    if(!container) return;
    container.innerHTML = "";
    currentUserLogs.forEach(log => {
        container.innerHTML += `<div class="bg-gray-800/80 p-3 rounded-xl flex justify-between items-center border border-gray-700 mb-2">
            <div><p class="text-white font-bold text-sm">الجولة ${log.day}</p></div>
            <div class="flex items-center gap-3">
                <span class="text-xl font-black text-green-400">${log.score}</span>
                <button onclick="cancelRound('${log.docId}', ${log.score})" class="bg-red-900 text-white p-2 rounded-lg text-xs"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>`;
    });
}

function cancelRound(logDocId, scoreToDeduct) {
    if(confirm(`مسح الجولة وخصم ${scoreToDeduct} نقطة؟`)) {
        db.collection("users").doc(currentOpenedUserId).collection("game_logs").doc(logDocId).delete()
        .then(() => db.collection("users").doc(currentOpenedUserId).update({ score: firebase.firestore.FieldValue.increment(-scoreToDeduct) }))
        .then(() => { alert("تم!"); openProfile(currentOpenedUserId); });
    }
}

function loadQ() {
    let d = document.getElementById('q-day').value;
    let v = document.getElementById('q-var').value;
    db.collection("quizzes_pool").doc("day_"+d).get().then(doc => {
        if(doc.exists && doc.data().variations && doc.data().variations[v]) {
            let questions = doc.data().variations[v].questions || [];
            document.querySelectorAll('.q-block').forEach((b, i) => {
                if(questions[i]) {
                    b.querySelector('.qt').value = questions[i].q;
                    b.querySelector('.o1').value = questions[i].options[0];
                    b.querySelector('.o2').value = questions[i].options[1];
                    b.querySelector('.o3').value = questions[i].options[2];
                    b.querySelector('.o4').value = questions[i].options[3];
                    b.querySelector('.ca').value = questions[i].correctIndex;
                }
            });
            alert("✅ تم استدعاء الأسئلة.");
        }
    });
}

function saveQ() {
    let d = document.getElementById('q-day').value, v = document.getElementById('q-var').value, questions = [];
    document.querySelectorAll('.q-block').forEach(b => {
        let qText = b.querySelector('.qt').value.trim();
        if(qText) questions.push({ q: qText, options: [b.querySelector('.o1').value, b.querySelector('.o2').value, b.querySelector('.o3').value, b.querySelector('.o4').value], correctIndex: parseInt(b.querySelector('.ca').value) });
    });
    if(questions.length > 0) db.collection("quizzes_pool").doc("day_"+d).set({ variations: { [v]: { questions: questions } } }, {merge: true}).then(() => alert("✅ تم الحفظ"));
}

function setStatus(s) { db.collection("settings").doc("global_status").set({ currentDay: parseInt(document.getElementById('pub-day').value), status: s }).then(() => alert("تم التحديث")); }
function saveMessage(doc) { let val = (doc === 'champData') ? document.getElementById('msg-champ').value : document.getElementById('msg-daily').value; db.collection("settings").doc(doc).set({ message: val }).then(() => alert("تم النشر")); }
function calculateGlobalRanking() { /* نفس الكود السابق للترتيب */ }
      
