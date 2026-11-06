(function(){'use strict';if(window.__andalusStudentEssayRenderFixed)return;window.__andalusStudentEssayRenderFixed=true;const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));window.renderExamQuestionsForStudent=function(saved){saved=saved||{};const wrap=document.getElementById('exam-questions-wrap');if(!wrap)return;const qs=window.examQuestionsForStudent||[];wrap.innerHTML=qs.map((q,i)=>{if(q.question_type==='essay')return '<div class="exam-q-card"><div class="q-title">سؤال '+(i+1)+' · مقالي</div><div style="white-space:pre-wrap;margin:10px 0">'+esc(q.question_text)+'</div><textarea style="width:100%;min-height:150px;padding:12px;border:1px solid var(--border);border-radius:10px;font-family:inherit" placeholder="اكتب إجابتك هنا..." oninput="saveExamAnswer(\''+q.id+'\',this.value)">'+esc(saved[q.id]||'')+'</textarea><div style="font-size:11px;color:var(--muted);margin-top:6px">الدرجة: '+(q.points||1)+'</div></div>';if(q.question_type==='truefalse')return '<div class="exam-q-card"><div class="q-title">سؤال '+(i+1)+' · صح أو خطأ</div><div style="white-space:pre-wrap;margin:10px 0">'+esc(q.question_text)+'</div><label class="exam-option-label '+(saved[q.id]==='true'?'selected':'')+'"><input type="radio" name="q_'+q.id+'" value="true" '+(saved[q.id]==='true'?'checked':'')+' onchange="saveExamAnswer(\''+q.id+'\',\'true\')"> صح</label><label class="exam-option-label '+(saved[q.id]==='false'?'selected':'')+'"><input type="radio" name="q_'+q.id+'" value="false" '+(saved[q.id]==='false'?'checked':'')+' onchange="saveExamAnswer(\''+q.id+'\',\'false\')"> غلط</label></div>';return '<div class="exam-q-card"><div class="q-title">سؤال '+(i+1)+' · اختيار من متعدد</div><div style="white-space:pre-wrap;margin:10px 0">'+esc(q.question_text)+'</div>'+['a','b','c','d'].filter(k=>q['option_'+k]).map(k=>'<label class="exam-option-label '+(saved[q.id]===k?'selected':'')+'"><input type="radio" name="q_'+q.id+'" value="'+k+'" '+(saved[q.id]===k?'checked':'')+' onchange="saveExamAnswer(\''+q.id+'\',\''+k+'\')"> '+esc(q['option_'+k])+'</label>').join('')+'</div>';}).join('')};})();
/* Student exam: one foreground policy dialog, then a true full-screen exam surface. */
(function(){
 if(window.__andalusExamViewportFix)return;window.__andalusExamViewportFix=true;
 const style=document.createElement('style');style.id='andalus-exam-viewport-fix';
 style.textContent=`
 /* The active exam is a screen, not a small modal. */
 #exam-portal-screen #exam-active-screen{
   position:fixed!important;inset:0!important;z-index:2147482000!important;
   width:100vw!important;height:100vh!important;height:100dvh!important;
   max-width:none!important;max-height:none!important;min-height:100vh!important;
   margin:0!important;padding:0 0 env(safe-area-inset-bottom)!important;
   box-sizing:border-box!important;overflow-x:hidden!important;overflow-y:auto!important;
   background:#f5f7fb!important;overscroll-behavior:contain!important;
 }
 #exam-portal-screen #exam-active-screen .exam-timer{
   position:sticky!important;top:0!important;z-index:5!important;
   width:100%!important;max-width:none!important;box-sizing:border-box!important;
   padding:12px!important;background:#fff!important;
 }
 #exam-portal-screen #exam-active-screen .exam-questions-wrap{
   width:min(100%,1100px)!important;margin:0 auto!important;
   padding:clamp(12px,2.5vw,28px)!important;box-sizing:border-box!important;
 }
 #exam-portal-screen #exam-active-screen .exam-q-card{
   width:100%!important;box-sizing:border-box!important;
 }
 #exam-portal-screen #exam-active-screen>div:last-child{
   width:100%!important;box-sizing:border-box!important;padding:18px!important;
 }
 /* Policy consent is the only overlay in the start flow; it must be readable and clickable. */
 #modal-exam-policy-consent{
   display:none;position:fixed!important;inset:0!important;z-index:2147483000!important;
   width:100vw!important;height:100vh!important;height:100dvh!important;
   padding:0!important;margin:0!important;box-sizing:border-box!important;
   align-items:stretch!important;justify-content:stretch!important;
   background:rgba(8,18,38,.88)!important;pointer-events:auto!important;
 }
 #modal-exam-policy-consent.open{display:flex!important}
 #modal-exam-policy-consent>.modal{
   position:relative!important;z-index:1!important;display:flex!important;
   flex-direction:column!important;width:100vw!important;max-width:none!important;
   height:100vh!important;height:100dvh!important;max-height:none!important;
   min-height:100vh!important;margin:0!important;border:0!important;
   border-radius:0!important;box-sizing:border-box!important;
   background:#fff!important;opacity:1!important;visibility:visible!important;
   overflow:hidden!important;pointer-events:auto!important;transform:none!important;
   animation:none!important;
 }
 #modal-exam-policy-consent .modal-header,
 #modal-exam-policy-consent .modal-footer{flex:0 0 auto!important}
 #modal-exam-policy-consent .modal-body{
   flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;
   padding:clamp(16px,3vw,32px)!important;overscroll-behavior:contain!important;
 }
 #modal-exam-policy-consent .modal-footer{
   position:sticky!important;bottom:0!important;background:#fff!important;
   padding:14px clamp(16px,3vw,32px)!important;
   padding-bottom:max(14px,env(safe-area-inset-bottom))!important;
   border-top:1px solid #dbe2ee!important;z-index:2!important;
 }
 #modal-exam-policy-consent .modal-footer button{
   min-height:48px!important;flex:1 1 auto!important;cursor:pointer!important;
   pointer-events:auto!important;touch-action:manipulation!important;
 }
 body.andalus-exam-running{overflow:hidden!important}
 `;
 document.head.appendChild(style);
 const active=document.getElementById('exam-active-screen');
 if(active){
   const observer=new MutationObserver(()=>{
     const running=active.style.display!=='none'&&getComputedStyle(active).display!=='none';
     document.body.classList.toggle('andalus-exam-running',running);
   });
   observer.observe(active,{attributes:true,attributeFilter:['style','class']});
 }
})();
