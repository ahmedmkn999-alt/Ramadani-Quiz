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

// --- 🃏 متغيرات أسلحة المساعدة (الجواكر) ---
let used5050 = false;
let usedFreeze = false;

// --- 🎵 مؤثرات اللعبة الصوتية (متأمنة ضد أخطاء الموبايلات) ---
const sfxCorrect = new Audio('https://www.myinstants.com/media/sounds/correct-answer-sound-effect.mp3');
const sfxWrong = new Audio('https://www.myinstants.com/media/sounds/error-sound-effect.mp3');
const sfxTick = new Audio('https://www.myinstants.com/media/sounds/tick.mp3');
const sfxWin = new Audio('https://www.myinstants.com/media/sounds/crowd-cheer.mp3');

function playSound(audioObj) {
    try {
        audioObj.currentTime = 0;
        let p = audioObj.play();
        if(p !== undefined) p.catch(e => {}); 
    } catch(e){}
}
// ------------------------------------

// --- 🎖️ نظام الألقاب والرتب ---
function getRankInfo(score) {
    if(score >= 101) return { text: "أسطورة رمضان 👑", color: "text-yellow-400 bg-yellow-900/50" };
    if(score >= 51) return { text: "كابتن الملعب 🥇", color: "text-yellow-300 bg-yellow-800/50" };
    if(score >= 21) return { text: "هداف الفريق 🥈", color: "text-gray-300 bg-gray-700/50" };
    return { text: "لاعب ناشئ 🥉", color: "text-orange-400 bg-orange-900/50" };
}
// ------------------------------

window.addEventListener('DOMContentLoaded', () => {
    
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.webkitTouchCallout = "none";

    setTimeout(() => {
        try {
            user = JSON.parse(localStorage.getItem('currentUser'));
            if(!user || !user.id) throw new Error();

            document.getElementById('p-name').innerText = user.name;
            
            if (typeof firebase !== 'undefined' && !firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();

            initFirebaseData();

        } catch(e) { 
            window.location.replace("index.html"); 
        }
    }, 100);
});

function initFirebaseData() {
    db.collection("users").doc(user.id).onSnapshot(doc => {
        if(doc.exists) {
            let d = doc.data();
            let pScore = d.score || 0;
            document.getElementById('p-score').innerText = pScore;
            isEliminatedPlayer = d.isEliminated || false;
            
            // تحديث اللقب (الرانك)
            let rank = getRankInfo(pScore);
            
            if(isEliminatedPlayer) {
                document.getElementById('p-group').innerHTML = '<span class="text-red-500 font-black text-xs"><i class="fas fa-ban"></i> تم الإقصاء (لعب ودي)</span>';
            } else {
                document.getElementById('p-group').innerHTML = `${d.group} | ${d.team} <br> <span class="inline-block mt-1 px-2 py-0.5 rounded border border-gray-600 font-bold text-[10px] ${rank.color}">${rank.text}</span>`;
            }
        }
    });

    db.collection("settings").doc("dailyData").onSnapshot(s => {
        let msgBox = document.getElementById('daily-msg-box');
        if(s.exists && s.data().message && s.data().message.trim() !== "") {
            msgBox.innerHTML = `<i class="fas fa-bullhorn text-yellow-400 ml-2 animate-pulse"></i> ${s.data().message}`;
            msgBox.classList.remove('hidden');
        } else {
            msgBox.classList.add('hidden');
        }
    });

    db.collection("settings").doc("champData").get().then(s => {
        if(s.exists && s.data().message && !sessionStorage.getItem('champSeen')) {
            document.getElementById('champ-popup-text').innerText = s.data().message;
            let pop = document.getElementById('champ-flying-popup');
            pop.style.display = 'block';
            setTimeout(() => { 
                pop.classList.remove('opacity-0', '-translate-y-10');
                pop.classList.add('opacity-100', 'translate-y-0');
            }, 100);
            sessionStorage.setItem('champSeen', 'true');
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

window.closeChampPopup = function() {
    let pop = document.getElementById('champ-flying-popup');
    pop.classList.remove('opacity-100', 'translate-y-0');
    pop.classList.add('opacity-0', '-translate-y-10');
    setTimeout(() => { pop.style.display = 'none'; }, 700);
}

function updateLogs() {
    if(logsUnsubscribe) logsUnsubscribe();
    logsUnsubscribe = db.collection("users").doc(user.id).collection("game_logs").onSnapshot(snap => {
        myLogs = {};
        snap.forEach(d => myLogs[d.data().day] = d.data().score);
        renderMap();
        
        let pCount = Object.keys(myLogs).length;
        document.getElementById('progress-text').innerText = `${pCount} / 29 جولة`;
        document.getElementById('progress-bar').style.width = `${(pCount/29)*100}%`;
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
            html += `<div class="glass-card p-6 rounded-2xl flex justify-between mb-4 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <div class="flex items-center gap-4">
                    <div class="bg-blue-900/50 text-blue-400 w-14 h-14 rounded-full flex justify-center items-center"><i class="fas fa-hourglass-half text-2xl animate-pulse"></i></div>
                    <div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-blue-400 font-bold mt-1">تفتح قريباً ⏳</p></div>
                </div>
                <i class="fas fa-lock text-blue-500/30 text-3xl opacity-40"></i>
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
            html += `<div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl mb-2 border border-gray-700 hover:border-yellow-500/30 transition-colors">
                <div class="flex items-center gap-3">
                    <span class="w-6 text-center font-bold ${rank <= 3 ? 'text-yellow-500 text-lg' : 'text-gray-400'}">${rank}</span>
                    <div>
                        <span class="font-bold block ${u.id === user.id ? 'text-yellow-400' : 'text-white'}">${u.name}</span>
                        <span class="text-[10px] ${uRank.color} px-1.5 py-0.5 rounded">${uRank.text}</span>
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
        alert("أنت لعبت الجولة دي خلاص يا بطل، مفيش إعادة!");
        return;
    }

    document.body.classList.add('hide-ads');

    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center">
            <div class="bg-yellow-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-yellow-500 shadow-[0_0_15px_rgba(255,215,0,0.5)]">
                <i class="fas fa-fist-raised text-4xl text-yellow-400"></i>
            </div>
            <h2 class="text-2xl font-black text-white mb-2">مستعد يا بطل؟ 🔥</h2>
            <p class="text-gray-400 text-sm mb-6 leading-relaxed">الوقت هيبدأ يعد فوراً بمجرد دخولك، ومفيش رجوع، وأي محاولة خروج هتتحسب غش!</p>
            <div class="flex gap-3">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-black font-black p-3 rounded-xl transition-all shadow-lg">أيوة، جاهز ⚔️</button>
                <button onclick="closeQuizOverlay()" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold p-3 rounded-xl transition-all">لا، استنى ✋</button>
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
    document.getElementById('quiz-content').innerHTML = '<p class="text-center font-bold text-yellow-500 animate-pulse">جاري تجهيز ساحة المعركة...</p>';
    
    window.open = function() { return null; }; 

    // إعادة ضبط الجواكر لكل جولة
    used5050 = false;
    usedFreeze = false;

    db.collection("quizzes_pool").doc("day_" + day).get().then(doc => {
        if(doc.exists && doc.data().variations) {
            let variationsObj = doc.data().variations;
            let availableKeys = Object.keys(variationsObj); 
            
            if(availableKeys.length > 0) {
                let randomKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
                currentQuestions = variationsObj[randomKey].questions;
                currentIndex = 0; sessionScore = 0;
                showQuestion();
            } else {
                document.getElementById('quiz-content').innerHTML = '<p class="text-center text-red-500 font-bold">التحدي لم يجهز بعد!</p>';
                setTimeout(() => location.reload(), 2000);
            }
        } else {
            document.getElementById('quiz-content').innerHTML = '<p class="text-center text-red-500 font-bold">التحدي لم يجهز بعد!</p>';
            setTimeout(() => location.reload(), 2000);
        }
    }).catch(err => {
        console.error(err);
        document.getElementById('quiz-content').innerHTML = '<p class="text-center text-red-500 font-bold">حدث خطأ في الاتصال!</p>';
        setTimeout(() => location.reload(), 2000);
    });
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) return endQuiz();
    
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 20;
    
    // تصميم السؤال وإضافة أزرار المساعدة (الجواكر)
    let html = `
        <div class="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
            <span class="text-xs text-yellow-500 font-bold bg-yellow-900/30 px-3 py-1 rounded-full">سؤال ${currentIndex+1} من ${currentQuestions.length}</span>
            <span id="timer" class="text-red-400 font-black text-xl bg-red-900/20 px-3 py-1 rounded-lg shadow-inner">${globalTimeLeft}s</span>
        </div>
        <h3 class="text-xl font-bold text-center mb-6 leading-relaxed select-none pointer-events-none">${q.q}</h3>
        <div class="space-y-3" id="options-container">
            ${q.options.map((opt, i) => `
                <button onclick="handleAnswer(${i}, event)" class="opt-btn group select-none relative z-[5000]" id="opt-${i}">
                    <span class="group-hover:text-yellow-400 transition-colors">${opt}</span>
                    <div class="opt-circle group-hover:border-yellow-500 group-hover:text-yellow-500 transition-colors">${String.fromCharCode(65+i)}</div>
                </button>
            `).join('')}
        </div>
        
        <div class="flex justify-between mt-5 gap-3 border-t border-gray-700 pt-4">
            <button id="btn-5050" onclick="use5050()" class="flex-1 bg-gradient-to-r from-purple-700 to-purple-900 p-2.5 rounded-xl text-xs font-bold shadow-lg transition-all ${used5050 ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:scale-105'} text-white border border-purple-500/50">
                <i class="fas fa-star-half-alt text-yellow-400 ml-1"></i> حذف إجابتين
            </button>
            <button id="btn-freeze" onclick="useFreeze()" class="flex-1 bg-gradient-to-r from-blue-700 to-blue-900 p-2.5 rounded-xl text-xs font-bold shadow-lg transition-all ${usedFreeze ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:scale-105'} text-white border border-blue-500/50">
                <i class="fas fa-snowflake text-blue-300 ml-1"></i> تجميد الوقت
            </button>
        </div>
    `;
    document.getElementById('quiz-content').innerHTML = html;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        globalTimeLeft--;
        document.getElementById('timer').innerText = globalTimeLeft + "s";
        
        // 🎵 تشغيل صوت التيك توك المرعب في آخر 5 ثواني
        if(globalTimeLeft <= 5 && globalTimeLeft > 0) {
            playSound(sfxTick);
        }

        if(globalTimeLeft <= 0) handleAnswer(-1, null);
    }, 1000);
}

// --- ✂️ تفعيل جوكر 50:50 ---
window.use5050 = function() {
    if(used5050 || !isQuizActive) return;
    used5050 = true;
    document.getElementById('btn-5050').classList.add('opacity-30', 'cursor-not-allowed', 'grayscale');
    
    let correctIdx = currentQuestions[currentIndex].correctIndex;
    let hiddenCount = 0;
    
    // إخفاء إجابتين غلط
    for(let i=0; i<4; i++) {
        if(i !== correctIdx && hiddenCount < 2) {
            document.getElementById(`opt-${i}`).style.visibility = 'hidden';
            hiddenCount++;
        }
    }
}

// --- ❄️ تفعيل جوكر تجميد الوقت (+10 ثواني) ---
window.useFreeze = function() {
    if(usedFreeze || !isQuizActive) return;
    usedFreeze = true;
    let btn = document.getElementById('btn-freeze');
    btn.classList.add('opacity-30', 'cursor-not-allowed', 'grayscale');
    
    // إضافة 10 ثواني للوقت
    globalTimeLeft += 10;
    let timerEl = document.getElementById('timer');
    timerEl.innerText = globalTimeLeft + "s";
    
    // تأثير بصري للتايمر
    timerEl.classList.remove('text-red-400');
    timerEl.classList.add('text-blue-400', 'animate-pulse');
    setTimeout(() => {
        timerEl.classList.remove('text-blue-400', 'animate-pulse');
        timerEl.classList.add('text-red-400');
    }, 2000);
}
// ------------------------------------------

window.handleAnswer = function(i, event) {
    if(event) {
        event.stopPropagation();
    }
    
    clearInterval(timerInterval);
    
    // تلوين الأزرار بالصح والغلط
    if(i !== -1) {
        let correctIdx = currentQuestions[currentIndex].correctIndex;
        let selectedBtn = document.getElementById(`opt-${i}`);
        let correctBtn = document.getElementById(`opt-${correctIdx}`);
        
        if(i === correctIdx) {
            sessionScore++;
            playSound(sfxCorrect); // 🎵 رنة الصح
            selectedBtn.classList.add('bg-green-600', 'border-green-400');
        } else {
            playSound(sfxWrong); // 🎵 صوت الغلط
            selectedBtn.classList.add('bg-red-600', 'border-red-400');
            correctBtn.classList.add('bg-green-600', 'border-green-400');
        }
    }
    
    // تأخير نص ثانية عشان يشوف الإجابة الصح ويسمع الصوت
    setTimeout(() => {
        currentIndex++;
        showQuestion();
    }, 800);
}

function endQuiz(isForceExit = false) {
    if (!isQuizActive) return;
    isQuizActive = false;
    clearInterval(timerInterval);
    
    if (!isForceExit) {
        document.getElementById('quiz-content').innerHTML = '<p class="text-center font-bold text-yellow-500 text-xl animate-pulse">جاري توثيق إنجازك...</p>';
    }

    db.collection("users").doc(user.id).set({
        score: isEliminatedPlayer ? firebase.firestore.FieldValue.increment(0) : firebase.firestore.FieldValue.increment(sessionScore)
    }, { merge: true }).then(() => {
        return db.collection("users").doc(user.id).collection("game_logs").doc("day_"+adminDay).set({
            day: adminDay,
            score: sessionScore, 
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        if (!isForceExit) {
            
            playSound(sfxWin); // 🎵 صوت هتاف الجمهور

            if(window.confetti) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            
            document.getElementById('quiz-content').innerHTML = `
                <div class="text-center">
                    <div class="inline-block bg-yellow-500/20 p-4 rounded-full mb-4">
                        <i class="fas fa-trophy text-6xl text-yellow-400 drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]"></i>
                    </div>
                    <h2 class="text-3xl font-black mb-2 text-white">عاش يا بطل!</h2>
                    <p class="mb-6 text-gray-300">حصدت اليوم: <span class="text-3xl font-black text-yellow-400 mx-2">${sessionScore}</span> نقطة</p>
                    <button onclick="location.reload()" class="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 p-4 rounded-xl font-black text-black text-lg shadow-lg transform hover:scale-105 transition-all">العودة للمعسكر</button>
                </div>
            `;
            document.body.classList.remove('hide-ads');
        }
    }).catc
