/* Student portal login hotfix v1 — Android/mobile safe device token handling */
(function(){
  try {
    if (typeof window.completeStudentDeviceLogin !== 'function' || typeof window.getStudentDeviceToken !== 'function') return;

    window.completeStudentDeviceLogin = async function(studentCode = '', nationalId = '') {
      const code = String(studentCode || '').trim();
      const nid = String(nationalId || '').trim();
      const token = await window.getStudentDeviceToken(nid);
      if (!token) {
        if (!code && !nid) return false;
        throw new Error('تعذر إنشاء رمز الجهاز. امسح بيانات الموقع غير الضرورية أو استخدم Chrome ثم حاول مرة أخرى.');
      }

      const request = window.sb.rpc('student_device_auth', {
        p_student_code: code,
        p_national_id: nid,
        p_device_token: token
      });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('انتهت مهلة الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.')), 15000));
      const { data, error } = await Promise.race([request, timeout]);

      if (error) throw new Error(error.message || 'تعذر الاتصال بخدمة تسجيل الدخول.');
      if (!data?.ok) {
        if (data?.reason === 'device_mismatch') throw new Error('هذا الحساب مربوط بجهاز آخر. تواصل مع إدارة المركز لإعادة ربط الجهاز.');
        if (data?.reason === 'session_not_found') return false;
        if (data?.reason === 'invalid_device') throw new Error('رمز الجهاز غير صالح. أعد فتح البوابة وحاول مرة أخرى.');
        if (data?.reason === 'invalid_credentials') throw new Error('بيانات الدخول غير صحيحة، راجع رقم القيد والرقم القومي.');
        throw new Error('تعذر تسجيل الدخول. راجع بياناتك وحاول مرة أخرى.');
      }

      window.unifiedPortalStudent = data.student;
      window.unifiedPortalPhone = String(data.student?.phone || '');
      window.studentPortalFaceToken = null;
      window.__andalusStudentPortalSessionToken = data.token || null;

      if (typeof window.renderStudentPortalMenu === 'function') {
        await Promise.resolve(window.renderStudentPortalMenu());
      } else {
        throw new Error('تعذر تجهيز واجهة بوابة الطالب. أعد تحميل الصفحة.');
      }
      return true;
    };

    const originalEnter = window.enterStudentPortal;
    window.enterStudentPortal = async function(){
      const idInput = document.getElementById('student-portal-id-input');
      const identityInput = document.getElementById('student-portal-phone-input');
      const errEl = document.getElementById('student-portal-login-err');
      const studentCode = idInput?.value.trim() || '';
      const identity = identityInput?.value.trim() || '';
      const weeklyEntry = new URLSearchParams(window.location.search).get('weekly-quiz') === '1';

      if (weeklyEntry && typeof originalEnter === 'function') return originalEnter();
      if (!studentCode || !identity) {
        if (errEl) { errEl.textContent = 'اكتب رقم القيد والرقم القومي'; errEl.style.display = 'block'; }
        return;
      }

      if (errEl) errEl.style.display = 'none';
      const button = document.querySelector('#student-portal-content button.btn');
      if (button) button.disabled = true;
      try {
        await window.completeStudentDeviceLogin(studentCode, identity);
      } catch (e) {
        if (errEl) {
          errEl.textContent = e?.message || 'تعذر تسجيل الدخول. حاول مرة أخرى.';
          errEl.style.display = 'block';
        }
      } finally {
        if (button) button.disabled = false;
      }
    };
  } catch (e) {
    console.warn('Student portal login hotfix unavailable:', e);
  }
})();
