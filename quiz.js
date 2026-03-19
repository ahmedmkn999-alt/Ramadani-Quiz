// ==========================================
// 1. المتغيرات العامة والحالة (State)
// ==========================================
let currentQuestions = [], currentIndex = 0, sessionScore = 0;
let timerInterval = null, globalTimeLeft = 10; 
let isQuizActive = false;
let used5050InRound = false, usedFreezeInRound = false;
let currentPlayingDay = 1; // ✅ اليوم اللي المستخدم بيلعبه دلوقتي
let pressureMode = false; // 🔥 وضع الضغط للأيام 26-30

// الرصيد المجاني للكويز
let free5050 = 1, freeFreeze = 1;

// ==========================================
// 2. نظام مكافحة الغش (Anti-Cheat System)
// ==========================================

// ✅ مراقبة الخروج - بس لما الكويز شغال فعلاً
document.addEventListener("visibilitychange", () => {
    if (document.hidden && isQuizActive) {
        if (currentQuestions.length > 0 && currentIndex >= 0) {
            triggerAntiCheat("غادرت شاشة الكويز! اختر هل تكمل أم تخرج.");
        }
    }
});

// ✅ FIX: popstate يتعامل معه protection.js - مش هنا عشان ميتعارضوش

function triggerAntiCheat(reason) {
    if (!isQuizActive) return;

    // إيقاف مؤقت بدون إنهاء
    clearInterval(timerInterval);
    document.querySelectorAll('.opt-btn').forEach(btn => btn.style.pointerEvents = 'none');

    // ربط دوال الاستئناف والإنهاء مع نظام التحذير الجديد
    window._acResume = function() {
        // إعادة تشغيل التايمر واستئناف الكويز
        document.querySelectorAll('.opt-btn').forEach(btn => btn.style.pointerEvents = 'auto');
        timerInterval = setInterval(() => {
            globalTimeLeft--;
            let timerEl = document.getElementById('timer');
            if(timerEl) timerEl.innerText = globalTimeLeft;
            if(globalTimeLeft <= 0) handleAnswer(-1);
        }, 1000);
    };

    window._acForceEnd = function() {
        isQuizActive = false;
        endQuiz();
    };

    // إظهار نافذة التحذير الجديدة
    if (window.showAcWarning) {
        window.showAcWarning(reason);
    } else if (window.showAlert) {
        window.showAlert("تحذير! 🚨", reason, "🛑", "error");
        setTimeout(() => {
            if (window.closeCustomAlert) window.closeCustomAlert();
            isQuizActive = false;
            endQuiz();
        }, 3500);
    }
}

// ==========================================
// 3. وظائف بدء وتشغيل الكويز
// ==========================================

window.openQuiz = function(day) {
    if (myLogs && myLogs[day] !== undefined) { 
        window.showAlert("انتباه!", "أنت لعبت الجولة دي خلاص يا بطل!", "⚠️", "error"); 
        return; 
    }
    document.body.classList.add('hide-ads'); 
    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = `
        <div class="text-center relative z-10">
            <h2 class="text-3xl font-black text-white mb-3">مستعد للمواجهة؟ 🔥</h2>
            ${pressureMode ? `
            <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);border-radius:12px;padding:10px 14px;margin-bottom:10px;">
                <p style="font-family:'Cairo',sans-serif;color:#fca5a5;font-size:13px;font-weight:900;margin:0;">
                    🔥 الأيام الأخيرة — وضع الضغط!<br>
                    <span style="font-size:11px;color:#9ca3af;">✅ صح = +4 ثواني &nbsp;|&nbsp; ❌ غلط = -3 ثواني</span>
                </p>
            </div>` : ''}
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
    // ✅ FIX: مش بنعمل pushState هنا عشان ميتعارضش مع protection.js
    isQuizActive = true;
    currentPlayingDay = day; // ✅ حفظ اليوم اللي بيتلعب
    
    document.getElementById('quiz-content').innerHTML = `<p class="text-center font-bold text-yellow-500 text-lg animate-pulse">جاري تجهيز ساحة المعركة...</p>`;
    
    free5050 = 1; freeFreeze = 1;
    used5050InRound = false; usedFreezeInRound = false;
    pressureMode = (day >= 26); // 🔥 وضع الضغط للأيام الأخيرة

    db.collection("quizzes_pool").doc("day_" + day).get().then(doc => {
        if(doc.exists && doc.data().variations) {
            let variationsObj = doc.data().variations;
            let availableKeys = Object.keys(variationsObj); 
            // اختيار نسخة عشوائية للمستخدم
            let randomKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
            currentQuestions = variationsObj[randomKey].questions;
            currentIndex = 0; 
            sessionScore = 0;
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
    // 🔥 وضع الضغط: الوقت بيتأثر بالإجابة السابقة
    if (pressureMode) {
        // globalTimeLeft اتعدّل في handleAnswer — بس مش نقله تحت الصفر أو فوق 20
        if (currentIndex === 0) globalTimeLeft = 8; // أول سؤال: 8 ثواني
        // من تاني سؤال: الوقت بيجي من handleAnswer (+4 أو -3)
        globalTimeLeft = Math.max(4, Math.min(20, globalTimeLeft));
    } else {
        globalTimeLeft = 10;
    }
    
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

// ==========================================
// 4. نظام المساعدات (Powerups)
// ==========================================

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
    
    // تحديث الشكل
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

// ==========================================
// 5. معالجة الإجابات وإنهاء الكويز
// ==========================================


// 🔥 إظهار +/- الوقت
function showTimeBonus(text, isPositive) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:fixed;top:40%;left:50%;transform:translateX(-50%);
        font-family:'Cairo',sans-serif;font-size:22px;font-weight:900;
        color:${isPositive ? '#4ade80' : '#ef4444'};
        text-shadow:0 0 12px ${isPositive ? 'rgba(74,222,128,0.8)' : 'rgba(239,68,68,0.8)'};
        pointer-events:none;z-index:99999;
        animation:floatUp 0.9s ease forwards;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

window.handleAnswer = function(i) {
    if(!isQuizActive) return;
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
            // 🔥 وضع الضغط: +4 ثواني على التايمر
            if(pressureMode) {
                const timerEl = document.getElementById('timer');
                if(timerEl) {
                    // فلاش أخضر
                    timerEl.style.borderColor = '#4ade80';
                    timerEl.style.boxShadow = '0 0 20px rgba(74,222,128,0.8)';
                    timerEl.style.color = '#4ade80';
                    setTimeout(() => {
                        timerEl.style.borderColor = '';
                        timerEl.style.boxShadow = '';
                        timerEl.style.color = '';
                    }, 600);
                }
                // +4 محدودة بـ 20 ثانية
                if(pressureMode) globalTimeLeft = Math.min(20, globalTimeLeft + 4);
                showTimeBonus('+4⏱️', true);
            }
        } else {
            if(selectedBtn) {
                selectedBtn.classList.add('border-red-500', 'bg-red-900/60', 'line-through', 'opacity-80');
                selectedBtn.innerHTML += ` <i class="fas fa-times-circle float-left mt-1 text-xl drop-shadow-[0_0_10px_rgba(239,68,68,1)]"></i>`;
            }
            let correctBtn = document.getElementById(`opt-${correctIdx}`);
            if(correctBtn) correctBtn.classList.add('border-green-500/50', 'text-green-200');
            if(pressureMode) {
                const timerEl = document.getElementById('timer');
                if(timerEl) {
                    timerEl.style.borderColor = '#ef4444';
                    timerEl.style.boxShadow = '0 0 20px rgba(239,68,68,0.9)';
                    setTimeout(() => {
                        timerEl.style.borderColor = '';
                        timerEl.style.boxShadow = '';
                    }, 600);
                }
                globalTimeLeft = Math.max(4, globalTimeLeft - 3);
                showTimeBonus('-3⏱️', false);
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
        return db.collection("users").doc(user.id).collection("game_logs").doc("day_"+currentPlayingDay).set({
            day: currentPlayingDay, 
            score: sessionScore, 
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        // 🏆 الجولة الأخيرة — شاشة النهاية السينمائية
        if (currentPlayingDay === 30) {
            showFinalCinematicScreen();
        } else {
            showNormalEndScreen();
        }
    }).catch(err => {
        console.error("Error saving quiz:", err);
        alert("حدث خطأ أثناء حفظ النقاط، تأكد من الاتصال.");
    });
}

// ===== شاشة النهاية العادية =====
function showNormalEndScreen() {
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
}

// ===== شاشة النهاية السينمائية — الجولة 30 =====
function showFinalCinematicScreen() {
    // جيب الترتيب من Firebase
    db.collection('users').where('group', '==', 'النهائي').get().then(snap => {
        const players = [];
        snap.forEach(doc => {
            players.push({ id: doc.id, name: doc.data().name || 'بطل', score: doc.data().score || 0 });
        });
        players.sort((a, b) => b.score - a.score);

        const myRank = players.findIndex(p => p.id === user.id) + 1;
        const myData = players.find(p => p.id === user.id) || { name: user.name, score: 0 };
        const totalPlayers = players.length;
        const isQualified = user.group === 'النهائي' || user.status === 'qualified';

        // لو مش متأهل — جيب ترتيبه الكلي
        if (!isQualified) {
            db.collection('users').orderBy('score', 'desc').get().then(allSnap => {
                const all = [];
                allSnap.forEach(d => all.push({ id: d.id, score: d.data().score || 0 }));
                const globalRank = all.findIndex(p => p.id === user.id) + 1;
                showCinematic(myData.name, 0, globalRank, all.length, false);
            });
        } else {
            showCinematic(myData.name, myRank, myRank, totalPlayers, true);
        }
    });
}

function showCinematic(name, rank, displayRank, total, isFinalist) {
    const overlay = document.getElementById('quiz-overlay');
    const content = document.getElementById('quiz-content');

    // 🎬 ظلام تام
    overlay.style.background = '#000';
    content.innerHTML = '';

    const medals  = ['', '🥇', '🥈', '🥉'];
    const prizes  = ['', '300ج 💰', 'المركز الثاني 🥈', 'المركز الثالث 🥉'];
    const colors  = ['', '#fbbf24', '#d1d5db', '#cd7f32'];
    const msgs    = ['', 'أنت الفائز بالموسم الأول!', 'وصلت للمركز الثاني!', 'وصلت للمركز الثالث!'];

    let medal, color, title, subtitle, prize, whatsappBtn = '';

    if (!isFinalist) {
        medal   = '🎖️';
        color   = '#6b7280';
        title   = 'شكراً على مشاركتك!';
        subtitle = `ترتيبك النهائي: المركز ${displayRank} من ${total}`;
        prize   = 'الموسم القادم هيكون أقوى — كون مستعد! 💪';
    } else if (rank <= 3) {
        medal    = medals[rank] || '🏅';
        color    = colors[rank] || '#fbbf24';
        title    = msgs[rank] || `المركز ${rank}`;
        subtitle = `من أصل ${total} متأهل`;
        prize    = prizes[rank] || '';
        if (rank === 1) {
            const waMsg = encodeURIComponent(`🏆 مبروك! أنت الفائز بكويز رمضاني الموسم الأول!
الاسم: ${name}
جائزتك: 300ج 💰
تواصل معنا لاستلام جائزتك ✅`);
            whatsappBtn = `<a href="https://wa.me/201128381838?text=${waMsg}" target="_blank"
                style="display:block;width:100%;background:linear-gradient(135deg,#25d366,#128c7e);
                color:white;font-family:'Cairo',sans-serif;font-size:16px;font-weight:900;
                padding:14px;border-radius:14px;text-align:center;text-decoration:none;
                margin-bottom:10px;box-shadow:0 4px 20px rgba(37,211,102,0.4);">
                📲 تواصل لاستلام جائزتك
            </a>`;
        }
    } else {
        medal   = '🏅';
        color   = '#8b5cf6';
        title   = `أنت في المركز ${rank}`;
        subtitle = `من أصل ${total} متأهل — أداء رائع!`;
        prize   = 'شكراً على منافستك في الموسم الأول 🙏';
    }

    // مرحلة 1: ظلام
    setTimeout(() => {
        content.style.opacity = '0';
        content.innerHTML = `
            <div id="cin-wrap" style="text-align:center;padding:20px;opacity:0;transition:opacity 1.5s ease;">
                <div style="font-size:80px;margin-bottom:16px;filter:drop-shadow(0 0 30px ${color});">${medal}</div>
                <h1 id="cin-name" style="font-family:'Cairo',sans-serif;font-size:28px;font-weight:900;
                    color:${color};margin-bottom:8px;text-shadow:0 0 30px ${color};opacity:0;
                    transition:opacity 2s ease;letter-spacing:1px;">${name}</h1>
                <p style="font-family:'Cairo',sans-serif;font-size:18px;color:white;font-weight:900;
                    margin-bottom:6px;">${title}</p>
                <p style="font-family:'Cairo',sans-serif;font-size:13px;color:#9ca3af;margin-bottom:20px;">${subtitle}</p>
                ${prize ? `<div style="background:rgba(255,255,255,0.05);border:1px solid ${color}44;
                    border-radius:14px;padding:14px;margin-bottom:20px;">
                    <p style="font-family:'Cairo',sans-serif;font-size:15px;color:${color};font-weight:900;margin:0;">${prize}</p>
                </div>` : ''}
                ${whatsappBtn}
                <button onclick="window.location.replace('dashboard.html');"
                    style="width:100%;background:linear-gradient(135deg,#374151,#1f2937);
                    color:white;font-family:'Cairo',sans-serif;font-size:15px;font-weight:900;
                    padding:13px;border-radius:14px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;">
                    العودة للمعسكر ⛺
                </button>
            </div>`;

        // مرحلة 2: بعد ثانية — يظهر المحتوى
        setTimeout(() => {
            const wrap = document.getElementById('cin-wrap');
            if(wrap) wrap.style.opacity = '1';
            content.style.opacity = '1';

            // مرحلة 3: بعد ثانية تانية — الاسم يظهر
            setTimeout(() => {
                const nameEl = document.getElementById('cin-name');
                if(nameEl) nameEl.style.opacity = '1';

                // كونفيتي حسب المرتبة
                if (rank === 1) {
                    if(window.confetti) {
                        confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#fbbf24','#f59e0b','#ffffff','#4ade80'] });
                        setTimeout(() => confetti({ particleCount: 200, spread: 80, angle: 60, origin: { x: 0, y: 0.6 } }), 600);
                        setTimeout(() => confetti({ particleCount: 200, spread: 80, angle: 120, origin: { x: 1, y: 0.6 } }), 900);
                    }
                } else if (rank <= 3) {
                    if(window.confetti) confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
                } else if (isFinalist) {
                    if(window.confetti) confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 }, colors: ['#8b5cf6','#a78bfa'] });
                }
            }, 1200);
        }, 800);
    }, 300);
}
            
