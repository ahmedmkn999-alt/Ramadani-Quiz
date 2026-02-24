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

// --- 🎵 مؤثرات اللعبة الصوتية (بالروابط المباشرة بتاعتك) ---
const sfxCorrect = new Audio('https://files.catbox.moe/112l01.m4a');
const sfxWrong = new Audio('https://files.catbox.moe/khm3ue.m4a');
const sfxTick = new Audio('https://files.catbox.moe/epmgt5.m4a');
const sfxWin = new Audio('https://files.catbox.moe/p998o7.m4a');

function playSound(audioObj) {
    try { 
        audioObj.currentTime = 0; 
        audioObj.play().catch(e => console.log("تنبيه: المتصفح يحتاج تفاعل لتشغيل الصوت")); 
    } catch(e){}
}
// -------------------------------------------------------------

function getRankInfo(score) {
    if(score >= 101) return { text: "أسطورة رمضان 👑", color: "text-yellow-400 bg-yellow-900/50" };
    if(score >= 51) return { text: "كابتن الملعب 🥇", color: "text-yellow-300 bg-yellow-800/50" };
    if(score >= 21) return { text: "هداف الفريق 🥈", color: "text-gray-300 bg-gray-700/50" };
    return { text: "لاعب ناشئ 🥉", color: "text-orange-400 bg-orange-900/50" };
}

window.addEventListener('DOMContentLoaded', () => {
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    
    setTimeout(() => {
        try {
            user = JSON.parse(localStorage.getItem('currentUser'));
            if(!user || !user.id) { logoutUser(); return; }
            if (typeof firebase !== 'undefined' && !firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            initFirebaseData();
        } catch(e) { logoutUser(); }
    }, 100);
});

function initFirebaseData() {
    db.collection("users").doc(user.id).onSnapshot(doc => {
        if(doc.exists) {
            let d = doc.data();
            let pScore = d.score || 0;
            currentStreak = d.streak || 0;
            document.getElementById('p-score').innerText = pScore;
            isEliminatedPlayer = d.isEliminated || false;
            
            let rank = getRankInfo(pScore);
            
            document.getElementById('p-name').innerHTML = `<span class="truncate max-w-[120px] inline-block">${d.name}</span> <span class="text-orange-500 text-[11px] bg-orange-900/30 px-1.5 py-0.5 rounded border border-orange-700/50 ml-1">🔥 ${currentStreak}</span>`;
            
            if(isEliminatedPlayer) {
                document.getElementById('p-group').innerHTML = '<span class="text-red-500 font-black text-[10px] bg-red-900/30 px-2 py-0.5 rounded"><i class="fas fa-ban"></i> مقصى (لعب ودي)</span>';
            } else {
                document.getElementById('p-group').innerHTML = `
                    <span class="text-yellow-500 font-bold bg-yellow-900/40 px-2 py-0.5 rounded border border-yellow-700/50 text-[9px]">${d.group} | ${d.team}</span>
                    <span class="font-bold text-[9px] px-2 py-0.5 rounded border border-gray-600 ${rank.color}">${rank.text}</span>
                `;
            }
        }
    });

    db.collection("settings").doc("global_status").onSnapshot(doc => {
        if(doc.exists) {
            adminDay = doc.data().currentDay;
            adminStatus = doc.data().status;
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
        document.getElementById('progress-text').innerText = `${Object.keys(myLogs).length} / 29 جولة`;
        document.getElementById('progress-bar').style.width = `${(Object.keys(myLogs).length/29)*100}%`;
    });
}

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
                    <div class="bg-green-500/20 text-green-400 w-12 h-12 rounded-full flex justify-center items-center"><i class="fas fa-check"></i></div>
                    <div><p class="font-bold text-gray-300">الجولة ${i}</p></div>
                </div>
                <p class="font-black text-2xl text-green-400">${myLogs[i]}</p>
            </div>`;
        } else if (isActive) {
            html += `<div onclick="openQuiz(${i})" class="day-active p-6 rounded-2xl flex justify-between mb-4 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <div class="flex items-center gap-4">
                    <div class="bg-gradient-to-br from-yellow-400 to-yellow-600 w-14 h-14 rounded-full flex justify-center items-center text-black shadow-lg"><i class="fas fa-play text-xl ml-1"></i></div>
                    <div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-yellow-400 font-bold mt-1">العب الآن!</p></div>
                </div>
                <i class="fas fa-chevron-left text-yellow-500 text-3xl opacity-40"></i>
            </div>`;
        } else if (isSoon) {
            html += `<div class="glass-card p-6 rounded-2xl flex justify-between mb-4 border border-blue-500/30">
                <div class="flex items-center gap-4">
                    <div class="bg-blue-900/50 text-blue-400 w-14 h-14 rounded-full flex justify-center items-center"><i class="fas fa-hourglass-half text-2xl animate-pulse"></i></div>
                    <div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-blue-400 font-bold mt-1">تفتح قريباً ⏳</p></div>
                </div>
            </div>`;
        } else {
            html += `<div class="glass-card p-5 rounded-2xl flex items-center gap-4 opacity-40 mb-4 grayscale">
                <div class="bg-gray-800 text-gray-500 w-12 h-12 rounded-full flex justify-center items-center"><i class="fas fa-lock text-sm"></i></div>
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
    db.collection("users").where("group", "==", user.group).get().then(snap => {
        let list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a,b) => (b.score || 0) - (a.score || 0));
        let html = '';
        list.forEach((u, i) => {
            let rank = i + 1;
            let uRank = getRankInfo(u.score || 0);
            html += `<div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl mb-2 border border-gray-700 hover:border-yellow-500/30">
                <div class="flex items-center gap-3">
                    <span class="w-6 text-center font-bold ${rank <= 3 ? 'text-yellow-500 text-lg' : 'text-gray-400'}">${rank}</span>
                    <div>
                        <span class="font-bold block ${u.name === user.name ? 'text-yellow-400' : 'text-white'}">${u.name} <span class="text-orange-500 text-[10px]">🔥 ${u.streak||0}</span></span>
                        <span class="text-[10px] ${uRank.color} px-1.5 py-0.5 rounded mt-1 inline-block">${uRank.text}</span>
                    </div>
                </div>
                <span class="font-black text-yellow-500">${u.score || 0}</span>
            </div>`;
        });
        document.getElementById('group-list').innerHTML = html;
    });
}

window.openQuiz = function(day) {
    if (myLogs[day] !== undefined) {
        alert("أنت لعبت الجولة دي خلاص!"); return;
    }
    document.body.classList.add('hide-ads'); 
    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center">
            <h2 class="text-2xl font-black text-white mb-2">مستعد يا بطل؟ 🔥</h2>
            <p class="text-gray-400 text-sm mb-6">الوقت هيبدأ يعد فوراً بمجرد دخولك!</p>
            <div class="flex gap-3">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-green-500 text-black font-black p-3 rounded-xl shadow-lg">أيوة، جاهز ⚔️</button>
                <button onclick="closeQuizOverlay()" class="flex-1 bg-gray-700 text-white font-bold p-3 rounded-xl">لا، استنى ✋</button>
            </div>
        </div>
    `;
}

window.closeQuizOverlay = function() {
    document.getElementById('quiz-overlay').style.display = 'none';
    document.body.classList.remove('hide-ads');
}

window.startQuizFetch = function(day) {
    isQuizActive = true;
    history.pushState(null, null, location.href);
    document.getElementById('quiz-content').innerHTML = '<p class="text-center font-bold text-yellow-500">جاري تجهيز ساحة المعركة...</p>';
    
    window.open = function() { return null; }; 

    used5050 = false;
    usedFreeze = false;

    db.collection("quizzes_pool").doc("day_" + day).get().then(doc => {
        if(doc.exists && doc.data().variations) {
            let variationsObj = doc.data().variations;
            let availableKeys = Object.keys(variationsObj); 
            if(availableKeys.length > 0) {
                currentQuestions = variationsObj[availableKeys[Math.floor(Math.random() * availableKeys.length)]].questions;
                currentIndex = 0; sessionScore = 0;
                showQuestion();
            }
        }
    }).catch(err => {
        document.getElementById('quiz-content').innerHTML = '<p class="text-red-500 font-bold">حدث خطأ في الاتصال!</p>';
        setTimeout(() => location.reload(), 2000);
    });
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) return endQuiz();
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 20;
    
    let html = `
        <div class="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
            <span class="text-xs text-yellow-500 font-bold bg-yellow-900/30 px-3 py-1 rounded-full">سؤال ${currentIndex+1} من ${currentQuestions.length}</span>
            <span id="timer" class="text-red-400 font-black text-xl">${globalTimeLeft}s</span>
        </div>
        <h3 class="text-xl font-bold text-center mb-6 leading-relaxed select-none pointer-events-none">${q.q}</h3>
        <div class="space-y-3">
            ${q.options.map((opt, i) => `
                <button onclick="handleAnswer(${i})" class="opt-btn group select-none relative z-[5000]" id="opt-${i}">
                    <span>${opt}</span><div class="opt-circle">${String.fromCharCode(65+i)}</div>
                </button>
            `).join('')}
        </div>
        <div class="flex justify-between mt-5 gap-3 border-t border-gray-700 pt-4">
            <button id="btn-5050" onclick="use5050()" class="flex-1 bg-purple-800 p-2.5 rounded-xl text-xs font-bold text-white ${used5050?'opacity-30':''}">✂️ إجابتين</button>
            <button id="btn-freeze" onclick="useFreeze()" class="flex-1 bg-blue-800 p-2.5 rounded-xl text-xs font-bold text-white ${usedFreeze?'opacity-30':''}">❄️ تجميد</button>
        </div>
    `;
    document.getElementById('quiz-content').innerHTML = html;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        globalTimeLeft--;
        document.getElementById('timer').innerText = globalTimeLeft + "s";
        
        // تشغيل صوت التيك توك في آخر 5 ثواني
        if(globalTimeLeft <= 5 && globalTimeLeft > 0) playSound(sfxTick);
        
        if(globalTimeLeft <= 0) handleAnswer(-1);
    }, 1000);
}

window.use5050 = function() {
    if(used5050 || !isQuizActive) return;
    used5050 = true;
    document.getElementById('btn-5050').classList.add('opacity-30');
    let correctIdx = currentQuestions[currentIndex].correctIndex;
    let hiddenCount = 0;
    for(let i=0; i<4; i++) {
        if(i !== correctIdx && hiddenCount < 2) {
            document.getElementById(`opt-${i}`).style.visibility = 'hidden';
            hiddenCount++;
        }
    }
}

window.useFreeze = function() {
    if(usedFreeze || !isQuizActive) return;
    usedFreeze = true;
    document.getElementById('btn-freeze').classList.add('opacity-30');
    globalTimeLeft += 10;
    document.getElementById('timer').innerText = globalTimeLeft + "s";
}

window.handleAnswer = function(i) {
    clearInterval(timerInterval);
    if(i !== -1) {
        let correctIdx = currentQuestions[currentIndex].correctIndex;
        if(i === correctIdx) {
            sessionScore++;
            playSound(sfxCorrect); // صوت الإجابة الصح
            document.getElementById(`opt-${i}`).classList.add('bg-green-600');
        } else {
            playSound(sfxWrong); // صوت الإجابة الغلط
            document.getElementById(`opt-${i}`).classList.add('bg-red-600');
            document.getElementById(`opt-${correctIdx}`).classList.add('bg-green-600');
        }
    }
    setTimeout(() => { currentIndex++; showQuestion(); }, 800);
}

function endQuiz(isForceExit = false) {
    if (!isQuizActive) return;
    isQuizActive = false;
    clearInterval(timerInterval);
    if (!isForceExit) document.getElementById('quiz-content').innerHTML = '<p class="text-center font-bold text-yellow-500 text-xl animate-pulse">جاري توثيق إنجازك...</p>';

    let newStreak = 1;
    if (adminDay === 1 || myLogs[adminDay - 1] !== undefined) {
        newStreak = currentStreak + 1; 
    } else {
        newStreak = 1; 
    }

    db.collection("users").doc(user.id).set({
        score: isEliminatedPlayer ? firebase.firestore.FieldValue.increment(0) : firebase.firestore.FieldValue.increment(sessionScore),
        streak: newStreak
    }, { merge: true }).then(() => {
        return db.collection("users").doc(user.id).collection("game_logs").doc("day_"+adminDay).set({
            day: adminDay, score: sessionScore, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        if (!isForceExit) {
            playSound(sfxWin); // صوت الفوز والجمهور
            if(window.confetti) confetti({ particleCount: 150 });
            document.getElementById('quiz-content').innerHTML = `
                <div class="text-center">
                    <h2 class="text-3xl font-black mb-2 text-white">عاش يا بطل! 🔥</h2>
                    <p class="mb-2 text-gray-300">حصدت اليوم: <span class="text-3xl text-yellow-400">${sessionScore}</span> نقطة</p>
                    <p class="mb-6 text-orange-400 font-bold">شعلة الحماس: 🔥 ${newStreak}</p>
                    <button onclick="location.reload()" class="w-full bg-yellow-600 p-4 rounded-xl font-black text-black">العودة للمعسكر</button>
                </div>
            `;
            document.body.classList.remove('hide-ads');
        }
    }).catch(error => {
        if(!isForceExit) alert("خطأ في الحفظ! جرب تسجل خروج وتدخل تاني.");
        document.body.classList.remove('hide-ads');
    });
}

window.logoutUser = function() {
    localStorage.removeItem('currentUser');
    window.location.replace("index.html");
}

window.addEventListener('beforeunload', function (e) {
    if (isQuizActive) { endQuiz(true); e.preventDefault(); e.returnValue = ''; }
});
        
