/* Andalus login click recovery — independent guard */
(function () {
  'use strict';
  const PROJECT_URL = 'https://uvwarprsghwvrfmdaaqv.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1dndhcnByc2dod3ZyZm1kYWFxdjYiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4MTI5ODM2NCwiZXhwIjoyMDk2ODczNjM0fQ.bPfXaNqmWUIM7pYU8rHfRtHNs6Z7fsZs2nf8-Vo5T7E';

  function showError(message) {
    const box = document.getElementById('login-error');
    if (box) {
      box.textContent = message;
      box.style.display = 'block';
    } else {
      window.alert(message);
    }
  }

  async function getClient() {
    if (window.sb && window.sb.auth) return window.sb;
    if (!window.supabase || !window.supabase.createClient) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = () => reject(new Error('تعذر تحميل مكتبة الاتصال. تأكد من الإنترنت ثم حدّث الصفحة.'));
        document.head.appendChild(script);
      });
    }
    if (!window.supabase || !window.supabase.createClient) throw new Error('مكتبة تسجيل الدخول غير متاحة.');
    const client = window.supabase.createClient(PROJECT_URL, ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    window.sb = client;
    return client;
  }

  async function recoveryLogin() {
    const email = (document.getElementById('login-email')?.value || '').trim();
    const password = document.getElementById('login-password')?.value || '';
    const btn = document.getElementById('login-btn');
    if (!email || !password) {
      showError(!email ? 'اكتب البريد الإلكتروني أولًا.' : 'اكتب كلمة المرور أولًا.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('اكتب بريدًا إلكترونيًا صحيحًا.');
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'جاري التحقق...'; }
    try {
      const client = await getClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data || !data.user) throw new Error('لم يتم استلام بيانات الحساب.');
      const { data: profile, error: profileError } = await client.from('user_profiles').select('*').eq('id', data.user.id).single();
      if (profileError || !profile) throw new Error('تم التحقق من كلمة المرور لكن تعذر تحميل ملف المستخدم. تواصل مع المدير.');
      if (profile.is_active === false) {
        await client.auth.signOut();
        throw new Error('الحساب موقوف. تواصل مع المدير.');
      }
      try {
        currentAuth = data.user;
        currentUser = profile;
        if (typeof initApp === 'function') {
          const loginScreen = document.getElementById('login-screen');
          const appScreen = document.getElementById('app-screen');
          if (loginScreen) loginScreen.style.display = 'none';
          if (appScreen) appScreen.style.display = 'block';
          if (btn) { btn.disabled = false; btn.textContent = 'دخول'; }
          initApp().catch(err => {
            console.error('Login recovery app init failed:', err);
            showError('تم تسجيل الدخول، لكن كود تهيئة النظام لم يعمل. حدّث الصفحة وأرسل هذه الرسالة للدعم.');
          });
          return;
        }
      } catch (stateError) {
        console.error('Login recovery could not connect to app state:', stateError);
      }
      showError('تم التحقق من الحساب، لكن النظام لم يحمّل وظائفه. افتح الموقع في نافذة خاصة أو أرسل هذه الرسالة للدعم.');
    } catch (error) {
      console.error('Login recovery error:', error);
      showError(error && error.message ? error.message : 'تعذر تسجيل الدخول. حاول مرة أخرى.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'دخول'; }
    }
  }

  function attach() {
    const btn = document.getElementById('login-btn');
    if (!btn || btn.dataset.loginRecoveryAttached === '1') return;
    btn.dataset.loginRecoveryAttached = '1';
    btn.addEventListener('click', function (event) {
      if (typeof window.doLogin === 'function') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      recoveryLogin();
    }, true);
    if (typeof window.doLogin !== 'function') {
      btn.title = 'استرداد تسجيل الدخول مفعّل';
      console.warn('Main login handler missing; recovery handler is active.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
})();

// Load the conditional passkey/biometric gate after the main application script.
(function loadStudentPasskeyGate() {
  if (document.querySelector('script[data-andalus-student-passkey]')) return;
  const script = document.createElement('script');
  script.src = './student-passkey.js?v=1';
  script.async = false;
  script.dataset.andalusStudentPasskey = '1';
  script.onload = () => console.info('Andalus student passkey gate loaded.');
  script.onerror = () => console.warn('Student passkey gate could not be loaded; device-bound fallback remains available.');
  document.head.appendChild(script);
})();

// Load the staged AI exam generator after the main application script.
(function loadStagedExamGenerator() {
  if (document.querySelector('script[data-andalus-staged-exam]')) return;
  const script = document.createElement('script');
  script.src = './exam-generation-stages.js?v=1';
  script.async = false;
  script.dataset.andalusStagedExam = '1';
  script.onload = () => console.info('Andalus staged exam generation loaded.');
  script.onerror = () => console.warn('Staged exam generator could not be loaded; original generator remains available.');
  document.head.appendChild(script);
})();
