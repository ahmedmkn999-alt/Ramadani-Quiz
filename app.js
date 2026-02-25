// ==========================================
// 1. إعدادات فايربيز والمتغيرات العامة
// ==========================================
const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};

let db = null;
let user = null;
let myLogs = {}, adminDay = 1, adminStatus = "closed";
let isEliminatedPlayer = false; 
let currentStreak = 0;
let logsUnsubscribe = null; 

function getRankInfo(score) {
    if(score >= 101) return { text: "أسطورة رمضان 👑", color: "text-yellow-400 bg-yellow-900/50" };
    if(score >= 51) return { text: "كابتن الملعب 🥇", color: "text-yellow-300 bg-yellow-800/50" };
    if(score >= 21) return { text: "هداف الفريق 🥈", color: "text-gray-300 bg-gray-700/50" };
    return { text: "لاعب ناشئ 🥉", color: "text-orange-400 bg-orange-900/50" };
}

// ==========================================
// 2. تشغيل الموقع وربط البيانات
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.webkitTouchCallout = "none";

    setTimeout(() => {
        try {
            user = JSON.parse(localStorage.getItem('currentUser'));
            if(!user || !user.id) throw new Error("No User");

            if (typeof firebase !== 'undefined' && !firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();

            initFirebaseData();

        } catch(e) { 
            // التوجيه لصفحة تسجيل الدخول لو مش مسجل
            window.location.replace("index.html"); 
        }
    }, 150);
});

function initFirebaseData() {
    db.collection("users").doc(user.id).onSnapshot(doc => {
        if(doc.exists) {
            let d = doc.data();
            let pScore = d.score || 0;
            currentStreak = d.streak || 0;
            isEliminatedPlayer = d.isEliminated || false;
            let rank = getRankInfo(pScore);

            let elScore = document.getElementById('p-score');
            if(elScore) elScore.innerText = pScore;
            
            let elStreak = document.getElementById('p-streak');
            if(elStreak) {
                elStreak.innerText = `🔥 ${currentStreak}`;
                elStreak.classList.remove('hidden');
            }

            let elName = document.getElementById('p-name');
            if(elName) elName.innerText = d.name || "مجهول";
            
            let elGroup = document.getElementById('p-group');
            let elRank = document.getElementById('p-rank');

            if(isEliminatedPlayer) {
                if(elGroup) {
                    elGroup.innerHTML = '<i class="fas fa-ban"></i> مقصى';
                    elGroup.className = 'text-red-400 font-bold bg-red-900/40 px-2 py-0.5 rounded text-[10px] border border-red-700';
                    elGroup.classList.remove('hidden');
                }
                if(elRank) elRank.classList.add('hidden');
            } else {
                if(elGroup) {
                    elGroup.innerText = `${d.group || ""} | ${d.team || ""}`;
                    elGroup.className = 'text-yellow-400 font-bold bg-gray-800 px-2 py-0.5 rounded text-[10px] border border-gray-600 truncate max-w-[100px]';
                    elGroup.classList.remove('hidden');
                }
                if(elRank) {
                    elRank.innerText = rank.text;
                    elRank.className = `font-bold text-[10px] px-2 py-0.5 rounded border border-gray-600 ${rank.color}`;
                    elRank.classList.remove('hidden');
                }
            }
        }
    });

    db.collection("settings").doc("global_status").onSnapshot(doc => {
        if(doc.exists) {
            adminDay = doc.data().currentDay || 1;
            adminStatus = doc.data().status || "closed";
        } else {
            adminDay = 1;
            adminStatus = "active";
        }
        updateLogs(); 
    });
}

function updateLogs() {
    if(logsUnsubscribe) logsUnsubscribe();
    logsUnsubscribe = db.collection("users").doc(user.id).collection("game_logs").onSnapshot(snap => {
        myLogs = {};
        snap.forEach(d => myLogs[d.data().day] = d.data().score);
        renderMap(); 
        
        let pText = document.getElementById('progress-text');
        let pBar = document.getElementById('progress-bar');
        if(pText) pText.innerText = `${Object.keys(myLogs).length} / 29 جولة`;
        if(pBar) pBar.style.width = `${(Object.keys(myLogs).length/29)*100}%`;
    });
}

// ==========================================
// 3. واجهة الخريطة والترتيب
// ==========================================
function renderMap() {
    let container = document.getElementById('view-arena');
    if(!container) return;
    let html = '';
    for (let i = 1; i <= 29; i++) {
        let isPlayed = myLogs[i] !== undefined;
        let isActive = (i === adminDay && adminStatus === 'active');
        let isSoon = (i === adminDay && adminStatus === 'soon'); 
        
        if (isPlayed) {
            html += `<div class="glass-card p-5 rounded-2xl flex justify-between opacity-80 border-r-4 border-r-green-500 mb-4 transition-all">
                <div class="flex items-center gap-4">
                    <div class="bg-green-500/20 text-green-400 w-12 h-12 rounded-full flex justify-center items-center shadow-inner"><i class="fas fa-check"></i></div>
                    <div><p class="font-bold text-gray-300">الجولة ${i}</p></div>
                </div>
                <p class="font-black text-2xl text-green-400 drop-shadow-md">${myLogs[i]}</p>
            </div>`;
        } else if (isActive) {
            html += `<div onclick="openQuiz(${i})" class="day-active p-6 rounded-2xl flex justify-between mb-4 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <div class="flex items-center gap-4">
                    <div class="bg-gradient-to-br from-yellow-400 to-yellow-600 w-14 h-14 rounded-full flex justify-center items-center text-black shadow-lg"><i class="fas fa-play text-xl ml-1"></i></div>
                    <div><p class="font-black text-white text-xl drop-shadow-md">الجولة ${i}</p><p class="text-xs text-yellow-400 font-bold mt-1">العب الآن!</p></div>
                </div>
                <i class="fas fa-chevron-left text-yellow-500 text-3xl opacity-40"></i>
            </div>`;
        } else if (isSoon) {
            html += `<div class="glass-card p-6 rounded-2xl flex justify-between mb-4 border border-blue-500/30">
                <div class="flex items-center gap-4">
                    <div class="bg-blue-900/50 text-blue-400 w-14 h-14 rounded-full flex justify-center items-center shadow-inner"><i class="fas fa-hourglass-half text-2xl animate-pulse"></i></div>
                    <div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-blue-400 font-bold mt-1">تفتح قريباً ⏳</p></div>
                </div>
            </div>`;
        } else {
            html += `<div class="glass-card p-5 rounded-2xl flex items-center gap-4 opacity-40 mb-4 grayscale">
                <div class="bg-gray-800 text-gray-500 w-12 h-12 rounded-full flex justify-center items-center shadow-inner"><i class="fas fa-lock text-sm"></i></div>
                <p class="font-bold text-sm text-gray-500">الجولة ${i}</p>
            </div>`;
        }
    }
    container.innerHTML = html;
}

window.showTab = function(t) {
    document.getElementById('view-arena').classList.toggle('hidden', t !== 'arena');
    document.getElementById('view-leaderboard').classList.toggle('hidden', t !== 'leaderboard');
    document.getElementById('btn-arena').classList.toggle('active', t === 'arena');
    document.getElementById('btn-leader').classList.toggle('active', t === 'leaderboard');
    if(t === 'leaderboard') fetchLeaderboard();
}

function fetchLeaderboard() {
    if(!user || !user.group) return;
    db.collection("users").where("group", "==", user.group).get().then(snap => {
        let list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a,b) => (b.score || 0) - (a.score || 0));
        let html = '';
        list.forEach((u, i) => {
            let rank = i + 1;
            let uRank = getRankInfo(u.score || 0);
            html += `<div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl mb-2 border border-gray-700 hover:border-yellow-500/30 transition-colors shadow-sm">
                <div class="flex items-center gap-3">
                    <span class="w-6 text-center font-black ${rank <= 3 ? 'text-yellow-500 text-xl drop-shadow-md' : 'text-gray-400'}">${rank}</span>
                    <div>
                        <span class="font-bold block ${u.name === user.name ? 'text-yellow-400' : 'text-white'}">${u.name} <span class="text-orange-500 text-[10px]">🔥 ${u.streak||0}</span></span>
                        <span class="text-[10px] ${uRank.color} px-1.5 py-0.5 rounded mt-1 inline-block shadow-sm">${uRank.text}</span>
                    </div>
                </div>
                <span class="font-black text-yellow-500 text-lg">${u.score || 0}</span>
            </div>`;
        });
        document.getElementById('group-list').innerHTML = html;
    });
}

window.logoutUser = function() {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('splashSeen'); 
    window.location.replace("index.html"); 
}
