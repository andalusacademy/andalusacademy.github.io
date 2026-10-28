(() => {
'use strict';
const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(String(v??'')):String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const client=()=>window.sb||(typeof sb!=='undefined'?sb:null);
let draftId=null, allQuestions=[], selectedIds=new Set(), selectedSummaryId='', reviewSummaryId='', reviewReadOnly=false, activeBatch='all', expandedReviewId='', selectedManageIds=new Set();
let wired=false;
const typeLabel=t=>t==='mcq'?'اختيار من متعدد':t==='true_false'?'صح أو خطأ':t==='essay'?'مقالي':String(t||'سؤال');
function localDateTime(d){const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,16);}
function status(msg,ok=false){const el=document.getElementById('ss-ai-status');if(el)el.innerHTML='<div style="background:'+(ok?'#ecfdf5':'#fef2f2')+';color:'+(ok?'#166534':'#991b1b')+';padding:12px;border-radius:10px;line-height:1.8">'+(ok?'✅ ':'❌ ')+esc(msg)+'</div>';}
function hideLegacy(){
 ['ss-legacy-summary-form-card','ss-approved-bank-card'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
 const oldForm=document.getElementById('ss-title')?.closest('.card');if(oldForm)oldForm.style.display='none';
 const page=document.getElementById('page-study-summaries');if(!page)return;
 const cards=[...page.querySelectorAll(':scope > .card')];
 cards.forEach(card=>{
  if(card.id==='ss-ai-generator-card'||card.id==='ss-question-review-card'||card.id==='ss-approved-summaries-card'||card.id==='ss-summary-management-card')return;
  if(card.querySelector('#ssq-question')||card.querySelector('button[onclick*="saveStudySummaryQuestion"]'))card.style.display='none';
 });
}
function inject(){
 const page=document.getElementById('page-study-summaries');if(!page)return;
 if(!document.getElementById('ss-ai-generator-card')){
  const card=document.createElement('div');card.id='ss-ai-generator-card';card.className='card';
  card.innerHTML='<div class="card-header"><h3>📚 ١) رفع المادة وتوليد الأسئلة</h3><span style="font-size:12px;color:var(--muted)">حفظ مسودة فقط — بدون إتاحة للطلاب</span></div>'+
  '<div style="padding:18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px">'+
  '<div class="form-group"><label>اسم الملخص</label><input id="ss-ai-title" class="search-input" maxlength="180" placeholder="مثال: ملخص التغذية العلاجية" style="width:100%"></div>'+
  '<div class="form-group"><label>اسم المادة</label><input id="ss-ai-subject" class="search-input" maxlength="160" placeholder="التغذية العلاجية" style="width:100%"></div>'+
  '<div class="form-group"><label><input id="ss-ai-mc-enabled" type="checkbox"> اختياري (MCQ)</label><input id="ss-ai-mc-count" class="search-input" type="number" min="1" max="100" placeholder="عدد أسئلة الاختياري" style="width:100%" disabled></div>'+
  '<div class="form-group"><label><input id="ss-ai-tf-enabled" type="checkbox"> صح وغلط</label><input id="ss-ai-tf-count" class="search-input" type="number" min="1" max="100" placeholder="عدد أسئلة صح وغلط" style="width:100%" disabled></div>'+
  '<div class="form-group"><label><input id="ss-ai-essay-enabled" type="checkbox"> مقالي</label><input id="ss-ai-essay-count" class="search-input" type="number" min="1" max="100" placeholder="عدد الأسئلة المقالية" style="width:100%" disabled></div>'+
  '<div class="form-group" style="grid-column:1/-1"><label>ملف المادة PDF (ارفعه في الجزء الأول فقط)</label><input id="ss-ai-pdf" class="search-input" type="file" accept="application/pdf,.pdf" style="width:100%"><div id="ss-ai-file-info" style="margin-top:6px;color:var(--muted);font-size:12px"></div></div>'+
  '<div class="form-group" style="grid-column:1/-1"><label>وصف الملخص (اختياري)</label><textarea id="ss-ai-description" class="search-input" maxlength="3000" placeholder="وصف مختصر للمادة" style="width:100%;min-height:65px"></textarea></div></div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-gold" id="ss-ai-generate-btn" type="button">⬆️ حفظ المادة وتوليد الأسئلة</button></div>'+
  '<div id="ss-ai-status" style="margin-top:12px"></div><div style="margin-top:8px;font-size:12px;color:var(--muted)">كل ضغطة تولّد جزءًا جديدًا مستقلًا وتحفظه فورًا. اختر نوعًا واحدًا أو أكثر وحدد عدد أسئلة كل نوع. يمكنك رفع المادة مرة واحدة ثم توليد أجزاء أخرى منها.</div></div>';
  const anchor=page.querySelector('.card');if(anchor)anchor.insertAdjacentElement('beforebegin',card);else page.prepend(card);
  document.getElementById('ss-ai-pdf').addEventListener('change',e=>{const f=e.target.files?.[0];document.getElementById('ss-ai-file-info').textContent=f?'📄 '+f.name+' — '+(f.size/1024/1024).toFixed(2)+' MB':'';});
  document.getElementById('ss-ai-generate-btn').addEventListener('click',generate);
  [['ss-ai-mc-enabled','ss-ai-mc-count'],['ss-ai-tf-enabled','ss-ai-tf-count'],['ss-ai-essay-enabled','ss-ai-essay-count']].forEach(([check,count])=>{const box=document.getElementById(check),input=document.getElementById(count);box.addEventListener('change',()=>{input.disabled=!box.checked;if(!box.checked)input.value='';else input.focus();});});
 }
 if(!document.getElementById('ss-question-review-card')){
  const card=document.createElement('div');card.id='ss-question-review-card';card.className='card';
  card.innerHTML='<div class="card-header"><h3>📝 ٢) مراجعة الأسئلة والإجابات ومصادر الصفحات</h3><span id="ss-question-counts" style="font-size:12px;color:var(--muted)">ارفع المادة أولًا</span></div>'+
  '<div style="padding:16px"><div class="form-group" style="margin-bottom:12px"><label>الملخصات المسجلة — افتح أي ملخص لمراجعة أسئلته</label><div id="ss-review-summary-cards" style="display:grid;gap:10px;margin:10px 0"></div><select id="ss-review-summary" class="search-input" style="display:none;width:100%"><option value="">—</option></select><div id="ss-review-status" style="font-size:12px;color:var(--muted);margin-top:6px"></div><div class="form-group" style="margin-top:10px"><label>عرض جزء الأسئلة</label><select id="ss-review-batch" class="search-input" style="width:100%"><option value="all">كل الأجزاء</option></select></div><button class="btn btn-outline btn-sm" id="ss-select-all-questions" type="button" style="margin-top:10px">☑️ تحديد كل الأسئلة</button></div><div id="ss-generated-list"><p style="color:var(--muted)">اختر ملخصًا لعرض أسئلته وإجاباته ومصادر الصفحات. هذه الشاشة إدارية فقط.</p></div>'+
  '<div style="margin:24px 0 12px;border-top:3px solid #c9a24c;padding-top:16px"><h3 style="margin-bottom:8px">⭐ الأسئلة التي اخترتها للملخص</h3><p style="color:var(--muted);font-size:12px;margin-bottom:12px">أي سؤال تعلّم عليه فوق ينتقل إلى هذه القائمة تلقائيًا.</p><div id="ss-selected-list"><p style="color:var(--muted)">لم تحدد أسئلة بعد.</p></div></div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-gold" id="ss-approve-summary-btn" disabled>✅ اعتماد الأسئلة المحددة والملخص بالكامل</button><button class="btn btn-outline" id="ss-export-questions-pdf-btn" type="button" disabled>📄 تصدير PDF</button><button class="btn btn-outline" id="ss-export-questions-word-btn" type="button" disabled>📝 تصدير Word</button></div><div id="ss-approve-status" style="margin-top:12px"></div></div>';
  document.getElementById('ss-ai-generator-card').insertAdjacentElement('afterend',card);
  card.addEventListener('change',e=>{const box=e.target.closest('input[data-question-id]');if(!box)return;const id=box.dataset.questionId;if(box.checked)selectedIds.add(id);else selectedIds.delete(id);renderQuestionLists();});
  document.getElementById('ss-approve-summary-btn').addEventListener('click',approveSelected);
  document.getElementById('ss-select-all-questions').addEventListener('click',()=>{if(reviewReadOnly)return;const visible=allQuestions.filter(q=>activeBatch==='all'||Number(q.batch_no)===Number(activeBatch));const allPicked=visible.length>0&&visible.every(q=>selectedIds.has(q.id));if(allPicked)visible.forEach(q=>selectedIds.delete(q.id));else visible.forEach(q=>selectedIds.add(q.id));renderQuestionLists();const b=document.getElementById('ss-select-all-questions');if(b)b.textContent=allPicked?'☑️ تحديد كل أسئلة الجزء':'☐ إلغاء تحديد أسئلة الجزء';});
  document.getElementById('ss-review-summary').addEventListener('change',e=>{activeBatch='all';reviewSummaryId=e.target.value;expandedReviewId=e.target.value;setReviewWorkspaceVisible(!!e.target.value);loadReviewSummaryQuestions(e.target.value);});
  document.getElementById('ss-review-batch').addEventListener('change',e=>{activeBatch=e.target.value;renderQuestionLists();});
  document.getElementById('ss-export-questions-pdf-btn').addEventListener('click',exportQuestionsPdf);
  document.getElementById('ss-export-questions-word-btn').addEventListener('click',exportQuestionsWord);
 }
 if(!document.getElementById('ss-summary-management-card')){
  const card=document.createElement('div');card.id='ss-summary-management-card';card.className='card';
  card.innerHTML='<div class="card-header"><h3>📦 ٣) إعداد الملخص المعتمد ونشره</h3><span style="font-size:12px;color:var(--muted)">لا يظهر للطلاب إلا بعد النشر</span></div>'+
  '<div style="padding:18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">'+
  '<div class="form-group" style="grid-column:1/-1"><label>الملخصات المعتمدة — حدّد ملخصًا أو أكثر لتطبيق الإعدادات والنشر</label><div id="ss-manage-summary-cards" style="display:grid;gap:10px;margin:10px 0"></div><select id="ss-manage-summary" class="search-input" style="display:none;width:100%"><option value="">—</option></select></div>'+
  '<div class="form-group"><label>السعر بالجنيه</label><input id="ss-manage-price" type="number" min="0" step="0.01" value="" class="search-input" style="width:100%" placeholder="أدخل السعر"></div>'+
  '<div class="form-group"><label>وسيلة التحويل</label><input id="ss-manage-payment-provider" type="text" maxlength="80" value="" class="search-input" style="width:100%" placeholder="اكتب وسيلة التحويل"></div>'+
  '<div class="form-group"><label>رقم المحفظة المستقبِلة</label><input id="ss-manage-wallet-number" type="text" inputmode="tel" maxlength="40" class="search-input" style="width:100%" placeholder="أدخل رقم المحفظة قبل النشر"></div>'+
  '<div class="form-group"><label>مدة صلاحية الطالب بعد الشراء (بالأيام)</label><input id="ss-manage-validity" type="number" min="1" max="3650" value="" class="search-input" style="width:100%"></div>'+
  '<div class="form-group"><label>بداية الإتاحة للشراء</label><input id="ss-manage-from" type="datetime-local" class="search-input" style="width:100%"></div>'+
  '<div class="form-group"><label>نهاية الإتاحة للشراء</label><input id="ss-manage-until" type="datetime-local" class="search-input" style="width:100%"></div>'+
  '<div class="form-group" style="grid-column:1/-1"><label><input id="ss-manage-target-all" type="checkbox"> إتاحة المنتج لكل الطلاب</label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:8px"><div><label>الفرع المستهدف (اختياري)</label><select id="ss-manage-target-branch" class="search-input" style="width:100%"><option value="">جاري تحميل الفروع...</option></select></div><div><label>النظام المستهدف (اختياري)</label><select id="ss-manage-target-system" class="search-input" style="width:100%"><option value="">جاري تحميل الأنظمة...</option></select></div><div><label>الدفعة / البرنامج المستهدف (اختياري)</label><select id="ss-manage-target-batch" class="search-input" style="width:100%"><option value="">جاري تحميل البرامج...</option></select></div></div><small style="display:block;color:var(--muted);margin-top:5px">حدد «كل الطلاب» أو أدخل شرطًا واحدًا على الأقل للجمهور المستهدف.</small></div>'+
  '<div class="form-group" style="grid-column:1/-1"><label>الأجزاء المتاحة للطالب</label><div id="ss-manage-batches" style="display:flex;gap:12px;flex-wrap:wrap;padding:10px;border:1px solid var(--border);border-radius:8px">احفظ جزءًا واحدًا على الأقل أولًا</div><small style="display:block;color:var(--muted);margin-top:5px">حدد الأجزاء التي تريد بيعها داخل هذا المنتج.</small></div>'+
  '<div class="form-group" style="grid-column:1/-1"><label>أنواع الأسئلة المتاحة في المنتج</label><div id="ss-manage-types" style="display:flex;gap:18px;flex-wrap:wrap;padding:10px;border:1px solid var(--border);border-radius:8px"><label><input type="checkbox" data-summary-type="mcq" checked> اختياري فقط / ضمن الملخص</label><label><input type="checkbox" data-summary-type="true_false" checked> صح وغلط</label><label><input type="checkbox" data-summary-type="essay" checked> مقالي</label></div><small style="display:block;color:var(--muted);margin-top:5px">يمكنك بيع نوع واحد فقط أو مزيج من الأنواع المحددة.</small></div></div>'+
  '<div id="ss-manage-info" style="margin:8px 0;color:var(--muted);font-size:12px"></div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline" id="ss-manage-save" type="button">💾 حفظ الإعدادات فقط</button><button class="btn btn-gold" id="ss-manage-publish" type="button">📢 نشر للطلاب</button></div><div id="ss-manage-status" style="margin-top:12px"></div></div>';
  const rev=document.getElementById('ss-question-review-card');rev.insertAdjacentElement('afterend',card);
  document.getElementById('ss-manage-summary').addEventListener('change',loadManageSummary);
  document.getElementById('ss-manage-save').addEventListener('click',()=>saveManageSummary(false));
  document.getElementById('ss-manage-publish').addEventListener('click',()=>saveManageSummary(true));
  document.getElementById('ss-manage-from').value='';document.getElementById('ss-manage-until').value='';
  document.getElementById('ss-manage-target-all').addEventListener('change',()=>{const all=document.getElementById('ss-manage-target-all').checked;['ss-manage-target-branch','ss-manage-target-system','ss-manage-target-batch'].forEach(id=>{document.getElementById(id).disabled=all;});});
 }
 hideLegacy();
}
async function generate(){
 const sbc=client(),file=document.getElementById('ss-ai-pdf').files?.[0],description=document.getElementById('ss-ai-description').value.trim();
 const tf=document.getElementById('ss-ai-tf-enabled').checked?Math.max(0,Math.min(100,Number(document.getElementById('ss-ai-tf-count').value||0))):0;
 const mc=document.getElementById('ss-ai-mc-enabled').checked?Math.max(0,Math.min(100,Number(document.getElementById('ss-ai-mc-count').value||0))):0;
 const essay=document.getElementById('ss-ai-essay-enabled').checked?Math.max(0,Math.min(100,Number(document.getElementById('ss-ai-essay-count').value||0))):0;
 const total=tf+mc+essay;
 if(!sbc)return status('اتصال قاعدة البيانات غير جاهز. أعد تحميل الصفحة.');
 if(total<1)return status('اختر نوع سؤال واحدًا على الأقل واكتب عدد الأسئلة المطلوبة.');
 if(total>100)return status('إجمالي أسئلة الجزء الواحد لا يتجاوز 100 سؤال.');
 if((document.getElementById('ss-ai-mc-enabled').checked&&mc<1)||(document.getElementById('ss-ai-tf-enabled').checked&&tf<1)||(document.getElementById('ss-ai-essay-enabled').checked&&essay<1))return status('اكتب عددًا صحيحًا لكل نوع اخترته.');
 if(file&&(!file.type.includes('pdf')&&!file.name.toLowerCase().endsWith('.pdf')))return status('اختر ملف PDF للمادة.');
 if(file&&file.size>15*1024*1024)return status('حجم الملف يجب ألا يتجاوز 15 ميجابايت.');
 const btn=document.getElementById('ss-ai-generate-btn');btn.disabled=true;
 try{
  const auth=await sbc.auth.getSession();if(!auth.data?.session)throw new Error('جلسة المدير غير صالحة. سجّل الدخول مرة أخرى.');
  const chosenDraft=draftId||document.getElementById('ss-review-summary')?.value||'';
  let summary=null;
  if(chosenDraft){const found=await sbc.from('study_summaries').select('id,title,subject_name,description,source_pdf_path,is_approved,is_published').eq('id',chosenDraft).single();if(found.error)throw found.error;summary=found.data;draftId=summary.id;if(summary.is_published)throw new Error('الملخص منشور بالفعل. أوقف نشره أولًا قبل إضافة جزء جديد.');}
  const title=(document.getElementById('ss-ai-title').value.trim()||summary?.title||'').trim();
  const subject=(document.getElementById('ss-ai-subject').value.trim()||summary?.subject_name||'').trim();
  if(title.length<2||!subject)throw new Error('اكتب اسم الملخص واسم المادة أولًا.');
  if(!summary&&!file)throw new Error('ارفع ملف PDF لإنشاء الجزء الأول.');
  if(summary){const old=await sbc.from('study_summaries').update({title,subject_name:subject,description:description||summary.description||'',is_published:false,ai_generation_status:'processing',ai_generation_error:null,updated_at:new Date().toISOString()}).eq('id',draftId);if(old.error)throw old.error;}
  else{const made=await sbc.from('study_summaries').insert({title,subject_name:subject,description,price:0,validity_days:30,is_published:false,is_approved:false,created_by:auth.data.session.user.id,ai_generation_status:'processing'}).select('id').single();if(made.error)throw made.error;draftId=made.data.id;}
  let path=summary?.source_pdf_path||'';
  if(file){path='summary-'+draftId+'/'+Date.now()+'-source.pdf';const upload=await sbc.storage.from('study-summary-pdfs').upload(path,file,{contentType:'application/pdf',upsert:false});if(upload.error)throw upload.error;}
  if(!path)throw new Error('لم يتم العثور على ملف المادة المحفوظ. ارفع ملف PDF ثم أعد المحاولة.');
  const prior=await sbc.from('study_summary_questions').select('batch_no').eq('summary_id',draftId).order('batch_no',{ascending:false}).limit(1);if(prior.error)throw prior.error;
  const batchNo=(prior.data?.length?Number(prior.data[0].batch_no)||0:0)+1;if(batchNo>100)throw new Error('وصل الملخص إلى الحد الأقصى للأجزاء (100).');
  status('جاري توليد الجزء '+batchNo+' وحفظه فور اكتماله...',true);
  const response=await fetch(sbc.supabaseUrl+'/functions/v1/generate-study-summary',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.data.session.access_token,apikey:sbc.supabaseKey},body:JSON.stringify({summary_id:draftId,pdf_path:path,subject,true_false_count:tf,mcq_count:mc,essay_count:essay,batch_no:batchNo})});
  const result=await response.json().catch(()=>({}));if(!response.ok||!result.success)throw new Error('تعذر توليد الجزء '+batchNo+': '+(result.error||'خدمة التوليد لم تُكمل العدد المطلوب.'));
  const count=await sbc.from('study_summary_questions').select('id',{count:'exact',head:true}).eq('summary_id',draftId);if(count.error)throw count.error;
  const save=await sbc.from('study_summaries').update({source_pdf_path:path,ai_generation_status:'ready',generated_question_count:count.count||result.totalQuestionCount||total,is_published:false,updated_at:new Date().toISOString()}).eq('id',draftId);if(save.error)throw save.error;
  const loaded=await sbc.from('study_summary_questions').select('*').eq('summary_id',draftId).order('batch_no').order('order_num');if(loaded.error)throw loaded.error;
  allQuestions=loaded.data||[];selectedIds=new Set();selectedSummaryId=draftId;reviewSummaryId=draftId;reviewReadOnly=false;
  const reviewSel=document.getElementById('ss-review-summary');if(reviewSel)reviewSel.value=draftId;
  document.getElementById('ss-question-counts').textContent='تم حفظ الجزء '+batchNo+' — إجمالي الأسئلة: '+allQuestions.length+' ('+allQuestions.filter(q=>q.question_type==='mcq').length+' اختياري، '+allQuestions.filter(q=>q.question_type==='true_false').length+' صح/خطأ، '+allQuestions.filter(q=>q.question_type==='essay').length+' مقالي)';
  renderQuestionLists();document.getElementById('ss-approve-summary-btn').disabled=false;
  document.getElementById('ss-export-questions-pdf-btn').disabled=!allQuestions.length;document.getElementById('ss-export-questions-word-btn').disabled=!allQuestions.length;
  status('تم توليد الجزء '+batchNo+' وحفظه. يمكنك تحديد الأسئلة المناسبة أو توليد جزء جديد من نفس المادة؛ لم يتم النشر للطلاب.',true);
  await refreshSummaries();
 }catch(e){
  const reason=e?.message||String(e);status(reason);
  if(draftId){try{const partial=await sbc.from('study_summary_questions').select('*').eq('summary_id',draftId).order('batch_no').order('order_num');if(!partial.error&&partial.data?.length){allQuestions=partial.data;selectedIds=new Set();selectedSummaryId=draftId;reviewSummaryId=draftId;const reviewSel=document.getElementById('ss-review-summary');if(reviewSel)reviewSel.value=draftId;document.getElementById('ss-question-counts').textContent='الأسئلة المحفوظة حتى الآن: '+allQuestions.length;renderQuestionLists();document.getElementById('ss-export-questions-pdf-btn').disabled=false;document.getElementById('ss-export-questions-word-btn').disabled=false;status('لم يكتمل الجزء الجديد: '+reason+' — تم الحفاظ على الأسئلة المحفوظة بالفعل.',false);}}catch(partialError){console.error('تعذر تحميل الأسئلة المحفوظة جزئيًا',partialError);}}
 }finally{btn.disabled=false;}
}
function renderQuestionLists(){
 const generated=document.getElementById('ss-generated-list'),selected=document.getElementById('ss-selected-list');if(!generated||!selected)return;
 const visibleQuestions=allQuestions.filter(q=>activeBatch==='all'||Number(q.batch_no)===Number(activeBatch));
 const one=q=>'<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin:8px 0;background:#fff"><label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-question-id="'+esc(q.id)+'" '+(selectedIds.has(q.id)?'checked':'')+' '+(reviewReadOnly?'disabled':'')+' style="margin-top:5px;flex:0 0 auto"><span style="flex:1"><strong>'+esc(q.order_num)+'. المجموعة '+String.fromCharCode(64+Number(q.batch_no||1))+' — '+esc(q.question_text)+'</strong><div style="margin-top:5px;color:#64748b;font-size:12px">'+esc(typeLabel(q.question_type))+'</div>'+(Array.isArray(q.options)&&q.options.length?'<ol style="margin:8px 22px">'+q.options.map(o=>'<li>'+esc(o)+'</li>').join('')+'</ol>':'')+'<div style="margin-top:8px;color:#166534;white-space:pre-wrap"><strong>الإجابة النموذجية:</strong> '+esc(q.answer_text||'')+'</div>'+(q.explanation?'<div style="margin-top:5px;color:#64748b">التوضيح: '+esc(q.explanation)+'</div>':'')+'<div style="margin-top:6px;color:#92400e;background:#fffbeb;padding:5px 8px;border-radius:6px;font-size:12px"><strong>📄 صفحة المصدر (للمدير فقط):</strong> '+esc(q.source_reference||'لم يحدد الذكاء الاصطناعي الصفحة — راجع ملف PDF يدويًا')+(q.source_page?' (رقم الصفحة: '+esc(q.source_page)+')':'')+'</div></span></label></div>';
 generated.innerHTML=visibleQuestions.length?visibleQuestions.map(one).join(''):'<p style="color:var(--muted)">لا توجد أسئلة في الجزء المحدد حتى الآن.</p>';
 const picked=visibleQuestions.filter(q=>selectedIds.has(q.id));
 selected.innerHTML=picked.length?picked.map((q,i)=>'<div style="border:1px solid #86bda0;border-radius:10px;padding:12px;margin:8px 0;background:#f0fdf4"><strong>'+ (i+1)+'. '+esc(q.question_text)+'</strong><div style="font-size:12px;color:#166534;margin-top:4px">'+esc(typeLabel(q.question_type))+' — الإجابة: '+esc(q.answer_text)+'</div><button type="button" class="btn btn-outline btn-sm" data-unselect-id="'+esc(q.id)+'" '+(reviewReadOnly?'disabled':'')+' style="margin-top:8px">إزالة من الاختيار</button></div>').join(''):'<p style="color:var(--muted)">لم تحدد أسئلة بعد.</p>';
 selected.querySelectorAll('[data-unselect-id]').forEach(b=>b.addEventListener('click',()=>{selectedIds.delete(b.dataset.unselectId);renderQuestionLists();}));
 selected.querySelectorAll('[data-unselect-id]').forEach(b=>{const q=allQuestions.find(x=>x.id===b.dataset.unselectId);if(q){const d=document.createElement('div');d.style.cssText='font-size:12px;color:#92400e;margin-top:5px';d.textContent='صفحة المصدر (للمدير فقط): '+(q.source_reference||'غير محددة — راجع PDF');b.parentElement.appendChild(d);}});
 document.getElementById('ss-approve-summary-btn').disabled=reviewReadOnly||!picked.some(q=>!q.is_approved);const exportBtn=document.getElementById('ss-export-questions-pdf-btn');if(exportBtn)exportBtn.disabled=!allQuestions.length;const wordBtn=document.getElementById('ss-export-questions-word-btn');if(wordBtn)wordBtn.disabled=!allQuestions.length;
}
function exportQuestionsPdf(){
 if(!allQuestions.length){status('لا توجد أسئلة لتصديرها بعد.');return;}
 const summaryTitle=document.getElementById('ss-ai-title')?.value.trim()||'ملخص دراسي';
 const subject=document.getElementById('ss-ai-subject')?.value.trim()||'';
 const rows=allQuestions.map((q,i)=>{
  const opts=Array.isArray(q.options)&&q.options.length?'<ol>'+q.options.map(o=>'<li>'+esc(o)+'</li>').join('')+'</ol>':'';
  return '<article class="question"><h3>'+esc(q.order_num||i+1)+'. '+esc(q.question_text)+'</h3><div class="meta">'+esc(typeLabel(q.question_type))+' — '+(selectedIds.has(q.id)?'محدد للاعتماد':'غير محدد')+'</div>'+opts+'<p><strong>الإجابة النموذجية:</strong> '+esc(q.answer_text||'—')+'</p>'+(q.explanation?'<p><strong>التوضيح:</strong> '+esc(q.explanation)+'</p>':'')+'<p class="source"><strong>مرجع الصفحة للمراجعة الإدارية:</strong> '+esc(q.source_reference||'غير محدد في المصدر — يحتاج مراجعة يدوية')+'</p></article>';
 }).join('');
 const w=window.open('','_blank');
 if(!w){status('المتصفح منع نافذة التصدير. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.');return;}
 w.document.open();
 w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(summaryTitle)+' - الأسئلة</title><style>body{font-family:Tahoma,Arial,sans-serif;color:#172033;margin:24px;direction:rtl;line-height:1.8}header{border-bottom:3px solid #183b67;padding-bottom:12px;margin-bottom:20px}h1{color:#183b67;font-size:22px;margin:0}h2{font-size:15px;color:#475569;margin:4px 0}.question{break-inside:avoid;border:1px solid #cbd5e1;border-radius:8px;padding:12px 15px;margin:0 0 14px}.question h3{font-size:16px;margin:0 0 5px;color:#102a43}.meta{font-size:11px;color:#64748b}.question ol{padding-right:24px}.question p{margin:6px 0}.source{color:#92400e;background:#fffbeb;padding:5px 8px;border-radius:4px;font-size:12px}button{font:inherit;padding:9px 16px;border:0;border-radius:6px;background:#183b67;color:white;cursor:pointer;margin:0 0 18px}@media print{body{margin:10mm}button{display:none}.question{break-inside:avoid}}@page{size:A4;margin:12mm}</style></head><body><button onclick="window.print()">طباعة / حفظ كـ PDF</button><header><h1>مركز الأندلس للتدريب</h1><h2>تصدير الأسئلة للمراجعة الإدارية</h2><div><strong>الملخص:</strong> '+esc(summaryTitle)+' '+(subject?' — <strong>المادة:</strong> '+esc(subject):'')+'</div><div><strong>عدد الأسئلة:</strong> '+allQuestions.length+' — <strong>تاريخ التصدير:</strong> '+esc(new Date().toLocaleString('ar-EG'))+'</div></header>'+rows+'</body></html>');
 w.document.close();w.focus();setTimeout(()=>{try{w.print();}catch(e){}},400);
}

function exportQuestionsWord(){
 if(!allQuestions.length){status('لا توجد أسئلة لتصديرها بعد.');return;}
 const summaryTitle=document.getElementById('ss-ai-title')?.value.trim()||'ملخص دراسي';
 const subject=document.getElementById('ss-ai-subject')?.value.trim()||'';
 const rows=allQuestions.map((q,i)=>{
  const opts=Array.isArray(q.options)&&q.options.length?'<ol>'+q.options.map(o=>'<li>'+esc(o)+'</li>').join('')+'</ol>':'';
  return '<article class="question"><h3>'+(i+1)+'. '+esc(q.question_text)+'</h3><div class="meta">'+esc(typeLabel(q.question_type))+' — '+(selectedIds.has(q.id)?'محدد للاعتماد':'غير محدد')+'</div>'+opts+'<p><strong>الإجابة النموذجية:</strong> '+esc(q.answer_text||'—')+'</p>'+(q.explanation?'<p><strong>التوضيح:</strong> '+esc(q.explanation)+'</p>':'')+'<p class="source"><strong>صفحة المصدر (للمراجعة الإدارية فقط):</strong> '+esc(q.source_reference||'غير محددة — يلزم مراجعة ملف PDF يدويًا')+'</p></article>';
 }).join('');
 const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(summaryTitle)+'</title><style>body{font-family:Arial,Tahoma,sans-serif;direction:rtl;text-align:right;color:#172033;line-height:1.8}h1{color:#183b67;border-bottom:3px solid #c9a24c;padding-bottom:10px}.meta{color:#64748b;font-size:10pt}.question{border:1px solid #cbd5e1;padding:12px;margin:12px 0;page-break-inside:avoid}.question h3{color:#183b67}.source{color:#92400e;background:#fffbeb;padding:6px}.question ol{padding-right:28px}@page{size:A4;margin:18mm}</style></head><body><h1>مركز الأندلس للتدريب — أسئلة الملخص</h1><p><strong>الملخص:</strong> '+esc(summaryTitle)+(subject?' — <strong>المادة:</strong> '+esc(subject):'')+'</p><p><strong>عدد الأسئلة:</strong> '+allQuestions.length+' — <strong>تاريخ التصدير:</strong> '+esc(new Date().toLocaleString('ar-EG'))+'</p>'+rows+'</body></html>';
 const blob=new Blob(['\ufeff',html],{type:'application/msword;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=(summaryTitle.replace(/[\\/:*?"<>|]/g,'_')||'study-summary')+'-questions.doc';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 status('تم تجهيز ملف Word للتنزيل. يتضمن صفحة المصدر للمراجعة الإدارية فقط.',true);
}
async function approveSelected(){
 const sbc=client(),targetId=reviewSummaryId||draftId;if(!sbc||!targetId||reviewReadOnly)return;
 const visible=allQuestions.filter(q=>activeBatch==='all'||Number(q.batch_no)===Number(activeBatch));const picked=visible.filter(q=>selectedIds.has(q.id));if(!picked.length)return;const pendingPicked=picked.filter(q=>!q.is_approved);if(!pendingPicked.length){const el=document.getElementById('ss-approve-status');if(el)el.textContent='كل الأسئلة المحددة في الجزء المعروض معتمدة بالفعل.';return;}
 const btn=document.getElementById('ss-approve-summary-btn');btn.disabled=true;
 try{
  const auth=await sbc.auth.getSession();if(!auth.data?.session)throw new Error('انتهت جلسة المدير.');
  const ids=pendingPicked.map(q=>q.id);
  const selected=await sbc.from('study_summary_questions').update({is_selected:true,is_approved:true,reviewed_at:new Date().toISOString(),reviewed_by:auth.data.session.user.id}).in('id',ids);if(selected.error)throw selected.error;
  const summary=await sbc.from('study_summaries').update({is_approved:true,approved_at:new Date().toISOString(),approved_by:auth.data.session.user.id,is_published:false,updated_at:new Date().toISOString()}).eq('id',targetId);if(summary.error)throw summary.error;
  allQuestions=allQuestions.map(q=>selectedIds.has(q.id)?({...q,is_selected:true,is_approved:true,reviewed_at:new Date().toISOString(),reviewed_by:auth.data.session.user.id}):q);
  const el=document.getElementById('ss-approve-status');el.innerHTML='<div style="background:#ecfdf5;color:#166534;padding:12px;border-radius:10px">✅ تم اعتماد '+pendingPicked.length+' سؤالًا جديدًا في '+(activeBatch==='all'?'الأجزاء المحددة':'الجزء '+String.fromCharCode(64+Number(activeBatch)))+'. يمكنك مراجعة جزء آخر ثم إعداد السعر والنشر.</div>';
  selectedSummaryId=targetId;document.getElementById('ss-manage-summary').value=targetId;selectedManageIds.add(targetId);await refreshSummaries();await loadManageSummary();
  if(typeof window.loadStudySummaryOrdersAdmin==='function')await window.loadStudySummaryOrdersAdmin();
 }catch(e){document.getElementById('ss-approve-status').textContent='❌ '+(e?.message||e);btn.disabled=false;}
}
function renderSummaryPickerCards(rows){
 const review=document.getElementById('ss-review-summary-cards');
 if(review){
  review.innerHTML=rows.length?rows.map(x=>'<div style="border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer"><input type="checkbox" data-review-pick="'+esc(x.id)+'" '+(reviewSummaryId===x.id?'checked':'')+'><span><strong>'+esc(x.title)+'</strong><div style="font-size:12px;color:var(--muted)">'+esc(x.subject_name||'')+' · '+Number(x.generated_question_count||0)+' سؤال · '+(x.is_published?'منشور للطلاب':x.is_approved?'معتمد':'مسودة')+'</div></span></label><button type="button" class="btn btn-outline btn-sm" data-review-toggle="'+esc(x.id)+'">'+(expandedReviewId===x.id?'إخفاء الأسئلة':'إظهار الأسئلة')+'</button></div>').join(''):'<div style="color:var(--muted);padding:12px">لا توجد ملخصات مسجلة بعد.</div>';
  review.querySelectorAll('[data-review-pick]').forEach(box=>box.addEventListener('change',()=>{const id=box.dataset.reviewPick;const sel=document.getElementById('ss-review-summary');if(box.checked){review.querySelectorAll('[data-review-pick]').forEach(other=>{if(other!==box)other.checked=false;});if(sel)sel.value=id;activeBatch='all';loadReviewSummaryQuestions(id);}else if(reviewSummaryId===id){expandedReviewId='';if(sel)sel.value='';loadReviewSummaryQuestions('');setReviewWorkspaceVisible(false);}}));
  review.querySelectorAll('[data-review-toggle]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.reviewToggle;if(expandedReviewId===id){expandedReviewId='';setReviewWorkspaceVisible(false);renderSummaryPickerCards(rows);return;}expandedReviewId=id;reviewSummaryId=id;const sel=document.getElementById('ss-review-summary');if(sel)sel.value=id;activeBatch='all';setReviewWorkspaceVisible(true);renderSummaryPickerCards(rows);await loadReviewSummaryQuestions(id);}));
 }
 const manage=document.getElementById('ss-manage-summary-cards');
 if(manage){
  const approved=rows.filter(x=>x.is_approved);
  manage.innerHTML=approved.length?approved.map(x=>'<div style="border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;align-items:center;gap:9px"><label style="display:flex;align-items:center;gap:9px;flex:1;cursor:pointer"><input type="checkbox" data-manage-pick="'+esc(x.id)+'" '+(selectedManageIds.has(x.id)?'checked':'')+'><span><strong>'+esc(x.title)+'</strong><div style="font-size:12px;color:var(--muted)">'+esc(x.subject_name||'')+' · '+Number(x.generated_question_count||0)+' سؤال</div></span></label><span class="badge '+(x.is_published?'badge-success':'badge-gray')+'">'+(x.is_published?'منشور':'غير منشور')+'</span></div>').join(''):'<div style="color:var(--muted);padding:12px">لا توجد ملخصات معتمدة. اعتمد الأسئلة أولًا.</div>';
  manage.querySelectorAll('[data-manage-pick]').forEach(box=>box.addEventListener('change',async()=>{const id=box.dataset.managePick;if(box.checked){selectedManageIds.add(id);const sel=document.getElementById('ss-manage-summary');if(sel)sel.value=id;selectedSummaryId=id;await loadManageSummary();}else{selectedManageIds.delete(id);if(selectedSummaryId===id){const next=[...selectedManageIds][0]||'';const sel=document.getElementById('ss-manage-summary');if(sel)sel.value=next;selectedSummaryId=next;if(next)await loadManageSummary();}}}));
 }
}
function setReviewWorkspaceVisible(visible){['ss-review-batch','ss-select-all-questions','ss-generated-list','ss-selected-list','ss-approve-summary-btn','ss-export-questions-pdf-btn','ss-export-questions-word-btn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=visible?'':'none';});const selected=document.getElementById('ss-selected-list');if(selected?.parentElement)selected.parentElement.style.display=visible?'':'none';}
async function populateTargetOptions(){
 const sbc=client();if(!sbc)return;const branch=document.getElementById('ss-manage-target-branch'),system=document.getElementById('ss-manage-target-system'),batch=document.getElementById('ss-manage-target-batch');if(!branch||branch.dataset.loaded==='1')return;
 try{const [students,programs,users]=await Promise.all([sbc.from('students').select('branch,system_name,program'),sbc.from('programs').select('name,system,systems'),sbc.from('users').select('branch')]);
 const uniq=a=>[...new Set(a.map(v=>String(v||'').trim()).filter(v=>v&&v!=='—'))].sort((a,b)=>a.localeCompare(b,'ar'));
 const branches=uniq([...(students.data||[]).map(x=>x.branch),...(users.data||[]).map(x=>x.branch)]),systems=uniq([...(students.data||[]).map(x=>x.system_name),...(programs.data||[]).flatMap(x=>[x.system,...(Array.isArray(x.systems)?x.systems:[])])]),batches=uniq([...(students.data||[]).map(x=>x.program),...(programs.data||[]).map(x=>x.name)]);
 const fill=(el,items,placeholder)=>{const old=el.value;el.innerHTML='<option value="">'+placeholder+'</option>'+items.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');if(old&&items.includes(old))el.value=old;};fill(branch,branches,'اختر الفرع');fill(system,systems,'اختر النظام');fill(batch,batches,'اختر الدفعة / البرنامج');branch.dataset.loaded='1';
 }catch(e){console.warn('تعذر تحميل خيارات الفروع والأنظمة',e);}
}

async function refreshSummaries(){
 const sbc=client();if(!sbc)return;
 const {data,error}=await sbc.from('study_summaries').select('*').order('created_at',{ascending:false});
 if(error){const el=document.getElementById('ss-manage-status');if(el)el.textContent='تعذر تحميل الملخصات: '+error.message;return;}
 const rows=data||[];
 if(typeof studySummaryAdminRows!=='undefined')studySummaryAdminRows=rows;
 renderSummaryTable(rows);
 const sel=document.getElementById('ss-manage-summary'),previous=sel?.value||selectedSummaryId;
 const approvedRows=rows.filter(x=>x.is_approved);
 if(sel)sel.innerHTML='<option value="">—</option>'+approvedRows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join('');
 if(!selectedManageIds.size&&previous&&approvedRows.some(x=>x.id===previous))selectedManageIds.add(previous);
 selectedManageIds=new Set([...selectedManageIds].filter(id=>approvedRows.some(x=>x.id===id)));
 if(sel&&selectedManageIds.size){const current=selectedManageIds.has(previous)?previous:[...selectedManageIds][0];sel.value=current;selectedSummaryId=current;}
 renderSummaryPickerCards(rows);
 const reviewSel=document.getElementById('ss-review-summary'),reviewPrevious=reviewSummaryId||reviewSel?.value||(draftId&&rows.some(x=>x.id===draftId)?draftId:'');
 if(reviewSel){reviewSel.innerHTML='<option value="">—</option>'+rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+' — '+esc(x.subject_name||'')+'</option>').join('');if(reviewPrevious&&rows.some(x=>x.id===reviewPrevious))reviewSel.value=reviewPrevious;else if(rows.length)reviewSel.value=rows[0].id;}
 if(reviewSel?.value){await loadReviewSummaryQuestions(reviewSel.value);renderSummaryPickerCards(rows);}
}
async function loadReviewSummaryQuestions(id){
 const sbc=client(),statusEl=document.getElementById('ss-review-status');
 if(!sbc||!id){allQuestions=[];selectedIds=new Set();reviewReadOnly=false;renderQuestionLists();if(statusEl)statusEl.textContent='اختر ملخصًا لعرض أسئلته وإجاباته ومراجع الصفحات.';const b=document.getElementById('ss-approve-summary-btn');if(b)b.disabled=true;return;}
 reviewSummaryId=id;
 if(statusEl)statusEl.textContent='جاري تحميل الأسئلة المحفوظة...';
 const [summaryResult,questionResult]=await Promise.all([
  sbc.from('study_summaries').select('id,title,subject_name,is_approved,is_published').eq('id',id).single(),
  sbc.from('study_summary_questions').select('*').eq('summary_id',id).order('batch_no').order('order_num')
 ]);
 if(summaryResult.error||questionResult.error){if(statusEl)statusEl.textContent='تعذر تحميل المراجعة: '+(summaryResult.error?.message||questionResult.error?.message||'خطأ غير معروف');return;}
 const summary=summaryResult.data;
 allQuestions=questionResult.data||[];
 reviewReadOnly=!!summary.is_published;
 selectedIds=new Set(allQuestions.filter(q=>q.is_selected).map(q=>q.id));
 const batchSelect=document.getElementById('ss-review-batch');const batches=[...new Set(allQuestions.map(q=>Number(q.batch_no)||1))].sort((a,b)=>a-b);if(batchSelect){batchSelect.innerHTML='<option value="all">كل الأجزاء</option>'+batches.map(n=>'<option value="'+n+'">الجزء '+String.fromCharCode(64+n)+' — '+allQuestions.filter(q=>Number(q.batch_no)===n).length+' سؤال'+(allQuestions.some(q=>Number(q.batch_no)===n&&q.is_approved)?' (به أسئلة معتمدة)':'')+'</option>').join('');if(activeBatch!=='all'&&!batches.includes(Number(activeBatch)))activeBatch='all';batchSelect.value=activeBatch;}document.getElementById('ss-question-counts').textContent='أسئلة '+summary.title+': '+allQuestions.length+' في '+batches.length+' جزء/أجزاء.';
 if(statusEl)statusEl.textContent=reviewReadOnly?'الملخص منشور؛ المراجعة للعرض فقط. أوقف النشر قبل تعديل الأسئلة.':summary.is_approved?'تم اعتماد جزء سابق؛ يمكنك مراجعة واعتماد أجزاء أخرى دون إلغاء الاعتمادات السابقة.':'وضع مراجعة: يمكنك تحديد الأسئلة المطلوبة واعتماد كل جزء على حدة.';
 renderQuestionLists();
 document.getElementById('ss-export-questions-pdf-btn').disabled=!allQuestions.length;document.getElementById('ss-export-questions-word-btn').disabled=!allQuestions.length;
}
function renderSummaryTable(rows){
 const body=document.getElementById('ss-admin-list');if(!body)return;
 body.innerHTML=rows.length?rows.map(s=>'<tr><td><strong>'+esc(s.title)+'</strong><div style="font-size:11px;color:var(--muted)">'+esc(s.description||'')+'</div></td><td>'+esc(s.subject_name||'—')+'</td><td>'+Number(s.price||0).toLocaleString('ar-EG')+' ج.م</td><td>'+esc(s.validity_days||30)+' يوم</td><td>'+esc(s.generated_question_count||0)+'</td><td><span class="badge '+(s.is_published?'badge-success':s.is_approved?'badge-warning':'badge-gray')+'">'+(s.is_published?'منشور للطلاب':s.is_approved?'معتمد — غير منشور':'مسودة')+'</span></td><td><div style="display:flex;gap:5px;flex-wrap:wrap">'+(s.is_approved?'<button class="btn btn-outline btn-sm" data-manage-id="'+esc(s.id)+'">إعداد / نشر</button>':'<span style="font-size:12px;color:var(--muted)">بانتظار اعتماد الأسئلة</span>')+'<button class="btn btn-danger btn-sm" data-delete-id="'+esc(s.id)+'">حذف نهائي</button></div></td></tr>').join(''):'<tr><td colspan="7" style="text-align:center;padding:18px">لا توجد ملخصات.</td></tr>';
 body.querySelectorAll('[data-manage-id]').forEach(b=>b.addEventListener('click',()=>{const sel=document.getElementById('ss-manage-summary');sel.value=b.dataset.manageId;selectedManageIds.add(b.dataset.manageId);loadManageSummary();document.getElementById('ss-summary-management-card').scrollIntoView({behavior:'smooth',block:'start'});}));
 body.querySelectorAll('[data-delete-id]').forEach(b=>b.addEventListener('click',()=>hardDeleteSummary(b.dataset.deleteId)));
}
async function loadManageSummary(){
 await populateTargetOptions();
 const id=document.getElementById('ss-manage-summary')?.value;if(!id)return;
 selectedSummaryId=id;const sbc=client();const {data,error}=await sbc.from('study_summaries').select('*').eq('id',id).single();if(error){document.getElementById('ss-manage-status').textContent=error.message;return;}
 document.getElementById('ss-manage-price').value=data.price??'';document.getElementById('ss-manage-validity').value=(Number(data.price||0)===0&&!data.payment_wallet_number&&!data.available_until)?'':(data.validity_days??'');
 document.getElementById('ss-manage-payment-provider').value=data.payment_provider||'';document.getElementById('ss-manage-wallet-number').value=data.payment_wallet_number||'';
 document.getElementById('ss-manage-from').value=data.available_from?localDateTime(new Date(data.available_from)):'';
 document.getElementById('ss-manage-until').value=data.available_until?localDateTime(new Date(data.available_until)):'';
 document.getElementById('ss-manage-target-all').checked=data.target_all===true;
 document.getElementById('ss-manage-target-branch').value=data.target_branch||'';document.getElementById('ss-manage-target-system').value=data.target_system||'';document.getElementById('ss-manage-target-batch').value=data.target_batch||'';
 ['ss-manage-target-branch','ss-manage-target-system','ss-manage-target-batch'].forEach(id=>{document.getElementById(id).disabled=data.target_all===true;});
 const enabledBatches=Array.isArray(data.enabled_batches)?data.enabled_batches.map(Number):[];
 const batchQuery=await sbc.from('study_summary_questions').select('batch_no').eq('summary_id',id).eq('is_selected',true).eq('is_approved',true).order('batch_no');
 const availableBatches=[...new Set((batchQuery.data||[]).map(q=>Number(q.batch_no)).filter(n=>n>0))];
 document.getElementById('ss-manage-batches').innerHTML=availableBatches.length?availableBatches.map(n=>'<label style="display:flex;gap:7px;align-items:center"><input type="checkbox" data-summary-batch="'+n+'" '+(enabledBatches.includes(n)?'checked':'')+'> الجزء '+n+' ('+String.fromCharCode(64+n)+')</label>').join(''):'لا توجد أجزاء معتمدة تحتوي على أسئلة مختارة.';
 const enabledTypes=Array.isArray(data.enabled_question_types)?data.enabled_question_types:['mcq','true_false','essay'];
 document.querySelectorAll('#ss-manage-types input[data-summary-type]').forEach(box=>box.checked=enabledTypes.includes(box.dataset.summaryType));
 const qs=await sbc.from('study_summary_questions').select('id,batch_no').eq('summary_id',id).eq('is_selected',true).eq('is_approved',true);
 const countA=(qs.data||[]).filter(q=>Number(q.batch_no)===1).length,countB=(qs.data||[]).filter(q=>Number(q.batch_no)===2).length;
 document.getElementById('ss-manage-info').textContent='الأسئلة المعتمدة المختارة: المجموعة A بها '+countA+'، والمجموعة B بها '+countB+'. مدة الصلاحية تبدأ بعد تأكيد الشراء؛ ووقت الإتاحة هنا يحدد متى يظهر الملخص في بوابة الطالب.';
 document.getElementById('ss-manage-status').textContent=data.is_published?'هذا الملخص منشور حاليًا. يمكنك تحديث إعداداته أو إلغاء نشره بحفظه فقط ثم استخدام زر النشر بعد ضبط الوقت.':'هذا الملخص معتمد لكنه غير منشور.';
}
async function saveManageSummary(publish){
 const sbc=client(),el=document.getElementById('ss-manage-status');const ids=[...selectedManageIds].filter(Boolean);if(!ids.length&&document.getElementById('ss-manage-summary')?.value)ids.push(document.getElementById('ss-manage-summary').value);if(!ids.length){el.textContent='حدد ملخصًا واحدًا على الأقل من القائمة.';return;}
 const priceRaw=document.getElementById('ss-manage-price').value.trim(),price=Number(priceRaw),validity=Number(document.getElementById('ss-manage-validity').value),fromVal=document.getElementById('ss-manage-from').value,untilVal=document.getElementById('ss-manage-until').value;
 const paymentProvider=document.getElementById('ss-manage-payment-provider').value.trim(),walletNumber=document.getElementById('ss-manage-wallet-number').value.trim(),targetAll=document.getElementById('ss-manage-target-all').checked,targetBranch=document.getElementById('ss-manage-target-branch').value.trim(),targetSystem=document.getElementById('ss-manage-target-system').value.trim(),targetBatch=document.getElementById('ss-manage-target-batch').value.trim();
 if(!priceRaw||!Number.isFinite(price)||price<0||!Number.isInteger(validity)||validity<1||validity>3650){el.textContent='راجع السعر ومدة الصلاحية.';return;}if(!fromVal||!untilVal||new Date(untilVal)<=new Date(fromVal)){el.textContent='حدد بداية ونهاية صحيحتين للإتاحة.';return;}if(!targetAll&&!targetBranch&&!targetSystem&&!targetBatch){el.textContent='حدد الجمهور المستهدف: كل الطلاب أو فرعًا أو نظامًا أو دفعة/برنامجًا.';return;}if(publish&&(!paymentProvider||!walletNumber)){el.textContent='أدخل وسيلة التحويل ورقم المحفظة قبل نشر الملخص للطلاب.';return;}if(walletNumber&&!/^[0-9+\s()-]{6,40}$/.test(walletNumber)){el.textContent='راجع رقم المحفظة؛ أدخل رقمًا صحيحًا فقط.';return;}
 const enabledBatches=[...document.querySelectorAll('#ss-manage-batches input[data-summary-batch]:checked')].map(box=>Number(box.dataset.summaryBatch)),enabledTypes=[...document.querySelectorAll('#ss-manage-types input[data-summary-type]:checked')].map(box=>box.dataset.summaryType);if(!enabledBatches.length||!enabledTypes.length){el.textContent='حدد جزءًا واحدًا ونوع سؤال واحدًا على الأقل.';return;}
 for(const id of ids){const q=await sbc.from('study_summary_questions').select('id').eq('summary_id',id).eq('is_selected',true).eq('is_approved',true).in('batch_no',enabledBatches).in('question_type',enabledTypes);if(q.error)throw q.error;if(!(q.data||[]).length){const row=await sbc.from('study_summaries').select('title').eq('id',id).maybeSingle();el.textContent='الملخص «'+(row.data?.title||id)+'» لا يحتوي أسئلة معتمدة تطابق الأجزاء والأنواع المحددة. لم تُحفظ أي إعدادات.';return;}}
 const payload={price,validity_days:validity,payment_provider:paymentProvider||null,payment_wallet_number:walletNumber||null,enabled_batches:enabledBatches,enabled_question_types:enabledTypes,target_all:targetAll,target_branch:targetAll?null:(targetBranch||null),target_system:targetAll?null:(targetSystem||null),target_batch:targetAll?null:(targetBatch||null),available_from:new Date(fromVal).toISOString(),available_until:new Date(untilVal).toISOString(),is_published:!!publish,published_at:publish?new Date().toISOString():null,updated_at:new Date().toISOString()};
 for(const id of ids){const result=await sbc.from('study_summaries').update(payload).eq('id',id).eq('is_approved',true);if(result.error){el.textContent='تعذر حفظ إعدادات أحد الملخصات: '+result.error.message;return;}}
 el.textContent=(publish?'تم نشر ':'تم حفظ إعدادات ')+ids.length+' ملخص/ملخصات '+(publish?'للطلاب ضمن وقت الإتاحة المحدد.':' دون النشر للطلاب.');if(publish&&typeof showToast==='function')showToast('تم نشر '+ids.length+' ملخص/ملخصات للطلاب المستهدفين.','success');await refreshSummaries();if(typeof window.loadStudySummaryOrdersAdmin==='function')await window.loadStudySummaryOrdersAdmin();
}
async function hardDeleteSummary(id){
 const sbc=client();const {data:s,error}=await sbc.from('study_summaries').select('id,title,source_pdf_path').eq('id',id).single();if(error){if(typeof showToast==='function')showToast('تعذر قراءة الملخص: '+error.message,'error');return;}
 if(!confirm('حذف نهائي للملخص «'+s.title+'»؟ سيُحذف معه بنك الأسئلة وطلبات الشراء وسجلات الصلاحيات والنشاط المرتبطة به. لا يمكن التراجع.'))return;
 try{
  for(const table of ['study_summary_activity','study_summary_entitlements','study_summary_orders','study_summary_questions']){
   const r=await sbc.from(table).delete().eq('summary_id',id);if(r.error)throw new Error('تعذر حذف البيانات المرتبطة من '+table+': '+r.error.message);
  }
  const d=await sbc.from('study_summaries').delete().eq('id',id);if(d.error)throw d.error;
  if(s.source_pdf_path){const rm=await sbc.storage.from('study-summary-pdfs').remove([s.source_pdf_path]);if(rm.error)console.warn('تعذر حذف ملف PDF من التخزين',rm.error);}
  if(draftId===id)draftId=null;if(reviewSummaryId===id){reviewSummaryId='';allQuestions=[];selectedIds.clear();reviewReadOnly=false;renderQuestionLists();}
  if(typeof showToast==='function')showToast('تم حذف الملخص وجميع سجلاته نهائيًا','success');
  await refreshSummaries();if(typeof window.loadStudySummaryOrdersAdmin==='function')await window.loadStudySummaryOrdersAdmin();
 }catch(e){if(typeof showToast==='function')showToast(e?.message||String(e),'error');else alert(e?.message||String(e));}
}
function wire(){
 const page=document.getElementById('page-study-summaries');if(!page)return;
 if(!wired){
  wired=true;
  if(typeof window.deleteStudySummary==='function')window.deleteStudySummary=hardDeleteSummary;
  if(typeof window.renderStudySummaryAdminRows==='function')window.renderStudySummaryAdminRows=function(){refreshSummaries();};
  if(typeof window.loadStudySummaryAdmin==='function'&&!window.loadStudySummaryAdmin.__ssNewFlow){const old=window.loadStudySummaryAdmin;const wrapped=async function(...args){const r=await old.apply(this,args);inject();hideLegacy();await refreshSummaries();return r;};wrapped.__ssNewFlow=true;window.loadStudySummaryAdmin=wrapped;}
  if(typeof window.showPage==='function'&&!window.showPage.__ssNewFlow){const old=window.showPage;const wrapped=function(p,...args){const r=old.call(this,p,...args);if(p==='study-summaries')setTimeout(()=>{inject();hideLegacy();refreshSummaries();},0);return r;};wrapped.__ssNewFlow=true;window.showPage=wrapped;}
 }
 inject();hideLegacy();
}
setInterval(wire,500);setTimeout(wire,100);
})();