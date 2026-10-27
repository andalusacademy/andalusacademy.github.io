(() => {
'use strict';
const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(String(v??'')):String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const client=()=>window.sb||(typeof sb!=='undefined'?sb:null);
let draftId=null, allQuestions=[], selectedIds=new Set(), selectedSummaryId='';
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
  '<div class="form-group"><label>عدد الاختيار من متعدد</label><input id="ss-ai-mc-count" class="search-input" type="number" min="0" max="50" value="25" style="width:100%"></div>'+
  '<div class="form-group"><label>عدد الصح والخطأ</label><input id="ss-ai-tf-count" class="search-input" type="number" min="0" max="50" value="20" style="width:100%"></div>'+
  '<div class="form-group"><label>عدد الأسئلة المقالية</label><input id="ss-ai-essay-count" class="search-input" type="number" min="0" max="50" value="5" style="width:100%"></div>'+
  '<div class="form-group" style="grid-column:1/-1"><label>ملف المادة PDF</label><input id="ss-ai-pdf" class="search-input" type="file" accept="application/pdf,.pdf" style="width:100%"><div id="ss-ai-file-info" style="margin-top:6px;color:var(--muted);font-size:12px"></div></div>'+
  '<div class="form-group" style="grid-column:1/-1"><label>وصف الملخص (اختياري)</label><textarea id="ss-ai-description" class="search-input" maxlength="3000" placeholder="وصف مختصر للمادة" style="width:100%;min-height:65px"></textarea></div></div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-gold" id="ss-ai-generate-btn" type="button">⬆️ حفظ المادة وتوليد الأسئلة</button></div>'+
  '<div id="ss-ai-status" style="margin-top:12px"></div><div style="margin-top:8px;font-size:12px;color:var(--muted)">كل مجموعة تتكون من 50 سؤالًا. أدخل التوزيع الذي تريده (افتراضيًا 25 اختيارًا + 20 صح/خطأ + 5 مقالي)، وسيولد النظام مجموعتين مستقلتين A وB بإجمالي 100 سؤال. راجع الأسئلة ومصادر صفحاتها هنا قبل الاعتماد؛ هذه شاشة إدارية فقط.</div></div>';
  const anchor=page.querySelector('.card');if(anchor)anchor.insertAdjacentElement('beforebegin',card);else page.prepend(card);
  document.getElementById('ss-ai-pdf').addEventListener('change',e=>{const f=e.target.files?.[0];document.getElementById('ss-ai-file-info').textContent=f?'📄 '+f.name+' — '+(f.size/1024/1024).toFixed(2)+' MB':'';});
  document.getElementById('ss-ai-generate-btn').addEventListener('click',generate);
 }
 if(!document.getElementById('ss-question-review-card')){
  const card=document.createElement('div');card.id='ss-question-review-card';card.className='card';
  card.innerHTML='<div class="card-header"><h3>📝 ٢) مراجعة الأسئلة الناتجة</h3><span id="ss-question-counts" style="font-size:12px;color:var(--muted)">ارفع المادة أولًا</span></div>'+
  '<div style="padding:16px"><div id="ss-generated-list"><p style="color:var(--muted)">ستظهر هنا جميع الأسئلة التي أنشأها الذكاء الاصطناعي.</p></div>'+
  '<div style="margin:24px 0 12px;border-top:3px solid #c9a24c;padding-top:16px"><h3 style="margin-bottom:8px">⭐ الأسئلة التي اخترتها للملخص</h3><p style="color:var(--muted);font-size:12px;margin-bottom:12px">أي سؤال تعلّم عليه فوق ينتقل إلى هذه القائمة تلقائيًا.</p><div id="ss-selected-list"><p style="color:var(--muted)">لم تحدد أسئلة بعد.</p></div></div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-gold" id="ss-approve-summary-btn" disabled>✅ اعتماد الأسئلة المحددة والملخص بالكامل</button><button class="btn btn-outline" id="ss-export-questions-pdf-btn" type="button" disabled>📄 تصدير PDF</button><button class="btn btn-outline" id="ss-export-questions-word-btn" type="button" disabled>📝 تصدير Word</button></div><div id="ss-approve-status" style="margin-top:12px"></div></div>';
  document.getElementById('ss-ai-generator-card').insertAdjacentElement('afterend',card);
  card.addEventListener('change',e=>{const box=e.target.closest('input[data-question-id]');if(!box)return;const id=box.dataset.questionId;if(box.checked)selectedIds.add(id);else selectedIds.delete(id);renderQuestionLists();});
  document.getElementById('ss-approve-summary-btn').addEventListener('click',approveSelected);
  document.getElementById('ss-export-questions-pdf-btn').addEventListener('click',exportQuestionsPdf);
  document.getElementById('ss-export-questions-word-btn').addEventListener('click',exportQuestionsWord);
 }
 if(!document.getElementById('ss-summary-management-card')){
  const card=document.createElement('div');card.id='ss-summary-management-card';card.className='card';
  card.innerHTML='<div class="card-header"><h3>📦 ٣) إعداد الملخص المعتمد ونشره</h3><span style="font-size:12px;color:var(--muted)">لا يظهر للطلاب إلا بعد النشر</span></div>'+
  '<div style="padding:18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">'+
  '<div class="form-group" style="grid-column:1/-1"><label>اختر ملخصًا تم اعتماده</label><select id="ss-manage-summary" class="search-input" style="width:100%"><option value="">اختر الملخص</option></select></div>'+
  '<div class="form-group"><label>السعر بالجنيه</label><input id="ss-manage-price" type="number" min="0" step="0.01" value="0" class="search-input" style="width:100%"></div>'+
  '<div class="form-group"><label>مدة صلاحية الطالب بعد الشراء (بالأيام)</label><input id="ss-manage-validity" type="number" min="1" max="3650" value="30" class="search-input" style="width:100%"></div>'+
  '<div class="form-group"><label>بداية الإتاحة للشراء</label><input id="ss-manage-from" type="datetime-local" class="search-input" style="width:100%"></div>'+
  '<div class="form-group"><label>نهاية الإتاحة للشراء</label><input id="ss-manage-until" type="datetime-local" class="search-input" style="width:100%"></div>'+
  '<div class="form-group" style="grid-column:1/-1"><label>المجموعات المتاحة للطالب</label><div style="display:flex;gap:18px;flex-wrap:wrap;padding:10px;border:1px solid var(--border);border-radius:8px"><label style="display:flex;gap:7px;align-items:center"><input id="ss-manage-batch-a" type="checkbox" checked> إتاحة المجموعة A</label><label style="display:flex;gap:7px;align-items:center"><input id="ss-manage-batch-b" type="checkbox" checked> إتاحة المجموعة B</label></div><small style="display:block;color:var(--muted);margin-top:5px">اختيار A وحدها أو B وحدها أو الاثنين. الطالب يرى الأسئلة المتاحة كملخص واحد متصل.</small></div></div>'+
  '<div id="ss-manage-info" style="margin:8px 0;color:var(--muted);font-size:12px"></div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline" id="ss-manage-save" type="button">💾 حفظ الإعدادات فقط</button><button class="btn btn-gold" id="ss-manage-publish" type="button">📢 نشر للطلاب</button></div><div id="ss-manage-status" style="margin-top:12px"></div></div>';
  const rev=document.getElementById('ss-question-review-card');rev.insertAdjacentElement('afterend',card);
  document.getElementById('ss-manage-summary').addEventListener('change',loadManageSummary);
  document.getElementById('ss-manage-save').addEventListener('click',()=>saveManageSummary(false));
  document.getElementById('ss-manage-publish').addEventListener('click',()=>saveManageSummary(true));
  const now=new Date();document.getElementById('ss-manage-from').value=localDateTime(now);document.getElementById('ss-manage-until').value=localDateTime(new Date(now.getTime()+30*86400000));
 }
 hideLegacy();
}
async function generate(){
 const sbc=client(),title=document.getElementById('ss-ai-title').value.trim(),subject=document.getElementById('ss-ai-subject').value.trim(),file=document.getElementById('ss-ai-pdf').files?.[0];
 const tf=Math.max(0,Math.min(100,Number(document.getElementById('ss-ai-tf-count').value||0))),mc=Math.max(0,Math.min(100,Number(document.getElementById('ss-ai-mc-count').value||0))),essay=Math.max(0,Math.min(100,Number(document.getElementById('ss-ai-essay-count').value||0))),total=tf+mc+essay,description=document.getElementById('ss-ai-description').value.trim();
 if(!sbc)return status('اتصال قاعدة البيانات غير جاهز. أعد تحميل الصفحة.');
 if(title.length<2||!subject)return status('اكتب اسم الملخص واسم المادة أولًا.');
 if(total!==50)return status('يجب أن يكون إجمالي أسئلة كل مجموعة 50 سؤالًا بالضبط. عدّل توزيع الأنواع ليصبح الإجمالي 50.');
 if(!file||(!file.type.includes('pdf')&&!file.name.toLowerCase().endsWith('.pdf')))return status('اختر ملف PDF للمادة.');
 if(file.size>15*1024*1024)return status('حجم الملف يجب ألا يتجاوز 15 ميجابايت.');
 const btn=document.getElementById('ss-ai-generate-btn');btn.disabled=true;
 try{
  status('جاري حفظ المسودة ورفع المادة ثم توليد مجموعتين مستقلتين؛ 50 سؤالًا لكل مجموعة...',true);
  const auth=await sbc.auth.getSession();if(!auth.data?.session)throw new Error('جلسة المدير غير صالحة. سجّل الدخول مرة أخرى.');
  if(draftId){const old=await sbc.from('study_summaries').update({title,subject_name:subject,description,is_published:false,updated_at:new Date().toISOString()}).eq('id',draftId);if(old.error)throw old.error;}
  else{const made=await sbc.from('study_summaries').insert({title,subject_name:subject,description,price:0,validity_days:30,is_published:false,is_approved:false,created_by:auth.data.session.user.id,ai_generation_status:'processing'}).select('id').single();if(made.error)throw made.error;draftId=made.data.id;}
  const path='summary-'+draftId+'/'+Date.now()+'-source.pdf';
  const upload=await sbc.storage.from('study-summary-pdfs').upload(path,file,{contentType:'application/pdf',upsert:false});if(upload.error)throw upload.error;
  let latestResult=null;
  for(const batchNo of [1,2]){
   const batchLabel=batchNo===1?'A':'B';
   status('جاري توليد المجموعة '+batchLabel+' من مجموعتين — 50 سؤالًا، مع استبعاد أسئلة المجموعة الأخرى...',true);
   const response=await fetch(sbc.supabaseUrl+'/functions/v1/generate-study-summary',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.data.session.access_token,apikey:sbc.supabaseKey},body:JSON.stringify({summary_id:draftId,pdf_path:path,subject,true_false_count:tf,mcq_count:mc,essay_count:essay,batch_no:batchNo})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.success)throw new Error('تعذر إكمال المجموعة '+batchLabel+': '+(result.error||'خدمة التوليد لم تُكمل العدد المطلوب.'));
   latestResult=result;
  }
  const save=await sbc.from('study_summaries').update({source_pdf_path:path,ai_generation_status:'ready',generated_question_count:latestResult?.totalQuestionCount||100,is_published:false,is_approved:false,approved_at:null,approved_by:null}).eq('id',draftId);if(save.error)throw save.error;
  const loaded=await sbc.from('study_summary_questions').select('*').eq('summary_id',draftId).order('order_num');
  if(loaded.error)throw loaded.error;
  allQuestions=loaded.data||[];selectedIds=new Set();selectedSummaryId=draftId;
  document.getElementById('ss-question-counts').textContent='تم إنشاء '+allQuestions.length+' سؤالًا: '+allQuestions.filter(q=>q.question_type==='mcq').length+' اختياري، '+allQuestions.filter(q=>q.question_type==='true_false').length+' صح/خطأ، '+allQuestions.filter(q=>q.question_type==='essay').length+' مقالي';
  renderQuestionLists();document.getElementById('ss-approve-summary-btn').disabled=false;
  document.getElementById('ss-export-questions-pdf-btn').disabled=!allQuestions.length;document.getElementById('ss-export-questions-word-btn').disabled=!allQuestions.length;
  status('اكتمل توليد المجموعتين A وB (50 سؤالًا لكل مجموعة). الإجمالي 100 سؤال. لم يتم نشرها للطلاب؛ راجع الأسئلة والمراجع ثم اختر المناسب واضغط اعتماد.',true);
  await refreshSummaries();
 }catch(e){status(e?.message||String(e));}finally{btn.disabled=false;}
}
function renderQuestionLists(){
 const generated=document.getElementById('ss-generated-list'),selected=document.getElementById('ss-selected-list');if(!generated||!selected)return;
 const one=q=>'<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin:8px 0;background:#fff"><label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-question-id="'+esc(q.id)+'" '+(selectedIds.has(q.id)?'checked':'')+' style="margin-top:5px;flex:0 0 auto"><span style="flex:1"><strong>'+esc(q.order_num)+'. المجموعة '+(Number(q.batch_no)===2?'B':'A')+' — '+esc(q.question_text)+'</strong><div style="margin-top:5px;color:#64748b;font-size:12px">'+esc(typeLabel(q.question_type))+'</div>'+(Array.isArray(q.options)&&q.options.length?'<ol style="margin:8px 22px">'+q.options.map(o=>'<li>'+esc(o)+'</li>').join('')+'</ol>':'')+'<div style="margin-top:8px;color:#166534;white-space:pre-wrap"><strong>الإجابة النموذجية:</strong> '+esc(q.answer_text||'')+'</div>'+(q.explanation?'<div style="margin-top:5px;color:#64748b">التوضيح: '+esc(q.explanation)+'</div>':'')+'<div style="margin-top:6px;color:#92400e;background:#fffbeb;padding:5px 8px;border-radius:6px;font-size:12px"><strong>📄 صفحة المصدر (للمدير فقط):</strong> '+esc(q.source_reference||'لم يحدد الذكاء الاصطناعي الصفحة — راجع ملف PDF يدويًا')+(q.source_page?' (رقم الصفحة: '+esc(q.source_page)+')':'')+'</div></span></label></div>';
 generated.innerHTML=allQuestions.length?allQuestions.map(one).join(''):'<p style="color:var(--muted)">لا توجد أسئلة مولّدة حتى الآن.</p>';
 const picked=allQuestions.filter(q=>selectedIds.has(q.id));
 selected.innerHTML=picked.length?picked.map((q,i)=>'<div style="border:1px solid #86bda0;border-radius:10px;padding:12px;margin:8px 0;background:#f0fdf4"><strong>'+ (i+1)+'. '+esc(q.question_text)+'</strong><div style="font-size:12px;color:#166534;margin-top:4px">'+esc(typeLabel(q.question_type))+' — الإجابة: '+esc(q.answer_text)+'</div><button type="button" class="btn btn-outline btn-sm" data-unselect-id="'+esc(q.id)+'" style="margin-top:8px">إزالة من الاختيار</button></div>').join(''):'<p style="color:var(--muted)">لم تحدد أسئلة بعد.</p>';
 selected.querySelectorAll('[data-unselect-id]').forEach(b=>b.addEventListener('click',()=>{selectedIds.delete(b.dataset.unselectId);renderQuestionLists();}));
 selected.querySelectorAll('[data-unselect-id]').forEach(b=>{const q=allQuestions.find(x=>x.id===b.dataset.unselectId);if(q){const d=document.createElement('div');d.style.cssText='font-size:12px;color:#92400e;margin-top:5px';d.textContent='صفحة المصدر (للمدير فقط): '+(q.source_reference||'غير محددة — راجع PDF');b.parentElement.appendChild(d);}});
 document.getElementById('ss-approve-summary-btn').disabled=!picked.length;const exportBtn=document.getElementById('ss-export-questions-pdf-btn');if(exportBtn)exportBtn.disabled=!allQuestions.length;const wordBtn=document.getElementById('ss-export-questions-word-btn');if(wordBtn)wordBtn.disabled=!allQuestions.length;
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
 const sbc=client();if(!sbc||!draftId)return;
 const picked=allQuestions.filter(q=>selectedIds.has(q.id));if(!picked.length)return;
 const btn=document.getElementById('ss-approve-summary-btn');btn.disabled=true;
 try{
  const auth=await sbc.auth.getSession();if(!auth.data?.session)throw new Error('انتهت جلسة المدير.');
  const reset=await sbc.from('study_summary_questions').update({is_selected:false,is_approved:false,reviewed_at:null,reviewed_by:null}).eq('summary_id',draftId);if(reset.error)throw reset.error;
  const ids=picked.map(q=>q.id);
  const selected=await sbc.from('study_summary_questions').update({is_selected:true,is_approved:true,reviewed_at:new Date().toISOString(),reviewed_by:auth.data.session.user.id}).in('id',ids);if(selected.error)throw selected.error;
  const summary=await sbc.from('study_summaries').update({is_approved:true,approved_at:new Date().toISOString(),approved_by:auth.data.session.user.id,is_published:false,updated_at:new Date().toISOString()}).eq('id',draftId);if(summary.error)throw summary.error;
  allQuestions=allQuestions.map(q=>({...q,is_selected:selectedIds.has(q.id),is_approved:selectedIds.has(q.id)}));
  const el=document.getElementById('ss-approve-status');el.innerHTML='<div style="background:#ecfdf5;color:#166534;padding:12px;border-radius:10px">✅ تم اعتماد الملخص بالكامل مع '+picked.length+' سؤالًا محددًا. انتقل إلى إعداد الملخص المعتمد لاختيار السعر ووقت الإتاحة، ثم انشره للطلاب.</div>';
  document.getElementById('ss-manage-summary').value=draftId;await refreshSummaries();await loadManageSummary();
  if(typeof window.loadStudySummaryOrdersAdmin==='function')await window.loadStudySummaryOrdersAdmin();
 }catch(e){document.getElementById('ss-approve-status').textContent='❌ '+(e?.message||e);btn.disabled=false;}
}
async function refreshSummaries(){
 const sbc=client();if(!sbc)return;
 const {data,error}=await sbc.from('study_summaries').select('*').order('created_at',{ascending:false});
 if(error){const el=document.getElementById('ss-manage-status');if(el)el.textContent='تعذر تحميل الملخصات: '+error.message;return;}
 if(typeof studySummaryAdminRows!=='undefined')studySummaryAdminRows=data||[];
 renderSummaryTable(data||[]);
 const sel=document.getElementById('ss-manage-summary'),previous=sel?.value||selectedSummaryId;
 if(sel)sel.innerHTML='<option value="">اختر الملخص</option>'+(data||[]).filter(s=>s.is_approved).map(s=>'<option value="'+esc(s.id)+'">'+esc(s.title)+' — '+esc(s.subject_name||'')+(s.is_published?' (منشور)':'')+'</option>').join('');
 if(sel&&previous&&(data||[]).some(s=>s.id===previous&&s.is_approved))sel.value=previous;
 if(sel?.value)await loadManageSummary();
}
function renderSummaryTable(rows){
 const body=document.getElementById('ss-admin-list');if(!body)return;
 body.innerHTML=rows.length?rows.map(s=>'<tr><td><strong>'+esc(s.title)+'</strong><div style="font-size:11px;color:var(--muted)">'+esc(s.description||'')+'</div></td><td>'+esc(s.subject_name||'—')+'</td><td>'+Number(s.price||0).toLocaleString('ar-EG')+' ج.م</td><td>'+esc(s.validity_days||30)+' يوم</td><td>'+esc(s.generated_question_count||0)+'</td><td><span class="badge '+(s.is_published?'badge-success':s.is_approved?'badge-warning':'badge-gray')+'">'+(s.is_published?'منشور للطلاب':s.is_approved?'معتمد — غير منشور':'مسودة')+'</span></td><td><div style="display:flex;gap:5px;flex-wrap:wrap">'+(s.is_approved?'<button class="btn btn-outline btn-sm" data-manage-id="'+esc(s.id)+'">إعداد / نشر</button>':'<span style="font-size:12px;color:var(--muted)">بانتظار اعتماد الأسئلة</span>')+'<button class="btn btn-danger btn-sm" data-delete-id="'+esc(s.id)+'">حذف نهائي</button></div></td></tr>').join(''):'<tr><td colspan="7" style="text-align:center;padding:18px">لا توجد ملخصات.</td></tr>';
 body.querySelectorAll('[data-manage-id]').forEach(b=>b.addEventListener('click',()=>{const sel=document.getElementById('ss-manage-summary');sel.value=b.dataset.manageId;loadManageSummary();document.getElementById('ss-summary-management-card').scrollIntoView({behavior:'smooth',block:'start'});}));
 body.querySelectorAll('[data-delete-id]').forEach(b=>b.addEventListener('click',()=>hardDeleteSummary(b.dataset.deleteId)));
}
async function loadManageSummary(){
 const id=document.getElementById('ss-manage-summary')?.value;if(!id)return;
 selectedSummaryId=id;const sbc=client();const {data,error}=await sbc.from('study_summaries').select('*').eq('id',id).single();if(error){document.getElementById('ss-manage-status').textContent=error.message;return;}
 document.getElementById('ss-manage-price').value=data.price??0;document.getElementById('ss-manage-validity').value=data.validity_days??30;
 document.getElementById('ss-manage-from').value=data.available_from?localDateTime(new Date(data.available_from)):localDateTime(new Date());
 document.getElementById('ss-manage-until').value=data.available_until?localDateTime(new Date(data.available_until)):localDateTime(new Date(Date.now()+30*86400000));
 const enabledBatches=Array.isArray(data.enabled_batches)?data.enabled_batches.map(Number):[1,2];
 document.getElementById('ss-manage-batch-a').checked=enabledBatches.includes(1);
 document.getElementById('ss-manage-batch-b').checked=enabledBatches.includes(2);
 const qs=await sbc.from('study_summary_questions').select('id,batch_no').eq('summary_id',id).eq('is_selected',true).eq('is_approved',true);
 const countA=(qs.data||[]).filter(q=>Number(q.batch_no)===1).length,countB=(qs.data||[]).filter(q=>Number(q.batch_no)===2).length;
 document.getElementById('ss-manage-info').textContent='الأسئلة المعتمدة المختارة: المجموعة A بها '+countA+'، والمجموعة B بها '+countB+'. مدة الصلاحية تبدأ بعد تأكيد الشراء؛ ووقت الإتاحة هنا يحدد متى يظهر الملخص في بوابة الطالب.';
 document.getElementById('ss-manage-status').textContent=data.is_published?'هذا الملخص منشور حاليًا. يمكنك تحديث إعداداته أو إلغاء نشره بحفظه فقط ثم استخدام زر النشر بعد ضبط الوقت.':'هذا الملخص معتمد لكنه غير منشور.';
}
async function saveManageSummary(publish){
 const sbc=client(),id=document.getElementById('ss-manage-summary').value,el=document.getElementById('ss-manage-status');if(!id){el.textContent='اختر ملخصًا معتمدًا أولًا.';return;}
 const price=Number(document.getElementById('ss-manage-price').value),validity=Number(document.getElementById('ss-manage-validity').value),fromVal=document.getElementById('ss-manage-from').value,untilVal=document.getElementById('ss-manage-until').value;
 if(!Number.isFinite(price)||price<0||!Number.isInteger(validity)||validity<1||validity>3650){el.textContent='راجع السعر ومدة الصلاحية.';return;}
 if(!fromVal||!untilVal||new Date(untilVal)<=new Date(fromVal)){el.textContent='حدد بداية ونهاية صحيحتين للإتاحة.';return;}
 const enabledBatches=[];if(document.getElementById('ss-manage-batch-a').checked)enabledBatches.push(1);if(document.getElementById('ss-manage-batch-b').checked)enabledBatches.push(2);if(!enabledBatches.length){el.textContent='اختر المجموعة A أو المجموعة B أو الاثنين قبل الحفظ.';return;}
 const q=await sbc.from('study_summary_questions').select('id').eq('summary_id',id).eq('is_selected',true).eq('is_approved',true).in('batch_no',enabledBatches);if(q.error)throw q.error;if(!q.data?.length){el.textContent='لا توجد أسئلة مختارة ومعتمدة في المجموعات التي اخترتها.';return;}
 const payload={price,validity_days:validity,enabled_batches:enabledBatches,available_from:new Date(fromVal).toISOString(),available_until:new Date(untilVal).toISOString(),is_published:!!publish,published_at:publish?new Date().toISOString():null,updated_at:new Date().toISOString()};
 const result=await sbc.from('study_summaries').update(payload).eq('id',id).eq('is_approved',true);if(result.error){el.textContent='تعذر الحفظ: '+result.error.message;return;}
 el.textContent=publish?'تم نشر الملخص للطلاب ضمن وقت الإتاحة المحدد.':'تم حفظ الإعدادات فقط. لم يتم نشر الملخص للطلاب.';
 await refreshSummaries();if(typeof window.loadStudySummaryOrdersAdmin==='function')await window.loadStudySummaryOrdersAdmin();
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
  if(draftId===id){draftId=null;allQuestions=[];selectedIds.clear();}
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