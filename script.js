// ==========================================
// 1. الإعدادات الأساسية
// ==========================================
const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    authDomain: "ramadan-87817.firebaseapp.com", 
    projectId: "ramadan-87817", 
    storageBucket: "ramadan-87817.appspot.com",
    messagingSenderId: "343525703258",
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};

let db = null;
let user = null;
let myLogs = {}, adminDay = 1, adminStatus = "closed";
let currentQuestions = [], currentIndex = 0, sessionScore = 0;
let timerInterval = null, globalTimeLeft = 20;
let isQuizActive = false;
let isEliminatedPlayer = false; 
let logsUnsubscribe = null; 

let used5050 = false, usedFreeze = false;
let currentStreak = 0;

// ==========================================
// 🛡️ 2. نظام الحماية من الغش (Anti-Cheat) 🛡️
// ==========================================
let cheatWarnings = 0;

function handleCheatAttempt(reason) {
    if (!isQuizActive) return;
    
    cheatWarnings++;
    vibratePhone([200, 100, 200]);

    if (cheatWarnings === 1) {
        // إنذار شيك أول مرة
        showChicWarning("خلي بالك! 🚨", `ممنوع ${reason} أثناء الكويز. دي فرصة أخيرة، لو كررتها هيتم إنهاء الجولة واعتبارها محاولة غش!`);
    } else {
        // طرد وتسجيل في الداتا بيز كغشاش
        kickCheater(reason);
    }
}

function kickCheater(reason) {
    isQuizActive = false;
    clearInterval(timerInterval);
    
    // تسجيل الغش في قاعدة البيانات عشان يظهرلك في لوحة التحكم
    db.collection("users").doc(user.id).update({
        isCheater: true,
        cheatReason: reason,
        lastCheatTime: firebase.firestore.FieldValue.serverTimestamp()
    });

    // إنهاء الكويز وحفظ النقط اللي جابها لحد دلوقتي مع رسالة طرد
    endQuiz(true, "تم طردك للاشتباه في محاولة غش! 🚫");
}

function showChicWarning(title, msg) {
    let warningHTML = `
        <div id="cheat-warning-modal" class="fixed inset-0 z-[999999] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
            <div class="bg-gray-900 border-2 border-red-500 rounded-3xl p-6 text-center w-full max-w-sm shadow-[0_0_50px_rgba(239,68,68,0.4)] animate-bounce">
                <div class="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500">
                    <i class="fas fa-eye text-4xl text-red-500"></i>
                </div>
                <h3 class="text-2xl font-black text-white mb-2">${title}</h3>
                <p class="text-gray-300 font-bold text-sm mb-6 leading-relaxed">${msg}</p>
                <button onclick="document.getElementById('cheat-warning-modal').remove()" class="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl transition-all shadow-lg">فهمت، مش هكررها</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', warningHTML);
}

// مراقبة تبديل الشاشات أو قفل الموبايل
document.addEventListener("visibilitychange", () => {
    if (document.hidden && isQuizActive) handleCheatAttempt("الخروج من الصفحة أو قفل الشاشة");
});

// فخ الرجوع للخلف (Back Button Trap)
window.history.pushState(null, null, window.location.href);
window.onpopstate = function () {
    if (isQuizActive) {
        window.history.pushState(null, null, window.location.href);
        handleCheatAttempt("الرجوع للخلف");
    }
};

// منع النسخ وتحديد النص
document.addEventListener('contextmenu', e => { if(isQuizActive) e.preventDefault(); });
document.addEventListener('copy', e => { if(isQuizActive) e.preventDefault(); });

// ==========================================
// 3. دوال مساعدة وبدء التشغيل
// ==========================================
function vibratePhone(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }

function getRankInfo(score) {
    if(score >= 101) return { text: "أسطورة رمضان 👑", color: "text-yellow-400 bg-yellow-900/50" };
    if(score >= 51) return { text: "كابتن الملعب 🥇", color: "text-yellow-300 bg-yellow-800/50" };
    if(score >= 21) return { text: "هداف الفريق 🥈", color: "text-gray-300 bg-gray-700/50" };
    return { text: "لاعب ناشئ 🥉", color: "text-orange-400 bg-orange-900/50" };
}

window.addEventListener('load', () => {
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    if (typeof firebase === 'undefined') return console.error("Firebase is missing!");
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();

    const savedUser = localStorage.getItem('currentUser');
    if(!savedUser) {
        user = { id: "test_user_1", name: "زائر تجريبي", group: "مجموعة 1", team: "فريق أ" };
        db.collection("users").doc(user.id).set({ name: user.name, group: user.group, score: 0, streak: 0, isEliminated: false }, { merge: true });
    } else {
        user = JSON.parse(savedUser);
    }

    if(document.getElementById('p-name')) document.getElementById('p-name').innerText = user.name;
    initFirebaseData(); 
});

// ==========================================
// 4. جلب البيانات من Firestore
// ==========================================
function initFirebaseData() {
    if(!user || !user.id) return;
    
    db.collection("users").doc(user.id).onSnapshot(doc => {
        if(doc.exists) {
            let d = doc.data();
            currentStreak = d.streak || 0;
            isEliminatedPlayer = d.isEliminated || false;
            let rank = getRankInfo(d.score || 0);

            if(document.getElementById('p-score')) document.getElementById('p-score').innerText = d.score || 0;
            let elStreak = document.getElementById('p-streak');
            if(elStreak) { elStreak.innerText = `🔥 ${currentStreak}`; elStreak.classList.remove('hidden'); }

            let elRank = document.getElementById('p-rank'), elGroup = document.getElementById('p-group');
            if(isEliminatedPlayer) {
                if(elGroup) { elGroup.innerHTML = '<i class="fas fa-ban"></i> مقصى'; elGroup.className = 'text-red-400 font-bold bg-red-900/40 px-2 py-0.5 rounded text-[10px] border border-red-700'; }
                if(elRank) elRank.classList.add('hidden');
            } else {
                if(elGroup) { elGroup.innerText = `${d.group || user.group}`; elGroup.className = 'text-yellow-400 font-bold bg-gray-800 px-2 py-0.5 rounded text-[10px] border border-gray-600'; }
                if(elRank) { elRank.innerText = rank.text; elRank.className = `font-bold text-[10px] px-2 py-0.5 rounded border border-gray-600 ${rank.color}`; elRank.classList.remove('hidden'); }
            }
        }
    });

    db.collection("settings").doc("global_status").onSnapshot(doc => {
        if(doc.exists) { adminDay = doc.data().currentDay || 1; adminStatus = doc.data().status || "closed"; updateLogs(); }
    });
}

function updateLogs() {
    if(logsUnsubscribe) logsUnsubscribe();
    logsUnsubscribe = db.collection("users").doc(user.id).collection("game_logs").onSnapshot(snap => {
        myLogs = {};
        snap.forEach(d => myLogs[d.id.replace('day_', '')] = d.data().score);
        renderMap();
        let pText = document.getElementById('progress-text'), pBar = document.getElementById('progress-bar');
        if(pText) pText.innerText = `${Object.keys(myLogs).length} / 29 جولة`;
        if(pBar) pBar.style.width = `${(Object.keys(myLogs).length/29)*100}%`;
    });
}

function renderMap() {
    let container = document.getElementById('view-arena');
    if(!container) return;
    let html = '';
    for (let i = 1; i <= 29; i++) {
        let isPlayed = myLogs[i] !== undefined, isActive = (i === adminDay && adminStatus === 'active'), isSoon = (i === adminDay && adminStatus === 'soon'); 
        if (isPlayed) html += `<div class="glass-card p-5 rounded-2xl flex justify-between opacity-80 border-r-4 border-r-green-500 mb-4 transition-all"><div class="flex items-center gap-4"><div class="bg-green-500/20 text-green-400 w-12 h-12 rounded-full flex justify-center items-center shadow-inner"><i class="fas fa-check"></i></div><div><p class="font-bold text-gray-300">الجولة ${i}</p></div></div><p class="font-black text-2xl text-green-400 drop-shadow-md">${myLogs[i]}</p></div>`;
        else if (isActive) html += `<div onclick="openQuiz(${i})" class="day-active p-6 rounded-2xl flex justify-between mb-4 shadow-[0_0_20px_rgba(212,175,55,0.2)] cursor-pointer hover:scale-[1.02] transition-transform"><div class="flex items-center gap-4"><div class="bg-gradient-to-br from-yellow-400 to-yellow-600 w-14 h-14 rounded-full flex justify-center items-center text-black shadow-lg"><i class="fas fa-play text-xl ml-1"></i></div><div><p class="font-black text-white text-xl drop-shadow-md">الجولة ${i}</p><p class="text-xs text-yellow-400 font-bold mt-1">العب الآن!</p></div></div><i class="fas fa-chevron-left text-yellow-500 text-3xl opacity-40"></i></div>`;
        else if (isSoon) html += `<div class="glass-card p-6 rounded-2xl flex justify-between mb-4 border border-blue-500/30"><div class="flex items-center gap-4"><div class="bg-blue-900/50 text-blue-400 w-14 h-14 rounded-full flex justify-center items-center shadow-inner"><i class="fas fa-hourglass-half text-2xl animate-pulse"></i></div><div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-blue-400 font-bold mt-1">تفتح قريباً ⏳</p></div></div></div>`;
        else html += `<div class="glass-card p-5 rounded-2xl flex items-center gap-4 opacity-40 mb-4 grayscale"><div class="bg-gray-800 text-gray-500 w-12 h-12 rounded-full flex justify-center items-center shadow-inner"><i class="fas fa-lock text-sm"></i></div><p class="font-bold text-sm text-gray-500">الجولة ${i}</p></div>`;
    }
    container.innerHTML = html;
}

// ==========================================
// 5. نظام الكويز واللعب
// ==========================================
window.openQuiz = function(day) {
    if (myLogs[day] !== undefined) return alert("لعبت الجولة دي قبل كدة!");
    let overlay = document.getElementById('quiz-overlay');
    overlay.style.display = 'flex';
    overlay.className = "fixed inset-0 z-[99999] bg-black/95 flex flex-col overflow-y-auto";

    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center relative z-10 p-4 mt-6 w-full max-w-md mx-auto">
            <h2 class="text-2xl font-black text-white mb-2">الجولة ${day} 🔥</h2>
            <div class="bg-red-900/50 border border-red-500 p-3 rounded-xl mb-6">
                <p class="text-red-200 text-xs font-bold leading-relaxed">⚠️ تحذير هام: بمجرد الدخول ممنوع تبديل الشاشة، أو قفل الموبايل، أو الرجوع للخلف. أي محاولة ستؤدي للطرد الفوري وحفظ نتيجتك الحالية فقط!</p>
            </div>
            <div class="flex gap-3">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-black font-black p-3 rounded-xl shadow-lg">ابدأ التحدي ⚔️</button>
                <button onclick="closeQuizOverlay()" class="flex-1 bg-gray-800 text-white font-bold p-3 rounded-xl border border-gray-600">إغلاق ✋</button>
            </div>
        </div>`;
}

window.startQuizFetch = function(day) {
    // محاولة فتح الكويز في وضع الشاشة الكاملة
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});

    isQuizActive = true; used5050 = false; usedFreeze = false; cheatWarnings = 0;
    
    // تأمين الـ History
    window.history.pushState(null, null, window.location.href);

    document.getElementById('quiz-content').innerHTML = `<div class="flex flex-col items-center py-10"><div class="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div><p class="font-bold text-yellow-500">جاري تجهيز ساحة المعركة...</p></div>`;

    db.collection("quizzes_pool").doc("day_" + day).get().then(doc => {
        if(doc.exists && doc.data().variations) {
            let variations = doc.data().variations;
            let keys = Object.keys(variations);
            currentQuestions = variations[keys[Math.floor(Math.random() * keys.length)]].questions;
            currentIndex = 0; sessionScore = 0;
            showQuestion();
        } else { throw new Error(); }
    }).catch(() => {
        alert("خطأ في تحميل الأسئلة."); closeQuizOverlay();
    });
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) return endQuiz();
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 20;
    
    // تم إضافة pt-28 و mt-8 لتنزيل الكويز بعيد عن الإعلانات العائمة اللي فوق
    document.getElementById('quiz-content').innerHTML = `
        <div class="w-full max-w-md mx-auto px-3 pb-6 pt-28 mt-8 relative">
            
            <div class="flex justify-between items-center mb-5 border-b border-gray-700/50 pb-3">
                <div class="bg-gray-800 border border-gray-600 px-3 py-1 rounded-full"><span class="text-xs text-gray-300 font-bold">سؤال <span class="text-yellow-400">${currentIndex+1}</span> / ${currentQuestions.length}</span></div>
                <div class="bg-gray-800 border border-gray-600 px-3 py-1 rounded-full"><span class="text-xs text-gray-300 font-bold">نقاط: <span class="text-yellow-400">${sessionScore}</span></span></div>
            </div>

            <div class="glass-card p-5 rounded-3xl mb-5 text-center relative border border-yellow-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                <div class="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gray-900 border-2 border-yellow-500 rounded-full w-14 h-14 flex items-center justify-center shadow-[0_0_15px_rgba(255,215,0,0.4)]">
                    <span id="timer" class="text-white font-black text-xl">${globalTimeLeft}</span>
                </div>
                <h3 class="text-base md:text-lg font-bold text-white mt-4 leading-relaxed">${q.q}</h3>
            </div>
            
            <div class="space-y-3" id="options-container">
                ${q.options.map((opt, i) => `
                    <button onclick="handleAnswer(${i})" class="relative overflow-hidden rounded-2xl border border-gray-600 bg-gray-800/95 p-3.5 w-full text-right transition-transform active:scale-95 shadow-md" id="opt-${i}">
                        <span class="text-sm md:text-base font-bold text-gray-200 block pr-2">${opt}</span>
                    </button>
                `).join('')}
            </div>
            
            <div class="flex justify-between mt-6 gap-3">
                <button id="btn-5050" onclick="use5050()" class="flex-1 bg-gray-800 p-3 rounded-xl border border-purple-500/50 text-xs font-bold text-white shadow-lg ${used5050?'opacity-40 grayscale':''}"><i class="fas fa-cut mr-1 text-purple-400"></i> إجابتين</button>
                <button id="btn-freeze" onclick="useFreeze()" class="flex-1 bg-gray-800 p-3 rounded-xl border border-blue-500/50 text-xs font-bold text-white shadow-lg ${usedFreeze?'opacity-40 grayscale':''}"><i class="fas fa-snowflake mr-1 text-blue-400"></i> تجميد</button>
            </div>
        </div>
    `;
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        globalTimeLeft--;
        let tEl = document.getElementById('timer');
        if(tEl) {
            tEl.innerText = globalTimeLeft;
            if(globalTimeLeft <= 5) {
                tEl.parentElement.classList.replace('border-yellow-500', 'border-red-500');
                tEl.classList.add('text-red-500', 'animate-pulse');
            }
        }
        if(globalTimeLeft <= 0) handleAnswer(-1);
    }, 1000);
}

window.handleAnswer = function(idx) {
    if (!isQuizActive) return;
    clearInterval(timerInterval);
    document.getElementById('options-container').style.pointerEvents = 'none';
    let q = currentQuestions[currentIndex];
    
    if(idx === q.correctIndex) {
        sessionScore += 1; vibratePhone(100);
        document.getElementById(`opt-${idx}`).className = 'relative overflow-hidden rounded-2xl border-2 border-green-500 bg-green-600/40 p-3.5 w-full text-right';
    } else {
        vibratePhone([100, 50, 100]);
        if(idx !== -1) document.getElementById(`opt-${idx}`).className = 'relative overflow-hidden rounded-2xl border-2 border-red-500 bg-red-600/40 p-3.5 w-full text-right';
        document.getElementById(`opt-${q.correctIndex}`).className = 'relative overflow-hidden rounded-2xl border-2 border-green-500 bg-green-600/40 p-3.5 w-full text-right';
    }
    currentIndex++;
    setTimeout(showQuestion, 1200); 
}

window.use5050 = function() {
    if(used5050 || !isQuizActive) return;
    used5050 = true; document.getElementById('btn-5050').classList.add('opacity-40', 'grayscale');
    let correct = currentQuestions[currentIndex].correctIndex, removed = 0;
    for(let i=0; i<4; i++) {
        if(i !== correct && removed < 2) { document.getElementById(`opt-${i}`).style.opacity = '0.2'; removed++; }
    }
}

window.useFreeze = function() {
    if(usedFreeze || !isQuizActive) return;
    usedFreeze = true; document.getElementById('btn-freeze').classList.add('opacity-40', 'grayscale');
    globalTimeLeft += 15; 
    let tEl = document.getElementById('timer');
    tEl.innerText = globalTimeLeft;
    tEl.parentElement.classList.replace('border-red-500', 'border-yellow-500');
    tEl.classList.remove('text-red-500', 'animate-pulse');
}

// ==========================================
// 6. دوال الإنهاء والحفظ
// ==========================================
window.endQuiz = function(forceExit = false, customMessage = null) {
    if (!isQuizActive && !forceExit) return;
    isQuizActive = false; 
    clearInterval(timerInterval);
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});

    let displayMessage = customMessage || "تم إنهاء الجولة بنجاح! 🎉";
    let colorClass = customMessage ? "text-red-500" : "text-green-500";
    let iconClass = customMessage ? "fa-ban text-red-500" : "fa-check text-green-500";

    document.getElementById('quiz-content').innerHTML = `
        <div class="py-10 text-center flex flex-col items-center justify-center h-full mt-20">
            <div class="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4 border-2 border-gray-600">
                <i class="fas ${iconClass} text-4xl"></i>
            </div>
            <h2 class="text-xl font-black ${colorClass} mb-4">${displayMessage}</h2>
            <p class="text-white font-bold text-lg bg-gray-800 px-6 py-2 rounded-xl border border-gray-600">نقاطك: <span class="text-yellow-400 font-black">${sessionScore}</span></p>
            <p class="text-xs text-gray-500 mt-6 animate-pulse">جاري حفظ النتيجة...</p>
        </div>`;

    db.collection("users").doc(user.id).collection("game_logs").doc("day_" + adminDay).set({
        day: adminDay, score: sessionScore, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => db.collection("users").doc(user.id).update({ score: firebase.firestore.FieldValue.increment(sessionScore) }))
      .then(() => setTimeout(closeQuizOverlay, 3000))
      .catch(() => { alert("خطأ في حفظ النتيجة!"); closeQuizOverlay(); });
}

window.closeQuizOverlay = function() { 
    document.getElementById('quiz-overlay').style.display = 'none'; 
    isQuizActive = false; 
    clearInterval(timerInterval); 
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
}

// ==========================================
// 7. دوال الواجهة والتبويبات
// ==========================================
window.showTab = function(tabName) {
    document.getElementById('view-arena').style.display = tabName === 'arena' ? 'block' : 'none';
    document.getElementById('view-leaderboard').style.display = tabName === 'leaderboard' ? 'block' : 'none';
    document.getElementById('btn-arena').classList.toggle('active', tabName === 'arena');
    document.getElementById('btn-leader').classList.toggle('active', tabName === 'leaderboard');
    if(tabName === 'leaderboard') renderLeaderboard();
}

window.renderLeaderboard = function() {
    let container = document.getElementById('group-list');
    if(!container) return;
    if(user && user.group) {
        container.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-yellow-500 text-2xl"></i></div>';
        db.collection("users").where("group", "==", user.group).orderBy("score", "desc").limit(20).get()
        .then(snap => {
            let html = '', rank = 1;
            snap.forEach(doc => {
                let d = doc.data(), isMe = doc.id === user.id;
                let rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `<span class="text-gray-400 font-bold">${rank}</span>`;
                html += `
                <div class="flex items-center justify-between p-3 rounded-xl mb-2 ${isMe ? 'bg-yellow-900/40 border border-yellow-500' : 'bg-gray-800 border border-gray-700'}">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center">${rankIcon}</div>
                        <p class="font-bold text-sm ${d.isCheater ? 'text-red-500 line-through' : (isMe ? 'text-yellow-400' : 'text-gray-200')}">${d.name} ${d.isCheater ? '🚩' : ''}</p>
                    </div>
                    <p class="font-black ${isMe ? 'text-yellow-400' : 'text-white'}">${d.score}</p>
                </div>`;
                rank++;
            });
            container.innerHTML = html || '<p class="text-center text-gray-400 text-sm">لا يوجد لاعبين</p>';
        });
    }
}

window.logoutUser = function() {
    if(confirm("متأكد إنك عايز تخرج؟")) { localStorage.removeItem('currentUser'); window.location.reload(); }
}

window.closeChampPopup = function() {
    let popup = document.getElementById('champ-flying-popup');
    if(popup) {
        popup.style.opacity = '0';
        popup.style.transform = 'translate(-50%, -40px)';
        setTimeout(() => popup.style.display = 'none', 700);
    }
}
