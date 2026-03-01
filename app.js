// ==========================================
// 1. الإعدادات والاتصال بـ Firebase
// ==========================================
const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// التأكد من تسجيل الدخول
let user = JSON.parse(localStorage.getItem('currentUser'));
if(!user) window.location.replace("index.html");

// متغيرات عالمية عشان الكويز يشوفها
window.myLogs = {};
window.myPowerups = {};
let currentAdminDay = 1;
let currentStatus = 'locked';

// ==========================================
// 2. التحديث اللحظي لبيانات اللاعب
// ==========================================
db.collection("users").doc(user.id).onSnapshot(doc => {
    if(doc.exists) {
        let d = doc.data();
        // تحديث الواجهة
        if(document.getElementById('p-score')) document.getElementById('p-score').innerText = d.score || 0;
        if(document.getElementById('p-name')) document.getElementById('p-name').innerText = d.name;
        if(document.getElementById('p-group')) document.getElementById('p-group').innerText = d.group;
        if(document.getElementById('inv-freeze')) document.getElementById('inv-freeze').innerText = d.powerups?.freeze || 0;
        if(document.getElementById('inv-5050')) document.getElementById('inv-5050').innerText = d.powerups?.fifty50 || 0;
        
        // حفظ البيانات في النافذة لاستخدامها في quiz.js
        window.myPowerups = d.powerups || { freeze: 0, fifty50: 0 };
    }
});

// ==========================================
// 3. رسم الخريطة (الجولات)
// ==========================================
function renderArena() {
    // 1. مراقبة حالة اليوم المفتوح من الإعدادات
    db.collection("settings").doc("global_status").onSnapshot(doc => {
        if(doc.exists) {
            currentAdminDay = doc.data().currentDay;
            currentStatus = doc.data().status; // active | soon | locked
        }
        
        // 2. جلب جولات المستخدم اللي خلصها
        db.collection("users").doc(user.id).collection("game_logs").onSnapshot(snap => {
            window.myLogs = {};
            snap.forEach(d => {
                // بننظف الاسم عشان يطلع رقم الجولة بس
                let dayNum = d.id.replace('day_', '');
                window.myLogs[dayNum] = d.data().score;
            });
            
            // 3. بناء الـ HTML للخريطة
            let html = '';
            for(let i=1; i<=30; i++) {
                if(window.myLogs[i] !== undefined) {
                    // ✅ جولة تم لعبها
                    html += `
                    <div class="glass-card p-5 rounded-2xl flex justify-between items-center border-r-4 border-green-500 mb-3 opacity-90">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                                <i class="fas fa-check"></i>
                            </div>
                            <span class="font-bold text-white">الجولة ${i}</span>
                        </div>
                        <span class="font-black text-green-400">+${window.myLogs[i]}</span>
                    </div>`;
                } else if(i == currentAdminDay && currentStatus == 'active') {
                    // 🔥 الجولة المتاحة حالياً
                    html += `
                    <div onclick="openQuiz(${i})" class="day-active p-6 rounded-3xl flex justify-between items-center mb-3 cursor-pointer transform active:scale-95 transition-all">
                        <div>
                            <p class="font-black text-xl text-black">الجولة ${i}</p>
                            <p class="text-[10px] font-bold text-black/70 uppercase">اضغط هنا لبدء التحدي ⚔️</p>
                        </div>
                        <div class="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center">
                            <i class="fas fa-play text-black"></i>
                        </div>
                    </div>`;
                } else {
                    // 🔒 جولة مغلقة
                    html += `
                    <div class="glass-card p-5 rounded-2xl flex justify-between items-center mb-3 opacity-30 grayscale">
                        <div class="flex items-center gap-3 text-gray-400">
                            <i class="fas fa-lock"></i>
                            <span class="font-bold">الجولة ${i}</span>
                        </div>
                    </div>`;
                }
            }
            const arenaDiv = document.getElementById('view-arena');
            if(arenaDiv) arenaDiv.innerHTML = html;
        });
    });
}

// ==========================================
// 4. نظام ترتيب المجموعة (Leaderboard)
// ==========================================
function fetchLeaderboard() {
    if(!user.group) return;
    
    db.collection("users").where("group", "==", user.group)
    .onSnapshot(snap => {
        let players = [];
        snap.forEach(d => players.push(d.data()));
        
        // ترتيب تنازلي حسب السكور
        players.sort((a,b) => (b.score || 0) - (a.score || 0));
        
        let html = '';
        players.forEach((p, index) => {
            let isMe = p.name === user.name ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/5';
            let rankIcon = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : index + 1));
            
            html += `
            <div class="glass-card p-4 rounded-2xl flex justify-between items-center border ${isMe} mb-2">
                <div class="flex items-center gap-3">
                    <span class="w-6 text-center font-black text-yellow-500">${rankIcon}</span>
                    <div>
                        <p class="font-bold text-sm text-white">${p.name}</p>
                        <p class="text-[9px] text-gray-400 uppercase">${p.team || 'فردي'}</p>
                    </div>
                </div>
                <span class="font-black text-yellow-500">${p.score || 0}</span>
            </div>`;
        });
        
        const listDiv = document.getElementById('group-list');
        if(listDiv) listDiv.innerHTML = html;
    });
}

// ==========================================
// 5. التحكم في الواجهة (Tabs & Logout)
// ==========================================
window.showTab = function(tab) {
    const arenaView = document.getElementById('view-arena');
    const leaderView = document.getElementById('view-leaderboard');
    const btnArena = document.getElementById('btn-arena');
    const btnLeader = document.getElementById('btn-leader');

    if(tab === 'arena') {
        arenaView.classList.remove('hidden');
        leaderView.classList.add('hidden');
        btnArena.classList.add('active');
        btnLeader.classList.remove('active');
    } else {
        arenaView.classList.add('hidden');
        leaderView.classList.remove('hidden');
        btnArena.classList.remove('active');
        btnLeader.classList.add('active');
        fetchLeaderboard(); // تحديث الترتيب عند فتح التاب
    }
}

window.logoutUser = () => {
    if(confirm("هل تريد تسجيل الخروج؟")) {
        localStorage.clear();
        window.location.replace("index.html");
    }
};

// تشغيل الوظائف عند التحميل
document.addEventListener('DOMContentLoaded', () => {
    renderArena();
});
            
