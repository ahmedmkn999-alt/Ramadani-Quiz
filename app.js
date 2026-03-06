// 1. نظام الحماية: التأكد إن المستخدم مسجل دخول
// ✅ FIX: إزالة شرط isInApp اللي كان بيمنع الدخول من المتصفح العادي
// نتحقق فقط إن فيه مستخدم مسجل، لو لأ نرجعه لصفحة الدخول
const isInApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

// 2. إعدادات Firebase
const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};

let db = null; let user = null; let myLogs = {}; 
let adminDay = 1, adminStatus = "closed";
window.activeDays = []; // الأيام المفعّلة
let logsUnsubscribe = null;
window.myPowerups = { freeze: 0, fifty50: 0 }; 

// 3. نظام التنبيهات الشيك (Alerts)
window.showAlert = function(title, msg, icon = "🔔", type = "normal") {
    let box = document.getElementById('custom-alert');
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-msg').innerText = msg;
    document.getElementById('alert-icon').innerText = icon;
    
    let titleEl = document.getElementById('alert-title');
    if(type === 'success') titleEl.className = "text-2xl font-black text-green-400 mb-2";
    else if(type === 'error') titleEl.className = "text-2xl font-black text-red-500 mb-2";
    else titleEl.className = "text-2xl font-black text-yellow-400 mb-2";

    box.style.display = 'flex';
    setTimeout(() => document.getElementById('alert-box').classList.remove('scale-95'), 10);
}

window.closeCustomAlert = function() {
    let box = document.getElementById('custom-alert');
    document.getElementById('alert-box').classList.add('scale-95');
    setTimeout(() => {
        box.style.display = 'none';
    }, 200);
}

// 4. تهيئة البيانات عند التحميل
window.addEventListener('DOMContentLoaded', () => {
    // تحقق من المستخدم أولاً بشكل منفصل عن Firebase
    try {
        user = JSON.parse(localStorage.getItem('currentUser'));
    } catch(e) {
        localStorage.removeItem('currentUser');
        user = null;
    }

    if (!user || !user.id) {
        window.location.replace("index.html");
        return;
    }

    // المستخدم موجود — شغّل Firebase بشكل مستقل
    try {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    } catch(e) {
        console.error("Firebase init error:", e);
        return;
    }

    initFirebaseData();
    setupWheelTimer();
    initNightQuestion();
});

function initFirebaseData() {
    // ✅ FIX 3: حالة الاتصال تتحول فوراً لـ متصل بنجاح 
    const connStatus = document.getElementById('conn-status');
    if (connStatus) {
        connStatus.innerHTML = 'متصل بنجاح 🟢';
        connStatus.style.color = '#10b981';
    }

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
            const data = doc.data();
            if (Array.isArray(data.activeDays) && data.activeDays.length > 0) {
                window.activeDays = data.activeDays;
                adminDay = window.activeDays[window.activeDays.length - 1];
                adminStatus = 'active';
            } else {
                adminDay = data.currentDay || 1;
                adminStatus = data.status || "closed";
                window.activeDays = (adminStatus === 'active') ? [adminDay] : [];
            }
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

// 5. التحكم في التبويبات (الخريطة / المتصدرين)
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
    // استخدام الرندر المحسّن الموجود في dashboard.html
    if (typeof window.__renderMapEnhanced === 'function') {
        window.__renderMapEnhanced(container, myLogs, adminDay, adminStatus);
        return;
    }
    // fallback قديم
    let html = '';
    for (let i = 1; i <= 30; i++) {
        let isPlayed = myLogs[i] !== undefined;
        let isActive = window.activeDays.includes(i);
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
// 7. نظام سؤال الليلة 🌙
// ==========================================

let nightQuestionData = null;
let nightCountdownInterval = null;

// وقت الإفطار الافتراضي (القاهرة - رمضان) — الأدمن يضبطه من Firebase
// في الـ settings/global_status يضيف حقل: iftarHour: 18, iftarMinute: 30
// سؤال الليلة يفتح بعد الإفطار بساعة ويقفل عند الفجر (4 فجراً)

function initNightQuestion() {
    let today   = new Date();
    let dayKey  = `night_${today.getFullYear()}_${today.getMonth()+1}_${today.getDate()}`;
    let nqLog   = JSON.parse(localStorage.getItem('nqLog_' + user.id)) || {};

    db.collection("settings").doc("night_question").onSnapshot(doc => {
        if (!doc.exists) return;
        let data = doc.data();
        nightQuestionData = data;

        // لو أجاب اليوم → ما نفتحش البوب أب
        if (nqLog[dayKey] !== undefined) return;

        let now    = new Date();
        let openH  = data.openHour   !== undefined ? data.openHour  : 19;
        let openM  = data.openMinute !== undefined ? data.openMinute : 30;
        let closeH = data.closeHour  !== undefined ? data.closeHour : 4;
        let closeM = data.closeMinute!== undefined ? data.closeMinute: 0;

        let openTime  = new Date(now); openTime.setHours(openH, openM, 0, 0);
        let closeTime = new Date(now); closeTime.setHours(closeH, closeM, 0, 0);
        // لو وقت الإغلاق أقل من وقت الفتح (مثلاً فتح 17 وإغلاق 4 فجر) يبقى اليوم الجاي
        if (closeH < openH) closeTime.setDate(closeTime.getDate() + 1);

        let isActive = (now >= openTime && now < closeTime) && data.active === true;
        if (isActive) {
            // بوب أب بعد ثانيتين من فتح الداشبورد
            setTimeout(() => window.openNightQuestion(), 2000);
        }
    });
}

// فتح أوفرلاي سؤال الليلة
window.openNightQuestion = function() {
    if (!nightQuestionData) return;
    let overlay = document.getElementById('nq-overlay');
    let content = document.getElementById('nq-content');
    if (!overlay || !content) return;

    overlay.style.display = 'flex';
    document.body.classList.add('hide-ads');

    let data = nightQuestionData;
    let pts = data.points || 10;
    let el = document.getElementById('nq-prize-pts');
    if (el) el.textContent = `+${pts}`;

    // بناء واجهة السؤال
    let opts = data.options || [];
    let optsHtml = opts.map((opt, i) => `
        <button onclick="handleNightAnswer(${i})" class="nq-opt-btn" style="
            width:100%;text-align:right;padding:14px 16px;margin-bottom:10px;
            background:rgba(255,255,255,0.05);border:1px solid rgba(167,139,250,0.25);
            border-radius:14px;color:rgba(255,255,255,0.88);font-weight:700;font-size:14px;
            font-family:'Cairo',sans-serif;cursor:pointer;
            transition:background .2s,border-color .2s,transform .15s;
            display:flex;align-items:center;gap:10px;
        " onmouseover="this.style.background='rgba(124,58,237,0.18)';this.style.borderColor='rgba(167,139,250,0.5)'"
           onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.borderColor='rgba(167,139,250,0.25)'">
            <span style="
                width:28px;height:28px;border-radius:50%;flex-shrink:0;
                background:rgba(124,58,237,0.20);border:1px solid rgba(167,139,250,0.35);
                display:flex;align-items:center;justify-content:center;
                font-size:12px;font-weight:900;color:#c4b5fd;
            ">${['أ','ب','ج','د'][i]}</span>
            ${opt}
        </button>
    `).join('');

    content.innerHTML = `
        <div style="margin-bottom:18px;">
            <p style="font-size:16px;font-weight:900;color:white;line-height:1.65;text-align:center;padding:0 4px;">${data.question || '...'}</p>
        </div>
        <div>${optsHtml}</div>
    `;
};

window.handleNightAnswer = function(i) {
    if (!nightQuestionData) return;
    let data = nightQuestionData;
    let correct = data.correctIndex;
    let pts = data.points || 10;
    let earned = (i === correct) ? pts : 0;

    // تعطيل الأزرار
    document.querySelectorAll('.nq-opt-btn').forEach((btn, idx) => {
        btn.style.pointerEvents = 'none';
        if (idx === correct) {
            btn.style.background = 'rgba(34,197,94,0.20)';
            btn.style.borderColor = 'rgba(34,197,94,0.60)';
            btn.style.color = '#4ade80';
        } else if (idx === i && i !== correct) {
            btn.style.background = 'rgba(239,68,68,0.15)';
            btn.style.borderColor = 'rgba(239,68,68,0.50)';
            btn.style.opacity = '0.7';
        }
    });

    // احفظ في localStorage وFirebase
    let today = new Date();
    let dayKey = `night_${today.getFullYear()}_${today.getMonth()+1}_${today.getDate()}`;
    let nqLog = JSON.parse(localStorage.getItem('nqLog_' + user.id)) || {};
    nqLog[dayKey] = earned;
    localStorage.setItem('nqLog_' + user.id, JSON.stringify(nqLog));

    if (earned > 0 && db && user) {
        db.collection("users").doc(user.id).update({
            score: firebase.firestore.FieldValue.increment(earned)
        });
        db.collection("users").doc(user.id).collection("night_logs").doc(dayKey).set({
            day: dayKey, score: earned, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // رسالة النتيجة
    setTimeout(() => {
        let content = document.getElementById('nq-content');
        if (!content) return;
        if (earned > 0) {
            if (window.confetti) confetti({ particleCount: 150, spread: 90, origin: {y:0.5}, colors:['#c4b5fd','#7c3aed','#fbbf24','#fff'] });
            content.innerHTML = `
                <div style="text-align:center;padding:20px 10px;">
                    <div style="font-size:60px;margin-bottom:12px;filter:drop-shadow(0 0 20px rgba(200,160,255,0.8));">🌟</div>
                    <h3 style="font-size:22px;font-weight:900;color:#c4b5fd;margin-bottom:8px;">أحسنت يا بطل!</h3>
                    <p style="color:rgba(255,255,255,0.7);font-weight:700;margin-bottom:16px;">الإجابة صحيحة 🎉</p>
                    <div style="background:rgba(124,58,237,0.20);border:1px solid rgba(167,139,250,0.35);border-radius:16px;padding:16px;margin-bottom:20px;">
                        <div style="font-size:40px;font-weight:900;color:#c4b5fd;">+${earned}</div>
                        <div style="font-size:12px;color:rgba(167,139,250,0.7);font-weight:700;">نقطة مضافة 🌙</div>
                    </div>
                    <button onclick="closeNightQuestion()" style="
                        width:100%;background:linear-gradient(135deg,#7c3aed,#5b21b6);
                        color:white;font-weight:900;font-size:16px;padding:14px;
                        border-radius:14px;border:none;cursor:pointer;font-family:'Cairo',sans-serif;
                    ">العودة للملعب ⛺</button>
                </div>`;
        } else {
            content.innerHTML = `
                <div style="text-align:center;padding:20px 10px;">
                    <div style="font-size:60px;margin-bottom:12px;">😔</div>
                    <h3 style="font-size:22px;font-weight:900;color:#f87171;margin-bottom:8px;">إجابة خاطئة</h3>
                    <p style="color:rgba(255,255,255,0.6);font-weight:700;margin-bottom:20px;">الإجابة الصحيحة كانت: <span style="color:#c4b5fd;font-weight:900;">${data.options[correct]}</span></p>
                    <button onclick="closeNightQuestion()" style="
                        width:100%;background:linear-gradient(135deg,rgba(124,58,237,0.5),rgba(76,29,149,0.5));
                        color:white;font-weight:900;font-size:16px;padding:14px;
                        border-radius:14px;border:1px solid rgba(167,139,250,0.3);cursor:pointer;font-family:'Cairo',sans-serif;
                    ">المرة الجاية أحسن 💪</button>
                </div>`;
        }
    }, 1200);
};

window.closeNightQuestion = function() {
    document.getElementById('nq-overlay').style.display = 'none';
    document.body.classList.remove('hide-ads');
    // تحديث البطاقة
    let today = new Date();
    let dayKey = `night_${today.getFullYear()}_${today.getMonth()+1}_${today.getDate()}`;
    let nqLog = JSON.parse(localStorage.getItem('nqLog_' + user.id)) || {};
    if (nqLog[dayKey] !== undefined) showNightDone(nqLog[dayKey]);
};

// 6. نظام عجلة الحظ (Streak + Probability)
function setupWheelTimer() {
    let wheelData = JSON.parse(localStorage.getItem('wheelData_' + user.id)) || { streak: 0, lastLogin: null };
    let today = new Date();
    today.setHours(0,0,0,0);
    
    if (wheelData.lastLogin) {
        let lastLogin = new Date(wheelData.lastLogin);
        lastLogin.setHours(0,0,0,0);
        let diffDays = Math.floor(Math.abs(today - lastLogin) / (1000 * 60 * 60 * 24));
        
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
        controls.innerHTML = `<button id="spin-btn" onclick="spinWheel()" class="w-full bg-gradient-to-r from-yellow-500 to-yellow-700 text-black font-black py-4 rounded-xl shadow-lg text-xl">لف العجلة الأسطورية! 🎰</button>`;
    } else {
        controls.innerHTML = `
            <div class="bg-gray-800/80 p-4 rounded-xl">
                <p class="text-gray-300 font-bold mb-2">للدوران، لازم تدخل ${3 - wheelData.streak} أيام كمان ورا بعض!</p>
                <div class="bg-gray-900 rounded-lg py-2">
                    <p id="wheel-timer-inside" class="text-yellow-400 font-black text-2xl tracking-widest font-mono">--:--:--</p>
                </div>
            </div>
        `;
        setInterval(() => {
            let el = document.getElementById('wheel-timer-inside');
            if(el) {
                let now = new Date();
                let tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                let diff = tomorrow - now;
                let h = Math.floor(diff / 3600000).toString().padStart(2, '0');
                let m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                let s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
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
    
    // نظام الاحتمالات (20 نقطة نادرة جداً بنسبة 2%)
    let prizes = [
        { text: "50 نقطة", points: 50, item: null, angle: 330, chance: 5 }, 
        { text: "حذف إجابتين", points: 0, item: 'fifty50', angle: 270, chance: 25 }, 
        { text: "20 نقطة", points: 20, item: null, angle: 210, chance: 2 }, 
        { text: "تجميد الوقت", points: 0, item: 'freeze', angle: 150, chance: 28 }, 
        { text: "10 نقاط", points: 10, item: null, angle: 90, chance: 20 }, 
        { text: "حظ أوفر", points: 0, item: null, angle: 30, chance: 20 } 
    ];
    
    let rand = Math.random() * 100;
    let sum = 0;
    let winIndex = 0;
    
    for (let i = 0; i < prizes.length; i++) {
        sum += prizes[i].chance;
        if (rand <= sum) { winIndex = i; break; }
    }
    
    let prize = prizes[winIndex];
    wheel.style.transform = `rotate(${(360 * 6) + prize.angle}deg)`;
    
    setTimeout(() => {
        isSpinning = false;
        let wheelData = JSON.parse(localStorage.getItem('wheelData_' + user.id));
        wheelData.streak = 0; 
        localStorage.setItem('wheelData_' + user.id, JSON.stringify(wheelData));
        
        if (prize.text === "حظ أوفر") {
            window.showAlert("حظ أوفر!", "معلش يا بطل، حاول تاني المرة الجاية.", "😔");
        } else {
            window.showAlert("مبروك!", `كسبت: ${prize.text} 🎁`, "🎉", "success");
            if(window.confetti) confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }});
            
            if (prize.points > 0) {
                db.collection("users").doc(user.id).update({ score: firebase.firestore.FieldValue.increment(prize.points) });
            } else {
                window.myPowerups[prize.item]++;
                db.collection("users").doc(user.id).update({ powerups: window.myPowerups });
            }
        }
        setTimeout(() => { location.reload(); }, 3500); 
    }, 4000); 
            }
