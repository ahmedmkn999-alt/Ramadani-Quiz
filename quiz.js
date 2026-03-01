let currentQuestions = [], currentIndex = 0, sessionScore = 0;
let timerInterval = null, globalTimeLeft = 15;
let isQuizActive = false;
let used5050InRound = false, usedFreezeInRound = false;
let free5050 = 1, freeFreeze = 1;

window.openQuiz = function(day) {
    if (myLogs[day] !== undefined) { 
        window.showAlert("انتباه!", "أنت لعبت الجولة دي خلاص يا بطل!", "⚠️", "error"); 
        return; 
    }
    document.body.classList.add('hide-ads'); 
    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center">
            <h2 class="text-3xl font-black text-white mb-3">الجولة ${day} 🔥</h2>
            <p class="text-gray-300 text-sm mb-8">لديك (1) تجميد و (1) حذف مجاناً.</p>
            <div class="flex gap-4">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-green-500 text-black font-black p-4 rounded-xl">جاهز ⚔️</button>
                <button onclick="closeQuizOverlay()" class="flex-1 bg-gray-800 text-white font-bold p-4 rounded-xl">تراجع</button>
            </div>
        </div>`;
}

window.startQuizFetch = async function(day) {
    isQuizActive = true;
    document.getElementById('quiz-content').innerHTML = `<p class="text-center font-bold text-yellow-500 animate-pulse">جاري تجهيز الأسئلة...</p>`;
    
    try {
        // الأدمن بيحفظ الأسئلة في مجموعة quizzes والـ ID بيكون day_X_v0
        const quizRef = db.collection("quizzes").doc(`day_${day}_v0`);
        const doc = await quizRef.get();

        if (!doc.exists) {
            window.showAlert("عفواً", "الأسئلة جاري رفعها حالياً، جرب كمان شوية.", "⏳");
            closeQuizOverlay();
            return;
        }

        currentQuestions = doc.data().questions;
        if (!currentQuestions || currentQuestions.length === 0) throw new Error("Empty Quiz");

        currentIndex = 0; sessionScore = 0;
        free5050 = 1; freeFreeze = 1;
        showQuestion();
    } catch (e) {
        console.error(e);
        window.showAlert("خطأ", "حدثت مشكلة في تحميل الأسئلة.", "❌");
        closeQuizOverlay();
    }
}

function showQuestion() {
    if(currentIndex >= currentQuestions.length) return endQuiz();
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 15;
    
    // رسم واجهة السؤال (نفس التصميم اللي بعتهولي)
    document.getElementById('quiz-content').innerHTML = `
        <div class="flex justify-between mb-4"><span class="text-xs">سؤال ${currentIndex+1}/${currentQuestions.length}</span><span class="text-xs text-yellow-500">نقاط: ${sessionScore}</span></div>
        <div class="glass-card p-4 rounded-2xl mb-4 text-center border border-yellow-500/20">
            <span id="timer" class="text-white font-black text-3xl bg-gray-900 border-2 border-red-500 px-4 py-1 rounded-xl mb-3 inline-block">${globalTimeLeft}</span>
            <h3 class="text-lg font-black text-white">${q.q}</h3>
        </div>
        <div class="space-y-3">
            ${q.options.map((opt, i) => `<button onclick="handleAnswer(${i})" class="opt-btn bg-gray-800 p-4 w-full text-right rounded-xl border border-gray-600 font-bold" id="opt-${i}">${opt}</button>`).join('')}
        </div>
        <div class="flex gap-3 mt-5">
            <button onclick="use5050()" id="btn-5050" class="flex-1 bg-purple-900/50 p-3 rounded-xl border border-purple-500 text-xs font-bold">إجابتين (${free5050 + (window.myPowerups.fifty50||0)})</button>
            <button onclick="useFreeze()" id="btn-freeze" class="flex-1 bg-blue-900/50 p-3 rounded-xl border border-blue-500 text-xs font-bold">تجميد (${freeFreeze + (window.myPowerups.freeze||0)})</button>
        </div>`;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        globalTimeLeft--;
        if(document.getElementById('timer')) document.getElementById('timer').innerText = globalTimeLeft;
        if(globalTimeLeft <= 0) handleAnswer(-1);
    }, 1000);
}

// ... بقية دوال handleAnswer و endQuiz و use5050 زي ما هي عندك ...
// فقط تأكد من استبدال دالة endQuiz بـ adminDay بدل variables تانية
function endQuiz() {
    isQuizActive = false;
    clearInterval(timerInterval);
    db.collection("users").doc(user.id).update({
        score: firebase.firestore.FieldValue.increment(sessionScore)
    }).then(() => {
        return db.collection("users").doc(user.id).collection("game_logs").doc("day_"+adminDay).set({
            day: adminDay, score: sessionScore, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        location.reload();
    });
}
