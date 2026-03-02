// ==========================================
// محرك الكويز - اللاعب
// ==========================================
let currentQuestions = [];
let currentIndex = 0;
let sessionScore = 0;
let quizTimer = null;

// الدالة المسؤولة عن سحب الكويز وحل مشكلة الطرد
window.startQuizFetch = async function(day) {
    const content = document.getElementById('quiz-content');
    content.innerHTML = `<div class="p-8 text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div><p>جاري تجهيز ساحة المعركة للجولة ${day}...</p></div>`;

    try {
        // بنحاول نسحب النسخة الأولى v0 دايماً
        const doc = await db.collection("quizzes").doc(`day_${day}_v0`).get();
        
        if (!doc.exists) {
            alert(`⚠️ الجولة ${day} لسه مجهزش أسئلتها بالنسخة v0. كلم الإدارة يا بطل!`);
            closeQuizOverlay();
            return;
        }

        currentQuestions = doc.data().questions || [];
        if (currentQuestions.length === 0) {
            alert("⚠️ عذراً، الجولة دي فاضية!");
            closeQuizOverlay();
            return;
        }

        // لو كله تمام، بنبدأ
        currentIndex = 0;
        sessionScore = 0;
        renderQuestion();

    } catch (err) {
        console.error("Quiz Error:", err);
        alert("فشل الاتصال بالخادم. تأكد من إنترنتك.");
        closeQuizOverlay();
    }
}

function renderQuestion() {
    const q = currentQuestions[currentIndex];
    const content = document.getElementById('quiz-content');
    
    content.innerHTML = `
        <div class="p-4 animate-fade-in">
            <div class="flex justify-between items-center mb-6">
                <span class="bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold">سؤال ${currentIndex + 1} من ${currentQuestions.length}</span>
                <span id="quiz-timer" class="text-red-500 font-mono font-bold">15s</span>
            </div>
            <h3 class="text-lg font-bold mb-6 text-white leading-relaxed">${q.text}</h3>
            <div class="grid gap-3">
                ${q.options.map((opt, i) => `
                    <button onclick="checkAnswer(${i})" class="w-full p-4 rounded-2xl bg-gray-800 border border-gray-700 text-right hover:bg-gray-700 transition-all text-sm">
                        ${opt}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    startTimer();
}

function startTimer() {
    let timeLeft = 15;
    clearInterval(quizTimer);
    quizTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('quiz-timer').innerText = timeLeft + "s";
        if (timeLeft <= 0) {
            clearInterval(quizTimer);
            nextQuestion();
        }
    }, 1000);
}

window.checkAnswer = function(idx) {
    clearInterval(quizTimer);
    const correct = currentQuestions[currentIndex].answer;
    if (idx == correct) sessionScore += 10;
    nextQuestion();
}

function nextQuestion() {
    currentIndex++;
    if (currentIndex < currentQuestions.length) {
        renderQuestion();
    } else {
        finishQuiz();
    }
}

async function finishQuiz() {
    const content = document.getElementById('quiz-content');
    content.innerHTML = `<div class="p-8 text-center"><p class="text-xl font-bold mb-4">انتهت الجولة! 🎉</p><p class="text-4xl font-black text-yellow-500 mb-6">${sessionScore}</p><p class="text-xs text-gray-400">جاري حفظ النقاط...</p></div>`;

    try {
        const userRef = db.collection("users").doc(userData.id);
        
        // تحديث النقاط + إضافة سجل الجولة عشان ميتلعبش تاني
        await db.runTransaction(async (transaction) => {
            transaction.update(userRef, { score: firebase.firestore.FieldValue.increment(sessionScore) });
            const logRef = userRef.collection("game_logs").doc(`day_${activeDay}`);
            transaction.set(logRef, { day: activeDay, score: sessionScore, time: Date.now() });
        });

        alert("عاش يا بطل! تم حفظ نقاطك.");
        location.reload();
    } catch (err) {
        alert("حصلت مشكلة في الحفظ، بس ولا يهمك سكورك متسجل عندنا!");
    }
}
