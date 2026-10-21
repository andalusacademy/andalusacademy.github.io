(() => {
'use strict';
const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(String(v??'')):String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let draftId=null;
const client=()=>window.sb||(typeof sb!=='undefined'?sb:null);
function inject(){
 const page=document.getElementById('page-study-summaries');
 if(!page||document.getElementById('ss-ai-generator-card'))return;
 const card=document.createElement('div');card.id='ss-ai-generator-card';card.className='card';
 card.innerHTML='<div class="card-header"><h3>📚 إنشاء ملخص وتوليد أسئلته</h3><span style="font-size:12px;color:var(--muted)">لن يُتاح للطلاب قبل اعتماد الأسئلة</span></div>'+
 '<div style="padding:18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">'+
 '<div class="form-group"><label>اسم الملخص (اكتبه بنفسك)</label><input id="ss-ai-title" class="search-input" maxlength="180" placeholder="مثال: ملخص التغذية العلاجية" style="width:100%"></div>'+
 '<div class="form-group"><label>اسم المادة</label><input id="ss-ai-subject" class="search-input" maxlength="160" placeholder="التغذية العلاجية" style="width:100%"></div>'+
 '<div class="form-group"><label>عدد الأسئلة المطلوبة</label><input id="ss-ai-count" class="search-input" type="number" min="1" max="50" value="30" style="width:100%"></div>'+
 '<div class="form-group"><label>السعر بالجنيه</label><input id="ss-ai-price" class="search-input" type="number" min="0" step="0.01" value="0" style="width:100%"></div>'+
 '<div class="form-group"><label>مدة الإتاحة (بالأيام)</label><input id="ss-ai-validity" class="search-input" type="number" min="1" max="3650" value="30" style="width:100%"></div>'+
 '<div class="form-group"><label>ملف المادة PDF</label><input id="ss-ai-pdf" class="search-input" type="file" accept="application/pdf,.pdf" style="width:100%"></div>'+
 '<div class="form-group" style="grid-column:1/-1"><label>وصف الملخص (اختياري)</label><textarea id="ss-ai-description" class="search-input" maxlength="3000" placeholder="وصف مختصر لمحتوى الملخص" style="width:100%;min-height:65px"></textarea></div></div>'+
 '<div id="ss-ai-file-info" style="margin:8px 0;color:var(--muted);font-size:12px"></div>'+
 '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-gold" id="ss-ai-generate-btn" type="button">⬆️ رفع الملف وإنشاء الأسئلة</button><button class="btn btn-outline" id="ss-ai-publish-btn" type="button" disabled>💾 حفظ وإتاحة للطلاب</button></div>'+
 '<div id="ss-ai-status" style="margin-top:12px"></div><div style="margin-top:8px;font-size:12px;color:var(--muted)">بعد التوليد راجع الأسئلة في قسم إدارة الأسئلة أسفل الصفحة، واعتمد كل سؤال مناسب قبل الإتاحة.</div></div>';
 const anchor=page.querySelector('.card');if(anchor)anchor.insertAdjacentElement('beforebegin',card);else page.prepend(card);const legacy=document.getElementById('ss-title')?.closest('.card');if(legacy){legacy.id='ss-legacy-summary-form-card';legacy.style.display='none';}
 document.getElementById('ss-ai-pdf').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];document.getElementById('ss-ai-file-info').textContent=f?'📄 '+f.name+' — '+(f.size/1024/1024).toFixed(2)+' MB':'';});
 document.getElementById('ss-ai-generate-btn').addEventListener('click',generate);
 document.getElementById('ss-ai-publish-btn').addEventListener('click',publish);
}
function showStatus(message,ok){const el=document.getElementById('ss-ai-status');if(el)el.innerHTML='<div style="background:'+(ok?'#ecfdf5':'#fef2f2')+';color:'+(ok?'#166534':'#991b1b')+';padding:12px;border-radius:10px">'+(ok?'✅ ':'❌ ')+esc(message)+'</div>';}
async function generate(){
 const sbc=client(),title=document.getElementById('ss-ai-title').value.trim(),subject=document.getElementById('ss-ai-subject').value.trim(),file=document.getElementById('ss-ai-pdf').files?.[0];
 const count=Math.min(50,Math.max(1,Number(document.getElementById('ss-ai-count').value||30))),price=Number(document.getElementById('ss-ai-price').value||0),validity=Number(document.getElementById('ss-ai-validity').value||30),description=document.getElementById('ss-ai-description').value.trim();
 if(!sbc)return showStatus('اتصال قاعدة البيانات غير جاهز. أعد تحميل الصفحة.',false);
 if(title.length<2||!subject)return showStatus('اكتب اسم الملخص واسم المادة أولًا.',false);
 if(!file||(!file.type.includes('pdf')&&!file.name.toLowerCase().endsWith('.pdf')))return showStatus('اختر ملف PDF للمادة.',false);
 if(file.size>15*1024*1024)return showStatus('حجم الملف يجب ألا يتجاوز 15 ميجابايت.',false);
 if(!Number.isFinite(price)||price<0||!Number.isInteger(validity)||validity<1||validity>3650)return showStatus('راجع السعر ومدة الإتاحة.',false);
 const btn=document.getElementById('ss-ai-generate-btn');btn.disabled=true;
 try{
  showStatus('جاري حفظ بيانات الملخص ورفع المادة وإنشاء الأسئلة...',true);
  const auth=await sbc.auth.getSession();if(!auth.data?.session)throw new Error('جلسة المدير غير صالحة. سجّل الدخول مرة أخرى.');
  if(!draftId){const created=await sbc.from('study_summaries').insert({title,subject_name:subject,description,price,validity_days:validity,is_published:false,created_by:auth.data.session.user.id,ai_generation_status:'processing'}).select('id').single();if(created.error)throw created.error;draftId=created.data.id;}
  else {const upd=await sbc.from('study_summaries').update({title,subject_name:subject,description,price,validity_days:validity,is_published:false,ai_generation_status:'processing'}).eq('id',draftId);if(upd.error)throw upd.error;}
  // Use ASCII-only filename to avoid storage Invalid key errors.
  const path='summary-'+draftId+'/'+Date.now()+'-source.pdf';
  const upload=await sbc.storage.from('study-summary-pdfs').upload(path,file,{contentType:'application/pdf',upsert:false});if(upload.error)throw upload.error;
  const response=await fetch(sbc.supabaseUrl+'/functions/v1/generate-study-summary',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.data.session.access_token,apikey:sbc.supabaseKey},body:JSON.stringify({summary_id:draftId,pdf_path:path,subject,count})});
  const result=await response.json().catch(()=>({}));if(!response.ok||!result.success)throw new Error(result.error||'تعذر إنشاء الأسئلة.');
  const save=await sbc.from('study_summaries').update({source_pdf_path:path,ai_generation_status:'ready',generated_question_count:result.generatedCount||count,is_published:false}).eq('id',draftId);if(save.error)throw save.error;
  showStatus('تم إنشاء '+(result.generatedCount||count)+' سؤالًا للملخص «'+title+'». راجع الأسئلة واعتمد كل الأسئلة المناسبة، ثم احفظ وأتح الملخص.',true);
  document.getElementById('ss-ai-publish-btn').disabled=false;
  if(typeof window.loadStudySummaryAdmin==='function')await window.loadStudySummaryAdmin();
  if(typeof window.selectStudySummaryForQuestions==='function')await window.selectStudySummaryForQuestions(draftId);
 }catch(e){showStatus(e?.message||String(e),false);}finally{btn.disabled=false;}
}
async function publish(){
 const sbc=client();if(!sbc||!draftId)return showStatus('أنشئ الأسئلة أولًا.',false);
 const btn=document.getElementById('ss-ai-publish-btn');btn.disabled=true;
 try{
  const results=await Promise.all([sbc.from('study_summaries').select('*').eq('id',draftId).single(),sbc.from('study_summary_questions').select('id,is_approved').eq('summary_id',draftId)]);
  if(results[0].error)throw results[0].error;if(results[1].error)throw results[1].error;
  const qs=results[1].data||[];if(!qs.length)throw new Error('لا توجد أسئلة لهذا الملخص.');
  const pending=qs.filter(q=>!q.is_approved).length;if(pending)throw new Error('اعتمد الأسئلة أولًا. ما زال '+pending+' سؤالًا غير معتمد.');
  const upd=await sbc.from('study_summaries').update({is_published:true,updated_at:new Date().toISOString()}).eq('id',draftId);if(upd.error)throw upd.error;
  showStatus('تم حفظ السعر وإتاحة الملخص للطلاب. طلبات الشراء ستظهر في القسم المخصص لها.',true);
  if(typeof window.loadStudySummaryAdmin==='function')await window.loadStudySummaryAdmin();
  draftId=null;btn.disabled=true;
  ['ss-ai-title','ss-ai-subject','ss-ai-description','ss-ai-pdf'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('ss-ai-file-info').textContent='';
 }catch(e){showStatus(e?.message||String(e),false);}finally{btn.disabled=false;}
}

function injectApprovedBankPanel(){
 const page=document.getElementById('page-study-summaries');if(!page||document.getElementById('ss-approved-bank-card'))return;
 const card=document.createElement('div');card.id='ss-approved-bank-card';card.className='card';
 card.innerHTML='<div class="card-header"><h3>🎯 إنشاء امتحان من بنك الأسئلة المعتمد</h3><span style="font-size:12px;color:var(--muted)">يستخدم الأسئلة التي اعتمدتها فقط</span></div>'+
 '<div style="padding:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">'+
 '<div class="form-group"><label>الملخص / بنك المادة</label><select id="ss-bank-summary" class="search-input" style="width:100%"><option value="">اختر الملخص</option></select></div>'+
 '<div class="form-group"><label>عدد أسئلة الامتحان</label><input id="ss-bank-count" type="number" min="1" max="100" value="20" class="search-input" style="width:100%"></div>'+
 '<div style="display:flex;align-items:end"><button id="ss-bank-create" class="btn btn-gold" type="button">إنشاء امتحان من البنك</button></div><div id="ss-bank-status" style="grid-column:1/-1;font-size:13px"></div></div>';
 const ai=document.getElementById('ss-ai-generator-card');if(ai)ai.insertAdjacentElement('afterend',card);else page.prepend(card);
 document.getElementById('ss-bank-create').addEventListener('click',createExamFromApprovedSummaryBank);
}
async function populateBankSummarySelect(){
 const select=document.getElementById('ss-bank-summary'),sbc=client();if(!select||!sbc)return;
 const {data,error}=await sbc.from('study_summaries').select('id,title,subject_name').order('created_at',{ascending:false});
 if(error){select.innerHTML='<option value="">تعذر تحميل الملخصات</option>';return;}
 select.innerHTML='<option value="">اختر الملخص</option>'+(data||[]).map(s=>'<option value="'+esc(s.id)+'">'+esc(s.title)+' — '+esc(s.subject_name||'')+'</option>').join('');
}
async function createExamFromApprovedSummaryBank(){
 const sbc=client(),select=document.getElementById('ss-bank-summary'),status=document.getElementById('ss-bank-status'),btn=document.getElementById('ss-bank-create');
 const id=select?.value,count=Math.max(1,Math.min(100,Number(document.getElementById('ss-bank-count')?.value||20)));
 if(!id){status.textContent='اختر الملخص أولًا.';return;}btn.disabled=true;status.textContent='جاري جلب الأسئلة المعتمدة...';
 try{
  const {data,error}=await sbc.from('study_summary_questions').select('*').eq('summary_id',id).eq('is_approved',true);if(error)throw error;
  if(!data?.length)throw new Error('لا توجد أسئلة معتمدة في هذا البنك. راجع الأسئلة واعتمدها أولًا.');
  if(count>data.length)throw new Error('عدد الأسئلة المطلوب أكبر من عدد الأسئلة المعتمدة ('+data.length+').');
  const summary=await sbc.from('study_summaries').select('title,subject_name').eq('id',id).single();if(summary.error)throw summary.error;
  const questions=[...data].sort(()=>Math.random()-.5).slice(0,count).map(q=>{
   let options=Array.isArray(q.options)?q.options:[];if(!options.length&&q.options&&typeof q.options==='object')options=Object.values(q.options);
   const raw=String(q.answer_text||'').trim();let answer=raw;
   if(options.length){const norm=v=>String(v??'').trim().toLowerCase().replace(/[أإآ]/g,'ا');const n=options.findIndex(o=>norm(o)===norm(raw));if(n>=0)answer=String.fromCharCode(97+n);}
   const type=String(q.question_type||'').includes('true')||String(q.question_type||'').includes('صح')?'true_false':'multiple_choice';
   return {question:q.question_text,options,type,answer,explanation:q.explanation||'',points:1};
  });
  const subject=summary.data.subject_name||summary.data.title,exam={title:'امتحان '+subject,subject,questions};
  if(typeof window.showGeneratedExamReview!=='function')throw new Error('واجهة مراجعة الامتحان غير متاحة. حدّث الصفحة وأعد المحاولة.');
  status.textContent='تم اختيار '+questions.length+' سؤالًا. جاري فتح شاشة المراجعة والإعدادات...';window.showGeneratedExamReview(exam);
  if(typeof window.showToast==='function')window.showToast('تم اختيار '+questions.length+' سؤالًا معتمدًا');
  setTimeout(()=>{if(typeof window.openGeneratedExamSettings==='function')window.openGeneratedExamSettings();},250);
 }catch(e){status.textContent='❌ '+(e?.message||e);if(typeof window.showToast==='function')window.showToast(e?.message||'تعذر إنشاء الامتحان','error');}finally{btn.disabled=false;}
}
function wire(){
 if(typeof window.editStudySummary==='function'&&!window.editStudySummary.__ssFlowWrapped){const oldEdit=window.editStudySummary;const wrappedEdit=function(...args){const legacy=document.getElementById('ss-legacy-summary-form-card');if(legacy)legacy.style.display='block';return oldEdit.apply(this,args);};wrappedEdit.__ssFlowWrapped=true;window.editStudySummary=wrappedEdit;}
 if(typeof window.resetStudySummaryForm==='function'&&!window.resetStudySummaryForm.__ssFlowWrapped){const oldReset=window.resetStudySummaryForm;const wrappedReset=function(...args){const result=oldReset.apply(this,args);const legacy=document.getElementById('ss-legacy-summary-form-card');if(legacy)legacy.style.display='none';return result;};wrappedReset.__ssFlowWrapped=true;window.resetStudySummaryForm=wrappedReset;}
 if(typeof window.loadStudySummaryAdmin==='function'&&!window.loadStudySummaryAdmin.__ssFlowWrapped){const old=window.loadStudySummaryAdmin;const wrapped=async function(...args){const r=await old.apply(this,args);inject();injectApprovedBankPanel();populateBankSummarySelect();return r;};wrapped.__ssFlowWrapped=true;window.loadStudySummaryAdmin=wrapped;}
 if(typeof window.showPage==='function'&&!window.showPage.__ssFlowWrapped){const old=window.showPage;const wrapped=function(page,...args){const r=old.call(this,page,...args);if(page==='study-summaries')setTimeout(inject,0);return r;};wrapped.__ssFlowWrapped=true;window.showPage=wrapped;}
 inject();injectApprovedBankPanel();populateBankSummarySelect();
}
setInterval(wire,1000);setTimeout(wire,300);
})();