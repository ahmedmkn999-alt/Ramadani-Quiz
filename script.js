// 1. الإعدادات الأساسية (لم يتم لمسها)
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

// 3. بدء التشغيل (لم يتم لمسها)
window.addEventListener('DOMContentLoaded', () => {
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    try {
        const savedUser = localStorage.getItem('currentUser');
        if(!savedUser) return console.warn("No user in localStorage");
        user = JSON.parse(savedUser);

        if(document.getElementById('p-name')) document.getElementById('p-name').innerText = user.name;
        let elGroup = document.getElementById('p-group');
        if(elGroup) {
            elGroup.innerText = (user.group || "") + " | " + (user.team || "");
            elGroup.classList.remove('hidden');
        }

        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            initFirebaseData(); 
        } else {
            console.error("Firebase SDK not found!");
        }

    } catch(e) { 
        console.error("Initialization Error:", e);
    }
});

// 4. جلب البيانات من Firestore (لم يتم لمسها)
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
        snap.forEach(d => myLogs[d.data().day] = d.data().score);
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

// ==========================================
// 🔴 حماية الكويز من الهروب والسكرين شوت 🔴
// ==========================================
document.addEventListener("visibilitychange", () => {
    // لو الكويز شغال والمستخدم طلع بره المتصفح أو نزل ستارة الإشعارات
    if (document.hidden && isQuizActive) {
        forceEndQuiz("تم اكتشاف محاولة خروج! تم حفظ نتيجتك الحالية.");
    }
});

function forceEndQuiz(reasonMessage) {
    if (!isQuizActive) return;
    clearInterval(timerInterval);
    isQuizActive = false;
    alert(reasonMessage);
    endQuiz(true); // حفظ الكويز فوراً
}

// 6. نظام المسابقة (واجهة متوافقة مع الفون + إعلان)
window.openQuiz = function(day) {
    if (myLogs[day] !== undefined) return alert("لعبت الجولة دي قبل كدة!");
    
    let overlay = document.getElementById('quiz-overlay');
    overlay.style.display = 'flex';
    // التأكد إن المحتوى سكرول وقابل للعرض على الفون
    overlay.className = "fixed inset-0 z-50 bg-black/95 flex flex-col overflow-y-auto";

    document.getElementById('quiz-content').innerHTML = `
        <div id="quiz-ad-container" class="sticky top-0 w-full bg-gray-900 border-b border-gray-700 z-50 p-2 text-center text-xs text-gray-400 shadow-md">
            [مساحة إعلانية]
        </div>

        <div class="text-center relative z-10 p-4 mt-4 w-full max-w-md mx-auto">
            <div class="absolute inset-0 bg-yellow-500/10 blur-3xl rounded-full -z-10"></div>
            <div class="bg-gradient-to-br from-yellow-400 to-yellow-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(255,215,0,0.4)] border-4 border-gray-900">
                <i class="fas fa-bolt text-3xl text-black"></i>
            </div>
            <h2 class="text-2xl font-black text-white mb-2 drop-shadow-lg">الجولة ${day} 🔥</h2>
            <p class="text-gray-300 text-xs md:text-sm mb-6 leading-relaxed px-2">بمجرد دخولك سيبدأ التحدي.<br>أي محاولة للخروج ستحفظ نتيجتك الحالية فقط!</p>
            <div class="flex gap-3">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-black font-black p-3 rounded-xl shadow-[0_10px_20px_rgba(34,197,94,0.3)]">ابدأ ⚔️</button>
                <button onclick="closeQuizOverlay()" class="flex-1 bg-gray-800 text-white font-bold p-3 rounded-xl border border-gray-600">إغلاق ✋</button>
            </div>
        </div>`;
}

window.startQuizFetch = function(day) {
    isQuizActive = true;
    used5050 = false; usedFreeze = false;
    
    document.getElementById('quiz-content').innerHTML = `
        <div id="quiz-ad-container" class="sticky top-0 w-full bg-gray-900 border-b border-gray-700 z-50 p-2 text-center text-xs text-gray-400 shadow-md">
            [مساحة إعلانية]
        </div>
        <div class="flex flex-col items-center justify-center py-10 w-full max-w-md mx-auto">
            <div class="w-12 h-12 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mb-4"></div>
            <p class="text-center font-bold text-yellow-500 text-base animate-pulse">جاري التجهيز...</p>
        </div>`;

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
    
    let progressPercent = ((currentIndex + 1) / currentQuestions.length) * 100;

    document.getElementById('quiz-content').innerHTML = `
        <div id="quiz-ad-container" class="sticky top-0 w-full bg-gray-900 border-b border-gray-700 z-50 p-2 text-center text-xs text-gray-400 shadow-md">
            [مساحة إعلانية]
        </div>
        
        <div class="w-full max-w-md mx-auto px-4 pb-6">
            <div class="w-full h-1.5 bg-gray-900 rounded-b-2xl overflow-hidden mb-4">
                <div class="bg-gradient-to-r from-yellow-600 via-yellow-300 to-yellow-600 h-full transition-all duration-500" style="width: ${progressPercent}%"></div>
            </div>

            <div class="flex justify-between items-center mb-6">
                <div class="bg-gray-800/80 border border-gray-700/50 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span class="text-xs text-gray-300 font-bold">سؤال <span class="text-yellow-400">${currentIndex+1}</span> / ${currentQuestions.length}</span>
                </div>
                
                <div class="bg-gray-800/80 border border-gray-700/50 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span class="text-xs text-gray-300 font-bold">نقاط: <span class="text-yellow-400">${sessionScore}</span></span>
                </div>
            </div>

            <div class="glass-card p-4 md:p-6 rounded-2xl mb-6 border border-yellow-500/20 relative">
                <div class="flex flex-col items-center">
                    <span id="timer" class="text-white font-black text-2xl bg-gray-900 border-2 border-red-500/80 px-3 py-1.5 rounded-xl mb-3 transition-all w-16 text-center">${globalTimeLeft}</span>
                    <h3 class="text-lg md:text-xl font-bold text-center leading-relaxed text-white drop-shadow-md">${q.q}</h3>
                </div>
            </div>
            
            <div class="space-y-2.5 relative z-20" id="options-container">
                ${q.options.map((opt, i) => `
                    <button onclick="handleAnswer(${i})" class="opt-btn relative group overflow-hidden rounded-xl border border-gray-600 bg-gray-800/90 p-3.5 w-full text-right transition-all duration-300 active:scale-95" id="opt-${i}">
                        <div class="flex justify-between items-center relative z-10">
                            <span class="text-sm md:text-base font-bold text-gray-200">${opt}</span>
                            <div class="w-6 h-6 rounded-full border border-gray-600 flex items-center justify-center text-xs font-black text-gray-400">${String.fromCharCode(65+i)}</div>
                        </div>
                    </button>
                `).join('')}
            </div>
            
            <div class="flex justify-between mt-6 gap-3 border-t border-gray-700/50 pt-4">
                <button id="btn-5050" onclick="use5050()" class="flex-1 relative overflow-hidden rounded-lg p-[1px] ${used5050?'opacity-40 grayscale':'active:scale-95'}">
                    <span class="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600"></span>
                    <div class="bg-gray-900 px-2 py-2 rounded-[7px] flex items-center justify-center gap-1 relative z-10">
                        <i class="fas fa-cut text-purple-400 text-xs"></i>
                        <span class="text-[10px] font-bold text-gray-200">إجابتين</span>
                    </div>
                </button>
                <button id="btn-freeze" onclick="useFreeze()" class="flex-1 relative overflow-hidden rounded-lg p-[1px] ${usedFreeze?'opacity-40 grayscale':'active:scale-95'}">
                    <span class="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-500"></span>
                    <div class="bg-gray-900 px-2 py-2 rounded-[7px] flex items-center justify-center gap-1 relative z-10">
                        <i class="fas fa-snowflake text-blue-400 text-xs"></i>
                        <span class="text-[10px] font-bold text-gray-200">تجميد</span>
                    </div>
                </button>
            </div>

            <button onclick="promptExitQuiz()" class="w-full mt-6 text-gray-500 text-xs font-bold underline">انسحاب وحفظ النتيجة</button>
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
                tEl.classList.remove('border-red-500/80', 'text-white', 'border-blue-500/80', 'text-blue-300');
                tEl.classList.add('border-red-500', 'text-red-500', 'animate-pulse');
            }
        }
        if(globalTimeLeft <= 5 && globalTimeLeft > 0) vibratePhone(50);
        
        if(globalTimeLeft <= 0) handleAnswer(-1);
    }, 1000);
}

window.handleAnswer = function(idx) {
    if (!isQuizActive) return;
    clearInterval(timerInterval);
    
    let container = document.getElementById('options-container');
    if(container) container.style.pointerEvents = 'none';

    let q = currentQuestions[currentIndex];
    
    // النقطة بقت بـ 1 بدل 10
    if(idx === q.correctIndex) {
        sessionScore += 1; 
        vibratePhone(100);
        let btn = document.getElementById(`opt-${idx}`);
        if(btn) {
            btn.classList.add('bg-green-600/50', 'border-green-500');
            btn.classList.remove('border-gray-600', 'bg-gray-800/90');
        }
    } else {
        vibratePhone([100, 50, 100]);
        if(idx !== -1) {
            let btn = document.getElementById(`opt-${idx}`);
            if(btn) {
                btn.classList.add('bg-red-600/50', 'border-red-500');
                btn.classList.remove('border-gray-600', 'bg-gray-800/90');
            }
        }
        let correctBtn = document.getElementById(`opt-${q.correctIndex}`);
        if(correctBtn) {
            correctBtn.classList.add('bg-green-600/50', 'border-green-500');
            correctBtn.classList.remove('border-gray-600', 'bg-gray-800/90');
        }
    }
    
    currentIndex++;
    setTimeout(showQuestion, 1200); 
}

window.use5050 = function() {
    if(used5050 || !isQuizActive) return;
    used5050 = true;
    let btn = document.getElementById('btn-5050');
    if(btn) btn.classList.add('opacity-40', 'grayscale', 'cursor-not-allowed');
    
    let correct = currentQuestions[currentIndex].correctIndex;
    let removed = 0;
    for(let i=0; i<4; i++) {
        if(i !== correct && removed < 2) {
            let el = document.getElementById(`opt-${i}`);
            if(el) {
                el.style.opacity = '0.2';
                el.style.pointerEvents = 'none';
                el.style.filter = 'grayscale(100%)';
            }
            removed++;
        }
    }
}

window.useFreeze = function() {
    if(usedFreeze || !isQuizActive) return;
    usedFreeze = true;
    let btn = document.getElementById('btn-freeze');
    if(btn) btn.classList.add('opacity-40', 'grayscale', 'cursor-not-allowed');
    
    globalTimeLeft += 15;
    let timerEl = document.getElementById('timer');
    if(timerEl) {
        timerEl.innerText = globalTimeLeft;
        timerEl.classList.remove('animate-pulse', 'border-red-500', 'text-red-500');
        timerEl.classList.add('border-blue-500/80', 'text-blue-300');
        
        setTimeout(() => {
            if(timerEl && globalTimeLeft > 5) {
                timerEl.classList.remove('border-blue-500/80', 'text-blue-300');
                timerEl.classList.add('border-red-500/80', 'text-white');
            }
        }, 2000);
    }
}

// نافذة التأكيد الشيك عند الانسحاب
window.promptExitQuiz = function() {
    let confirmHTML = `
        <div id="exit-modal" class="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
            <div class="bg-gray-800 p-6 rounded-2xl border border-red-500/50 text-center w-full max-w-sm shadow-2xl transform transition-all">
                <div class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-exclamation-triangle text-2xl text-red-500"></i>
                </div>
                <h3 class="text-xl font-bold text-white mb-2">متأكد إنك عايز تنسحب؟</h3>
                <p class="text-xs text-gray-400 mb-6">سيتم إنهاء الجولة وحفظ نتيجتك الحالية فقط (${sessionScore} نقطة).</p>
                <div class="flex gap-3">
                    <button o
