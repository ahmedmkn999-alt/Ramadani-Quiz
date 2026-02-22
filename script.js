const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};

let db = null;
let user = null;
let myLogs = {}, adminDay = 1, adminStatus = "closed";
let currentQuestions = [], currentIndex = 0, sessionScore = 0, timerInterval;
let isQuizActive = false;

// --- كود تشغيل الإعلان الخاص بك لزيادة الأرباح ---
let adScript = document.createElement('script');
adScript.src = "https://pl28752538.effectivegatecpm.com/c3/3c/34/c33c34082705fc844e7a83f1bbebcf42.js";
adScript.async = true; 
document.head.appendChild(adScript);
// --------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
    
    // إغلاق أي إمكانية لتحديد النص أو النسخ باللمس (لحماية الأسئلة من جوجل لانس)
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.webkitTouchCallout = "none";

    setTimeout(() => {
        try {
            user = JSON.parse(localStorage.getItem('currentUser'));
            if(!user || !user.id) throw new Error();

            document.getElementById('p-name').innerText = user.name;
            document.getElementById('p-group').innerText = user.group + " | " + user.team;

            if (typeof firebase !== 'undefined' && !firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();

            initFirebaseData();

        } catch(e) { 
            window.location.replace("index.html"); 
        }
    }, 100);
});

function initFirebaseData() {
    db.collection("users").doc(user.id).onSnapshot(doc => {
        if(doc.exists) document.getElementById('p-score').innerText = doc.data().score || 0;
    });

    db.collection("settings").doc("dailyData").onSnapshot(s => {
        let msgBox = document.getElementById('daily-msg-box');
        if(s.exists && s.data().message && s.data().message.trim() !== "") {
            msgBox.innerHTML = `<i class="fas fa-bullhorn text-yellow-400 ml-2 animate-pulse"></i> ${s.data().message}`;
            msgBox.classList.remove('hidden');
        } else {
            msgBox.classList.add('hidden');
        }
    });

    db.collection("settings").doc("champData").get().then(s => {
        if(s.exists && s.data().message && !sessionStorage.getItem('champSeen')) {
            document.getElementById('champ-popup-text').innerText = s.data().message;
            let pop = document.getElementById('champ-flying-popup');
            pop.style.display = 'block';
            setTimeout(() => { 
                pop.classList.remove('opacity-0', '-translate-y-10');
                pop.classList.add('opacity-100', 'translate-y-0');
            }, 100);
            sessionStorage.setItem('champSeen', 'true');
        }
    });

    db.collection("settings").doc("global_status").onSnapshot(doc => {
        if(doc.exists) {
            adminDay = doc.data().currentDay;
            adminStatus = doc.data().status;
            updateLogs();
        }
    });
}

window.closeChampPopup = function() {
    let pop = document.getElementById('champ-flying-popup');
    pop.classList.remove('opacity-100', 'translate-y-0');
    pop.classList.add('opacity-0', '-translate-y-10');
    setTimeout(() => { pop.style.display = 'none'; }, 700);
}

function updateLogs() {
    db.collection("users").doc(user.id).collection("game_logs").get().then(snap => {
        myLogs = {};
        snap.forEach(d => myLogs[d.data().day] = d.data().score);
        renderMap();
        
        let pCount = Object.keys(myLogs).length;
        document.getElementById('progress-text').innerText = `${pCount} / 29 جولة`;
        document.getElementById('progress-bar').style.width = `${(pCount/29)*100}%`;
    });
}

function renderMap() {
    let container = document.getElementById('view-arena');
    if(!container) return;
    
    let html = '';
    for (let i = 1; i <= 29; i++) {
        let isPlayed = myLogs[i] !== undefined;
        let isActive = (i === adminDay && adminStatus === 'active');
        let isSoon = (i === adminDay && adminStatus === 'soon'); 
        
        if (isPlayed) {
            html += `<div class="glass-card p-5 rounded-2xl flex justify-between opacity-80 border-r-4 border-r-green-500 mb-4 transition-all">
                <div class="flex items-center gap-4">
                    <div class="bg-green-500/20 text-green-400 w-12 h-12 rounded-full flex justify-center items-center"><i class="fas fa-check"></i></div>
                    <div><p class="font-bold text-gray-300">الجولة ${i}</p></div>
                </div>
                <p class="font-black text-2xl text-green-400">${myLogs[i]}</p>
            </div>`;
        } else if (isActive) {
            html += `<div onclick="openQuiz(${i})" class="day-active p-6 rounded-2xl flex justify-between mb-4 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <div class="flex items-center gap-4">
                    <div class="bg-gradient-to-br from-yellow-400 to-yellow-600 w-14 h-14 rounded-full flex justify-center items-center text-black shadow-lg"><i class="fas fa-play text-xl ml-1"></i></div>
                    <div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-yellow-400 font-bold mt-1">العب الآن!</p></div>
                </div>
                <i class="fas fa-chevron-left text-yellow-500 text-3xl opacity-40"></i>
            </div>`;
        } else if (isSoon) {
            html += `<div class="glass-card p-6 rounded-2xl flex justify-between mb-4 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <div class="flex items-center gap-4">
                    <div class="bg-blue-900/50 text-blue-400 w-14 h-14 rounded-full flex justify-center items-center"><i class="fas fa-hourglass-half text-2xl animate-pulse"></i></div>
                    <div><p class="font-black text-white text-xl">الجولة ${i}</p><p class="text-xs text-blue-400 font-bold mt-1">تفتح قريباً ⏳</p></div>
                </div>
                <i class="fas fa-lock text-blue-500/30 text-3xl opacity-40"></i>
            </div>`;
        } else {
            html += `<div class="glass-card p-5 rounded-2xl flex items-center gap-4 opacity-40 mb-4 grayscale">
                <div class="bg-gray-800 text-gray-500 w-12 h-12 rounded-full flex justify-center items-center"><i class="fas fa-lock text-sm"></i></div>
                <p class="font-bold text-sm text-gray-500">الجولة ${i}</p>
            </div>`;
        }
    }
    container.innerHTML = html;
}

window.showTab = function(t) {
    document.getElementById('view-arena').classList.toggle('hidden', t !== 'arena');
    document.getElementById('view-leaderboard').classList.toggle('hidden', t !== 'leaderboard');
    document.getElementById('btn-arena').classList.toggle('active', t === 'arena');
    document.getElementById('btn-leader').classList.toggle('active', t === 'leaderboard');
    if(t === 'leaderboard') fetchLeaderboard();
}

function fetchLeaderboard() {
    db.collection("users").where("group", "==", user.group).get().then(snap => {
        let list = [];
        snap.forEach(d => list.push(d.data()));
        list.sort((a,b) => (b.score || 0) - (a.score || 0));
        
        let html = '';
        list.forEach((u, i) => {
            let rank = i + 1;
            html += `<div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl mb-2 border border-gray-700 hover:border-yellow-500/30 transition-colors">
                <div class="flex items-center gap-3">
                    <span class="w-6 text-center font-bold ${rank <= 3 ? 'text-yellow-500 text-lg' : 'text-gray-400'}">${rank}</span>
                    <span class="font-bold ${u.id === user.id ? 'text-yellow-400' : 'text-white'}">${u.name}</span>
                </div>
                <span class="font-black text-yellow-500">${u.score || 0}</span>
            </div>`;
        });
        document.getElementById('group-list').innerHTML = html;
    });
}

// --- التعديل هنا: نظام اختيار الكويز العشوائي ---
window.openQuiz = function(day) {
    if (myLogs[day] !== undefined) {
        alert("أنت لعبت الجولة دي خلاص يا بطل، مفيش إعادة!");
        return;
    }

    isQuizActive = true;
    history.pushState(null, null, location.href);

    document.getElementById('quiz-overlay').style.display = 'flex';
    document.getElementById('quiz-content').innerHTML = '<p class="text-center font-bold text-yellow-500 animate-pulse">جاري تجهيز ساحة المعركة...</p>';
    
    db.collection("quizzes_pool").doc("day_" + day).get().then(doc => {
        if(doc.exists && doc.data().variations) {
            // جلب كل النسخ المتاحة (0، 1، 2، إلخ)
            let variationsObj = doc.data().variations;
            let availableKeys = Object.keys(variationsObj); 
            
            if(availableKeys.length > 0) {
                // سحب نسخة عشوائية من النسخ المتاحة
                let randomKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
                
                currentQuestions = variationsObj[randomKey].questions;
                currentIndex = 0; sessionScore = 0;
                showQuestion();
            } else {
                document.getElementById('quiz-content').innerHTML = '<p class="text-center text-red-500 font-bold">التحدي لم يجهز بعد!</p>';
                setTimeout(() => location.reload(), 2000);
            }
        } else {
            document.getElementById('quiz-content').innerHTML = '<p class="text-center text-red-500 font-bold">التحدي لم يجهز بعد!</p>';
            setTimeout(() => location.reload(), 2000);
        }
    }).catch(err => {
        console.error(err);
        document.getElementById('quiz-content').innerHTML = '<p class="text-center text-red-500 font-bold">حدث خطأ في الاتصال!</p>';
        setTimeout(() => location.reload(), 2000);
    });
}
// ------------------------------------------------

function showQuestion() {
    if(currentIndex >= currentQuestions.length) return endQuiz();
    
    let q = currentQuestions[currentIndex];
    let timeLeft = 20;
    
    let html = `
        <div class="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
            <span class="text-xs text-yellow-500 font-bold bg-yellow-900/30 px-3 py-1 rounded-full">سؤال ${currentIndex+1} من ${currentQuestions.length}</span>
            <span id="timer" class="text-red-400 font-black text-xl bg-red-900/20 px-3 py-1 rounded-lg shadow-inner">${timeLeft}s</span>
        </div>
        <h3 class="text-xl font-bold text-center mb-8 leading-relaxed select-none pointer-events-none">${q.q}</h3>
        <div class="space-y-3">
            ${q.options.map((opt, i) => `
                <button onclick="handleAnswer(${i})" class="opt-btn group select-none">
                    <span class="group-hover:text-yellow-400 transition-colors">${opt}</span>
                    <div class="opt-circle group-hover:border-yellow-500 group-hover:text-yellow-500 transition-colors">${String.fromCharCode(65+i)}</div>
                </button>
            `).join('')}
        </div>
    `;
    document.getElementById('quiz-content').innerHTML = html;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = timeLeft + "s";
        if(timeLeft <= 0) handleAnswer(-1);
    }, 1000);
}

window.handleAnswer = function(i) {
    clearInterval(timerInterval);
    if(i !== -1 && i === currentQuestions[currentIndex].correctIndex) {
        sessionScore++;
    }
    currentIndex++;
    showQuestion();
}

function endQuiz(isForceExit = false) {
    if (!isQuizActive) return;
    isQuizActive = false;
    clearInterval(timerInterval);
    
    if (!isForceExit) {
        document.getElementById('quiz-content').innerHTML = '<p class="text-center font-bold text-yellow-500 text-xl animate-pulse">جاري توثيق إنجازك...</p>';
    }

    db.collection("users").doc(user.id).update({
        score: firebase.firestore.FieldValue.increment(sessionScore)
    }).then(() => {
        return db.collection("users").doc(user.id).collection("game_logs").doc("day_"+adminDay).set({
            day: adminDay,
            score: sessionScore,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        if (!isForceExit) {
            if(window.confetti) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            document.getElementById('quiz-content').innerHTML = `
                <div class="text-center">
                    <div class="inline-block bg-yellow-500/20 p-4 rounded-full mb-4">
                        <i class="fas fa-trophy text-6xl text-yellow-400 drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]"></i>
                    </div>
                    <h2 class="text-3xl font-black mb-2 text-white">عاش يا بطل!</h2>
                    <p class="mb-6 text-gray-300">حصدت اليوم: <span class="text-3xl font-black text-yellow-400 mx-2">${sessionScore}</span> نقطة</p>
                    <button onclick="location.reload()" class="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 p-4 rounded-xl font-black text-black text-lg shadow-lg transform hover:scale-105 transition-all">العودة للمعسكر</button>
                </div>
            `;
        }
    }).catch(error => {
        console.error("خطأ: ", error);
        if(!isForceExit) alert("حدثت مشكلة في الاتصال، لم تسجل النتيجة!");
    });
}

window.logoutUser = function() {
    localStorage.removeItem('currentUser');
    window.location.replace("index.html");
}

// ==========================================
// --- نظام الحماية ومكافحة الغش الأشرس ---
// ==========================================

function reportCheat(reason) {
    if (!isQuizActive) return; 
    
    // تسجيل الغش في قاعدة البيانات
    db.collection("users").doc(user.id).update({
        cheatCount: firebase.firestore.FieldValue.increment(1),
        lastCheatReason: reason,
        lastCheatTime: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(e => console.log(e));

    alert("⚠️ تحذير شديد اللهجة: " + reason + "\nتم إرسال إنذار للأدمن وقد يتم حظرك!");
}

// 1. منع الرجوع
window.addEventListener('popstate', function(event) {
    if (isQuizActive) {
        alert("⚠️ تحذير: ممنوع الرجوع أثناء الاختبار!");
        history.pushState(null, null, location.href);
    }
});

// 2. قفل الامتحان لو حاول يعمل ريفريش
window.addEventListener('beforeunload', function (e) {
    if (isQuizActive) {
        endQuiz(true);
        e.preventDefault();
        e.returnValue = '';
    }
});

// 3. الفخ الأكبر: لو خرج من المتصفح عشان يبحث أو يكلم حد (بتصطاد الاسكرين شوت كمان في بعض الأجهزة)
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'hidden' && isQuizActive) {
        reportCheat("خرج من شاشة الاختبار (يشتبه في غش أو تصوير)");
    }
});

// 4. منع النسخ نهائياً
document.addEventListener('copy', (e) => {
    if(isQuizActive){
        reportCheat("محاولة نسخ السؤال");
        e.preventDefault(); 
    }
});

// 5. منع الكليك يمين / الضغطة المطولة
document.addEventListener('contextmenu', (e) => {
    if(isQuizActive){
        e.preventDefault(); 
    }
});

// 6. اصطياد زرار السكرين شوت في الكمبيوتر
document.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen' && isQuizActive) {
        reportCheat("أخذ لقطة شاشة (Screenshot)");
        navigator.clipboard.writeText("ممنوع الغش يا بطل! 🛑"); 
    }
});

// 7. تشويش الشاشة لو فقد التركيز (عشان السكرين شوت تطلع سودا)
window.addEventListener('blur', function() {
    if(isQuizActive) {
        document.getElementById('quiz-content').style.opacity = '0';
    }
});
window.addEventListener('focus', function() {
    if(isQuizActive) {
        document.getElementById('quiz-content').style.opacity = '1';
    }
});
