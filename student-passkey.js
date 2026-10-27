/* Andalus Student Passkey Gate
 * Uses WebAuthn platform authenticators only. Devices without a supported
 * platform authenticator keep the existing device-bound fallback.
 */
(function () {
  'use strict';

  const FUNCTION_NAME = 'student-passkey';
  let platformSupportPromise = null;
  let ensurePromise = null;
  let passkeySessionToken = '';
  let boundStudentId = '';

  function deviceToken() {
    return typeof window.getStudentDeviceToken === 'function' ? window.getStudentDeviceToken('') : Promise.resolve(null);
  }

  async function platformAuthenticatorAvailable() {
    if (platformSupportPromise) return platformSupportPromise;
    platformSupportPromise = (async () => {
      try {
        if (!window.isSecureContext || !window.PublicKeyCredential) return false;
        if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
        return !!await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch (_) { return false; }
    })();
    return platformSupportPromise;
  }

  function b64ToBytes(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64(bytes) {
    const arr = new Uint8Array(bytes);
    let bin = '';
    for (let i = 0; i < arr.length; i += 0x8000) bin += String.fromCharCode(...arr.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function showPasskeyMessage(message, error = false) {
    if (typeof window.showToast === 'function') window.showToast(message, error ? 'error' : 'info');
    else console.log('[student-passkey]', message);
  }

  async function invoke(body) {
    const client = window.sb;
    if (!client?.functions?.invoke) throw new Error('خدمة الأمان غير متاحة الآن.');
    const { data, error } = await client.functions.invoke(FUNCTION_NAME, { body });
    if (error) throw new Error(error.message || 'تعذر الاتصال بخدمة بصمة الجهاز.');
    if (!data?.ok) throw new Error(data?.error || 'تعذر إتمام التحقق بالجهاز.');
    return data;
  }

  async function getStatus(studentId, token) {
    try {
      const result = await invoke({ action: 'status', studentId: studentId || '', deviceToken: token });
      if (result.studentId) boundStudentId = String(result.studentId);
      return result;
    } catch (e) {
      console.warn('student-passkey status:', e);
      return { ok: false, hasPasskey: false, error: e?.message || 'status_failed' };
    }
  }

  async function registerPasskey(studentId, token) {
    showPasskeyMessage('جهازك يدعم بصمة/قفل الجهاز. سيتم الآن تفعيل مفتاح المرور لهذا الجهاز.');
    const result = await invoke({ action: 'register-options', studentId: studentId || '', deviceToken: token });
    const options = result.options;
    const publicKey = {
      ...options,
      challenge: b64ToBytes(options.challenge).buffer,
      user: { ...options.user, id: b64ToBytes(options.user.id).buffer },
      excludeCredentials: (options.excludeCredentials || []).map(c => ({ ...c, id: b64ToBytes(c.id).buffer })),
    };
    const credential = await navigator.credentials.create({ publicKey });
    if (!credential) throw new Error('لم يتم إنشاء مفتاح المرور.');
    const response = credential.response;
    const payload = {
      id: credential.id,
      rawId: bytesToB64(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bytesToB64(response.clientDataJSON),
        attestationObject: bytesToB64(response.attestationObject),
        transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
      },
    };
    const verified = await invoke({ action: 'register-verify', studentId: studentId || '', deviceToken: token, response: payload });
    passkeySessionToken = verified.sessionToken || '';
    showPasskeyMessage('تم تفعيل بصمة/قفل الجهاز بنجاح.');
    return true;
  }

  async function authenticatePasskey(studentId, token) {
    const result = await invoke({ action: 'auth-options', studentId: studentId || '', deviceToken: token });
    const options = result.options;
    const publicKey = {
      ...options,
      challenge: b64ToBytes(options.challenge).buffer,
      allowCredentials: (options.allowCredentials || []).map(c => ({ ...c, id: b64ToBytes(c.id).buffer })),
    };
    const credential = await navigator.credentials.get({ publicKey });
    if (!credential) throw new Error('لم يتم التحقق من بصمة/قفل الجهاز.');
    const response = credential.response;
    const payload = {
      id: credential.id,
      rawId: bytesToB64(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bytesToB64(response.clientDataJSON),
        authenticatorData: bytesToB64(response.authenticatorData),
        signature: bytesToB64(response.signature),
        userHandle: response.userHandle ? bytesToB64(response.userHandle) : null,
      },
    };
    const verified = await invoke({ action: 'auth-verify', studentId: studentId || '', deviceToken: token, response: payload });
    passkeySessionToken = verified.sessionToken || '';
    showPasskeyMessage('تم التحقق من بصمة/قفل الجهاز.');
    return true;
  }

  async function ensureStudentPasskey() {
    if (ensurePromise) return ensurePromise;
    ensurePromise = (async () => {
      const supported = await platformAuthenticatorAvailable();
      if (!supported) { passkeySessionToken = ''; return false; }
      const studentId = String(window.unifiedPortalStudent?.id || boundStudentId || '');
      const token = await deviceToken();
      if (!token) throw new Error('لا توجد جلسة جهاز محفوظة.');
      if (passkeySessionToken) return true;
      const status = await getStatus(studentId, token);
      const resolvedId = String(status.studentId || studentId || boundStudentId || '');
      if (!resolvedId) throw new Error('تعذر تحديد الطالب المرتبط بهذا الجهاز.');
      boundStudentId = resolvedId;
      if (status.hasPasskey) await authenticatePasskey(resolvedId, token);
      else await registerPasskey(resolvedId, token);
      return true;
    })();
    try { return await ensurePromise; } finally { ensurePromise = null; }
  }

  window.studentPasskeySupported = platformAuthenticatorAvailable;
  window.ensureStudentPasskey = ensureStudentPasskey;

  function wrapCompleteLogin() {
    const original = window.completeStudentDeviceLogin;
    if (typeof original !== 'function' || original.__studentPasskeyWrapped) return false;
    const wrapped = async function (...args) {
      const result = await original.apply(this, args);
      try { await ensureStudentPasskey(); }
      catch (e) { passkeySessionToken = ''; throw new Error(e?.message || 'يجب تأكيد الهوية ببصمة/قفل الجهاز على هذا الجهاز.'); }
      return result;
    };
    wrapped.__studentPasskeyWrapped = true;
    window.completeStudentDeviceLogin = wrapped;
    return true;
  }

  function wrapContextToken() {
    const original = window.issueStudentDeviceContextToken;
    if (typeof original !== 'function' || original.__studentPasskeyWrapped) return false;
    const wrapped = async function (contextType, contextId = null) {
      const supported = await platformAuthenticatorAvailable();
      if (supported) {
        await ensureStudentPasskey();
        const token = await deviceToken();
        const studentId = String(window.unifiedPortalStudent?.id || boundStudentId || '');
        if (!studentId || !passkeySessionToken) throw new Error('يجب تأكيد الهوية ببصمة/قفل الجهاز قبل الدخول.');
        const { data, error } = await window.sb.rpc('student_device_issue_context_token', {
          p_student_id: studentId,
          p_device_token: token,
          p_context_type: contextType,
          p_context_id: contextId,
          p_passkey_session_token: passkeySessionToken,
        });
        if (error) throw new Error('تعذر إنشاء جلسة آمنة بعد التحقق بالجهاز.');
        if (!data?.ok || !data?.token) throw new Error('تعذر تأكيد صلاحية جلسة بصمة الجهاز.');
        return data.token;
      }
      return original.call(this, contextType, contextId);
    };
    wrapped.__studentPasskeyWrapped = true;
    window.issueStudentDeviceContextToken = wrapped;
    return true;
  }

  function install() {
    wrapCompleteLogin();
    wrapContextToken();
    setTimeout(() => { wrapCompleteLogin(); wrapContextToken(); }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  // Load the shared navigation control after the main app scripts are ready.
  function loadGlobalBackNavigation() {
    if (document.querySelector('script[data-andalus-global-back]')) return;
    const script = document.createElement('script');
    script.src = './global-back-navigation.js?v=1';
    script.dataset.andalusGlobalBack = '1';
    script.defer = true;
    document.head.appendChild(script);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadGlobalBackNavigation, { once: true });
  else loadGlobalBackNavigation();
})();
