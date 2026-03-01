let currentQuestions = [], currentIndex = 0, sessionScore = 0;
let timerInterval = null, globalTimeLeft = 15;
let isQuizActive = false;
let currentDayPlaying = 1;

// 🛡️ حماية الآيفون والتطبيق الرسمي
const isOfficialApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
if (!isOfficialApp && !window.location.href.includes('localhost')) {
    alert("⛔ يجب تشغيل اللعبة من أيقونة التطبيق على الشاشة الرئيسية.");
    window.location.replace('index.html');
}

window.openQuiz = function(day) {
    currentDayPlaying = day;
    // التأكد من أن المستخدم لم يلعب الجولة (بناءً على myLogs اللي في app.js)
    if (window.myLogs && window.myLogs[day] !== undefined) { 
        alert("أنت لعبت الجولة دي خلاص يا بطل!"); 
        return; 
    }
    
    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center p-6">
            <h2 class="text-3xl font-black text-white mb-3 italic">الجولة ${day} 🔥</h2>
            <p class="text-gray-400 mb-8 font-bold">استعد للبدء، مفيش وقت للغش! 🛡️</p>
            <button onclick="startQuizFetch(${day})" class="w-full bg-yellow-500 text-black font-black p-4 rounded-2xl shadow-lg active:scale-95 transition-transform">دخول الملعب ⚔️</button>
        </div>`;
}

window.startQuizFetch = async function(day) {
    isQuizActive = true;
    document.getElementById('quiz-content').innerHTML = `<p class="text-center font-bold text-yellow-500 animate-pulse">جاري سحب الأسئلة من المخازن...</p>`;
    
    try {
        // 🛠️ مطابق للوحة التحكم: بنسحب النسخة v0 تلقائياً
        const doc = await db.collection("quizzes").doc(`day_${day}_v0`).get();

        if (!doc.exists) {
            alert("⚠️ الأسئلة لسه مرفعهاش الأدمن للجولة دي.");
            closeQuizOverlay();
            return;
        }

        const data = doc.data();
        currentQuestions = data.questions || [];
        
        if (currentQuestions.length === 0) {
            alert("عفواً، لا توجد أسئلة.");
            closeQuizOverlay();
            return;
        }

        currentIndex = 0; 
        sessionScore = 0;
        showQuestion();
    } catch (e) {
        console.error("Quiz Error:", e);
        alert("فشل في تحميل الأسئلة.");
        closeQuizOverlay();
    }
}

function showQuestion() {
    if (currentIndex >= currentQuestions.length) return endQuiz();
    
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 15;
    
    // ✅ مطابقة الأسماء مع لوحة التحكم (text و options)
    const questionText = q.text || "سؤال مفقود؟"; 
    const options = q.options || [];

    document.getElementById('quiz-content').innerHTML = `
        <div class="flex justify-between mb-4 px-2">
            <span class="text-[10px] font-bold text-gray-400 uppercase">سؤال ${currentIndex + 1} / ${currentQuestions.length}</span>
            <span class="text-[10px] font-bold text-yellow-500 uppercase">نقاطك: ${sessionScore}</span>
        </div>
        
        <div class="glass-card p-6 rounded-[30px] mb-6 text-center border border-white/10 relative overflow-hidden">
            <div id="timer-bar" class="absolute bottom-0 left-0 h-1 bg-yellow-500 transition-all duration-1000" style="width: 100%"></div>
            <span id="timer" class="text-white font-black text-4xl mb-2 block">${globalTimeLeft}</span>
            <h3 class="text-lg font-bold text-white leading-relaxed">${questionText}</h3>
        </div>

        <div class="grid grid-cols-1 gap-3">
            ${options.map((opt, i) => `
                <button onclick="handleAnswer(${i})" id="opt-${i}" 
                    class="opt-btn bg-gray-800/50 p-4 w-full text-right rounded-2xl border border-white/5 font-bold text-white transition-all flex items-center">
                    <span class="w-8 h-8 bg-black/30 rounded-lg text-center leading-8 ml-3 text-yellow-500 text-xs">${i+1}</span>
                    ${opt}
                </button>
            `).join('')}
        </div>
    `;

    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        globalTimeLeft--;
        if (document.getElementById('timer')) document.getElementById('timer').innerText = globalTimeLeft;
        if (document.getElementById('timer-bar')) document.getElementById('timer-bar').style.width = (globalTimeLeft / 15 * 100) + "%";
        if (globalTimeLeft <= 0) handleAnswer(-1);
    }, 1000);
}

window.handleAnswer = function(idx) {
    clearInterval(timerInterval);
    
    // ✅ مطابق للوحة التحكم: الإجابة اسمها answer وبيكون نوعها string في اللوحة
    const correctIdx = parseInt(currentQuestions[currentIndex].answer); 
    
    const btns = document.querySelectorAll('.opt-btn');
    btns.forEach(b => b.disabled = true);

    if (idx === correctIdx) {
        sessionScore++;
        document.getElementById(`opt-${idx}`)?.classList.add('!bg-green-600', '!border-green-400');
    } else {
        if(idx !== -1) document.getElementById(`opt-${idx}`)?.classList.add('!bg-red-600', '!border-red-400');
        document.getElementById(`opt-${correctIdx}`)?.classList.add('!bg-green-600', '!border-green-400');
    }

    setTimeout(() => {
        currentIndex++;
        showQuestion();
    }, 1500);
}

function endQuiz() {
    isQuizActive = false;
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center py-10">
            <h2 class="text-2xl font-black mb-2 text-white">عاش يا بطل! 🏁</h2>
            <p class="text-yellow-500 font-bold text-lg mb-6">جمعت ${sessionScore} نقطة</p>
            <p class="text-gray-400 animate-pulse text-sm">جاري تسجيل نتيجتك في اللوحة...</p>
        </div>`;
    
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const uid = currentUser.id;

    // تحديث النقاط + إضافة اللوج (Log)
    db.collection("users").doc(uid).update({
        score: firebase.firestore.FieldValue.increment(sessionScore)
    }).then(() => {
        return db.collection("users").doc(uid).collection("game_logs").doc(`day_${currentDayPlaying}`).set({
            day: currentDayPlaying,
            score: sessionScore,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        window.location.reload();
    }).catch(err => {
        alert("حدث خطأ في الحفظ، صور الشاشة وكلم الإدارة.");
    });
}

function closeQuizOverlay() {
    document.getElementById('quiz-overlay').style.display = 'none';
    isQuizActive = false;
    clearInterval(timerInterval);
            }
