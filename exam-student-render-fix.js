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


/* Final student exam layout + resilient question renderer. */
(function(){
 'use strict';
 if(window.__andalusExamCenteredLayoutV2)return;
 window.__andalusExamCenteredLayoutV2=true;
 const style=document.createElement('style');
 style.id='andalus-exam-centered-layout-v2';
 style.textContent=`
 #exam-portal-screen #exam-active-screen{
   position:fixed!important;inset:0!important;z-index:2147482000!important;
   width:100vw!important;height:100vh!important;height:100dvh!important;
   max-width:none!important;max-height:none!important;margin:0!important;
   padding:76px 14px 24px!important;box-sizing:border-box!important;
   overflow-x:hidden!important;overflow-y:auto!important;background:#f3f6fb!important;
 }
 #exam-portal-screen #exam-active-screen #exam-timer-display{
   position:fixed!important;top:12px!important;left:50%!important;right:auto!important;
   transform:translateX(-50%)!important;width:auto!important;min-width:132px!important;
   max-width:calc(100vw - 28px)!important;text-align:center!important;
   display:flex!important;align-items:center!important;justify-content:center!important;
   z-index:2147482500!important;padding:10px 26px!important;margin:0!important;
   border-radius:16px!important;background:#172b4d!important;color:#f4d27c!important;
   box-shadow:0 5px 18px rgba(15,23,42,.22)!important;font-size:22px!important;
   line-height:1.3!important;letter-spacing:1px!important;
 }
 #exam-portal-screen #exam-active-screen #exam-questions-wrap{
   display:block!important;position:relative!important;width:min(100%,1040px)!important;
   max-width:1040px!important;min-height:0!important;margin:0 auto!important;
   padding:12px 0 28px!important;box-sizing:border-box!important;
 }
 #exam-portal-screen #exam-active-screen #exam-questions-wrap .exam-q-card{
   display:block!important;width:100%!important;max-width:none!important;
   margin:0 auto!important;padding:clamp(18px,3vw,34px)!important;
   box-sizing:border-box!important;background:#fff!important;border:1px solid #e1e8f2!important;
   border-radius:18px!important;box-shadow:0 8px 28px rgba(21,34,56,.08)!important;
 }
 #exam-portal-screen #exam-active-screen #exam-questions-wrap .q-title{
   font-size:clamp(18px,2.2vw,24px)!important;line-height:2!important;
   color:#172b4d!important;font-weight:900!important;margin:16px 0 22px!important;
 }
 #exam-portal-screen #exam-active-screen #exam-questions-wrap .exam-option-label{
   min-height:52px!important;font-size:clamp(15px,1.7vw,18px)!important;
   line-height:1.8!important;padding:13px 16px!important;background:#fff!important;
 }
 #exam-portal-screen #exam-active-screen #exam-questions-wrap .exam-option-label.selected{
   background:#eff6ff!important;border-color:#24477d!important;
 }
 #exam-portal-screen #exam-active-screen #exam-questions-wrap .exam-question-actions{
   display:flex!important;align-items:center!important;justify-content:flex-start!important;
   gap:10px!important;flex-wrap:wrap!important;margin-top:24px!important;padding-top:16px!important;
   border-top:1px solid #e5eaf2!important;direction:ltr!important;
 }
 #exam-portal-screen #exam-active-screen #exam-questions-wrap .exam-question-actions button{
   min-height:46px!important;min-width:128px!important;padding:10px 18px!important;
   font-family:inherit!important;font-size:14px!important;font-weight:800!important;
 }
 #exam-portal-screen #exam-active-screen #exam-questions-wrap .exam-question-actions .exam-submit-inline{
   background:#b42318!important;color:#fff!important;border:0!important;border-radius:10px!important;
 }
 #exam-portal-screen #exam-active-screen #exam-questions-wrap .exam-question-progress{
   display:flex!important;justify-content:space-between!important;gap:10px!important;
   flex-wrap:wrap!important;color:#64748b!important;font-size:13px!important;
   font-weight:700!important;margin-bottom:12px!important;
 }
 #exam-portal-screen #exam-active-screen>div:last-child{display:none!important}
 @media(max-width:600px){
   #exam-portal-screen #exam-active-screen{padding:68px 10px 18px!important}
   #exam-portal-screen #exam-active-screen #exam-timer-display{top:8px!important;font-size:19px!important;padding:8px 22px!important}
   #exam-portal-screen #exam-active-screen #exam-questions-wrap .exam-question-actions button{flex:1 1 100%!important}
 }
 `;
 document.head.appendChild(style);
 const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 window.renderExamQuestionsForStudent=function(savedAnswers){
   savedAnswers=savedAnswers||{};
   const wrap=document.getElementById('exam-questions-wrap');
   if(!wrap)return;
   const qs=Array.isArray(window.examQuestionsForStudent)?window.examQuestionsForStudent:[];
   if(!qs.length){wrap.innerHTML='<div class="exam-q-card"><h3>لا توجد أسئلة محملة في هذه المحاولة.</h3><p>يرجى الرجوع للإدارة لمراجعة بنك الأسئلة.</p></div>';return;}
   const index=Math.max(0,Math.min(Number(window.examCurrentQuestionIndex)||0,qs.length-1));
   window.examCurrentQuestionIndex=index;
   const q=qs[index]||{};
   const qid=String(q.id??'');
   const answer=savedAnswers[qid];
   const rawType=String(q.question_type||q.type||'mcq').toLowerCase();
   const isTF=['truefalse','true_false','true-false','tf','صح/خطأ','صح وخطأ'].includes(rawType)||rawType.includes('true')||rawType.includes('صح')||rawType.includes('خطأ');
   const isEssay=rawType==='essay'||rawType.includes('مقالي');
   let optionsHtml='';
   if(isTF){
     optionsHtml=['true','false'].map((v,i)=>'<label class="exam-option-label '+(answer===v?'selected':'')+'"><input type="radio" name="q_'+esc(qid)+'" value="'+v+'" '+(answer===v?'checked':'')+' onchange="saveExamAnswer(\''+esc(qid)+'\',\''+v+'\')"> '+(i===0?'صح':'خطأ')+'</label>').join('');
   }else if(isEssay){
     optionsHtml='<textarea style="width:100%;min-height:170px;padding:14px;border:1px solid #cbd5e1;border-radius:12px;font:inherit" placeholder="اكتب إجابتك هنا..." oninput="saveExamAnswer(\''+esc(qid)+'\',this.value)">'+esc(answer||'')+'</textarea>';
   }else{
     const opts=['a','b','c','d'].map(k=>q['option_'+k]??q['option_'+k.toUpperCase()]??'').filter(v=>String(v).trim()!=='');
     optionsHtml=['a','b','c','d'].map((k,i)=>{
       const value=q['option_'+k]??q['option_'+k.toUpperCase()]??'';
       if(String(value).trim()==='')return '';
       return '<label class="exam-option-label '+(answer===k?'selected':'')+'"><input type="radio" name="q_'+esc(qid)+'" value="'+k+'" '+(answer===k?'checked':'')+' onchange="saveExamAnswer(\''+esc(qid)+'\',\''+k+'\')"> <b>'+['أ','ب','ج','د'][i]+'.</b> '+esc(value)+'</label>';
     }).join('');
     if(!opts.length)optionsHtml='<div style="padding:12px;background:#fff7ed;color:#9a3412;border-radius:10px">لا توجد اختيارات محفوظة لهذا السؤال. يرجى مراجعة السؤال مع الإدارة.</div>';
   }
   const answered=qs.filter(item=>Object.prototype.hasOwnProperty.call(savedAnswers,String(item.id))).length;
   const title=window.examCurrentExam?.title||'الامتحان الإلكتروني';
   wrap.innerHTML='<div class="exam-q-card">'+
     '<div style="text-align:center;margin-bottom:18px"><div style="font-size:12px;color:#64748b;font-weight:800">أكاديمية الأندلس · الامتحان الإلكتروني</div><h2 style="font-size:clamp(18px,2.4vw,25px);color:#172b4d;margin-top:5px">'+esc(title)+'</h2></div>'+
     '<div class="exam-question-progress"><span>السؤال '+(index+1)+' من '+qs.length+'</span><span>تمت الإجابة: '+answered+' · متبقي: '+(qs.length-answered)+'</span></div>'+
     '<div class="q-title">'+esc(q.question_text??q.question??'')+'</div>'+optionsHtml+
     '<div class="exam-question-actions">'+
     '<button type="button" class="btn btn-outline" onclick="goToExamQuestion(examCurrentQuestionIndex-1)" '+(index===0?'disabled':'')+'>السابق</button>'+
     '<button type="button" class="btn btn-gold" onclick="goToExamQuestion(examCurrentQuestionIndex+1)" '+(index===qs.length-1?'disabled':'')+'>التالي</button>'+
     '<button type="button" class="exam-submit-inline" onclick="confirmSubmitExam()">📤 تسليم الامتحان</button>'+
     '</div></div>';
 };
})();
