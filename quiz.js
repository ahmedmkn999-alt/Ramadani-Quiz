let currentQuestions = [], currentIndex = 0, sessionScore = 0;
let timerInterval = null, globalTimeLeft = 15; // وقت السؤال 15 ثانية
let isQuizActive = false;
let used5050InRound = false, usedFreezeInRound = false;

// الرصيد المجاني للكويز
let free5050 = 1, freeFreeze = 1;

window.openQuiz = function(day) {
    if (myLogs[day] !== undefined) { 
        window.showAlert("انتباه!", "أنت لعبت الجولة دي خلاص يا بطل!", "⚠️", "error"); 
        return; 
    }
    document.body.classList.add('hide-ads'); 
    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center relative z-10">
            <h2 class="text-3xl font-black text-white mb-3">مستعد للمواجهة؟ 🔥</h2>
            <p class="text-gray-300 text-sm mb-8">لديك (1) تجميد و (1) حذف مجاناً في هذا التحدي.</p>
            <div class="flex gap-4">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-green-500 text-black font-black p-4 rounded-xl shadow-lg hover:scale-105 transition-transform">جاهز ⚔️</button>
                <button onclick="closeQuizOverlay()" class="flex-1 bg-gray-800 text-white font-bold p-4 rounded-xl border border-gray-600 hover:bg-gray-700 transition-colors">تراجع ✋</button>
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
    document.getElementById('quiz-content').innerHTML = `<p class="text-center font-bold text-yellow-500 text-lg animate-pulse">جاري تجهيز ساحة المعركة...</p>`;
    
    free5050 = 1; freeFreeze = 1;
    used5050InRound = false; usedFreezeInRound = false;

    db.collection("quizzes_pool").doc("day_" + day).get().then(doc => {
        if(doc.exists && doc.data().variations) {
            let variationsObj = doc.data().variations;
            let availableKeys = Object.keys(variationsObj); 
            currentQuestions = variationsObj[availableKeys[Math.floor(Math.random() * availableKeys.length)]].questions;
            currentIndex = 0; sessionScore = 0;
            showQuestion();
        } else {
            window.showAlert("عفواً", "التحدي لم يجهز بعد!", "⏳", "normal");
            setTimeout(() => location.reload(), 2000);
        }
    });
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) return endQuiz();
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 15; // وقت السؤال 15 ثانية هنا برضه
    
    let total5050 = free5050 + (window.myPowerups?.fifty50 || 0);
    let totalFreeze = freeFreeze + (window.myPowerups?.freeze || 0);

    let btn50Class = (total5050 > 0 && !used5050InRound) ? "hover:scale-105 shadow-[0_5px_15px_rgba(147,51,234,0.3)] cursor-pointer" : "opacity-40 grayscale cursor-not-allowed";
    let btnFreezeClass = (totalFreeze > 0 && !usedFreezeInRound) ? "hover:scale-105 shadow-[0_5px_15px_rgba(59,130,246,0.3)] cursor-pointer" : "opacity-40 grayscale cursor-not-allowed";

    let html = `
        <div class="flex justify-between items-center mb-4 px-1">
            <div class="bg-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-300 border border-gray-600">سؤال <span class="text-yellow-400">${currentIndex+1}</span> / ${currentQuestions.length}</div>
            <div class="bg-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-300 border border-gray-600">نقاط: <span class="text-yellow-400">${sessionScore}</span></div>
        </div>

        <div class="glass-card p-4 rounded-2xl mb-4 text-center border border-yellow-500/20 shadow-lg">
            <span id="timer" class="text-white font-black text-3xl bg-gray-900 border-2 border-red-500/80 px-4 py-1 rounded-xl mb-3 inline-block shadow-[0_0_15px_rgba(239,68,68,0.3)]">${globalTimeLeft}</span>
            <h3 class="text-lg md:text-xl font-black text-white drop-shadow-md leading-relaxed">${q.q}</h3>
        </div>
        
        <div class="space-y-3">
            ${q.options.map((opt, i) => `<button onclick="handleAnswer(${i})" class="opt-btn bg-gray-800/90 p-4 w-full text-right rounded-xl border border-gray-600 font-bold text-gray-200 hover:border-yellow-500/50 transition-colors" id="opt-${i}">${opt}</button>`).join('')}
        </div>
        
        <div class="flex justify-between mt-5 gap-3 border-t border-gray-700/50 pt-4">
            <div id="btn-5050" onclick="use5050()" class="flex-1 relative ${btn50Class} transition-all">
                ${total5050 > 0 ? `<div id="badge-5050" class="powerup-badge">${total5050}</div>` : ''}
                <div class="bg-gray-900 border border-purple-500/50 px-3 py-2.5 rounded-xl flex items-center justify-center gap-2">
                    <i class="fas fa-cut text-purple-400"></i><span class="text-xs font-black text-gray-200">إجابتين</span>
                </div>
            </div>
            <div id="btn-freeze" onclick="useFreeze()" class="flex-1 relative ${btnFreezeClass} transition-all">
                ${totalFreeze > 0 ? `<div id="badge-freeze" class="powerup-badge">${totalFreeze}</div>` : ''}
                <div class="bg-gray-900 border border-blue-500/50 px-3 py-2.5 rounded-xl flex items-center justify-center gap-2">
                    <i class="fas fa-snowflake text-blue-400"></i><span class="text-xs font-black text-gray-200">تجميد</span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('quiz-content').innerHTML = html;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        globalTimeLeft--;
        let timerEl = document.getElementById('timer');
        if(timerEl) timerEl.innerText = globalTimeLeft;
        if(globalTimeLeft <= 0) handleAnswer(-1);
    }, 1000);
}

window.use5050 = function() {
    let total5050 = free5050 + (window.myPowerups?.fifty50 || 0);
    if(used5050InRound || total5050 <= 0 || !isQuizActive) return;
    used5050InRound = true;
    
    if (free5050 > 0) {
        free5050--;
    } else {
        window.myPowerups.fifty50 -= 1;
        db.collection("users").doc(user.id).update({ powerups: window.myPowerups });
        let topInv = document.getElementById('inv-5050');
        if(topInv) topInv.innerText = window.myPowerups.fifty50;
    }
    
    let btn = document.getElementById('btn-5050');
    if(btn) {
        btn.classList.add('opacity-40', 'grayscale', 'cursor-not-allowed');
        btn.classList.remove('hover:scale-105', 'shadow-[0_5px_15px_rgba(147,51,234,0.3)]', 'cursor-pointer');
        let badge = document.getElementById('badge-5050');
        if(badge) {
            let newTotal = free5050 + (window.myPowerups?.fifty50 || 0);
            badge.innerText = newTotal;
            if(newTotal === 0) badge.style.display = 'none';
        }
    }
    
    let correctIdx = currentQuestions[currentIndex].correctIndex;
    let hiddenCount = 0;
    for(let i=0; i<4; i++) {
        if(i !== correctIdx && hiddenCount < 2) {
            let optBtn = document.getElementById(`opt-${i}`);
            if(optBtn) { optBtn.style.opacity = '0.2'; optBtn.style.pointerEvents = 'none'; }
            hiddenCount++;
        }
    }
}

window.useFreeze = function() {
    let totalFreeze = freeFreeze + (window.myPowerups?.freeze || 0);
    if(usedFreezeInRound || totalFreeze <= 0 || !isQuizActive) return;
    usedFreezeInRound = true;
    
    if (freeFreeze > 0) {
        freeFreeze--;
    } else {
        window.myPowerups.freeze -= 1;
        db.collection("users").doc(user.id).update({ powerups: window.myPowerups });
        let topInv = document.getElementById('inv-freeze');
        if(topInv) topInv.innerText = window.myPowerups.freeze;
    }
    
    let btn = document.getElementById('btn-freeze');
    if(btn) {
        btn.classList.add('opacity-40', 'grayscale', 'cursor-not-allowed');
        btn.classList.remove('hover:scale-105', 'shadow-[0_5px_15px_rgba(59,130,246,0.3)]', 'cursor-pointer');
        let badge = document.getElementById('badge-freeze');
        if(badge) {
            let newTotal = freeFreeze + (window.myPowerups?.freeze || 0);
            badge.innerText = newTotal;
            if(newTotal === 0) badge.style.display = 'none';
        }
    }
    
    globalTimeLeft += 10;
    let timerEl = document.getElementById('timer');
    if(timerEl) {
        timerEl.innerText = globalTimeLeft;
        timerEl.classList.add('border-blue-500', 'text-blue-300');
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
            if(selectedBtn) {
                selectedBtn.classList.add('border-green-500', 'bg-green-900/60', 'text-green-400', 'scale-[1.02]');
                selectedBtn.innerHTML += ` <i class="fas fa-check-circle float-left mt-1 text-xl drop-shadow-[0_0_10px_rgba(34,197,94,1)]"></i>`;
            }
        } else {
            if(selectedBtn) {
                selectedBtn.classList.add('border-red-500', 'bg-red-900/60', 'line-through', 'opacity-80');
                selectedBtn.innerHTML += ` <i class="fas fa-times-circle float-left mt-1 text-xl drop-shadow-[0_0_10px_rgba(239,68,68,1)]"></i>`;
            }
        }
    }
    setTimeout(() => { 
        currentIndex++; 
        used5050InRound = false; 
        usedFreezeInRound = false; 
        showQuestion(); 
    }, 1200);
}

function endQuiz() {
    isQuizActive = false;
    clearInterval(timerInterval);
    
    document.getElementById('quiz-content').innerHTML = `
        <div class="flex flex-col items-center justify-center py-10">
            <div class="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mb-4"></div>
            <p class="text-center font-bold text-yellow-500 text-lg animate-pulse">جاري توثيق المعركة...</p>
        </div>
    `;

    db.collection("users").doc(user.id).update({
        score: firebase.firestore.FieldValue.increment(sessionScore)
    }).then(() => {
        return db.collection("users").doc(user.id).collection("game_logs").doc("day_"+adminDay).set({
            day: adminDay, score: sessionScore, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        if(window.confetti) confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, colors: ['#fbbf24', '#f59e0b', '#d97706', '#ffffff'] });
        
        document.getElementById('quiz-content').innerHTML = `
            <div class="text-center p-2 relative">
                <div class="absolute inset-0 bg-gradient-to-b from-yellow-500/10 to-transparent rounded-3xl blur-2xl -z-10"></div>
                <div class="inline-block relative mb-4">
                    <div class="absolute inset-0 bg-yellow-500 blur-xl opacity-40 rounded-full animate-pulse"></div>
                    <div class="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-yellow-500 p-6 rounded-full relative z-10 shadow-[0_0_30px_rgba(212,175,55,0.4)]">
                        <i class="fas fa-trophy text-6xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-lg"></i>
                    </div>
                </div>
                <h2 class="text-3xl font-black mb-6 text-white drop-shadow-lg">انتهت المعركة! 🔥</h2>
                <div class="glass-card p-6 rounded-3xl border border-yellow-500/30 mb-8 w-full shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
                    <p class="text-gray-400 text-sm font-bold mb-1 uppercase tracking-wider">غنائمك اليوم</p>
                    <p class="text-6xl font-black text-yellow-400 drop-shadow-md mb-2">${sessionScore}</p>
                </div>
                <button onclick="window.location.replace('dashboard.html');" class="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-black py-4 rounded-xl shadow-lg hover:scale-105 transition-all text-xl">
                    العودة للمعسكر ⛺
                </button>
            </div>
        `;
    });
    }
                    
