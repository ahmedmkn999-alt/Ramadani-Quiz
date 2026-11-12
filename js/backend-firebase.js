// Firebase (Modular SDK v10 من CDN) — يتحمّل فقط لو firebase-config.js فيه إعدادات
// ⚠️ هذه الطبقة لم تُختبر على مشروع Firebase حقيقي (بيئة التطوير ما فيهاش اتصال) — راجع README قبل الإطلاق.
const V = '10.14.1';
const BASE = `https://www.gstatic.com/firebasejs/${V}`;

export async function create(cfg) {
  const [{ initializeApp }, { getAuth, signInAnonymously, onAuthStateChanged }, fs] = await Promise.all([
    import(`${BASE}/firebase-app.js`),
    import(`${BASE}/firebase-auth.js`),
    import(`${BASE}/firebase-firestore.js`),
  ]);
  const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, getDoc, getDocs,
    collection, query, orderBy, limit, serverTimestamp } = fs;

  const app = initializeApp(cfg);
  // كاش أوفلاين دائم: الكتابات تتحفظ وتتزامن لما النت يرجع
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  const auth = getAuth(app);

  const ready = new Promise((resolve) => {
    onAuthStateChanged(auth, (u) => { if (u) resolve(u); });
    if (!auth.currentUser) signInAnonymously(auth).catch((e) => console.warn('anon auth', e));
  });
  const uid = async () => (await ready).uid;

  return {
    async pushProfile(p) {
      const id = await uid();
      const daysDone = Object.keys(p.days).length;
      await setDoc(doc(db, 'users', id), {
        name: String(p.name).slice(0, 24), avatar: p.avatar, team: String(p.team || '').slice(0, 24),
        score: p.score, xp: p.xp, streak: p.streak, bestStreak: p.bestStreak, daysDone,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    },
    async leaderboard() {
      const id = await uid();
      const snap = await getDocs(query(collection(db, 'users'), orderBy('score', 'desc'), limit(100)));
      return { me: id, rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
    },
    async isAdmin() {
      const id = await uid();
      return (await getDoc(doc(db, 'admins', id))).exists();
    },
    async fetchQuestions() {
      const snap = await getDocs(collection(db, 'questions'));
      return snap.docs.map((d) => ({ id: 'r' + d.id, ...d.data() })).filter((q) => q.active !== false);
    },
    async fetchConfig() {
      const s = await getDoc(doc(db, 'config', 'app'));
      return s.exists() ? s.data() : null;
    },
    async publishQuestion(q) {
      const ref = doc(collection(db, 'questions'));
      await setDoc(ref, { cat: q.cat, diff: q.diff, q: q.q, a: q.a, c: q.c, e: q.e || '', active: true });
    },
    async publishConfig(c) {
      await setDoc(doc(db, 'config', 'app'), c, { merge: true });
    },
  };
}
