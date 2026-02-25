const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};

let db = null; let user = null; let myLogs = {}; 
let adminDay = 1, adminStatus = "closed";
let logsUnsubscribe = null;
window.myPowerups = { freeze: 0, fifty50: 0 }; 

window.addEventListener('DOMContentLoaded', () => {
    try {
        user = JSON.parse(localStorage.getItem('currentUser'));
        if(!user || !user.id) throw new Error("No User");
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        initFirebaseData();
        setupWheelTimer(); // تشغيل عداد العجلة
    } catch(e) { window.location.replace("index.html"); }
});

function initFirebaseData() {
    db.collection("users").doc(user.id).onSnapshot(doc => {
        if(doc.exists) {
            let d = doc.data();
            document.getElementById('p-score').innerText = d.score || 0;
            document.getElementById('p-name').innerText = d.name || "بطل";
            document.getElementById('p-group').innerText = d.group || "";
            
            // سحب المخزون (Inventory)
            window.myPowerups = d.powerups || { freeze: 0, fifty50: 0 };
            document.getElementById('inv-freeze').innerText = window.myPowerups.freeze;
            document.getElementById('inv-5050').innerText = window.myPowerups.fifty50;
        }
    });

    db.collection("settings").doc("global_status").onSnapshot(doc => {
        if(doc.exists) {
            adminDay = doc.data().currentDay || 1;
            adminStatus = doc.data().status || "closed";
        } else {
            adminDay = 1; adminStatus = "active";
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

function renderMap() {
    let container = document.getElementById('view-arena');
    if(!container) return;
    let html = '';
    for (let i = 1; i <= 29; i++) {
        let isPlayed = myLogs[i] !== undefined;
        let isActive = (i === adminDay && adminStatus === 'active');
        
        if (isPlayed) {
            html += `<div class="glass-card p-5 rounded-2xl flex justify-between opacity-80 border-r-4 border-r-green-500 mb-4"><div class="flex items-center gap-4"><div class="bg-green-500/20 text-green-400 w-12 h-12 rounded-full flex justify-center items-center"><i class="fas fa-check"></i></div><p class="font-bold text-gray-300">الجولة ${i}</p></div><p class="font-black text-2xl text-green-400">${myLogs[i]}</p></div>`;
        } else if (isActive) {
            html += `<div onclick="openQuiz(${i})" class="day-active p-6 rounded-2xl flex justify-between mb-4"><div class="flex items-center gap-4"><div class="bg-gradient-to-br from-yellow-400 to-yellow-600 w-14 h-14 rounded-full flex justify-center items-center text-black"><i class="fas fa-play text-xl ml-1"></i></div><div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-yellow-400 font-bold mt-1">العب الآن!</p></div></div><i class="fas fa-chevron-left text-yellow-500 text-3xl opacity-40"></i></div>`;
        } else {
            html += `<div class="glass-card p-5 rounded-2xl flex items-center gap-4 opacity-40 mb-4 grayscale"><div class="bg-gray-800 text-gray-500 w-12 h-12 rounded-full flex justify-center items-center"><i class="fas fa-lock text-sm"></i></div><p class="font-bold text-sm text-gray-500">الجولة ${i}</p></div>`;
        }
    }
    container.innerHTML = html;
}

window.logoutUser = function() { localStorage.removeItem('currentUser'); window.location.replace("index.html"); }

// ==========================================
// نظام الستريك للعجلة (3 أيام)
// ==========================================
function setupWheelTimer() {
    let wheelData = JSON.parse(localStorage.getItem('wheelData_' + user.id)) || { streak: 0, lastLogin: null };
    let today = new Date().toDateString();
    
    // تحديث الستريك عند الدخول في يوم جديد
    if (wheelData.lastLogin !== today) {
        if(wheelData.streak < 3) wheelData.streak++;
        wheelData.lastLogin = today;
        localStorage.setItem('wheelData_' + user.id, JSON.stringify(wheelData));
    }

    // رسم النقط (الستريك)
    let dotsHtml = '';
    for(let i=1; i<=3; i++) {
        if(i <= wheelData.streak) dotsHtml += `<div class="w-4 h-4 rounded-full bg-green-500 border-2 border-green-300 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>`;
        else dotsHtml += `<div class="w-4 h-4 rounded-full bg-gray-700 border-2 border-gray-600"></div>`;
    }
    document.getElementById('streak-dots').innerHTML = dotsHtml;

    // إظهار العجلة أو العداد
    if (wheelData.streak >= 3) {
        document.getElementById('wheel-status-container').classList.add('hidden');
        document.getElementById('open-wheel-btn').classList.remove('hidden');
    } else {
        document.getElementById('open-wheel-btn').classList.add('hidden');
        document.getElementById('wheel-status-container').classList.remove('hidden');
        
        // عداد تنازلي لمنتصف الليل
        setInterval(() => {
            let now = new Date();
            let tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            let diff = tomorrow - now;
            let h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
            let m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
            let s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
            document.getElementById('wheel-timer').innerText = `${h}:${m}:${s}`;
        }, 1000);
    }
}

window.openSpinWheel = function() { document.getElementById('spin-overlay').style.display = 'flex'; }
window.closeSpinWheel = function() { document.getElementById('spin-overlay').style.display = 'none'; }

let isSpinning = false;
window.spinWheel = function() {
    if(isSpinning) return;
    isSpinning = true;
    let wheel = document.getElementById('wheel-spinner');
    let btn = document.getElementById('spin-btn');
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    btn.innerText = "جاري اللف...";
    
    // زوايا الجوايز حسب الـ CSS اللي فوق
    let prizes = [
        { text: "50 نقطة", points: 50, item: null, angle: 330 },   // أحمر
        { text: "حذف إجابتين", points: 0, item: 'fifty50', angle: 270 }, // أزرق
        { text: "20 نقطة", points: 20, item: null, angle: 210 },   // أخضر
        { text: "تجميد الوقت", points: 0, item: 'freeze', angle: 150 }, // برتقالي
        { text: "10 نقاط", points: 10, item: null, angle: 90 },    // بنفسجي
        { text: "حظ أوفر", points: 0, item: null, angle: 30 }      // رمادي
    ];
    
    let winIndex = Math.floor(Math.random() * prizes.length);
    let prize = prizes[winIndex];
    let spinDegrees = (360 * 5) + prize.angle; // 5 لفات كاملة للإثارة
    
    wheel.style.transform = `rotate(${spinDegrees}deg)`;
    
    setTimeout(() => {
        isSpinning = false;
        
        // تصفير الستريك عشان يبدأ 3 أيام جديدة
        let wheelData = JSON.parse(localStorage.getItem('wheelData_' + user.id));
        wheelData.streak = 0;
        localStorage.setItem('wheelData_' + user.id, JSON.stringify(wheelData));
        
        if (prize.text === "حظ أوفر") {
            alert("حظ أوفر المرة الجاية! 😔");
        } else {
            alert(`🎉 مبروووووك! كسبت ${prize.text} 🎁`);
            if(window.confetti) confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, colors: ['#fbbf24', '#ffffff'] });
            
            // إضافة الجايزة للداتا بيز
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
        
        setTimeout(() => { location.reload(); }, 2000); // تحديث الصفحة لغلق العجلة وبدء عداد جديد
    }, 4000); 
}
    
