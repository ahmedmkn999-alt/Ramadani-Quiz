const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};

let db = null; let user = null; let myLogs = {}; 
let adminDay = 1, adminStatus = "closed";
let logsUnsubscribe = null;
window.myPowerups = { freeze: 0, fifty50: 0 }; 

// دالة الرسايل الشيك
window.showAlert = function(title, msg, icon = "🔔", type = "normal") {
    let box = document.getElementById('custom-alert');
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-msg').innerText = msg;
    document.getElementById('alert-icon').innerText = icon;
    
    let titleEl = document.getElementById('alert-title');
    if(type === 'success') titleEl.className = "text-2xl font-black text-green-400 mb-2";
    else if(type === 'error') titleEl.className = "text-2xl font-black text-red-500 mb-2";
    else titleEl.className = "text-2xl font-black text-yellow-400 mb-2";

    box.classList.remove('hidden');
    box.classList.add('flex');
    setTimeout(() => document.getElementById('alert-box').classList.remove('scale-95'), 10);
}

window.closeCustomAlert = function() {
    let box = document.getElementById('custom-alert');
    document.getElementById('alert-box').classList.add('scale-95');
    setTimeout(() => {
        box.classList.add('hidden');
        box.classList.remove('flex');
    }, 200);
}

window.addEventListener('DOMContentLoaded', () => {
    try {
        user = JSON.parse(localStorage.getItem('currentUser'));
        if(!user || !user.id) throw new Error("No User");
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        initFirebaseData();
        setupWheelTimer(); 
    } catch(e) { window.location.replace("index.html"); }
});

function initFirebaseData() {
    db.collection("users").doc(user.id).onSnapshot(doc => {
        if(doc.exists) {
            let d = doc.data();
            document.getElementById('p-score').innerText = d.score || 0;
            document.getElementById('p-name').innerText = d.name || "بطل";
            document.getElementById('p-group').innerText = d.group || "";
            
            window.myPowerups = d.powerups || { freeze: 0, fifty50: 0 };
            document.getElementById('inv-freeze').innerText = window.myPowerups.freeze;
            document.getElementById('inv-5050').innerText = window.myPowerups.fifty50;
        }
    });

    db.collection("settings").doc("global_status").onSnapshot(doc => {
        if(doc.exists) {
            adminDay = doc.data().currentDay || 1;
            adminStatus = doc.data().status || "closed";
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
    });
}

window.showTab = function(t) {
    let arena = document.getElementById('view-arena');
    let leader = document.getElementById('view-leaderboard');
    if(arena && leader) {
        arena.classList.toggle('hidden', t !== 'arena');
        leader.classList.toggle('hidden', t !== 'leaderboard');
        document.getElementById('btn-arena').classList.toggle('active', t === 'arena');
        document.getElementById('btn-leader').classList.toggle('active', t === 'leaderboard');
        if(t === 'leaderboard') fetchLeaderboard();
    }
}

function renderMap() {
    let container = document.getElementById('view-arena');
    if(!container) return;
    let html = '';
    for (let i = 1; i <= 29; i++) {
        let isPlayed = myLogs[i] !== undefined;
        let isActive = (i === adminDay && adminStatus === 'active');
        
        if (isPlayed) {
            html += `<div class="glass-card p-5 rounded-2xl flex justify-between border-r-4 border-r-green-500 mb-4"><div class="flex items-center gap-4"><div class="bg-green-500/20 text-green-400 w-12 h-12 rounded-full flex justify-center items-center"><i class="fas fa-check"></i></div><p class="font-bold text-gray-300">الجولة ${i}</p></div><p class="font-black text-2xl text-green-400">${myLogs[i]}</p></div>`;
        } else if (isActive) {
            html += `<div onclick="window.openQuiz(${i})" class="day-active p-6 rounded-2xl flex justify-between mb-4"><div class="flex items-center gap-4"><div class="bg-gradient-to-br from-yellow-400 to-yellow-600 w-14 h-14 rounded-full flex justify-center items-center text-black"><i class="fas fa-play text-xl ml-1"></i></div><div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-yellow-400 font-bold mt-1">العب الآن!</p></div></div><i class="fas fa-chevron-left text-yellow-500 text-3xl opacity-40"></i></div>`;
        } else {
            html += `<div class="glass-card p-5 rounded-2xl flex items-center gap-4 opacity-40 mb-4 grayscale"><div class="bg-gray-800 text-gray-500 w-12 h-12 rounded-full flex justify-center items-center"><i class="fas fa-lock text-sm"></i></div><p class="font-bold text-sm text-gray-500">الجولة ${i}</p></div>`;
        }
    }
    container.innerHTML = html;
}

function fetchLeaderboard() {
    if(!user) return;
    db.collection("users").where("group", "==", user.group).get().then(snap => {
        let list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a,b) => (b.score || 0) - (a.score || 0));
        let html = '';
        list.forEach((u, i) => {
            let rank = i + 1;
            html += `<div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl mb-2 border border-gray-700">
                <div class="flex items-center gap-3"><span class="w-6 text-center font-black ${rank <= 3 ? 'text-yellow-500 text-xl' : 'text-gray-400'}">${rank}</span><span class="font-bold ${u.name === user.name ? 'text-yellow-400' : 'text-white'}">${u.name}</span></div>
                <span class="font-black text-yellow-500 text-lg">${u.score || 0}</span>
            </div>`;
        });
        document.getElementById('group-list').innerHTML = html;
    });
}

window.logoutUser = function() { localStorage.removeItem('currentUser'); window.location.replace("index.html"); }

// ==========================================
// العجلة (التحديث الجديد للعداد)
// ==========================================
function setupWheelTimer() {
    let wheelData = JSON.parse(localStorage.getItem('wheelData_' + user.id)) || { streak: 0, lastLogin: null };
    let today = new Date();
    today.setHours(0,0,0,0);
    
    if (wheelData.lastLogin) {
        let lastLogin = new Date(wheelData.lastLogin);
        lastLogin.setHours(0,0,0,0);
        let diffTime = Math.abs(today - lastLogin);
        let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) { 
            if (wheelData.streak < 3) wheelData.streak++;
            wheelData.lastLogin = today.toISOString();
        } else if (diffDays > 1) { 
            wheelData.streak = 1;
            wheelData.lastLogin = today.toISOString();
        }
    } else {
        wheelData.streak = 1;
        wheelData.lastLogin = today.toISOString();
    }
    localStorage.setItem('wheelData_' + user.id, JSON.stringify(wheelData));

    document.getElementById('streak-badge').innerText = `${wheelData.streak}/3`;
}

window.openSpinWheel = function() {
    document.getElementById('spin-overlay').style.display = 'flex';
    let wheelData = JSON.parse(localStorage.getItem('wheelData_' + user.id));
    let controls = document.getElementById('wheel-controls');
    
    if (wheelData.streak >= 3) {
        controls.innerHTML = `<button id="spin-btn" onclick="spinWheel()" class="w-full bg-gradient-to-r from-yellow-500 to-yellow-700 text-black font-black py-4 rounded-xl shadow-[0_10px_20px_rgba(212,175,55,0.4)] hover:scale-[1.02] transition-all text-xl border border-yellow-300">لف العجلة الأسطورية! 🎰</button>`;
    } else {
        controls.innerHTML = `
            <div class="bg-gray-800/80 border border-gray-700 p-4 rounded-xl">
                <p class="text-gray-300 font-bold mb-2">للدوران، لازم تدخل ${3 - wheelData.streak} أيام كمان ورا بعض!</p>
                <div class="bg-gray-900 rounded-lg py-2">
                    <p id="wheel-timer-inside" class="text-yellow-400 font-black text-2xl tracking-widest font-mono">--:--:--</p>
                    <p class="text-xs text-gray-500 font-bold mt-1">يتبقى على اليوم القادم</p>
                </div>
            </div>
        `;
        
        setInterval(() => {
            let el = document.getElementById('wheel-timer-inside');
            if(el) {
                let now = new Date();
                let tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                let diff = tomorrow - now;
                let h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
                let m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
                let s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
                el.innerText = `${h}:${m}:${s}`;
            }
        }, 1000);
    }
}

window.closeSpinWheel = function() { document.getElementById('spin-overlay').style.display = 'none'; }

let isSpinning = false;
window.spinWheel = function() {
    if(isSpinning) return;
    isSpinning = true;
    let wheel = document.getElementById('wheel-spinner');
    let btn = document.getElementById('spin-btn');
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    btn.innerText = "جاري اللف...";
    
    let prizes = [
        { text: "50 نقطة", points: 50, item: null, angle: 330 },
        { text: "حذف إجابتين", points: 0, item: 'fifty50', angle: 270 },
        { text: "20 نقطة", points: 20, item: null, angle: 210 },
        { text: "تجميد الوقت", points: 0, item: 'freeze', angle: 150 },
        { text: "10 نقاط", points: 10, item: null, angle: 90 },
        { text: "حظ أوفر", points: 0, item: null, angle: 30 }
    ];
    
    let winIndex = Math.floor(Math.random() * prizes.length);
    let prize = prizes[winIndex];
    let spinDegrees = (360 * 5) + prize.angle; 
    
    wheel.style.transform = `rotate(${spinDegrees}deg)`;
    
    setTimeout(() => {
        isSpinning = false;
        
        let wheelData = JSON.parse(localStorage.getItem('wheelData_' + user.id));
        wheelData.streak = 0; 
        localStorage.setItem('wheelData_' + user.id, JSON.stringify(wheelData));
        
        if (prize.text === "حظ أوفر") {
            window.showAlert("حظ أوفر!", "معلش يا بطل، حظك أحسن المرة الجاية. كمل ستريك وهتكسب.", "😔", "normal");
        } else {
            window.showAlert("مبرووووك!", `أنت كسبت: ${prize.text} 🎁`, "🎉", "success");
            if(window.confetti) confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }});
            
            if (prize.points > 0) {
                db.collection("users").doc(user.id).update({ score: firebase.firestore.FieldValue.increment(prize.points) });
            } else if (prize.item === 'freeze') {
                window.myPowerups.freeze += 1;
                db.collection("users").doc(user.id).update({ powerups: window.myPowerups });
            } else if (prize.item === 'fifty50') {
                window.myPowerups.fifty50 += 1;
                db.collection("users").doc(user.id).update({ powerups: window.myPowerups });
            }
        }
        
        setTimeout(() => { location.reload(); }, 3500); 
    }, 4000); 
                                    }
            
