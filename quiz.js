// ==========================================
// محرك الكويز (Quiz Engine)
// ==========================================
let currentQuestions = [], currentIndex = 0, sessionScore = 0;
let timerInterval = null, globalTimeLeft = 20;
let isQuizActive = false;
let used5050 = false, usedFreeze = false;

function vibratePhone(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
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
            <p class="text-gray-300 text-sm mb-8 leading-relaxed px-4">بمجرد دخولك سيبدأ التحدي.<br>لا توجد فرصة للرجوع، وأي محاولة خروج تعتبر غش!</p>
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
                throw new Error("لا توجد أسئلة");
            }
        } else {
            throw new Error("لم يتم تجهيز الجولة");
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
        <div class="absolute top-0 left-0 w-full h-1.5 bg-gray-900 rounded-t-2xl overflow-hidden z-50">
            <div class="bg-gradient-to-r from-yellow-600 via-yellow-300 to-yellow-600 h-full transition-all duration-500 shadow-[0_0_15px_rgba(212,175,55,1)]" style="width: ${progressPercent}%"></div>
        </div>

        <div class="flex justify-between items-center mb-4 mt-2 px-1 relative z-10">
            <div class="bg-gray-800/80 border border-gray-700/50 px-3 py-1 rounded-full shadow-inner flex items-center gap-1.5">
                <i class="fas fa-crosshairs text-yellow-500 text-[10px] animate-spin-slow"></i>
                <span class="text-xs text-gray-300 font-bold">سؤال <span class="text-yellow-400 text-sm">${currentIndex+1}</span> / ${currentQuestions.length}</span>
            </div>
            
            <div class="bg-gray-800/80 border border-gray-700/50 px-3 py-1 rounded-full shadow-inner flex items-center gap-1.5">
                <i class="fas fa-star text-yellow-500 text-[10px]"></i>
                <span class="text-xs text-gray-300 font-bold">نقاط: <span class="text-yellow-400 text-sm">${sessionScore}</span></span>
            </div>
        </div>

        <div class="glass-card p-4 rounded-2xl mb-4 border border-yellow-500/20 shadow-lg relative overflow-hidden">
            <div class="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full"></div>
            <div class="absolute top-0 left-1/2 transform -translate-x-1/2 bg-yellow-600 text-black px-4 py-0.5 rounded-b-lg text-[9px] font-black tracking-widest shadow-md">سؤال الجولة</div>
            
            <div class="mt-3 flex flex-col items-center">
                <span id="timer" class="text-white font-black text-2xl bg-gray-900 border-2 border-red-500/80 px-3 py-1 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.3)] mb-3 transition-all w-16 text-center">${globalTimeLeft}</span>
                <h3 class="text-lg md:text-xl font-black text-center leading-snug text-white drop-shadow-md relative z-10">${q.q}</h3>
            </div>
        </div>
        
        <div class="space-y-2 relative z-20 px-1">
            ${q.options.map((opt, i) => `
                <button onclick="handleAnswer(${i})" class="opt-btn relative group overflow-hidden rounded-xl border border-gray-600 bg-gray-800/90 p-3 w-full text-right transition-all duration-300 hover:border-yellow-500/60" id="opt-${i}">
                    <div class="absolute inset-0 bg-gradient-to-r from-yellow-600/0 via-yellow-600/10 to-yellow-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div class="flex justify-between items-center relative z-10">
                        <span class="text-sm md:text-base font-bold text-gray-200 group-hover:text-yellow-400 transition-colors">${opt}</span>
                        <div class="w-6 h-6 rounded-full border-2 border-gray-600 flex items-center justify-center text-xs font-black text-gray-400 group-hover:border-yellow-500 group-hover:text-yellow-400 transition-colors">${String.fromCharCode(65+i)}</div>
                    </div>
                </button>
            `).join('')}
        </div>
        
        <div class="flex justify-between mt-4 gap-3 border-t border-gray-700/50 pt-3 px-1 pb-2">
            <button id="btn-5050" onclick="use5050()" class="flex-1 relative overflow-hidden group rounded-lg p-[1px] transition-all ${used5050?'opacity-40 grayscale cursor-not-allowed':'hover:scale-105 shadow-[0_5px_15px_rgba(147,51,234,0.3)]'}">
                <span class="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg"></span>
                <div class="bg-gray-900 px-3 py-2 rounded-[7px] flex items-center justify-center gap-2 relative z-10">
                    <i class="fas fa-cut text-purple-400 text-xs"></i>
                    <span class="text-[11px] font-black text-gray-200">إجابتين</span>
                </div>
            </button>
            <button id="btn-freeze" onclick="useFreeze()" class="flex-1 relative overflow-hidden group rounded-lg p-[1px] transition-all ${usedFreeze?'opacity-40 grayscale cursor-not-allowed':'hover:scale-105 shadow-[0_5px_15px_rgba(59,130,246,0.3)]'}">
                <span class="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-lg"></span>
                <div class="bg-gray-900 px-3 py-2 rounded-[7px] flex items-center justify-center gap-2 relative z-10">
                    <i class="fas fa-snowflake text-blue-400 text-xs"></i>
                    <span class="text-[11px] font-black text-gray-200">تجميد</span>
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
                selectedBtn.className = "opt-btn relative overflow-hidden rounded-xl border-2 border-green-500 bg-green-900/60 p-3 w-full text-right shadow-[0_0_30px_rgba(34,197,94,0.5)] transform scale-[1.02] transition-all z-30";
                selectedBtn.innerHTML = `<div class="flex justify-between items-center"><span class="text-base font-black text-white drop-shadow-md">${currentQuestions[currentIndex].options[i]}</span><i class="fas fa-check-circle text-2xl text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,1)]"></i></div>`;
            }
            if(window.confetti) confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#ffffff', '#fbbf24'] });

        } else {
            vibratePhone([100, 50, 100]);
            if(selectedBtn) {
                selectedBtn.className = "opt-btn relative overflow-hidden rounded-xl border-2 border-red-500 bg-red-900/60 p-3 w-full text-right shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all z-30";
                selectedBtn.innerHTML = `<div class="flex justify-between items-center"><span class="text-base font-black text-white line-through opacity-80">${currentQuestions[currentIndex].options[i]}</span><i class="fas fa-times-circle text-2xl text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,1)]"></i></div>`;
            }
        }
    } else {
        vibratePhone([100, 50, 100]);
        document.querySelectorAll('.opt-btn').forEach(btn => {
            btn.style.opacity = '0.4';
            btn.style.filter = 'grayscale(100%)';
        });
    }
    
    setTimeout(() => { currentIndex++; showQuestion(); }, 1200);
}

// ==========================================
// 🚨 نظام الحماية ضد الغش
// ==========================================
function reportCheat(reason) {
    if (!isQuizActive) return;

    db.collection("users").doc(user.id).set({
        cheatCount: firebase.firestore.FieldValue.increment(1),
        lastCheatReason: reason,
        lastCheatTime: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(e => console.log(e));

    alert("⚠️ تحذير شديد اللهجة: " + reason + "\nتم إرسال إنذار للأدمن وتم إنهاء الجولة!");
    endQuiz(true); 
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'hidden' && isQuizActive) {
        reportCheat("خرج من شاشة الاختبار (يشتبه في غش)");
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen' && isQuizActive) {
        reportCheat("أخذ لقطة شاشة (Screenshot)");
        navigator.clipboard.writeText("ممنوع الغش يا بطل! 🛑");
    }
});

document.addEventListener('copy', (e) => {
    if(isQuizActive){
        reportCheat("محاولة نسخ السؤال");
        e.preventDefault();
    }
});

document.addEventListener('contextmenu', (e) => {
    if(isQuizActive){ e.preventDefault(); }
});

window.addEventListener('blur', function() {
    if(isQuizActive) {
        let qc = document.getElementById('quiz-content');
        if(qc) qc.style.opacity = '0';
    }
});

window.addEventListener('focus', function() {
    if(isQuizActive) {
        let qc = document.getElementById('quiz-content');
        if(qc) qc.style.opacity = '1';
    }
});

window.addEventListener('popstate', function(event) {
    if (isQuizActive) {
        alert("⚠️ تحذير: ممنوع الرجوع أثناء الاختبار!");
        history.pushState(null, null, location.href);
    }
});

function endQuiz(isForceExit = false) {
    if (!isQuizActive) return;
    isQuizActive = false;
    clearInterval(timerInterval);

    if (isForceExit) {
        document.getElementById('quiz-content').innerHTML = `
            <div class="flex flex-col items-center justify-center py-10">
                <i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-4 animate-bounce"></i>
                <p class="text-center font-black text-red-500 text-xl">تم إنهاء الجولة وإلغاء التقدم!</p>
                <p class="text-center text-gray-400 text-sm mt-2">تم رصد محاولة غش وتوثيقها.</p>
            </div>
        `;
    } else {
        document.getElementById('quiz-content').innerHTML = `
            <div class="flex flex-col items-center justify-center py-10">
                <div class="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mb-4"></div>
                <p class="text-center font-bold text-yellow-500 text-lg animate-pulse">جاري توثيق المعركة...</p>
            </div>
        `;
    }

    let newStreak = 1;
    if (adminDay === 1 || myLogs[adminDay - 1] !== undefined) {
        newStreak = currentStreak + 1; 
    } else {
        newStreak = 1; 
    }
    
    if (isForceExit) newStreak = 0; 

    db.collection("users").doc(user.id).set({
        score: isEliminatedPlayer ? firebase.firestore.FieldValue.increment(0) : firebase.firestore.FieldValue.increment(sessionScore),
        streak: newStreak
    }, { merge: true }).then(() => {
        return db.collection("users").doc(user.id).collection("game_logs").doc("day_"+adminDay).set({
            day: adminDay, score: sessionScore, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        if (!isForceExit) {
            vibratePhone([200, 100, 200, 100, 400]); 
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
                    
                    <h2 class="text-3xl md:text-4xl font-black mb-6 text-white drop-shadow-lg">انتهت المعركة! 🔥</h2>
                    
                    <div class="glass-card p-6 rounded-3xl border border-yellow-500/30 mb-8 w-full shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
                        <p class="text-gray-400 text-sm font-bold mb-1 uppercase tracking-wider">غنائمك اليوم</p>
                        <p class="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600 drop-shadow-xl mb-5">${sessionScore}</p>
                        
                        <div class="flex justify-center gap-6 text-sm border-t border-gray-700/60 pt-5">
                            <div class="text-center flex-1">
                                <span class="block text-gray-500 mb-1 font-bold">رقم الجولة</span>
                                <span class="text-white font-black text-lg bg-gray-800 px-3 py-1 rounded-lg border border-gray-600">${adminDay}</span>
                            </div>
                            <div class="w-px bg-gray-700/60"></div>
                            <div class="text-center flex-1">
                                <span class="block text-gray-500 mb-1 font-bold">شعلة الحماس</span>
                                <span class="text-orange-400 font-black text-lg bg-orange-900/30 px-3 py-1 rounded-lg border border-orange-700/50">🔥 ${newStreak}</span>
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="window.location.reload()" class="w-full relative group overflow-hidden rounded-2xl p-[2px] shadow-[0_10px_20px_rgba(212,175,55,0.3)]">
                        <span class="absolute inset-0 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 group-hover:scale-[1.05] transition-transform duration-500"></span>
                        <span class="relative block bg-gray-900 px-6 py-4 rounded-[14px] text-yellow-400 font-black text-xl group-hover:bg-transparent group-hover:text-gray-900 transition-colors duration-300">العودة للمعسكر ⛺</span>
                    </button>
                </div>
            `;
        } else {
            setTimeout(() => { window.location.reload(); }, 2500);
        }
    }).catch(e => {
        alert("حصلت مشكلة في حفظ النتيجة، حاول تاني.");
        console.error(e);
        window.location.reload();
    });
}
