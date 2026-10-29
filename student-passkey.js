/* Andalus Student Portal compatibility shim — Passkey disabled.
 * Student login remains on the existing student_device_auth flow.
 * This file intentionally does not call WebAuthn or wrap the login/token functions.
 */
(function () {
  'use strict';
  window.studentPasskeySupported = function () { return Promise.resolve(false); };
  window.ensureStudentPasskey = function () { return Promise.resolve(false); };

  // Preserve the shared back-navigation behavior previously loaded here.
  function loadGlobalBackNavigation() {
    if (document.querySelector('script[data-andalus-global-back]')) return;
    const script = document.createElement('script');
    script.src = './global-back-navigation.js?v=1';
    script.dataset.andalusGlobalBack = '1';
    script.defer = true;
    document.head.appendChild(script);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGlobalBackNavigation, { once: true });
  } else {
    loadGlobalBackNavigation();
  }
})();
