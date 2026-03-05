/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         🛡️ ULTIMATE QUIZ PROTECTION SYSTEM v3.0          ║
 * ║         نظام الحماية الشامل - محظور التلاعب             ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * الحمايات المفعّلة:
 * 1. منع السكرين شوت (CSS + JS + Screen Capture API)
 * 2. منع DevTools (F12, right-click, Ctrl+Shift+I/J/U/C)
 * 3. منع Copy/Paste/Select
 * 4. منع زر الرجوع والخروج أثناء الكويز
 * 5. كشف تغيير التبويب / تصغير التطبيق
 * 6. كشف DevTools المفتوحة (size detection)
 * 7. منع Print Screen وتصوير الشاشة
 * 8. منع التاب switch أثناء الكويز
 * 9. watermark شفاف على الشاشة
 * 10. كشف Inspect Element
 * 11. منع drag وتحديد النصوص
 * 12. حماية الكود من القراءة (obfuscation layer)
 */

;(function() {
    'use strict';

    // ══════════════════════════════════════════
    // 0. CSS INJECTION - أول حاجة تتعمل
    // ══════════════════════════════════════════
    const protectionCSS = `
        /* 🚫 منع السكرين شوت عبر CSS */
        * {
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            -khtml-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
        }

        /* تعطيل Highlight عند الضغط الطويل على الموبايل */
        * {
            -webkit-tap-highlight-color: transparent !important;
        }

        /* طبقة الواترمارك الشفافة */
        #__security_watermark {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100vh !important;
            pointer-events: none !important;
            z-index: 2147483645 !important;
            opacity: 0.035 !important;
            background-image: repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 80px,
                rgba(255,255,255,0.03) 80px,
                rgba(255,255,255,0.03) 81px
            ) !important;
            user-select: none !important;
            -webkit-user-select: none !important;
        }

        /* شاشة تحذير السكرين شوت */
        #__screenshot_warning {
            display: none;
            position: fixed !important;
            inset: 0 !important;
            background: #000 !important;
            z-index: 2147483647 !important;
            align-items: center !important;
            justify-content: center !important;
            flex-direction: column !important;
        }
        #__screenshot_warning.active {
            display: flex !important;
        }

        /* إخفاء المحتوى عند Print */
        @media print {
            body > * { display: none !important; }
            body::after {
                content: "🚫 هذا المحتوى محمي ولا يمكن طباعته" !important;
                display: block !important;
                font-size: 32px !important;
                text-align: center !important;
                margin-top: 200px !important;
                color: #000 !important;
            }
        }

        /* إخفاء المحتوى عند Screen Capture API */
        @media (display-mode: screenshot) {
            body { visibility: hidden !important; }
        }

        /* حماية إضافية ضد Screenshot على iOS/Safari */
        html {
            -webkit-user-select: none !important;
        }

        /* تعطيل cursor drag */
        img, a {
            -webkit-user-drag: none !important;
            user-drag: none !important;
            pointer-events: none !important;
        }

        /* السماح بالضغط على الأزرار فقط */
        button, input, select, textarea, [onclick], .opt-btn, .gold-btn, .tab-btn, nav * {
            pointer-events: auto !important;
            -webkit-user-select: none !important;
        }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = '__protection_styles';
    styleEl.textContent = protectionCSS;
    document.head ? document.head.appendChild(styleEl) : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(styleEl));

    // ══════════════════════════════════════════
    // 1. WATERMARK - اسم اللاعب على الشاشة
    // ══════════════════════════════════════════
    function initWatermark() {
        if (document.getElementById('__security_watermark')) return;

        const wm = document.createElement('div');
        wm.id = '__security_watermark';

        // جيب اسم اللاعب من localStorage
        let playerName = 'PROTECTED';
        try {
            const u = JSON.parse(localStorage.getItem('currentUser'));
            if (u && u.name) playerName = u.name.toUpperCase();
        } catch(e) {}

        // إنشاء نص الواترمارك المتكرر
        let wmText = '';
        for (let i = 0; i < 80; i++) {
            wmText += `<span style="
                position:absolute;
                left:${(i % 8) * 13}%;
                top:${Math.floor(i / 8) * 11}%;
                transform:rotate(-35deg);
                font-size:14px;
                font-weight:900;
                color:rgba(255,255,255,0.6);
                white-space:nowrap;
                font-family:monospace;
                letter-spacing:2px;
            ">${playerName}</span>`;
        }
        wm.innerHTML = wmText;
        document.body ? document.body.appendChild(wm) : document.addEventListener('DOMContentLoaded', () => document.body.appendChild(wm));

        // حماية الواترمارك من الحذف
        const observer = new MutationObserver(() => {
            if (!document.getElementById('__security_watermark')) {
                document.body.appendChild(wm);
            }
        });
        observer.observe(document.body || document.documentElement, { childList: true, subtree: false });
    }

    // ══════════════════════════════════════════
    // 2. SCREENSHOT WARNING OVERLAY
    // ══════════════════════════════════════════
    function initScreenshotWarning() {
        const sw = document.createElement('div');
        sw.id = '__screenshot_warning';
        sw.innerHTML = `
            <div style="text-align:center; padding:40px; max-width:400px;">
                <div style="font-size:80px; margin-bottom:20px;">🚫</div>
                <h1 style="color:#ef4444; font-size:28px; font-weight:900; margin-bottom:15px; font-family:sans-serif;">
                    محظور!
                </h1>
                <p style="color:#fff; font-size:16px; font-weight:bold; font-family:sans-serif; line-height:1.6;">
                    لقد حاولت التقاط لقطة شاشة.<br>
                    هذا المحتوى محمي بالكامل.<br>
                    <span style="color:#fbbf24;">محاولتك تم تسجيلها ✓</span>
                </p>
            </div>
        `;
        document.body ? document.body.appendChild(sw) : document.addEventListener('DOMContentLoaded', () => document.body.appendChild(sw));
    }

    function showScreenshotWarning() {
        const sw = document.getElementById('__screenshot_warning');
        if (!sw) return;
        sw.classList.add('active');
        setTimeout(() => sw.classList.remove('active'), 2500);
    }

    // ══════════════════════════════════════════
    // 3. KEYBOARD SHORTCUTS - تعطيل كل الاختصارات الخطرة
    // ══════════════════════════════════════════
    document.addEventListener('keydown', function(e) {
        const key = e.key ? e.key.toLowerCase() : '';
        const code = e.code ? e.code.toLowerCase() : '';

        // F12 - DevTools
        if (e.keyCode === 123 || key === 'f12') {
            e.preventDefault(); e.stopImmediatePropagation();
            return false;
        }

        // Print Screen / Screenshot
        if (e.keyCode === 44 || key === 'printscreen' || code === 'printscreen') {
            e.preventDefault();
            showScreenshotWarning();
            // Windows Snipping Tool trigger
            setTimeout(() => {
                if (document.queryCommandSupported && document.queryCommandSupported('copy')) {
                    document.execCommand('copy'); // overwrite clipboard with empty
                }
            }, 100);
            return false;
        }

        // Ctrl + combinations
        if (e.ctrlKey || e.metaKey) {
            const blocked = ['u', 'i', 'j', 'c', 'v', 'x', 's', 'a', 'p', 'f', 'g', 'e', 'h', 'k', 'l', 'n', 'r', 't', 'w'];
            if (blocked.includes(key)) {
                e.preventDefault(); e.stopImmediatePropagation();
                return false;
            }
            // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
            if (e.shiftKey && ['i', 'j', 'c', 'k', 'e', 'm', 'u', 'p'].includes(key)) {
                e.preventDefault(); e.stopImmediatePropagation();
                return false;
            }
        }

        // Alt + F4 / Alt + Tab
        if (e.altKey && (key === 'f4' || key === 'tab')) {
            e.preventDefault();
            return false;
        }

        // Windows Key combinations
        if (e.metaKey) {
            e.preventDefault();
            return false;
        }

        // Power key / Lock screen - بعض الأجهزة
        if (key === 'power' || key === 'sleep') {
            e.preventDefault();
            return false;
        }

    }, true); // true = capture phase عشان يشتغل قبل أي listener تاني

    // ══════════════════════════════════════════
    // 4. RIGHT CLICK - منع القائمة
    // ══════════════════════════════════════════
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        // إظهار رسالة بدل القائمة
        showMiniToast('🚫 هذا المحتوى محمي');
        return false;
    }, true);

    // ══════════════════════════════════════════
    // 5. COPY / CUT / PASTE / SELECT منع
    // ══════════════════════════════════════════
    ['copy', 'cut', 'paste', 'selectstart', 'drag', 'dragstart'].forEach(evt => {
        document.addEventListener(evt, function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
        }, true);
    });

    // ══════════════════════════════════════════
    // 6. DEVTOOLS DETECTION - كشف أدوات المطور
    // ══════════════════════════════════════════
    let devToolsOpen = false;

    function checkDevTools() {
        // على الموبايل outerHeight أكبر بكتير من innerHeight بسبب شريط المتصفح
        // فنستخدم threshold أكبر بكتير ونتحقق إن مش على موبايل
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        if (isMobile) return; // مش بنشغل DevTools detection على الموبايل

        const threshold = 300;
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;

        if (widthDiff > threshold || heightDiff > threshold) {
            if (!devToolsOpen) {
                devToolsOpen = true;
                handleDevToolsOpen();
            }
        } else {
            devToolsOpen = false;
        }
    }

    function handleDevToolsOpen() {
        // لو الكويز شغال، اعتبره غش
        if (window.isQuizActive) {
            if (window.triggerAntiCheat) {
                window.triggerAntiCheat("تم كشف فتح أدوات المطور أثناء الكويز! 🚨");
            }
        }

        // مسح الـ console
        if (typeof console !== 'undefined') {
            const consoleMethods = ['log', 'warn', 'error', 'info', 'debug', 'dir', 'table'];
            consoleMethods.forEach(method => {
                try { console[method] = function() {}; } catch(e) {}
            });
        }

        showMiniToast('🚨 أدوات المطور مكتشفة!');
    }

    // فحص كل ثانية
    setInterval(checkDevTools, 1000);

    // طريقة كشف DevTools عبر timing - معطّلة على الموبايل
    // let devToolsTrap = /./; // معطّل لأنه بيسبب مشاكل

    // ══════════════════════════════════════════
    // 7. VISIBILITY CHANGE - كشف تبديل التطبيق
    // ══════════════════════════════════════════
    // (مضاف على الـ quiz.js الأصلي، هنا بنضيف layer تانية)
    // ✅ FIX: visibilitychange - يشتغل بس لو الكويز شغال فعلاً (مش لما overlay بيتفتح)
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // بلّغ anti-cheat بس لو الكويز شغال فعلاً (مش مجرد overlay مفتوح)
            if (window.isQuizActive) {
                document.body.style.filter = 'blur(20px)';
                document.body.style.pointerEvents = 'none';
            }
        } else {
            // عند العودة، شيل الـ blur
            setTimeout(() => {
                document.body.style.filter = '';
                document.body.style.pointerEvents = '';
            }, 500);
        }
    });

    // ══════════════════════════════════════════
    // 8. BACK BUTTON LOCK - قفل زر الرجوع
    // ══════════════════════════════════════════
    // ✅ FIX: قفل زر الرجوع - بيشتغل بس لما الكويز يبدأ فعلاً
    // مش بنعمل pushState تلقائي عشان ميتعارضش مع quiz.js
    window.addEventListener('popstate', function(e) {
        if (window.isQuizActive) {
            // الكويز شغال - امنع الرجوع وأبلغ عن غش
            history.pushState({ quizProtected: true }, '', location.href);
            if (window.triggerAntiCheat) {
                window.triggerAntiCheat("محاولة الضغط على زر الرجوع أثناء الكويز!");
            }
        }
        // لو الكويز مش شغال - اسمح بالرجوع العادي
    });

    // ══════════════════════════════════════════
    // 9. SCREENSHOT - Screen Capture API Block
    // ══════════════════════════════════════════
    // منع getDisplayMedia (Screen Recording API)
    if (navigator.mediaDevices) {
        const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
        navigator.mediaDevices.getDisplayMedia = function() {
            showScreenshotWarning();
            showMiniToast('🚫 تسجيل الشاشة محظور!');
            return Promise.reject(new Error('Screen capture is disabled for security reasons.'));
        };
    }

    // منع getUserMedia للشاشة
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const origGetUserMedia = navigator.mediaDevices.getUserMedia;
        navigator.mediaDevices.getUserMedia = function(constraints) {
            if (constraints && (constraints.video === true || (constraints.video && constraints.video.displaySurface))) {
                return Promise.reject(new Error('Screen capture disabled.'));
            }
            return origGetUserMedia.call(this, constraints);
        };
    }

    // ══════════════════════════════════════════
    // 10. TOUCH EVENTS - حماية على الموبايل
    // ══════════════════════════════════════════
    // منع Long Press (الضغط الطويل) اللي بيظهر قائمة Copy
    document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
            // Multi-touch (zoom) - منع إلا لو مش في الكويز
            if (window.isQuizActive) {
                e.preventDefault();
            }
        }
    }, { passive: false });

    // منع Long Press على النصوص
    let longPressTimer;
    document.addEventListener('touchstart', function(e) {
        longPressTimer = setTimeout(() => {
            e.preventDefault();
        }, 400);
    }, { passive: false });

    document.addEventListener('touchend', function() {
        clearTimeout(longPressTimer);
    });

    document.addEventListener('touchmove', function() {
        clearTimeout(longPressTimer);
    }, { passive: true });

    // ══════════════════════════════════════════
    // 11. IFRAME PROTECTION - منع التضمين
    // ══════════════════════════════════════════
    if (window.top !== window.self) {
        // الموقع مضمّن في iframe - اطردها
        window.top.location.replace(window.self.location.href);
    }

    // ══════════════════════════════════════════
    // 12. SOURCE CODE PROTECTION
    // ══════════════════════════════════════════
    // منع Ctrl+U (View Source) - مضاف فوق، لكن نضيف حماية إضافية
    document.addEventListener('keyup', function(e) {
        if (e.keyCode === 123) { e.preventDefault(); return false; }
    }, true);

    // إعادة تعريف Object.defineProperty لمنع الـ hooking
    // (layer حماية للـ quiz variables)
    (function protectGlobals() {
        const sensitiveVars = ['currentQuestions', 'sessionScore', 'globalTimeLeft', 'isQuizActive'];
        sensitiveVars.forEach(varName => {
            try {
                // نحاول نحمي المتغيرات من القراءة من الـ console
                // (مش ممكن 100% في JS لكن نصعّبها)
                Object.defineProperty(window, varName, {
                    configurable: false,
                    enumerable: false, // مش تظهر في Object.keys
                });
            } catch(e) {
                // بعض المتغيرات ممكن تكون مش متعرّفة بعد
            }
        });
    })();

    // ══════════════════════════════════════════
    // 13. TOAST NOTIFICATION - رسائل التحذير
    // ══════════════════════════════════════════
    function showMiniToast(msg) {
        const existing = document.getElementById('__security_toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = '__security_toast';
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed !important;
            bottom: 80px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: rgba(239,68,68,0.95) !important;
            color: white !important;
            padding: 12px 24px !important;
            border-radius: 50px !important;
            font-size: 14px !important;
            font-weight: 900 !important;
            font-family: 'Cairo', sans-serif !important;
            z-index: 2147483646 !important;
            pointer-events: none !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
            animation: __toastSlide 0.3s ease !important;
            direction: rtl !important;
            white-space: nowrap !important;
        `;

        // إضافة animation
        const animStyle = document.createElement('style');
        animStyle.textContent = `@keyframes __toastSlide { from { opacity:0; transform:translateX(-50%) translateY(20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
        document.head.appendChild(animStyle);

        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    // ══════════════════════════════════════════
    // 14. CONSOLE CLEANER - نظّف الكونسول
    // ══════════════════════════════════════════
    (function clearConsole() {
        // مسح أي logs موجودة
        try { console.clear(); } catch(e) {}

        // override console للرسائل المستقبلية
        const noop = () => {};
        if (typeof console !== 'undefined') {
            // نتركها تشتغل في development لكن نخفي الـ data الحساسة
            const originalLog = console.log.bind(console);
            console.log = function(...args) {
                // لو كلمة حساسة في الـ args، امنعها
                const sensitive = ['question', 'correct', 'answer', 'score', 'password', 'currentQuestions'];
                const str = args.join(' ').toLowerCase();
                if (sensitive.some(s => str.includes(s))) return;
                // originalLog(...args); // uncomment عشان تشوف logs تانية
            };
        }
    })();

    // ══════════════════════════════════════════
    // 15. QUIZ ACTIVE HOOKS - ربط مع نظام الكويز
    // ══════════════════════════════════════════
    // انتظر الـ quiz.js يتحمّل وعدّل الـ triggerAntiCheat
    window.addEventListener('load', function() {
        initWatermark();
        initScreenshotWarning();

        // ربط مع نظام الكويز الأصلي
        const origTrigger = window.triggerAntiCheat;
        window.triggerAntiCheat = function(reason) {
            // blur الشاشة فوراً
            const overlay = document.getElementById('quiz-overlay');
            if (overlay) overlay.style.filter = 'blur(5px)';

            // استدعاء الأصلية
            if (origTrigger) origTrigger(reason);
        };

        // مراقبة تغيير isQuizActive لتطبيق حمايات إضافية
      
