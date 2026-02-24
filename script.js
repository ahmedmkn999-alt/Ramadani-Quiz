// 1. الإعدادات الأساسية
const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
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

let used5050 = false;
let usedFreeze = false;
let currentStreak = 0;

// 2. دوال مساعدة
function vibratePhone(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

function getRankInfo(score) {
    if(score >= 101) return { text: "أسطورة رمضان 👑", color: "text-yellow-400 bg-yellow-900/50" };
    if(score >= 51) return { text: "كابتن الملعب 🥇", color: "text-yellow-300 bg-yellow-800/50" };
    if(score >= 21) return { text: "هداف الفريق 🥈", color: "text-gray-300 bg-gray-700/50" };
    return { text: "لاعب ناشئ 🥉", color: "text-orange-400 bg-orange-900/50" };
}

// 3. بدء التشغيل (تم إصلاح التوقيت والربط)
window.addEventListener('DOMContentLoaded', () => {
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    try {
        const savedUser = localStorage.getItem('currentUser');
        if(!savedUser) return console.warn("No user in localStorage");
        user = JSON.parse(savedUser);

        // عرض سريع للبيانات من الذاكرة
        if(document.getElementById('p-name')) document.getElementById('p-name').innerText = user.name;
        let elGroup = document.getElementById('p-group');
        if(elGroup) {
            elGroup.innerText = (user.group || "") + " | " + (user.team || "");
            elGroup.classList.remove('hidden');
        }

        // تشغيل Firebase
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            initFirebaseData(); // جلب البيانات الحية
        } else {
            console.error("Firebase SDK not found!");
        }

    } catch(e) { 
        console.error("Initialization Error:", e);
    }
});

// 4. جلب البيانات من Firestore
function initFirebaseData() {
    if(!user || !user.id) return;

    // مراقبة بيانات المستخدم (سكور، استريك، إقصاء)
    db.collection("users").doc(user.id).onSnapshot(doc => {
        if(doc.exists) {
            let d = doc.data();
            let pScore = d.score || 0;
            currentStreak = d.streak || 0;
            isEliminatedPlayer = d.isEliminated || false;
            let rank = getRankInfo(pScore);

            if(document.getElementById('p-score')) document.getElementById('p-score').innerText = pScore;
            
            let elStreak = document.getElementById('p-streak');
            if(elStreak) {
                elStreak.innerText = `🔥 ${currentStreak}`;
                elStreak.classList.remove('hidden');
            }

            let elRank = document.getElementById('p-rank');
            let elGroup = document.getElementById('p-group');

            if(isEliminatedPlayer) {
                if(elGroup) {
                    elGroup.innerHTML = '<i class="fas fa-ban"></i> مقصى';
                    elGroup.className = 'text-red-400 font-bold bg-red-900/40 px-2 py-0.5 rounded text-[10px] border border-red-700';
                }
                if(elRank) elRank.classList.add('hidden');
            } else {
                if(elGroup) {
                    elGroup.innerText = `${d.group || user.group} | ${d.team || user.team}`;
                    elGroup.className = 'text-yellow-400 font-bold bg-gray-800 px-2 py-0.5 rounded text-[10px] border border-gray-600';
                }
                if(elRank) {
                    elRank.innerText = rank.text;
                    elRank.className = `font-bold text-[10px] px-2 py-0.5 rounded border border-gray-600 ${rank.color}`;
                    elRank.classList.remove('hidden');
                }
            }
        }
    });

    // مراقبة حالة اليوم المفتوح
    db.collection("settings").doc("global_status").onSnapshot(doc => {
        if(doc.exists) {
            adminDay = doc.data().currentDay || 1;
            adminStatus = doc.data().status || "closed";
            updateLogs();
        }
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

// 5. بناء واجهة الخريطة (الساحة)
function renderMap() {
    let container = document.getElementById('view-arena');
    if(!container) return;
    let html = '';
    for (let i = 1; i <= 29; i++) {
        let isPlayed = myLogs[i] !== undefined;
        let isActive = (i === adminDay && adminStatus === 'active');
        let isSoon = (i === adminDay && adminStatus === 'soon'); 
        
        if (isPlayed) {
            html += `<div class="glass-card p-5 rounded-2xl flex justify-between opacity-80 border-r-4 border-r-green-500 mb-4">
                <div class="flex items-center gap-4">
                    <div class="bg-green-500/20 text-green-400 w-12 h-12 rounded-full flex justify-center items-center"><i class="fas fa-check"></i></div>
                    <p class="font-bold text-gray-300">الجولة ${i}</p>
                </div>
                <p class="font-black text-2xl text-green-400">${myLogs[i]}</p>
            </div>`;
        } else if (isActive) {
            html += `<div onclick="openQuiz(${i})" class="day-active p-6 rounded-2xl flex justify-between mb-4 shadow-lg cursor-pointer">
                <div class="flex items-center gap-4">
                    <div class="bg-yellow-500 text-black w-14 h-14 rounded-full flex justify-center items-center shadow-lg"><i class="fas fa-play ml-1"></i></div>
                    <div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-yellow-400 font-bold">العب الآن!</p></div>
                </div>
                <i class="fas fa-chevron-left text-yellow-500 text-3xl opacity-40"></i>
            </div>`;
        } else if (isSoon) {
            html += `<div class="glass-card p-6 rounded-2xl flex justify-between mb-4 border border-blue-500/30">
                <div class="flex items-center gap-4">
                    <div class="bg-blue-900/50 text-blue-400 w-14 h-14 rounded-full flex justify-center items-center"><i class="fas fa-hourglass-half animate-pulse"></i></div>
                    <div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-blue-400 font-bold">قريباً ⏳</p></div>
                </div>
            </div>`;
        } else {
            html += `<div class="glass-card p-5 rounded-2xl flex items-center gap-4 opacity-40 mb-4">
                <div class="bg-gray-800 text-gray-500 w-12 h-12 rounded-full flex justify-center items-center"><i class="fas fa-lock text-sm"></i></div>
                <p class="font-bold text-sm text-gray-500">الجولة ${i}</p>
            </div>`;
        }
    }
    container.innerHTML = html;
}

// 6. نظام المسابقة
window.openQuiz = function(day) {
    if (myLogs[day] !== undefined) return alert("لعبت الجولة دي قبل كدة!");
    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center p-6">
            <h2 class="text-2xl font-black text-white mb-4">الجولة ${day} ⚔️</h2>
            <p class="text-gray-300 mb-6">مستعد تبدأ التحدي؟</p>
            <div class="flex gap-4">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-green-600 text-black font-black p-3 rounded-xl">ابدأ</button>
                <button onclick="closeQuizOverlay()" class="flex-1 bg-gray-700 text-white p-3 rounded-xl">إغلاق</button>
            </div>
        </div>`;
}

window.startQuizFetch = function(day) {
    isQuizActive = true;
    used5050 = false; usedFreeze = false;
    document.getElementById('quiz-content').innerHTML = `<p class="text-yellow-500">جاري التحميل...</p>`;

    db.collection("quizzes_pool").doc("day_" + day).get().then(doc => {
        if(doc.exists && doc.data().variations) {
            let variations = doc.data().variations;
            let keys = Object.keys(variations);
            currentQuestions = variations[keys[Math.floor(Math.random() * keys.length)]].questions;
            currentIndex = 0; sessionScore = 0;
            showQuestion();
        } else {
            throw new Error();
        }
    }).catch(() => {
        alert("خطأ في تحميل الأسئلة");
        closeQuizOverlay();
    });
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) return endQuiz();
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 20;
    
    document.getElementById('quiz-content').innerHTML = `
        <div class="p-4">
            <div class="flex justify-between text-sm mb-4">
                <span>سؤال: ${currentIndex+1}/${currentQuestions.length}</span>
                <span id="timer" class="font-bold text-xl text-red-500">${globalTimeLeft}</span>
                <span>نقاط: ${sessionScore}</span>
            </div>
            <h3 class="text-xl font-bold text-center mb-6">${q.q}</h3>
            <div class="grid gap-3">
                ${q.options.map((opt, i) => `
                    <button onclick="handleAnswer(${i})" id="opt-${i}" class="bg-gray-800 p-4 rounded-xl text-right border border-gray-700 hover:border-yellow-500">${opt}</button>
                `).join('')}
            </div>
            <div class="flex gap-2 mt-6">
                <button onclick="use5050()" id="btn-5050" class="flex-1 bg-purple-900/50 p-2 rounded text-xs border border-purple-500">حذف إجابتين</button>
                <button onclick="useFreeze()" id="btn-freeze" class="flex-1 bg-blue-900/50 p-2 rounded text-xs border border-blue-500">تجميد الوقت</button>
            </div>
        </div>`;

    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        globalTimeLeft--;
        let tEl = document.getElementById('timer');
        if(tEl) tEl.innerText = globalTimeLeft;
        if(globalTimeLeft <= 0) handleAnswer(-1);
    }, 1000);
}

window.handleAnswer = function(idx) {
    clearInterval(timerInterval);
    let q = currentQuestions[currentIndex];
    if(idx === q.correctIndex) {
        sessionScore += 10;
        vibratePhone(100);
    } else {
        vibratePhone([100, 50, 100]);
    }
    
    currentIndex++;
    setTimeout(showQuestion, 500);
}

window.use5050 = function() {
    if(used5050) return;
    used5050 = true;
    document.getElementById('btn-5050').style.opacity = '0.3';
    let correct = currentQuestions[currentIndex].correctIndex;
    let removed = 0;
    for(let i=0; i<4; i++) {
        if(i !== correct && removed < 2) {
            let el = document.getElementById(`opt-${i}`);
            if(el) el.style.visibility = 'hidden';
            removed++;
        }
    }
}

window.useFreeze = function() {
    if(usedFreeze) return;
    usedFreeze = true;
    document.getElementById('btn-freeze').style.opacity = '0.3';
    globalTimeLeft += 15;
}

function endQuiz() {
    isQuizActive = false;
    document.getElementById('quiz-content').innerHTML = `<div class="text-center p-10"><p>انتهى التحدي! جاري حفظ نقاطك (${sessionScore})...</p></div>`;
    
    // حفظ النتيجة في الداتابيز
    let day = adminDay;
    db.collection("users").doc(user.id).collection("game_logs").doc("day_"+day).set({
        day: day,
        score: sessionScore,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        // تحديث السكور الكلي
        db.collection("users").doc(user.id).update({
            score: firebase.firestore.FieldValue.increment(sessionScore)
        }).then(() => {
            setTimeout(() => location.reload(), 1500);
        });
    });
}

window.closeQuizOverlay = function() {
    if(isQuizActive) return alert("ممنوع الهروب من المعركة!");
    document.getElementById('quiz-overlay').style.display = 'none';
}

// 7. الليدربورد
window.showTab = function(t) {
    document.getElementById('view-arena').classList.toggle('hidden', t !== 'arena');
    document.getElementById('view-leaderboard').classList.toggle('hidden', t !== 'leaderboard');
    if(t === 'leaderboard') fetchLeaderboard();
}

function fetchLeaderboard() {
    db.collection("users").where("group", "==", user.group).orderBy("score", "desc").limit(20).get().then(snap => {
        let html = '';
        snap.forEach((doc, i) => {
            let u = doc.data();
            html += `<div class="flex justify-between p-3 bg-gray-800 rounded-lg mb-2">
                <span>${i+1}. ${u.name}</span>
                <span class="text-yellow-500 font-bold">${u.score || 0}</span>
            </div>`;
        });
        document.getElementById('group-list').innerHTML = html;
    });
}
