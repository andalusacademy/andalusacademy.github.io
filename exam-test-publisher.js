/* Andalus electronic-exam test publishing: isolated clone + service accounts 0/1/2. */
(function(){
 'use strict';
 if(window.__andalusExamTestPublisherV1)return;
 window.__andalusExamTestPublisherV1=true;
 const $=s=>document.querySelector(s);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const db=()=>window.sb||(typeof sb!=='undefined'?sb:null);
 let currentExamId=null, accounts=[];
 const toast=(m,t)=>{const f=window.showToast||window.alert;f(m,t||'info');};
 function ensureModal(){
  if($('#aetp-modal'))return;
  const m=document.createElement('div');m.id='aetp-modal';m.className='modal-overlay';m.style.zIndex='1500';
  m.innerHTML='<div class="modal" style="max-width:560px;width:94vw;max-height:90vh;overflow:auto"><div class="modal-header"><div><h3 style="margin:0">🧪 نشر تجريبي للامتحان</h3><small id="aetp-title" style="color:var(--muted)"></small></div><button type="button" class="btn btn-outline" id="aetp-close">إغلاق</button></div><div class="modal-body"><p style="margin:0 0 12px">اختر حسابات الخدمة التي ستظهر لها نسخة تجريبية منفصلة من الامتحان. لن تظهر النسخة لباقي الطلاب.</p><div id="aetp-accounts" style="display:grid;gap:9px"></div><div style="margin-top:14px;padding:10px;border-radius:9px;background:#eff6ff;color:#1e3a8a;font-size:12px">محاولات النسخة التجريبية منفصلة، وتسليمها لا يسجل درجات رسمية ولا يغيّر نشر الطلاب.</div></div><div class="modal-footer" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-success" id="aetp-publish">🧪 إنشاء النشر التجريبي</button><button type="button" class="btn btn-outline" id="aetp-cancel">إلغاء</button></div></div>';
  document.body.appendChild(m);
  $('#aetp-close').onclick=$('#aetp-cancel').onclick=()=>m.classList.remove('open');
  $('#aetp-publish').onclick=publish;
 }
 async function open(id){
  currentExamId=String(id);
  const d=db();if(!d)return toast('قاعدة البيانات غير متاحة.','error');
  ensureModal();
  $('#aetp-title').textContent=(Array.isArray(allExams)?allExams.find(x=>String(x.id)===currentExamId)?.title:'')||'الامتحان المحدد';
  $('#aetp-accounts').innerHTML='<div style="color:var(--muted)">جاري تحميل حسابات الخدمة...</div>';
  $('#aetp-modal').classList.add('open');
  const {data,error}=await d.from('students').select('id,name,branch,student_status,deleted_at').in('id',['0','1','2']);
  if(error){$('#aetp-accounts').textContent='تعذر تحميل الحسابات: '+error.message;return;}
  accounts=(data||[]).filter(s=>!s.deleted_at&&String(s.student_status||'active').toLowerCase()==='active');
  const map=new Map(accounts.map(s=>[String(s.id),s]));
  $('#aetp-accounts').innerHTML=['0','1','2'].map(id=>{
   const s=map.get(id);
   return '<label style="display:flex;gap:10px;align-items:center;padding:11px;border:1px solid var(--border);border-radius:10px;'+(!s?'opacity:.45':'')+'"><input type="checkbox" class="aetp-check" value="'+id+'" '+(s?'checked':'disabled')+'><span style="flex:1"><b>رقم الخدمة '+id+'</b><small style="display:block;color:var(--muted)">'+(s?esc(s.name)+' · '+esc(s.branch||''):'الحساب غير موجود أو غير نشط')+'</small></span></label>';
  }).join('');
  // Existing service accounts are all selected by default; the administrator can uncheck any of them.
  $('#aetp-accounts').querySelectorAll('input.aetp-check').forEach(cb=>{if(cb.closest('label')&&!cb.disabled)cb.checked=true;});
 }
 async function publish(){
  const d=db();if(!d||!currentExamId)return;
  const ids=[...$('#aetp-accounts').querySelectorAll('.aetp-check:checked')].map(x=>x.value);
  if(!ids.length)return toast('حدد حساب خدمة واحدًا على الأقل.','error');
  const btn=$('#aetp-publish');btn.disabled=true;btn.textContent='جاري إنشاء النسخة التجريبية...';
  let cloneId=null;
  try{
   const {data:source,error:sourceErr}=await d.from('exams').select('*').eq('id',currentExamId).single();
   if(sourceErr)throw sourceErr;
   if(source.is_test)throw new Error('لا يمكن إنشاء تجربة من نسخة تجريبية.');
   const {data:questions,error:qErr}=await d.from('exam_questions').select('question_text,question_type,option_a,option_b,option_c,option_d,correct_answer,points,order_num,difficulty').eq('exam_id',source.id).order('order_num',{ascending:true});
   if(qErr)throw qErr;
   if(!questions?.length)throw new Error('لا يمكن نشر تجربة لامتحان بلا أسئلة.');
   const now=new Date();
   const clone={
    title:'🧪 تجربة — '+source.title,subject_id:source.subject_id,program_id:null,system_name:null,branch:'الفرعين',
    round:source.round||1,duration_minutes:source.duration_minutes||30,
    available_from:new Date(now.getTime()-60000).toISOString(),available_until:'2099-12-31T23:59:59.000Z',
    is_easy_retake:!!source.is_easy_retake,created_by:source.created_by||null,total_score:source.total_score||100,
    show_answers_after_submit:!!source.show_answers_after_submit,is_placement_test:true,program_combos:[],
    is_published:true,question_mix:source.question_mix||{easy:20,medium:60,hard:20},
    targeting_mode:true,question_type_mix:source.question_type_mix||{},
    is_test:true,test_source_exam_id:source.id
   };
   const {data:created,error:createErr}=await d.from('exams').insert(clone).select('id').single();
   if(createErr)throw createErr;
   cloneId=created.id;
   const copied=questions.map(q=>({...q,exam_id:cloneId}));
   const {error:copyErr}=await d.from('exam_questions').insert(copied);
   if(copyErr)throw copyErr;
   const {error:targetErr}=await d.from('exam_student_targets').insert(ids.map(student_id=>({exam_id:cloneId,student_id})));
   if(targetErr)throw targetErr;
   const {error:oldErr}=await d.from('exams').update({is_published:false}).eq('test_source_exam_id',source.id).eq('is_test',true).neq('id',cloneId);
   if(oldErr)console.warn('[Andalus test publish] old test versions remain published:',oldErr);
   if(typeof window.logActivity==='function')await window.logActivity('edit','نشر نسخة تجريبية للامتحان: '+source.title+' للحسابات '+ids.join(', '));
   $('#aetp-modal').classList.remove('open');
   toast('تم إنشاء نسخة تجريبية منفصلة للامتحان. الحسابات المسموح لها: '+ids.join(' و')+'. لن تُسجل درجات رسمية.','success');
   if(typeof window.loadExams==='function')await window.loadExams();
  }catch(err){
   console.error('[Andalus test publish]',err);
   if(cloneId){
    await d.from('exam_student_targets').delete().eq('exam_id',cloneId);
    await d.from('exam_questions').delete().eq('exam_id',cloneId);
    await d.from('exams').delete().eq('id',cloneId);
   }
   toast('تعذر إنشاء النشر التجريبي: '+(err?.message||String(err)),'error');
  }finally{btn.disabled=false;btn.textContent='🧪 إنشاء النشر التجريبي';}
 }
 function install(){
  if(typeof window.renderExamsTable==='function'&&!window.renderExamsTable.__aetpWrapped){
   const base=window.renderExamsTable;
   const wrapped=function(){const result=base.apply(this,arguments);const body=$('#exams-table');if(!body)return result;
    [...body.querySelectorAll('tr')].forEach((tr,i)=>{const e=Array.isArray(allExams)?allExams[i]:null;if(!e||e.is_test||tr.querySelector('[data-aetp-id]'))return;
     const cell=tr.lastElementChild;if(!cell)return;const b=document.createElement('button');b.type='button';b.className='btn btn-outline btn-sm';b.textContent='🧪 نشر تجريبي';b.dataset.aetpId=e.id;b.onclick=()=>open(e.id);
     const publishButton=cell.querySelector('button[onclick^="toggleExamPublication"]');if(publishButton)cell.insertBefore(b,publishButton);else cell.insertBefore(b,cell.firstChild);
    });return result;};
   wrapped.__aetpWrapped=true;window.renderExamsTable=wrapped;
  }
  if(typeof window.loadExams==='function'&&!window.loadExams.__aetpWrapped){
   const baseLoad=window.loadExams;
   const wrappedLoad=async function(){const result=await baseLoad.apply(this,arguments);if(Array.isArray(allExams)){allExams=allExams.filter(e=>!e.is_test);if(typeof window.renderExamsTable==='function')window.renderExamsTable();if(typeof window.renderExamAdminStats==='function')window.renderExamAdminStats();}return result;};
   wrappedLoad.__aetpWrapped=true;window.loadExams=wrappedLoad;
  }
  if(typeof window.renderExamsTable==='function')window.renderExamsTable();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
 window.openAndalusExamTestPublisher=open;
})();