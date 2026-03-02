let currentQuestions = [], currentIndex = 0, sessionScore = 0;
let timerInterval = null, globalTimeLeft = 15;
let isQuizActive = false;
let currentDayPlaying = 1;

// 🛡️ الحماية: منع الدخول إلا من التطبيق (PWA)
const isOfficial = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
if (!isOfficial && !window.location.href.includes('localhost') && !window.location.href.includes('127.0.0.1')) {
    alert("⛔ التحدي متاح فقط من خلال أيقونة التطبيق على الشاشة الرئيسية.");
    window.location.replace('index.html');
}

window.openQuiz = function(day) {
    currentDayPlaying = day;
    // التأكد من أن المستخدم لم يلعب الجولة
    if (window.myLogs && window.myLogs[day] !== undefined) { 
        alert("أنت لعبت الجولة دي خلاص يا بطل! 🏁"); 
        return; 
    }
    
    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center p-6 bg-gray-900/50 rounded-[40px] border border-white/10">
            <h2 class="text-4xl font-black text-white mb-2 italic">الجولة ${day}</h2>
            <p class="text-yellow-500 font-bold mb-8">استعد، التحدي هيبدأ حالاً ⚔️</p>
            <button onclick="startQuizFetch(${day})" class="w-full bg-yellow-500 text-black font-black p-5 rounded-2xl shadow-[0_10px_20px_rgba(234,179,8,0.3)] active:scale-95 transition-all">دخول الملعب</button>
            <button onclick="closeQuizOverlay()" class="mt-4 text-gray-500 font-bold text-sm">تراجع</button>
        </div>`;
}

window.startQuizFetch = async function(day) {
    isQuizActive = true;
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center">
            <div class="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p class="font-bold text-yellow-500">جاري سحب الأسئلة الآمنة...</p>
        </div>`;
    
    try {
        const doc = await db.collection("quizzes").doc(`day_${day}_v0`).get();
        if (!doc.exists) {
            alert("⚠️ الأسئلة غير متاحة حالياً، انتظر فتحها من الأدمن.");
            closeQuizOverlay();
            return;
        }

        const data = doc.data();
        currentQuestions = data.questions || [];
        
        if (currentQuestions.length === 0) {
            alert("لا توجد أسئلة في هذه الجولة.");
            closeQuizOverlay();
            return;
        }

        currentIndex = 0; sessionScore = 0;
        showQuestion();
    } catch (e) {
        alert("فشل الاتصال بالمخازن، تأكد من الإنترنت.");
        closeQuizOverlay();
    }
}

function showQuestion() {
    if (currentIndex >= currentQuestions.length) return endQuiz();
    
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 15;
    
    // ربط مع هيكلة لوحة التحكم (text, options)
    const questionText = q.text || "سؤال مفقود؟"; 
    const options = q.options || [];

    document.getElementById('quiz-content').innerHTML = `
        <div class="flex justify-between mb-4 px-2">
            <span class="text-[10px] font-bold text-gray-500 uppercase">سؤال ${currentIndex + 1} / ${currentQuestions.length}</span>
            <span class="text-[10px] font-bold text-yellow-500 uppercase">النقاط: ${sessionScore}</span>
        </div>
        
        <div class="glass-card p-8 rounded-[35px] mb-6 text-center border border-white/10 relative overflow-hidden shadow-2xl">
            <div id="timer-bar" class="absolute bottom-0 left-0 h-1 bg-yellow-500 transition-all duration-1000" style="width: 100%"></div>
            <span id="timer" class="text-white font-black text-5xl mb-4 block">${globalTimeLeft}</span>
            <h3 class="text-xl font-bold text-white leading-relaxed">${questionText}</h3>
        </div>

        <div class="grid grid-cols-1 gap-3">
            ${options.map((opt, i) => `
                <button onclick="handleAnswer(${i})" id="opt-${i}" 
                    class="opt-btn bg-gray-800/40 hover:bg-gray-700/60 p-5 w-full text-right rounded-2xl border border-white/5 font-bold text-white transition-all flex items-center">
                    <span class="w-8 h-8 bg-black/40 rounded-lg text-center leading-8 ml-3 text-yellow-500 text-xs font-black">${i+1}</span>
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
    const correctIdx = parseInt(currentQuestions[currentIndex].answer); 
    const btns = document.querySelectorAll('.opt-btn');
    btns.forEach(b => b.disabled = true);

    if (idx === correctIdx) {
        sessionScore++;
        document.getElementById(`opt-${idx}`)?.classList.add('!bg-green-600', '!border-green-400', 'scale-95');
    } else {
        if(idx !== -1) document.getElementById(`opt-${idx}`)?.classList.add('!bg-red-600', '!border-red-400', 'scale-95');
        document.getElementById(`opt-${correctIdx}`)?.classList.add('!bg-green-600', '!border-green-400');
    }

    setTimeout(() => {
        currentIndex++;
        showQuestion();
    }, 1200);
}

function endQuiz() {
    isQuizActive = false;
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center py-10">
            <div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
                <i class="fas fa-flag-checkered text-3xl text-black"></i>
            </div>
            <h2 class="text-2xl font-black mb-1 text-white">انتهى التحدي</h2>
            <p class="text-yellow-500 font-bold text-xl mb-8">جمعت ${sessionScore} نقطة</p>
            <p class="text-gray-500 animate-pulse">جاري تشفير وحفظ النتيجة...</p>
        </div>`;
    
    const uid = JSON.parse(localStorage.getItem('currentUser')).id;
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
    }).catch(() => alert("خطأ في الحفظ! راجع استقرار الإنترنت."));
}

function closeQuizOverlay() {
    document.getElementById('quiz-overlay').style.display = 'none';
    isQuizActive = false;
    clearInterval(timerInterval);
}
