/* Andalus student section navigation fix.
   Direct Golden League board + exam return-to-portal control.
*/
(function () {
  'use strict';
  function visible(el) { if (!el) return false; const s=getComputedStyle(el); return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'; }
  function portal() { try { if(typeof window.renderStudentPortalMenu==='function') return window.renderStudentPortalMenu(); if(typeof window.showStudentPortalLoginStep==='function') return window.showStudentPortalLoginStep(); } catch(e){ console.warn('Portal return failed:',e); } }
  function board() {
    let n=0; const t=setInterval(function(){ try { if(typeof window.showGoldenLeagueTab==='function'){ window.showGoldenLeagueTab('board'); clearInterval(t); return; } }catch(e){} if(++n>=40) clearInterval(t); },100);
    try { if(typeof window.showGoldenLeagueTab==='function') window.showGoldenLeagueTab('board'); }catch(e){}
  }
  function league(){ if(window.__aglDirectBoardFix) return true; if(typeof window.goToPortalWeeklyQuiz!=='function') return false; const old=window.goToPortalWeeklyQuiz; window.goToPortalWeeklyQuiz=function(){ try{old.apply(this,arguments);}finally{board();} }; window.__aglDirectBoardFix=true; return true; }
  function examControls(){ const exam=document.getElementById('exam-portal-screen'); if(!visible(exam)) return; exam.querySelectorAll('button,a,[role="button"]').forEach(function(el){ const text=(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim(); if(!/تسجيل\s+الخروج/.test(text)||el.dataset.aglPortalBack==='1') return; const b=document.createElement('button'); b.type='button'; b.className=el.className||'btn'; b.style.cssText=el.style.cssText||''; b.innerHTML='← الرجوع إلى البوابة'; b.dataset.aglPortalBack='1'; b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();portal();}); el.replaceWith(b); }); }
  function back(){ if(window.__aglExamBackFix||typeof window.andalusGoBack!=='function') return false; const old=window.andalusGoBack; window.andalusGoBack=function(){ if(visible(document.getElementById('exam-portal-screen'))) return portal(); return old.apply(this,arguments); }; window.__aglExamBackFix=true; return true; }
  function boot(){league();back();examControls();}
  boot(); let n=0; const timer=setInterval(function(){boot();if(++n>=100)clearInterval(timer);},200);
  new MutationObserver(boot).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
})();
