/* Andalus Academy — unified student section navigation.
   Keeps exams and the weekly league inside #student-portal-content.
   No database, student records, or RPC behavior is changed.
*/
(function () {
  'use strict';
  if (window.__andalusUnifiedStudentSectionsV1) return;
  window.__andalusUnifiedStudentSectionsV1 = true;

  const portal = () => document.getElementById('student-portal-screen');
  const content = () => document.getElementById('student-portal-content');
  const exam = () => document.getElementById('exam-portal-screen');
  const weekly = () => document.getElementById('weekly-quiz-screen');

  const homes = {};
  ['exam-portal-screen', 'weekly-quiz-screen'].forEach(id => {
    const node = document.getElementById(id);
    if (node) homes[id] = { parent: node.parentNode, next: node.nextSibling };
  });

  function restoreHome(node, id) {
    const home = homes[id];
    if (node && home && home.parent) {
      if (home.next && home.next.parentNode === home.parent) home.parent.insertBefore(node, home.next);
      else home.parent.appendChild(node);
    }
    if (node) node.style.display = 'none';
  }

  function prepareSection(node) {
    const box = content();
    if (!box || !node) return false;
    box.innerHTML = '';
    box.appendChild(node);
    node.style.display = 'block';
    const host = portal();
    if (host) host.style.display = 'block';
    return true;
  }

  function addExamBackButton() {
    const root = exam();
    if (!root || root.querySelector('[data-andalus-section-back="exam"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline';
    button.dataset.andalusSectionBack = 'exam';
    button.textContent = '← الرجوع إلى بوابة الطالب';
    button.style.cssText = 'display:block;width:100%;margin:0 auto 12px;max-width:480px;';
    button.addEventListener('click', backToStudentMenu);
    root.insertBefore(button, root.firstChild);
  }

  function addWeeklyBackButton() {
    const card = document.getElementById('weekly-quiz-card');
    if (!card || card.querySelector('[data-andalus-section-back="weekly"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline';
    button.dataset.andalusSectionBack = 'weekly';
    button.textContent = '← الرجوع إلى بوابة الطالب';
    button.style.cssText = 'display:block;width:100%;margin:0 0 12px;';
    button.addEventListener('click', backToStudentMenu);
    const heading = card.querySelector('.login-logo');
    card.insertBefore(button, heading || card.firstChild);
  }

  function backToStudentMenu() {
    const e = exam();
    const w = weekly();
    if (e && e.parentNode === content()) restoreHome(e, 'exam-portal-screen');
    if (w && w.parentNode === content()) restoreHome(w, 'weekly-quiz-screen');
    const host = portal();
    if (host) host.style.display = 'block';
    if (typeof window.renderStudentPortalMenu === 'function') window.renderStudentPortalMenu();
  }

  window.goToPortalExams = async function () {
    const root = exam();
    if (!root || !prepareSection(root)) return;
    addExamBackButton();
    if (typeof window.showExamScreen === 'function') window.showExamScreen('exam-login-screen');
    if (!window.unifiedPortalStudent || !window.unifiedPortalStudent.id) return;
    try {
      window.examStudent = window.unifiedPortalStudent;
      window.examStudentPhone = String(window.unifiedPortalPhone || window.unifiedPortalStudent.phone || '');
      window.examFaceVerifiedStudentId = String(window.unifiedPortalStudent.id);
      window.examFaceVerificationToken = await window.issueStudentDeviceContextToken('exam_portal', null);
      const welcome = document.getElementById('exam-student-welcome');
      if (welcome) welcome.textContent = 'أهلاً، ' + window.examStudent.name;
      if (typeof window.loadAvailableExamsForStudent === 'function') await window.loadAvailableExamsForStudent();
      if (typeof window.showExamScreen === 'function') window.showExamScreen('exam-select-screen');
    } catch (e) {
      if (typeof window.showExamScreen === 'function') window.showExamScreen('exam-login-screen');
      if (typeof window.showToast === 'function') window.showToast(e && e.message || 'تعذر تأمين جلسة الامتحان على هذا الجهاز.', 'error');
    }
  };

  window.goToPortalWeeklyQuiz = async function () {
    if (typeof window.stopWeeklyQuizAuditCamera === 'function') window.stopWeeklyQuizAuditCamera();
    if (!window.unifiedPortalStudent || !window.unifiedPortalStudent.id) {
      const host = portal();
      if (host) host.style.display = 'block';
      if (typeof window.showStudentPortalLoginStep === 'function') window.showStudentPortalLoginStep();
      return;
    }
    try {
      window.weeklyQuizStudent = window.unifiedPortalStudent;
      window.weeklyQuizFaceToken = await window.issueStudentDeviceContextToken('weekly_quiz', null);
      const root = weekly();
      if (!root || !prepareSection(root)) return;
      addWeeklyBackButton();
      if (typeof window.loadWeeklyQuizSection === 'function') await window.loadWeeklyQuizSection();
    } catch (e) {
      if (typeof window.showToast === 'function') window.showToast(e && e.message || 'تعذر تأمين جلسة المسابقة على هذا الجهاز.', 'error');
    }
  };

  window.backToPortalFromWeeklyQuiz = backToStudentMenu;
  window.backToPortalFromExam = backToStudentMenu;
})();
