const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let user = JSON.parse(localStorage.getItem('currentUser'));
if(!user) window.location.replace("index.html");

window.myLogs = {};
let currentAdminDay = 0;
let currentStatus = 'locked';

// 1. مراقبة بيانات المستخدم
db.collection("users").doc(user.id).onSnapshot(doc => {
    if(doc.exists) {
        let d = doc.data();
        document.getElementById('p-score').innerText = d.score || 0;
        document.getElementById('p-name').innerText = d.name;
        document.getElementById('p-group').innerText = d.group;
        document.getElementById('inv-freeze').innerText = d.powerups?.freeze || 0;
        document.getElementById('inv-5050').innerText = d.powerups?.fifty50 || 0;
    }
});

// 2. رسم الخريطة (Live)
function initArena() {
    db.collection("settings").doc("global_status").onSnapshot(sDoc => {
        if(sDoc.exists) {
            currentAdminDay = sDoc.data().currentDay;
            currentStatus = sDoc.data().status;
        }

        db.collection("users").doc(user.id).collection("game_logs").onSnapshot(snap => {
            window.myLogs = {};
            snap.forEach(l => window.myLogs[l.id.replace('day_', '')] = l.data().score);
            
            let html = '';
            for(let i=1; i<=30; i++) {
                if(window.myLogs[i] !== undefined) {
                    html += `<div class="glass-card p-5 rounded-2xl flex justify-between items-center border-r-4 border-green-500 mb-3 opacity-90">
                        <div class="flex items-center gap-3"><i class="fas fa-check-circle text-green-500"></i><span class="font-bold">جولة ${i}</span></div>
                        <span class="font-black text-green-400">+${window.myLogs[i]}</span>
                    </div>`;
                } else if(i == currentAdminDay && currentStatus == 'active') {
                    html += `<div onclick="openQuiz(${i})" class="day-active p-6 rounded-3xl flex justify-between items-center mb-3 cursor-pointer transform active:scale-95 transition-all">
                        <div><p class="font-black text-xl">الجولة ${i}</p><p class="text-[10px] font-bold opacity-70">اضغط للبدء ⚔️</p></div>
                        <i class="fas fa-play-circle text-3xl"></i>
                    </div>`;
                } else {
                    html += `<div class="glass-card p-5 rounded-2xl flex justify-between items-center mb-3 opacity-30 grayscale">
                        <div class="flex items-center gap-3 text-gray-400"><i class="fas fa-lock"></i><span class="font-bold">جولة ${i}</span></div>
                    </div>`;
                }
            }
            document.getElementById('view-arena').innerHTML = html;
        });
    });
}

// 3. الترتيب
function loadLeaderboard() {
    db.collection("users").where("group", "==", user.group).onSnapshot(snap => {
        let players = [];
        snap.forEach(d => players.push(d.data()));
        players.sort((a,b) => (b.score || 0) - (a.score || 0));
        
        let html = '';
        players.forEach((p, idx) => {
            let meClass = p.name === user.name ? 'border-yellow-500 bg-yellow-500/5' : 'border-white/5';
            html += `<div class="glass-card p-4 rounded-2xl flex justify-between items-center border ${meClass} mb-2">
                <div class="flex items-center gap-3">
                    <span class="w-5 text-center font-black text-yellow-500">${idx+1}</span>
                    <p class="font-bold text-sm">${p.name}</p>
                </div>
                <span class="font-black text-yellow-500">${p.score || 0}</span>
            </div>`;
        });
        document.getElementById('group-list').innerHTML = html;
    });
}

window.showTab = (t) => {
    document.getElementById('view-arena').classList.toggle('hidden', t !== 'arena');
    document.getElementById('view-leaderboard').classList.toggle('hidden', t !== 'leaderboard');
    document.getElementById('btn-arena').classList.toggle('active', t === 'arena');
    document.getElementById('btn-leader').classList.toggle('active', t === 'leaderboard');
    if(t === 'leaderboard') loadLeaderboard();
};

window.logoutUser = () => { if(confirm("خروج؟")) { localStorage.clear(); window.location.replace("index.html"); } };

// تشغيل
initArena();
                        
