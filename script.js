// 1. الإعدادات الأساسية
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

// 3. بدء التشغيل
window.addEventListener('load', () => {
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    if (typeof firebase === 'undefined') {
        console.error("لم يتم العثور على مكتبات Firebase! تأكد من تضمينها في ملف HTML.");
        return;
    }

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();

    const savedUser = localStorage.getItem('currentUser');
    if(!savedUser) {
        console.warn("لا يوجد مستخدم مسجل. تم إنشاء مستخدم تجريبي للاختبار.");
        user = { id: "test_user_1", name: "زائر تجريبي", group: "مجموعة 1", team: "فريق أ" };
        
        // إنشاء المستخدم تجريبياً في DB لتجنب الأخطاء
        db.collection("users").doc(user.id).set({
            name: user.name, group: user.group, team: user.team, score: 0, streak: 0, isEliminated: false
        }, { merge: true });

    } else {
        user = JSON.parse(savedUser);
    }

    if(document.getElementById('p-name')) document.getElementById('p-name').innerText = user.name;
    initFirebaseData(); 
});

// 4. جلب البيانات من Firestore
function initFirebaseData() {
    if(!user || !user.id) return;

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
        snap.forEach(d => myLogs[d.id.replace('day_', '')] = d.data().score);
        renderMap();
        
        let pText = document.getElementById('progress-text');
        let pBar = document.getElementById('progress-bar');
        if(pText) pText.innerText = `${Object.keys(myLogs).length} / 29 جولة`;
        if(pBar) pBar.style.width = `${(Object.keys(myLogs).length/29)*100}%`;
    });
}

// 5. بناء واجهة الخريطة
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
            html += `<div onclick="openQuiz(${i})" class="day-active p-6 rounded-2xl flex justify-between mb-4 shadow-[0_0_20px_rgba(212,175,55,0.2)] cursor-pointer hover:scale-[1.02] transition-transform">
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

// 6. نظام المسابقة والكويز
document.addEventListener("visibilitychange", () => {
    if (document.hidden && isQuizActive) {
        alert("تم اكتشاف محاولة خروج أو تصوير! تم إنهاء الجولة وحفظ نتيجتك.");
        endQuiz(true);
    }
});

window.openQuiz = function(day) {
    if (myLogs[day] !== undefined) return alert("لعبت الجولة دي قبل كدة!");
    
    let overlay = document.getElementById('quiz-overlay');
    overlay.style.display = 'flex';
    overlay.className = "fixed inset-0 z-[99999] bg-black/95 flex flex-col overflow-y-auto";

    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center relative z-10 p-4 mt-6 w-full max-w-md mx-auto">
            <h2 class="text-2xl font-black text-white mb-2 drop-shadow-lg">الجولة ${day} 🔥</h2>
            <p class="text-gray-300 text-sm mb-6 leading-relaxed px-2">بمجرد دخولك سيبدأ التحدي.<br>أي محاولة للخروج ستحفظ نتيجتك الحالية فقط!</p>
            <div class="flex gap-3">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-black font-black p-3 rounded-xl">ابدأ ⚔️</button>
                <button onclick="closeQuizOverlay()" class="flex-1 bg-gray-800 text-white font-bold p-3 rounded-xl border border-gray-600">إغلاق ✋</button>
            </div>
        </div>`;
}

window.startQuizFetch = function(day) {
    isQuizActive = true; used5050 = false; usedFreeze = false;
    document.getElementById('quiz-content').innerHTML = `<div class="flex flex-col items-center py-10"><p class="font-bold text-yellow-500 animate-pulse">جاري تجهيز ساحة المعركة...</p></div>`;

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
        alert("خطأ في تحميل الأسئلة.");
        closeQuizOverlay();
    });
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) return endQuiz();
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 20;
    
    document.getElementById('quiz-content').innerHTML = `
        <div class="w-full max-w-md mx-auto px-3 pb-6">
            <div class="flex justify-between items-center mb-4">
                <div class="bg-gray-800/80 border border-gray-700/50 px-3 py-1 rounded-full"><span class="text-xs text-gray-300 font-bold">سؤال <span class="text-yellow-400">${currentIndex+1}</span> / ${currentQuestions.length}</span></div>
                <div class="bg-gray-800/80 border border-gray-700/50 px-3 py-1 rounded-full"><span class="text-xs text-gray-300 font-bold">نقاط: <span class="text-yellow-400">${sessionScore}</span></span></div>
                <button onclick="promptExitQuiz()" class="bg-red-900/50 border border-red-700/50 px-3 py-1 rounded-full text-xs text-red-300 font-bold">خروج</button>
            </div>

            <div class="glass-card p-4 rounded-2xl mb-4 text-center">
                <span id="timer" class="text-white font-black text-2xl bg-gray-900 border-2 border-red-500/80 px-4 py-1 rounded-xl mb-3 w-16 text-center inline-block">${globalTimeLeft}</span>
                <h3 class="text-lg font-bold text-white mt-2">${q.q}</h3>
            </div>
            
            <div class="space-y-2" id="options-container">
                ${q.options.map((opt, i) => `
                    <button onclick="handleAnswer(${i})" class="opt-btn relative group rounded-xl border border-gray-600 bg-gray-800/90 p-3 w-full text-right" id="opt-${i}">
                        <span class="text-sm font-bold text-gray-200">${opt}</span>
                    </button>
                `).join('')}
            </div>
            
            <div class="flex justify-between mt-5 gap-3">
                <button id="btn-5050" onclick="use5050()" class="flex-1 bg-gray-900 p-2 rounded-md border border-purple-500 text-xs font-bold text-gray-200 ${used5050?'opacity-40':''}">إجابتين</button>
                <button id="btn-freeze" onclick="useFreeze()" class="flex-1 bg-gray-900 p-2 rounded-md border border-blue-500 text-xs font-bold text-gray-200 ${usedFreeze?'opacity-40':''}">تجميد</button>
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
        if(tEl) tEl.innerText = globalTimeLeft;
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
        document.getElementById(`opt-${idx}`).classList.add('bg-green-600/50', 'border-green-500');
    } else {
        vibratePhone([100, 50, 100]);
        if(idx !== -1) document.getElementById(`opt-${idx}`).classList.add('bg-red-600/50', 'border-red-500');
        document.getElementById(`opt-${q.correctIndex}`).classList.add('bg-green-600/50', 'border-green-500');
    }
    currentIndex++;
    setTimeout(showQuestion, 1200); 
}

window.use5050 = function() {
    if(used5050 || !isQuizActive) return;
    used5050 = true; document.getElementById('btn-5050').classList.add('opacity-40');
    let correct = currentQuestions[currentIndex].correctIndex, removed = 0;
    for(let i=0; i<4; i++) {
        if(i !== correct && removed < 2) { document.getElementById(`opt-${i}`).style.opacity = '0.2'; removed++; }
    }
}

window.useFreeze = function() {
    if(usedFreeze || !isQuizActive) return;
    usedFreeze = true; document.getElementById('btn-freeze').classList.add('opacity-40');
    globalTimeLeft += 15; document.getElementById('timer').innerText = globalTimeLeft;
}

window.promptExitQuiz = function() {
    clearInterval(timerInterval);
    let html = `
        <div id="exit-modal" class="fixed inset-0 z-[100000] flex items-center justify-center bg-black/90 p-4">
            <div class="bg-gray-800 p-6 rounded-2xl border border-red-500/50 text-center w-full max-w-sm">
                <h3 class="text-xl font-bold text-white mb-2">متأكد إنك عايز تنسحب؟</h3>
                <p class="text-xs text-gray-400 mb-6">سيتم حفظ (${sessionScore} نقاط)</p>
                <div class="flex gap-3">
                    <button onclick="confirmExitQuiz()" class="flex-1 bg-red-600 text-white font-bold py-2 rounded-xl">انسحاب</button>
                    <button onclick="closeExitModal()" class="flex-1 bg-gray-600 text-white font-bold py-2 rounded-xl">تراجع</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

window.closeExitModal = function() { document.getElementById('exit-modal').remove(); startTimer(); }
window.confirmExitQuiz = function() { document.getElementById('exit-modal').remove(); endQuiz(true); }

window.endQuiz = function(forceExit = false) {
    if (!isQuizActive) return;
    isQuizActive = false; clearInterval(timerInterval);
    document.getElementById('quiz-content').innerHTML = `<div class="py-10 text-center"><h2 class="text-2xl font-black text-white">تم الإنهاء!</h2><p class="text-yellow-400 font-bold">${sessionScore} نقطة</p></div>`;

    db.collection("users").doc(user.id).collection("game_logs").doc("day_" + adminDay).set({
        day: adminDay, score: sessionScore, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => db.collection("users").doc(user.id).update({ score: firebase.firestore.FieldValue.increment(sessionScore) }))
      .then(() => setTimeout(closeQuizOverlay, 2000))
      .catch(() => { alert("خطأ في الحفظ"); closeQuizOverlay(); });
}

window.closeQuizOverlay = function() { document.getElementById('quiz-overlay').style.display = 'none'; isQuizActive = false; clearInterval(timerInterval); }

// ==========================================
// 8. دوال الواجهة (اللي كانت مفقودة في HTML)
// ==========================================

window.showTab = function(tabName) {
    // إخفاء/إظهار المحتوى
    document.getElementById('view-arena').style.display = tabName === 'arena' ? 'block' : 'none';
    document.getElementById('view-leaderboard').style.display = tabName === 'leaderboard' ? 'block' : 'none';
    
    // تفعيل/إلغاء تفعيل شكل الأزرار
    document.getElementById('btn-arena').classList.toggle('active', tabName === 'arena');
    document.getElementById('btn-leader').classList.toggle('active', tabName === 'leaderboard');

    // لو فتحنا المجموعة، نجيب الترتيب
    if(tabName === 'leaderboard') {
        renderLeaderboard();
    }
}

window.renderLeaderboard = function() {
    let container = document.getElementById('group-list');
    if(!container) return;
    
    if(user && user.group) {
        container.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-yellow-500 text-2xl"></i><p class="text-gray-400 text-xs mt-2">جاري جلب ترتيب الأبطال...</p></div>';
        
        db.collection("users").where("group", "==", user.group).orderBy("score", "desc").limit(20).get()
        .then(snap => {
            let html = '';
            let rank = 1;
            snap.forEach(doc => {
                let d = doc.data();
                let isMe = doc.id === user.id;
                let rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `<span class="text-gray-400 font-bold">${rank}</span>`;
                
                html += `
                <div class="flex items-center justify-between p-3 rounded-xl mb-2 ${isMe ? 'bg-yellow-900/40 border border-yellow-500/50 shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'bg-gray-800/50 border border-gray-700'}">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center border border-gray-700">${rankIcon}</div>
                        <p class="font-bold ${isMe ? 'text-yellow-400' : 'text-gray-200'} text-sm">${d.name}</p>
                    </div>
                    <p class="font-black text-lg ${isMe ? 'text-yellow-400' : 'text-white'}">${d.score}</p>
                </div>`;
                rank++;
            });
            container.innerHTML = html || '<p class="text-center text-gray-400 text-sm">لا يوجد لاعبين في هذه المجموعة حتى الآن.</p>';
        }).catch(err => {
            console.error("Leaderboard Error:", err);
            container.innerHTML = '<p class="text-center text-red-400 text-sm">حدث خطأ أثناء جلب الترتيب. تأكد من إعدادات قاعدة البيانات.</p>';
        });
    }
}

window.logoutUser = function() {
    if(confirm("هل أنت متأكد أنك تريد الخروج من حسابك؟")) {
        localStorage.removeItem('currentUser');
        window.location.reload(); 
    }
}

window.closeChampPopup = function() {
    let popup = document.getElementById('champ-flying-popup');
    if(popup) {
        popup.style.opacity = '0';
        popup.style.transform = 'translate(-50%, -40px)';
        setTimeout(() => popup.style.display = 'none', 700);
    }
}
