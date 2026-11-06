(function(){'use strict';if(window.__andalusStudentEssayRenderFixed)return;window.__andalusStudentEssayRenderFixed=true;const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));window.renderExamQuestionsForStudent=function(saved){saved=saved||{};const wrap=document.getElementById('exam-questions-wrap');if(!wrap)return;const qs=window.examQuestionsForStudent||[];wrap.innerHTML=qs.map((q,i)=>{if(q.question_type==='essay')return '<div class="exam-q-card"><div class="q-title">سؤال '+(i+1)+' · مقالي</div><div style="white-space:pre-wrap;margin:10px 0">'+esc(q.question_text)+'</div><textarea style="width:100%;min-height:150px;padding:12px;border:1px solid var(--border);border-radius:10px;font-family:inherit" placeholder="اكتب إجابتك هنا..." oninput="saveExamAnswer(\''+q.id+'\',this.value)">'+esc(saved[q.id]||'')+'</textarea><div style="font-size:11px;color:var(--muted);margin-top:6px">الدرجة: '+(q.points||1)+'</div></div>';if(q.question_type==='truefalse')return '<div class="exam-q-card"><div class="q-title">سؤال '+(i+1)+' · صح أو خطأ</div><div style="white-space:pre-wrap;margin:10px 0">'+esc(q.question_text)+'</div><label class="exam-option-label '+(saved[q.id]==='true'?'selected':'')+'"><input type="radio" name="q_'+q.id+'" value="true" '+(saved[q.id]==='true'?'checked':'')+' onchange="saveExamAnswer(\''+q.id+'\',\'true\')"> صح</label><label class="exam-option-label '+(saved[q.id]==='false'?'selected':'')+'"><input type="radio" name="q_'+q.id+'" value="false" '+(saved[q.id]==='false'?'checked':'')+' onchange="saveExamAnswer(\''+q.id+'\',\'false\')"> غلط</label></div>';return '<div class="exam-q-card"><div class="q-title">سؤال '+(i+1)+' · اختيار من متعدد</div><div style="white-space:pre-wrap;margin:10px 0">'+esc(q.question_text)+'</div>'+['a','b','c','d'].filter(k=>q['option_'+k]).map(k=>'<label class="exam-option-label '+(saved[q.id]===k?'selected':'')+'"><input type="radio" name="q_'+q.id+'" value="'+k+'" '+(saved[q.id]===k?'checked':'')+' onchange="saveExamAnswer(\''+q.id+'\',\''+k+'\')"> '+esc(q['option_'+k])+'</label>').join('')+'</div>';}).join('')};})();
/* Full-screen modal layout + deterministic stacking for student exam/policy dialogs */
(function(){
 if(window.__andalusModalLayerFix)return;window.__andalusModalLayerFix=true;
 const style=document.createElement('style');style.id='andalus-modal-layer-fix';
 style.textContent=`
 .modal-overlay{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;min-height:100vh!important;box-sizing:border-box!important;align-items:stretch!important;justify-content:stretch!important;padding:0!important;overflow:hidden!important}
 .modal-overlay.open{z-index:100000!important}
 .modal-overlay>.modal,.modal-overlay .modal{width:100vw!important;max-width:none!important;height:100dvh!important;max-height:100dvh!important;min-height:100dvh!important;margin:0!important;border-radius:0!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
 .modal-overlay .modal-header,.modal-overlay .modal-footer{flex:0 0 auto!important}
 .modal-overlay .modal-body{flex:1 1 auto!important;min-height:0!important;overflow:auto!important;overscroll-behavior:contain!important}
 body.andalus-modal-open{overflow:hidden!important}
 `;
 document.head.appendChild(style);
 function visible(el){if(!(el instanceof HTMLElement))return false;const cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&(el.classList.contains('open')||el.getAttribute('aria-hidden')==='false'||el.offsetParent!==null);}
 function promote(){
  const overlays=[...document.querySelectorAll('.modal-overlay')].filter(visible);
  overlays.forEach((el,i)=>{el.style.zIndex=String(100000+i*2);});
  document.body.classList.toggle('andalus-modal-open',overlays.length>0);
 }
 const observer=new MutationObserver(()=>{requestAnimationFrame(promote);});
 observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','aria-hidden']});
 document.addEventListener('click',e=>{if(e.target.closest('[data-dismiss="modal"],.modal-close,[onclick*="closeModal"]'))setTimeout(promote,0);},true);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',promote,{once:true});else promote();
})();
