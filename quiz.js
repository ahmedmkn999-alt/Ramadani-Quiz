let currentQuestions = [], currentIndex = 0, sessionScore = 0;
let timerInterval = null, globalTimeLeft = 20;
let isQuizActive = false;
let used5050InRound = false, usedFreezeInRound = false;

window.openQuiz = function(day) {
    document.body.classList.add('hide-ads'); 
    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center relative z-10">
            <h2 class="text-3xl font-black text-white mb-3">مستعد للمواجهة؟ 🔥</h2>
            <p class="text-gray-300 text-sm mb-8">بمجرد دخولك سيبدأ التحدي. لا توجد فرصة للرجوع!</p>
            <div class="flex gap-4">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-green-500 text-black font-black p-4 rounded-xl">جاهز ⚔️</button>
                <button onclick="closeQuizOverlay()" class="flex-1 bg-gray-800 text-white font-bold p-4 rounded-xl">تراجع ✋</button>
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
    document.getElementById('quiz-content').innerHTML = `<p class="text-center font-bold text-yellow-500 text-lg">جاري تجهيز ساحة المعركة...</p>`;
    used5050InRound = false; usedFreezeInRound = false;

    db.collection("quizzes_pool").doc("day_" + day).get().then(doc => {
        if(doc.exists && doc.data().variations) {
            let variationsObj = doc.data().variations;
            let availableKeys = Object.keys(variationsObj); 
            currentQuestions = variationsObj[availableKeys[Math.floor(Math.random() * availableKeys.length)]].questions;
            currentIndex = 0; sessionScore = 0;
            showQuestion();
        }
    });
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) return endQuiz();
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 20;
    
    let count5050 = window.myPowerups.fifty50;
    let countFreeze = window.myPowerups.freeze;
    let btn50Class = (count5050 > 0 && !used5050InRound) ? "hover:scale-105 shadow-[0_5px_15px_rgba(147,51,234,0.3)] cursor-pointer" : "opacity-40 grayscale cursor-not-allowed";
    let btnFreezeClass = (countFreeze > 0 && !usedFreezeInRound) ? "hover:scale-105 shadow-[0_5px_15px_rgba(59,130,246,0.3)] cursor-pointer" : "opacity-40 grayscale cursor-not-allowed";

    let html = `
        <div class="flex justify-between items-center mb-4 px-1">
            <div class="bg-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-300">سؤال <span class="text-yellow-400">${currentIndex+1}</span> / ${currentQuestions.length}</div>
            <div class="bg-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-300">نقاط: <span class="text-yellow-400">${sessionScore}</span></div>
        </div>

        <div class="glass-card p-4 rounded-2xl mb-4 text-center">
            <span id="timer" class="text-white font-black text-2xl bg-gray-900 border-2 border-red-500/80 px-3 py-1 rounded-xl mb-3 inline-block">${globalTimeLeft}</span>
            <h3 class="text-lg md:text-xl font-black text-white drop-shadow-md">${q.q}</h3>
        </div>
        
        <div class="space-y-2">
            ${q.options.map((opt, i) => `<button onclick="handleAnswer(${i})" class="opt-btn bg-gray-800/90 p-3 w-full text-right rounded-xl border border-gray-600 font-bold text-gray-200" id="opt-${i}">${opt}</button>`).join('')}
        </div>
        
        <div class="flex justify-between mt-4 gap-3 border-t border-gray-700/50 pt-3">
            <div onclick="use5050()" class="flex-1 relative ${btn50Class} transition-all">
                ${count5050 > 0 ? `<div class="powerup-badge">${count5050}</div>` : ''}
                <div class="bg-gray-900 border border-purple-500/50 px-3 py-2 rounded-lg flex items-center justify-center gap-2">
                    <i class="fas fa-cut text-purple-400"></i><span class="text-xs font-black text-gray-200">إجابتين</span>
                </div>
            </div>
            <div onclick="useFreeze()" class="flex-1 relative ${btnFreezeClass} transition-all">
                ${countFreeze > 0 ? `<div class="powerup-badge">${countFreeze}</div>` : ''}
                <div class="bg-gray-900 border border-blue-500/50 px-3 py-2 rounded-lg flex items-center justify-center gap-2">
                    <i class="fas fa-snowflake text-blue-400"></i><span class="text-xs font-black text-gray-200">تجميد</span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('quiz-content').innerHTML = html;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        globalTimeLeft--;
        document.getElementById('timer').innerText = globalTimeLeft;
        if(globalTimeLeft <= 0) handleAnswer(-1);
    }, 1000);
}

window.use5050 = function() {
    if(used5050InRound || window.myPowerups.fifty50 <= 0 || !isQuizActive) return;
    used5050InRound = true;
    window.myPowerups.fifty50 -= 1;
    db.collection("users").doc(user.id).update({ powerups: window.myPowerups });
    document.getElementById('inv-5050').innerText = window.myPowerups.fifty50;
    
    let correctIdx = currentQuestions[currentIndex].correctIndex;
    let hiddenCount = 0;
    for(let i=0; i<4; i++) {
        if(i !== correctIdx && hiddenCount < 2) {
            let optBtn = document.getElementById(`opt-${i}`);
            if(optBtn) { optBtn.style.opacity = '0.2'; optBtn.style.pointerEvents = 'none'; }
            hiddenCount++;
        }
    }
    showQuestion();
}

window.useFreeze = function() {
    if(usedFreezeInRound || window.myPowerups.freeze <= 0 || !isQuizActive) return;
    usedFreezeInRound = true;
    window.myPowerups.freeze -= 1;
    db.collection("users").doc(user.id).update({ powerups: window.myPowerups });
    document.getElementById('inv-freeze').innerText = window.myPowerups.freeze;
    
    globalTimeLeft += 10;
    document.getElementById('timer').innerText = globalTimeLeft;
    showQuestion(); 
}

window.handleAnswer = function(i) {
    clearInterval(timerInterval);
    document.querySelectorAll('.opt-btn').forEach(btn => btn.style.pointerEvents = 'none');
    
    let correctIdx = currentQuestions[currentIndex].correctIndex;
    if(i !== -1) {
        let selectedBtn = document.getElementById(`opt-${i}`);
        if(i === correctIdx) {
            sessionScore++;
            if(selectedBtn) selectedBtn.classList.add('border-green-500', 'bg-green-900/60', 'text-green-400');
        } else {
            if(selectedBtn) selectedBtn.classList.add('border-red-500', 'bg-red-900/60', 'line-through');
        }
    }
    setTimeout(() => { currentIndex++; used5050InRound = false; usedFreezeInRound = false; showQuestion(); }, 1200);
}

function endQuiz() {
    isQuizActive = false;
    clearInterval(timerInterval);
    document.getElementById('quiz-content').innerHTML = `<p class="text-center font-bold text-yellow-500 text-lg">جاري توثيق المعركة...</p>`;

    db.collection("users").doc(user.id).update({
        score: firebase.firestore.FieldValue.increment(sessionScore)
    }).then(() => {
        return db.collection("users").doc(user.id).collection("game_logs").doc("day_"+adminDay).set({
            day: adminDay, score: sessionScore, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        alert("المعركة انتهت! غنائمك: " + sessionScore);
        window.location.reload();
    });
}
