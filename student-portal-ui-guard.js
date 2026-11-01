/* Andalus Academy — minimal safe student portal input styling. No observers or timers. */
(function(){
  'use strict';
  try{
    if(new URLSearchParams(location.search).get('student-portal')!=='1'&&location.hash!=='#student-portal')return;
    const apply=function(){
      const root=document.getElementById('student-portal-screen')||document.getElementById('student-portal-card')||document.getElementById('student-portal-content');
      if(!root)return;
      const style=document.createElement('style');
      style.id='andulus-portal-safe-input-css';
      style.textContent='#student-portal-screen,#student-portal-card,#student-portal-content{pointer-events:auto!important}#student-portal-screen input:not([type=hidden]),#student-portal-screen button,#student-portal-card input:not([type=hidden]),#student-portal-card button,#student-portal-content input:not([type=hidden]),#student-portal-content button{pointer-events:auto!important;user-select:text!important;-webkit-user-select:text!important}';
      if(!document.getElementById(style.id))document.head.appendChild(style);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  }catch(e){console.warn('Andalus portal safe styling skipped',e);}
})();