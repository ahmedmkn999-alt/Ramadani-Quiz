let currentQuestions = [], currentIndex = 0, sessionScore = 0;
let timerInterval = null, globalTimeLeft = 15;
let isQuizActive = false;
let currentDayPlaying = 1;

window.openQuiz = function(day) {
    currentDayPlaying = day;
    // التحقق من أن اللاعب لم يلعب هذا اليوم بالفعل
    if (window.myLogs && window.myLogs[day] !== undefined) { 
        alert("أنت لعبت جولة النهاردة خلاص يا بطل! 🌙"); 
        return; 
    }
    
    document.getElementById('quiz-overlay').classList.remove('hidden');
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center p-6 bg-gray-900/50 rounded-[40px] border border-white/10">
            <h2 class="text-3xl font-black text-white mb-3 italic">الجولة ${day} 🔥</h2>
            <p class="text-gray-400 mb-8 font-bold">استعد للبدء، مفيش وقت للغش! 🛡️</p>
            <button onclick="startQuizFetch(${day})" class="w-full bg-yellow-500 text-black font-black p-5 rounded-2xl shadow-lg active:scale-95 transition-all">دخول الملعب ⚔️</button>
            <button onclick="closeQuizOverlay()" class="mt-4 text-gray-500 font-bold">تراجع</button>
        </div>`;
}

window.startQuizFetch = async function(day) {
    isQuizActive = true;
    document.getElementById('quiz-content').innerHTML = `
        <div class="flex flex-col items-center justify-center">
            <div class="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p class="text-center font-bold text-yellow-500">جاري سحب الأسئلة من المخازن...</p>
        </div>`;
    
    try {
        const doc = await db.collection("quizzes").doc(`day_${day}_v0`).get();

        if (!doc.exists) {
            alert("⚠️ الأسئلة لسه مرفعهاش الأدمن للجولة دي.");
            closeQuizOverlay();
            return;
        }

        const data = doc.data();
        currentQuestions = data.questions || [];
        
        if (currentQuestions.length === 0) {
            alert("عفواً، لا توجد أسئلة حالياً.");
            closeQuizOverlay();
            return;
        }

        currentIndex = 0; 
        sessionScore = 0;
        showQuestion();
    } catch (e) {
        console.error("Quiz Fetch Error:", e);
        alert("فشل في الاتصال بالسيرفر، حاول تاني.");
        closeQuizOverlay();
    }
}

function showQuestion() {
    if (currentIndex >= currentQuestions.length) {
        return endQuiz();
    }
    
    let q = currentQuestions[currentIndex];
    globalTimeLeft = 15;
    
    const questionText = q.text || "سؤال مفقود؟"; 
    const options = q.options || [];

    document.getElementById('quiz-content').innerHTML = `
        <div class="flex justify-between mb-4 px-2">
            <span class="text-[10px] font-bold text-gray-400 uppercase">سؤال ${currentIndex + 1} / ${currentQuestions.length}</span>
            <span class="text-[10px] font-bold text-yellow-500 uppercase">نقاط الجولة: ${sessionScore}</span>
        </div>
        
        <div class="glass-card p-6 rounded-[30px] mb-6 text-center border border-white/10 relative overflow-hidden">
            <div id="timer-bar" class="absolute bottom-0 left-0 h-1 bg-yellow-500 transition-all duration-1000" style="width: 100%"></div>
            <span id="timer" class="text-white font-black text-4xl mb-2 block">${globalTimeLeft}</span>
            <h3 class="text-lg font-bold text-white leading-relaxed">${questionText}</h3>
        </div>

        <div class="grid grid-cols-1 gap-3">
            ${options.map((opt, i) => `
                <button onclick="handleAnswer(${i})" id="opt-${i}" 
                    class="opt-btn bg-gray-800/50 p-4 w-full text-right rounded-2xl border border-white/5 font-bold text-white transition-all flex items-center hover:bg-gray-700">
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
        const timerEl = document.getElementById('timer');
        const barEl = document.getElementById('timer-bar');
        
        if (timerEl) timerEl.innerText = globalTimeLeft;
        if (barEl) barEl.style.width = (globalTimeLeft / 15 * 100) + "%";
        
        if (globalTimeLeft <= 0) {
            clearInterval(timerInterval);
            handleAnswer(-1); // الوقت خلص
        }
    }, 1000);
}

window.handleAnswer = function(idx) {
    clearInterval(timerInterval);
    
    const q = currentQuestions[currentIndex];
    const correctIdx = parseInt(q.answer); 
    
    const btns = document.querySelectorAll('.opt-btn');
    btns.forEach(b => b.disabled = true); // منع الضغط المتكرر

    if (idx === correctIdx) {
        sessionScore++;
        document.getElementById(`opt-${idx}`).classList.add('!bg-green-600', '!border-green-400', 'scale-95');
    } else {
        if(idx !== -1) {
            document.getElementById(`opt-${idx}`).classList.add('!bg-red-600', '!border-red-400', 'scale-95');
        }
        document.getElementById(`opt-${correctIdx}`).classList.add('!bg-green-600', '!border-green-400');
    }

    setTimeout(() => {
        currentIndex++;
        showQuestion();
    }, 1500);
}

async function endQuiz() {
    isQuizActive = false;
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center py-10">
            <div class="text-5xl mb-4">🏆</div>
            <h2 class="text-2xl font-black mb-2 text-white">عاش يا بطل! 🏁</h2>
            <p class="text-yellow-500 font-bold text-lg mb-6">جمعت ${sessionScore} نقطة</p>
            <p class="text-gray-400 animate-pulse text-sm">جاري تسجيل نتيجتك في اللوحة...</p>
        </div>`;
    
    try {
        const userRef = db.collection("users").doc(user.id);
        
        // استخدام Transaction لضمان الدقة
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const newScore = (userDoc.data().score || 0) + sessionScore;
            transaction.update(userRef, { score: newScore });
            
            const logRef = userRef.collection("game_logs").doc(`day_${currentDayPlaying}`);
            transaction.set(logRef, {
                day: currentDayPlaying,
                score: sessionScore,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        window.location.reload();
    } catch (err) {
        console.error("Save Error:", err);
        alert("حدث خطأ في الحفظ، صور الشاشة وكلم الإدارة.");
    }
}

window.closeQuizOverlay = function() {
    document.getElementById('quiz-overlay').classList.add('hidden');
    isQuizActive = false;
    clearInterval(timerInterval);
            }
        
