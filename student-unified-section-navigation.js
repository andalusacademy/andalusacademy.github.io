/* Andalus Academy — unified student section navigation. */
(function () {
  'use strict';
  if (window.__andalusUnifiedStudentSectionsV1) return;
  window.__andalusUnifiedStudentSectionsV1 = true;

  // Compatibility repair: the live project was using a stale Supabase API key.
  (function repairSupabaseApiKey(){
    const VALID_PUBLISHABLE_KEY='sb_publishable_MBvIDp_gVme16l3nqwyTBw_qog5lUBW';
    const PROJECT_HOST='uvwarprsghwvrfmdaaqv.supabase.co';
    const originalFetch=window.fetch;
    if(typeof originalFetch!=='function' || window.__andalusSupabaseApiKeyRepairV1) return;
    window.__andalusSupabaseApiKeyRepairV1=true;
    window.fetch=function(input, init){
      let url='';
      try { url=typeof input==='string' ? input : (input && input.url) || ''; } catch(_) {}
      if(url.includes(PROJECT_HOST)){
        try{
          const request = new Request(input, init);
          request.headers.set('apikey', VALID_PUBLISHABLE_KEY);
          return originalFetch.call(window, request);
        }catch(_){}
      }
      return originalFetch.call(window, input, init);
    };
  })();

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
  function addBack(root, type) {
    if (!root || root.querySelector('[data-andalus-section-back="'+type+'"]')) return;
    const b = document.createElement('button');
    b.type='button'; b.className='btn btn-outline'; b.dataset.andalusSectionBack=type;
    b.textContent='← الرجوع إلى بوابة الطالب';
    b.style.cssText='display:block;width:100%;margin:0 auto 12px;max-width:480px;';
    b.addEventListener('click', backToStudentMenu);
    root.insertBefore(b, root.firstChild);
  }
  function backToStudentMenu() {
    const e=exam(), w=weekly();
    if(e && e.parentNode===content()) restoreHome(e,'exam-portal-screen');
    if(w && w.parentNode===content()) restoreHome(w,'weekly-quiz-screen');
    const host=portal(); if(host) host.style.display='block';
    if(typeof window.renderStudentPortalMenu==='function') window.renderStudentPortalMenu();
  }

  // The tutor tile is strictly a logged-in student feature.
  function syncTutorTile(){
    const tile=document.getElementById('sai-tile');
    if(!tile) return;
    const loggedIn=typeof unifiedPortalStudent!=='undefined' && !!unifiedPortalStudent?.id;
    tile.style.display=loggedIn ? '' : 'none';
    const label=tile.querySelector('.tile-label');
    const hint=tile.querySelector('.tile-hint');
    if(label) label.textContent='المساعد الذكي';
    if(hint) hint.textContent='ذاكر معايا بصوتك وبالعامية المصرية';
    const trial=tile.querySelector('.sai-tile-trial');
    if(trial) trial.textContent='تجربة 24 ساعة';
    tile.setAttribute('aria-label','المساعد الذكي');
  }
  function watchTutorTile(){
    syncTutorTile();
    const root=document.getElementById('student-portal-screen');
    if(!root || root.__andalusTutorTileWatcher) return;
    root.__andalusTutorTileWatcher=true;
    new MutationObserver(function(){syncTutorTile()}).observe(root,{childList:true,subtree:true});
  }

  window.goToPortalExams = async function () {
    const root=exam(); if(!root || !prepareSection(root)) return; addBack(root,'exam');
    if(typeof showExamScreen==='function') showExamScreen('exam-login-screen');
    if(!unifiedPortalStudent || !unifiedPortalStudent.id) return;
    try {
      examStudent=unifiedPortalStudent;
      examStudentPhone=String(unifiedPortalPhone||unifiedPortalStudent.phone||'');
      examFaceVerifiedStudentId=String(unifiedPortalStudent.id);
      examFaceVerificationToken=await issueStudentDeviceContextToken('exam_portal',null);
      const welcome=document.getElementById('exam-student-welcome'); if(welcome) welcome.textContent='أهلاً، '+examStudent.name;
      if(typeof loadAvailableExamsForStudent==='function') await loadAvailableExamsForStudent();
      if(typeof showExamScreen==='function') showExamScreen('exam-select-screen');
    } catch(e) {
      if(typeof showExamScreen==='function') showExamScreen('exam-login-screen');
      if(typeof showToast==='function') showToast(e?.message||'تعذر تأمين جلسة الامتحان على هذا الجهاز.','error');
    }
  };

  window.goToPortalWeeklyQuiz = async function () {
    if(typeof stopWeeklyQuizAuditCamera==='function') stopWeeklyQuizAuditCamera();
    if(!unifiedPortalStudent || !unifiedPortalStudent.id){
      const host=portal(); if(host) host.style.display='block';
      if(typeof showStudentPortalLoginStep==='function') showStudentPortalLoginStep(); return;
    }
    try {
      weeklyQuizStudent=unifiedPortalStudent;
      weeklyQuizFaceToken=await issueStudentDeviceContextToken('weekly_quiz',null);
      const root=weekly(); if(!root || !prepareSection(root)) return; addBack(root,'weekly');
      if(typeof loadWeeklyQuizSection==='function') await loadWeeklyQuizSection();
    } catch(e) { if(typeof showToast==='function') showToast(e?.message||'تعذر تأمين جلسة المسابقة على هذا الجهاز.','error'); }
  };
  window.backToPortalFromWeeklyQuiz=backToStudentMenu;
  window.backToPortalFromExam=backToStudentMenu;

  const originalOpenStudentRequestForm=window.openStudentRequestForm;
  const originalCloseStudentRequestForm=window.closeStudentRequestForm;
  window.openStudentRequestForm=function(){
    if(typeof originalOpenStudentRequestForm!=='function') return;
    originalOpenStudentRequestForm();
    const modal=document.getElementById('student-request-submit-modal'), box=content();
    if(!modal||!box||!unifiedPortalStudent||!unifiedPortalPhone) return;
    box.innerHTML='<button type="button" class="btn btn-outline" data-andalus-request-back="1" style="width:100%;margin-bottom:12px;">← الرجوع إلى بوابة الطالب</button>';
    box.querySelector('[data-andalus-request-back]').addEventListener('click',backToStudentMenu);
    modal.style.cssText='position:relative;inset:auto;z-index:auto;background:transparent;display:block;align-items:initial;justify-content:initial;padding:0;direction:rtl;';
    box.appendChild(modal);
    const history=document.createElement('div'); history.id='student-portal-requests'; history.style.marginTop='14px'; box.appendChild(history);
    if(typeof window.loadStudentPortalRequests==='function') void window.loadStudentPortalRequests();
  };
  window.closeStudentRequestForm=function(){
    const modal=document.getElementById('student-request-submit-modal');
    const belongs=!!(modal&&modal.parentNode===content());
    if(typeof originalCloseStudentRequestForm==='function') originalCloseStudentRequestForm();
    if(belongs) backToStudentMenu();
  };

  function loadTutor(){
    if(document.getElementById('student-ai-assistant-script')) return;
    const s=document.createElement('script');
    s.id='student-ai-assistant-script'; s.src='./student-ai-assistant.js?v=20261103-1'; s.async=false;
    (document.head||document.documentElement).appendChild(s);
    s.addEventListener('load',watchTutorTile,{once:true});
  }
  // Keep the core student login independent from the optional AI assistant.
  // Load the assistant only after the student portal has authenticated a student.
  let tutorLoaded=false;
  function loadTutorAfterLogin(){
    if(tutorLoaded) return;
    const loggedIn=typeof unifiedPortalStudent!=='undefined' && !!unifiedPortalStudent?.id;
    if(!loggedIn) return;
    tutorLoaded=true;
    loadTutor();
  }
  const tutorLoginWatcher=setInterval(function(){
    loadTutorAfterLogin();
    if(tutorLoaded) clearInterval(tutorLoginWatcher);
  },500);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadTutorAfterLogin);
  else loadTutorAfterLogin();
})();
