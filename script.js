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

function vibratePhone(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

function getRankInfo(score) {
    if(score >= 101) return { text: "أسطورة رمضان 👑", color: "text-yellow-400 bg-yellow-900/50" };
    if(score >= 51) return { text: "كابتن الملعب 🥇", color: "text-yellow-300 bg-yellow-800/50" };
    if(score >= 21) return { text: "هداف الفريق 🥈", color: "text-gray-300 bg-gray-700/50" };
    return { text: "لاعب ناشئ 🥉", color: "text-orange-400 bg-orange-900/50" };
}

window.addEventListener('DOMContentLoaded', () => {
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    
    user = JSON.parse(localStorage.getItem('currentUser'));
    if(!user || !user.id) { 
        logoutUser(); 
        return; 
    }

    let elName = document.getElementById('p-name');
    if(elName) elName.innerText = user.name.split(' ')[0] + "...";

    let waitForFb = setInterval(() => {
        if (typeof firebase !== 'undefined' && typeof firebase.firestore !== 'undefined') {
            clearInterval(waitForFb);
            try {
                if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
                db = firebase.firestore();
                initFirebaseData();
            } catch(e) { console.error("Firebase Init Error:", e); }
        }
    }, 200);
});

function initFirebaseData() {
    db.collection("users").doc(user.id).onSnapshot(doc => {
        if(doc.exists) {
            let d = doc.data();
            let pScore = d.score || 0;
            currentStreak = d.streak || 0;
            isEliminatedPlayer = d.isEliminated || false;
            let rank = getRankInfo(pScore);

            // تحديث العناصر بشكل آمن جداً بدون لغبطة الـ HTML
            document.getElementById('p-score').innerText = pScore;
            
            let elStreak = document.getElementById('p-streak');
            elStreak.innerText = `🔥 ${currentStreak}`;
            elStreak.classList.remove('hidden');

            document.getElementById('p-name').innerText = d.name || "مجهول";
            
            let elGroup = document.getElementById('p-group');
            let elRank = document.getElementById('p-rank');

            if(isEliminatedPlayer) {
                elGroup.innerHTML = '<i class="fas fa-ban"></i> مقصى';
                elGroup.className = 'text-red-400 font-bold bg-red-900/40 px-2 py-0.5 rounded text-[10px] border border-red-700';
                elGroup.classList.remove('hidden');
                elRank.classList.add('hidden');
            } else {
                elGroup.innerText = `${d.group || ""} | ${d.team || ""}`;
                elGroup.className = 'text-yellow-400 font-bold bg-gray-800 px-2 py-0.5 rounded text-[10px] border border-gray-600 truncate max-w-[100px]';
                elGroup.classList.remove('hidden');
                
                elRank.innerText = rank.text;
                elRank.className = `font-bold text-[10px] px-2 py-0.5 rounded border border-gray-600 ${rank.color}`;
                elRank.classList.remove('hidden');
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

window.openQuiz = function(day) {
    if (myLogs[day] !== undefined) {
        alert("أنت لعبت الجولة دي خلاص!"); return;
    }
    document.body.classList.add('hide-ads'); 
    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center relative z-10">
            <div class="absolute inset-0 bg-yellow-500/10 blur-3xl rounded-full -z-10"></div>
            <div class="bg-gradient-to-br from-yellow-400 to-yellow-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(255,215,0,0.4)] border-4 border-gray-900">
                <i class="fas fa-bolt text-4xl text-black"></i>
            </div>
            <h2 class="text-3xl font-black text-white mb-3 drop-shadow-lg">مستعد للمواجهة؟ 🔥</h2>
            <p class="text-gray-300 text-sm mb-8 leading-relaxed px-4">بمجرد دخولك سيبدأ التحدي.<br>لا توجد فرصة للرجوع، وأي خروج يعتبر غش!</p>
            <div class="flex gap-4">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-black font-black p-4 rounded-xl shadow-[0_10px_20px_rgba(34,197,94,0.3)] transform hover:-translate-y-1 transition-all">جاهز ⚔️</button>
                <button onclick="closeQuizOverlay()" class="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold p-4 rounded-xl border border-gray-600 transition-all">تراجع ✋</button>
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
    document.getElementById('quiz-content').innerHTML = `
        <div class="flex flex-col items-center justify-center py-10">
            <div class="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mb-4"></div>
            <p class="text-center font-bold text-yellow-500 text-lg animate-pulse">جاري تجهيز ساحة المعركة...</p>
        </div>
    `;
    
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
            } else {
                throw new Error("No questions");
            }
        } else {
            throw new Error("Quiz not ready");
        }
    }).catch(err => {
        document.getElementById('quiz-content').innerHTML = '<p class="text-red-500 font-bold text-center">التحدي لم يجهز بعد!</p>';
        setTimeout(() => location.reload(), 2000);
    });
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) return endQuiz();
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 20;
    
    let progressPercent = ((currentIndex + 1) / currentQuestions.length) * 100;

    let html = `
        <div class="absolute top-0 left-0 w-full h-1.5 bg-gray-900 rounded-t-2xl overflow-hidden">
            <div class="bg-gradient-to-r from-yellow-600 via-yellow-300 to-yellow-600 h-full transition-all duration-500 shadow-[0_0_15px_rgba(212,175,55,1)]" style="width: ${progressPercent}%"></div>
        </div>

        <div class="flex justify-between items-center mb-8 mt-4 px-2">
            <div class="bg-gray-800/80 border border-gray-700/50 px-4 py-1.5 rounded-full shadow-inner flex items-center gap-2">
                <i class="fas fa-crosshairs text-yellow-500 text-xs animate-spin-slow"></i>
                <span class="text-sm text-gray-300 font-bold">سؤال <span class="text-yellow-400 text-base">${currentIndex+1}</span> / ${currentQuestions.length}</span>
            </div>
            
            <div class="bg-gray-800/80 border border-gray-700/50 px-4 py-1.5 rounded-full shadow-inner flex items-center gap-2">
                <i class="fas fa-star text-yellow-500 text-xs"></i>
                <span class="text-sm text-gray-300 font-bold">نقاط: <span class="text-yellow-400 text-base">${sessionScore}</span></span>
            </div>
        </div>

        <div class="glass-card p-6 rounded-3xl mb-8 border border-yellow-500/20 shadow-[0_15px_35px_rgba(0,0,0,0.6)] relative overflow-hidden">
            <div class="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full"></div>
            <div class="absolute top-0 left-1/2 transform -translate-x-1/2 bg-yellow-600 text-black px-5 py-0.5 rounded-b-xl text-[10px] font-black tracking-widest shadow-md">سؤال الجولة</div>
            
            <div class="mt-4 flex flex-col items-center">
                <span id="timer" class="text-white font-black text-3xl bg-gray-900 border-2 border-red-500/80 px-4 py-2 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.3)] mb-4 transition-all w-20 text-center">${globalTimeLeft}</span>
                <h3 class="text-xl md:text-2xl font-black text-center leading-relaxed text-white drop-shadow-lg relative z-10">${q.q}</h3>
            </div>
        </div>
        
        <div class="space-y-3 relative z-20 px-1">
            ${q.options.map((opt, i) => `
                <button onclick="handleAnswer(${i})" class="opt-btn relative group overflow-hidden rounded-2xl border border-gray-600 bg-gray-800/90 p-4 w-full text-right transition-all duration-300 hover:border-yellow-500/60 hover:shadow-[0_0_25px_rgba(212,175,55,0.2)]" id="opt-${i}">
                    <div class="absolute inset-0 bg-gradient-to-r from-yellow-600/0 via-yellow-600/10 to-yellow-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div class="flex justify-between items-center relative z-10">
                        <span class="text-base md:text-lg font-bold text-gray-200 group-hover:text-yellow-400 transition-colors">${opt}</span>
                        <div class="w-8 h-8 rounded-full border-2 border-gray-600 flex items-center justify-center text-sm font-black text-gray-400 group-hover:border-yellow-500 group-hover:bg-yellow-500/10 group-hover:text-yellow-400 transition-colors">${String.fromCharCode(65+i)}</div>
                    </div>
                </button>
            `).join('')}
        </div>
        
        <div class="flex justify-between mt-8 gap-4 border-t border-gray-700/50 pt-5 px-1">
            <button id="btn-5050" onclick="use5050()" class="flex-1 relative overflow-hidden group rounded-xl p-[1px] transition-all ${used5050?'opacity-40 grayscale cursor-not-allowed':'hover:scale-105 shadow-[0_5px_15px_rgba(147,51,234,0.3)]'}">
                <span class="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl"></span>
                <div class="bg-gray-900 px-4 py-2.5 rounded-[11px] flex items-center justify-center gap-2 relative z-10">
                    <i class="fas fa-cut text-purple-400"></i>
                    <span class="text-xs font-black text-gray-200">إجابتين</span>
                </div>
            </button>
            <button id="btn-freeze" onclick="useFreeze()" class="flex-1 relative overflow-hidden group rounded-xl p-[1px] transition-all ${usedFreeze?'opacity-40 grayscale cursor-not-allowed':'hover:scale-105 shadow-[0_5px_15px_rgba(59,130,246,0.3)]'}">
                <span class="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-xl"></span>
                <div class="bg-gray-900 px-4 py-2.5 rounded-[11px] flex items-center justify-center gap-2 relative z-10">
                    <i class="fas fa-snowflake text-blue-400"></i>
                    <span class="text-xs font-black text-gray-200">تجميد</span>
                </div>
            </button>
        </div>
    `;
    document.getElementById('quiz-content').innerHTML = html;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        globalTimeLeft--;
        let timerEl = document.getElementById('timer');
        if(timerEl) {
            timerEl.innerText = globalTimeLeft;
            if(globalTimeLeft <= 5) {
                timerEl.classList.remove('border-red-500/80', 'text-white');
                timerEl.classList.add('border-red-500', 'text-red-500', 'animate-pulse', 'scale-110');
            }
        }
        if(globalTimeLeft <= 5) vibratePhone(50); 
        
        if(globalTimeLeft <= 0) handleAnswer(-1);
    }, 1000);
}

window.use5050 = function() {
    if(used5050 || !isQuizActive) return;
    used5050 = true;
    let btn = document.getElementById('btn-5050');
    if(btn) {
        btn.classList.add('opacity-40', 'grayscale', 'cursor-not-allowed');
        btn.classList.remove('hover:scale-105', 'shadow-[0_5px_15px_rgba(147,51,234,0.3)]');
    }
    
    let correctIdx = currentQuestions[currentIndex].correctIndex;
    let hiddenCount = 0;
    for(let i=0; i<4; i++) {
        if(i !== correctIdx && hiddenCount < 2) {
            let optBtn = document.getElementById(`opt-${i}`);
            if(optBtn) {
                optBtn.style.opacity = '0.2';
                optBtn.style.pointerEvents = 'none';
                optBtn.style.filter = 'grayscale(100%)';
            }
            hiddenCount++;
        }
    }
}

window.useFreeze = function() {
    if(usedFreeze || !isQuizActive) return;
    usedFreeze = true;
    let btn = document.getElementById('btn-freeze');
    if(btn) {
        btn.classList.add('opacity-40', 'grayscale', 'cursor-not-allowed');
        btn.classList.remove('hover:scale-105', 'shadow-[0_5px_15px_rgba(59,130,246,0.3)]');
    }
    
    globalTimeLeft += 10;
    let timerEl = document.getElementById('timer');
    if(timerEl) {
        timerEl.innerText = globalTimeLeft;
        timerEl.classList.remove('animate-pulse', 'scale-110', 'border-red-500', 'text-red-500');
        timerEl.classList.add('border-blue-500/80', 'text-blue-300');
        setTimeout(() => {
            if(timerEl) {
                timerEl.classList.remove('border-blue-500/80', 'text-blue-300');
                timerEl.classList.add('border-red-500/80', 'text-white');
            }
        }, 2000);
    }
}

window.handleAnswer = function(i) {
    clearInterval(timerInterval);
    
    document.querySelectorAll('.opt-btn').forEach(btn => btn.style.pointerEvents = 'none');
    
    let correctIdx = currentQuestions[currentIndex].correctIndex;

    if(i !== -1) {
        let selectedBtn = document.getElementById(`opt-${i}`);
        
        if(i === correctIdx) {
            sessionScore++;
            vibratePhone(100);
            if(selectedBtn) {
    
