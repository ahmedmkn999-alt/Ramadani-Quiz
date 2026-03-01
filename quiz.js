let currentQuestions = [], currentIndex = 0, sessionScore = 0;
let timerInterval = null, globalTimeLeft = 15;
let isQuizActive = false;
let used5050InRound = false, usedFreezeInRound = false;
let free5050 = 1, freeFreeze = 1;

// 🛡️ نظام الحماية العالمي - منع الدخول إلا من التطبيق الرسمي
const isOfficialApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
if (!isOfficialApp) {
    alert("⛔ تم اكتشاف محاولة دخول غير مصرح بها. يجب تشغيل اللعبة من أيقونة التطبيق على الشاشة الرئيسية لمنع الغش.");
    window.location.replace('index.html');
}

window.openQuiz = function(day) {
    if (myLogs[day] !== undefined) { 
        window.showAlert("انتباه!", "أنت لعبت الجولة دي خلاص يا بطل!", "⚠️", "error"); 
        return; 
    }
    // حماية إضافية: منع كليك يمين أو اختصارات المطورين أثناء الكويز
    document.onkeydown = (e) => { if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && e.keyCode == 73)) return false; };
    
    document.body.classList.add('hide-ads'); 
    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center">
            <h2 class="text-3xl font-black text-white mb-3">الجولة ${day} 🔥</h2>
            <p class="text-gray-300 text-sm mb-8">نظام مكافحة الغش نشط 🛡️</p>
            <div class="flex gap-4">
                <button onclick="startQuizFetch(${day})" class="flex-1 bg-green-500 text-black font-black p-4 rounded-xl shadow-lg">إبدأ التحدي ⚔️</button>
            </div>
        </div>`;
}

window.startQuizFetch = async function(day) {
    isQuizActive = true;
    document.getElementById('quiz-content').innerHTML = `<p class="text-center font-bold text-yellow-500 animate-pulse">جاري التحقق من النزاهة وتجهيز الأسئلة...</p>`;
    
    try {
        // سحب الأسئلة من المسار الصحيح (تأكد أن الأدمن يرفعها بهذا الاسم)
        const doc = await db.collection("quizzes").doc(`day_${day}_v0`).get();

        if (!doc.exists) {
            window.showAlert("عفواً", "الأسئلة غير متوفرة لهذه الجولة حالياً.", "⏳");
            closeQuizOverlay();
            return;
        }

        const data = doc.data();
        currentQuestions = data.questions;
        
        // تأكد أن الأسئلة موجودة وليست undefined
        if (!currentQuestions || currentQuestions.length === 0) {
            throw new Error("Data format error");
        }

        currentIndex = 0; 
        sessionScore = 0;
        free5050 = 1; 
        freeFreeze = 1;
        showQuestion();
    } catch (e) {
        console.error("Quiz Fetch Error:", e);
        window.showAlert("خطأ فني", "فشل تحميل الأسئلة. تأكد من جودة الإنترنت.", "❌");
        closeQuizOverlay();
    }
}

function showQuestion() {
    if (currentIndex >= currentQuestions.length) return endQuiz();
    
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 15;
    
    // حل مشكلة الـ undefined: التأكد من عرض نص السؤال والخيارات
    const questionText = q.q || q.question || "سؤال مفقود؟";
    const options = q.options || [];

    document.getElementById('quiz-content').innerHTML = `
        <div class="flex justify-between mb-4 px-2">
            <span class="text-xs font-bold text-gray-400">سؤال ${currentIndex + 1} من ${currentQuestions.length}</span>
            <span class="text-xs font-bold text-yellow-500">نقاطك: ${sessionScore}</span>
        </div>
        
        <div class="glass-card p-6 rounded-3xl mb-6 text-center border-2 border-yellow-500/20 shadow-2xl relative overflow-hidden">
            <div id="timer-bar" class="absolute bottom-0 left-0 h-1 bg-red-500 transition-all duration-1000" style="width: 100%"></div>
            <span id="timer" class="text-white font-black text-4xl mb-4 block">${globalTimeLeft}</span>
            <h3 class="text-xl font-black text-white leading-tight">${questionText}</h3>
        </div>

        <div class="grid grid-cols-1 gap-3">
            ${options.map((opt, i) => `
                <button onclick="handleAnswer(${i})" 
                        id="opt-${i}" 
                        class="opt-btn bg-gray-800/80 hover:bg-gray-700 p-4 w-full text-right rounded-2xl border border-gray-600 font-bold text-white transition-all active:scale-95">
                    <span class="inline-block w-8 h-8 bg-gray-900 rounded-lg text-center leading-8 ml-3 text-yellow-500 text-sm">${i+1}</span>
                    ${opt}
                </button>
            `).join('')}
        </div>

        <div class="flex gap-3 mt-6">
            <button onclick="use5050()" id="btn-5050" class="flex-1 bg-purple-900/40 p-4 rounded-2xl border border-purple-500/50 text-white font-black text-xs flex items-center justify-center gap-2">
                <i class="fas fa-cut"></i> حذف إجابتين (${free5050 + (window.myPowerups.fifty50||0)})
            </button>
            <button onclick="useFreeze()" id="btn-freeze" class="flex-1 bg-blue-900/40 p-4 rounded-2xl border border-blue-500/50 text-white font-black text-xs flex items-center justify-center gap-2">
                <i class="fas fa-snowflake"></i> تجميد (${freeFreeze + (window.myPowerups.freeze||0)})
            </button>
        </div>
    `;

    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        globalTimeLeft--;
        const timerEl = document.getElementById('timer');
        const barEl = document.getElementById('timer-bar');
        
        if (timerEl) timerEl.innerText = globalTimeLeft;
        if (barEl) barEl.style.width = (globalTimeLeft / 15 * 100) + "%";

        if (globalTimeLeft <= 0) {
            handleAnswer(-1); // الوقت خلص
        }
    }, 1000);
}

window.handleAnswer = function(selectedIndex) {
    clearInterval(timerInterval);
    
    // تعطيل الأزرار لمنع الضغط المتكرر
    const buttons = document.querySelectorAll('.opt-btn');
    buttons.forEach(btn => btn.disabled = true);

    const correctIndex = currentQuestions[currentIndex].correctIndex;
    const correctBtn = document.getElementById(`opt-${correctIndex}`);
    const selectedBtn = document.getElementById(`opt-${selectedIndex}`);

    if (selectedIndex === correctIndex) {
        sessionScore++;
        if (selectedBtn) selectedBtn.classList.replace('bg-gray-800/80', 'bg-green-600');
    } else {
        if (selectedBtn) selectedBtn.classList.replace('bg-gray-800/80', 'bg-red-600');
        if (correctBtn) correctBtn.classList.replace('bg-gray-800/80', 'bg-green-600');
    }

    // الانتقال للسؤال التالي بعد ثانية ونصف
    setTimeout(() => {
        currentIndex++;
        used5050InRound = false;
        usedFreezeInRound = false;
        showQuestion();
    }, 1500);
}

function endQuiz() {
    isQuizActive = false;
    clearInterval(timerInterval);
    document.getElementById('quiz-content').innerHTML = `<p class="text-center font-bold text-yellow-500">جاري حفظ النتيجة بنجاح...</p>`;
    
    // 🛡️ تشفير بسيط للنتيجة قبل الرفع (حماية ضد التلاعب بالـ Console)
    const secureScore = Number(sessionScore);

    db.collection("users").doc(user.id).update({
        score: firebase.firestore.FieldValue.increment(secureScore)
    }).then(() => {
        return db.collection("users").doc(user.id).collection("game_logs").doc(`day_${adminDay}`).set({
            day: adminDay,
            score: secureScore,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        window.location.reload();
    }).catch(err => {
        console.error("Final Save Error:", err);
        alert("حدث خطأ أثناء حفظ النتيجة، تواصل مع الإدارة.");
    });
}

// ... دوال use5050 و useFreeze تفضل زي ما هي مع التأكد من تحديث الـ UI ...
    
