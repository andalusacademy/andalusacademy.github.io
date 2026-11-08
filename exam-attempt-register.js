/* Andalus Academy — centralized electronic exam attempt register */
(function(){
 'use strict';
 if(window.__andalusExamAttemptRegisterV1)return;window.__andalusExamAttemptRegisterV1=true;
 const $=(s,r=document)=>r.querySelector(s);
 const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const fmt=v=>v?new Date(v).toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'}):'—';
 let rows=[],filter='all',search='';
 function mount(){
  const page=$('#page-exams');if(!page||$('#exam-attempt-register'))return;
  const cards=[...page.querySelectorAll('.card')];const anchor=cards.find(c=>c.querySelector('#exams-table'))||cards[cards.length-1];
  const section=document.createElement('section');section.id='exam-attempt-register';section.className='card';section.style.cssText='margin-top:18px;padding:16px';
  section.innerHTML='<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><h3 style="margin:0">📋 سجل دخول وتسليم الامتحانات</h3><div style="font-size:12px;color:var(--muted);margin-top:5px">متابعة كل محاولات الطلاب ونتائجهم وملاحظات المخالفات وإجراءات الدعم</div></div><button class="btn btn-info btn-sm" id="ear-refresh">↻ تحديث السجل</button></div><div id="ear-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px;margin:14px 0"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><input id="ear-search" placeholder="بحث برقم القيد أو اسم الطالب أو رقم الهاتف أو الامتحان" style="flex:1;min-width:240px;padding:10px;border:1px solid var(--border);border-radius:9px"><select id="ear-filter" style="padding:10px;border:1px solid var(--border);border-radius:9px"><option value="all">كل المحاولات</option><option value="submitted">تم التسليم</option><option value="abandoned">لم يسلم</option><option value="in_progress">جارية</option><option value="cheating">ملاحظات ومخالفات</option><option value="test">محاولات تجريبية</option><option value="official">محاولات الطلاب</option></select></div><div style="overflow:auto"><table style="min-width:1180px;width:100%"><thead><tr><th>رقم القيد</th><th>اسم الطالب</th><th>الهاتف</th><th>الامتحان</th><th>وقت الدخول</th><th>وقت التسليم</th><th>الحالة</th><th>النتيجة</th><th>ملاحظات / غش</th><th>إجراءات الإدارة</th></tr></thead><tbody id="ear-body"><tr><td colspan="10" style="text-align:center;padding:18px">اضغط تحديث السجل لعرض المحاولات</td></tr></tbody></table></div><div style="font-size:11px;color:var(--muted);margin-top:8px">السجل يعرض المحاولات المسجلة فعليًا في قاعدة البيانات؛ الطالب الذي لم يبدأ لا يظهر كسجل محاولة.</div>';
  if(anchor)anchor.insertAdjacentElement('afterend',section);else page.appendChild(section);
  $('#ear-refresh').onclick=load;
  $('#ear-stats').addEventListener('click',e=>{const b=e.target.closest('[data-ear-filter]');if(!b)return;filter=b.dataset.earFilter;$('#ear-filter').value=filter;render();$('#ear-body')?.scrollIntoView({behavior:'smooth',block:'start'});});
  $('#ear-search').oninput=e=>{search=e.target.value.trim().toLowerCase();render();};
  $('#ear-filter').onchange=e=>{filter=e.target.value;render();};
 }
 function student(id){const list=typeof allStudents!=='undefined'?allStudents:(window.allStudents||[]);return list.find(s=>String(s.id)===String(id))||{};}
 function exam(id){const list=typeof allExams!=='undefined'?allExams:(window.allExams||[]);return list.find(e=>String(e.id)===String(id))||window.__andalusTestExamMap?.[String(id)]||{};}
 function status(a){if(a.status==='submitted')return 'تم التسليم';if(a.status==='in_progress')return 'جارية — لم يتم التسليم بعد';if(a.status==='expired')return 'انتهى الوقت — أغلقت تلقائيًا';if(a.status==='abandoned')return 'أوقفها مسؤول الإدارة — لم تسلم';return a.status||'غير معروف';}
 async function load(){
  mount();const body=$('#ear-body');if(!body)return;body.innerHTML='<tr><td colspan="10" style="text-align:center;padding:18px">جاري تحميل سجل المحاولات...</td></tr>';
  const db=typeof sb!=='undefined'?sb:window.sb;if(!db){body.innerHTML='<tr><td colspan="10">قاعدة البيانات غير متاحة</td></tr>';return;}
  const expiryRun=await db.rpc('admin_expire_overdue_exam_attempts');if(expiryRun.error)console.warn('[Andalus exam register] overdue attempts check:',expiryRun.error);
  const {data,error}=await db.from('exam_attempts').select('*').order('started_at',{ascending:false}).limit(2000);
  if(error){body.innerHTML='<tr><td colspan="10" style="color:#b91c1c">تعذر تحميل السجل: '+esc(error.message)+'</td></tr>';return;}
  rows=data||[];const {data:testExams,error:testExamError}=await db.from('exams').select('id,title,total_score,is_test').eq('is_test',true);if(testExamError)console.warn('[Andalus exam register] test exam metadata:',testExamError);window.__andalusTestExamMap=Object.fromEntries((testExams||[]).map(e=>[String(e.id),e]));render();
 }
 function render(){
  const body=$('#ear-body');if(!body)return;
  const filtered=rows.filter(a=>{const s=student(a.student_id),e=exam(a.exam_id),hay=[s.enrollment_number,s.id,s.name,s.phone,e.title].join(' ').toLowerCase();if(search&&!hay.includes(search))return false;if(filter==='test'&&!exam(a.exam_id).is_test)return false;if(filter==='official'&&exam(a.exam_id).is_test)return false;if(filter==='submitted'&&a.status!=='submitted')return false;if(filter==='in_progress'&&a.status!=='in_progress')return false;if(filter==='abandoned'&&!['abandoned','expired'].includes(a.status))return false;if(filter==='cheating'&&!((a.flagged_cheating)||(Number(a.violation_count)>0)||(Array.isArray(a.violation_log)&&a.violation_log.length)))return false;return true;});
  const stat=(n,l,f)=>'<button type="button" data-ear-filter="'+f+'" style="cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:10px;padding:10px;text-align:center"><b style="font-size:22px;display:block">'+n+'</b><span style="font-size:11px;color:var(--muted)">'+l+'</span></button>';
  const stats=$('#ear-stats');if(stats)stats.innerHTML=stat(rows.length,'إجمالي المحاولات','all')+stat(rows.filter(a=>a.status==='submitted').length,'تم التسليم','submitted')+stat(rows.filter(a=>['abandoned','expired'].includes(a.status)).length,'لم يسلم / انتهى وقته','abandoned')+stat(rows.filter(a=>a.status==='in_progress').length,'جارية','in_progress')+stat(rows.filter(a=>exam(a.exam_id).is_test).length,'محاولات تجريبية','test')+stat(rows.filter(a=>a.flagged_cheating||Number(a.violation_count)>0||(Array.isArray(a.violation_log)&&a.violation_log.length)).length,'ملاحظات ومخالفات','cheating');
  if(!filtered.length){body.innerHTML='<tr><td colspan="10" style="text-align:center;padding:18px">لا توجد محاولات مطابقة.</td></tr>';return;}
  body.innerHTML=filtered.map(a=>{
   const s=student(a.student_id),e=exam(a.exam_id),pct=Number(a.max_score)>0?Math.round(Number(a.score||0)/Number(a.max_score)*100):0;
   const note=a.flagged_cheating?'اشتباه غش':(Number(a.violation_count)>0?'عدد المخالفات: '+a.violation_count:'لا توجد مخالفات مسجلة');
   const details=Array.isArray(a.violation_log)&&a.violation_log.length?a.violation_log.map(v=>typeof v==='string'?v:(v.message||v.type||JSON.stringify(v))).join(' • '):'';
   const hasFinalScore=['submitted','expired','abandoned'].includes(a.status)&&a.score!=null;const result=hasFinalScore?(Number(a.score||0)+' / '+Number(a.max_score||e.total_score||100)+' ('+pct+'%)'):'لم تُرصد نتيجة بعد';
   const answerStats='<div style="font-size:11px;white-space:nowrap">✓ '+(a.correct_count??'—')+' | ✗ '+(a.incorrect_count??'—')+' | لم يجب '+(a.unanswered_count??'—')+'</div>';
   const pass=hasFinalScore?(a.flagged_cheating?'راسب — اشتباه غش':(pct>=50?'ناجح':'راسب')):'—';
   let action='—';
   if(a.status==='in_progress')action='<button class="btn btn-success btn-sm" onclick="window.andalusExamAddTime(\''+a.id+'\')">＋ إضافة وقت</button> <button class="btn btn-outline btn-sm" onclick="window.andalusExamResetTime(\''+a.id+'\')">↻ إعادة الوقت</button> <button class="btn btn-danger btn-sm" onclick="window.andalusExamStopAttempt(\''+a.id+'\')">⏹ إيقاف المحاولة</button>';
   else if(a.status==='submitted')action='<button class="btn btn-success btn-sm" onclick="window.andalusExamReopen(\''+a.id+'\')">إعادة فتح + وقت</button> <button class="btn btn-outline btn-sm" onclick="window.andalusExamRestart(\''+a.id+'\')">محاولة جديدة من البداية</button>';
   return '<tr><td><b>'+esc(s.enrollment_number||s.id||a.student_id)+'</b></td><td>'+esc(s.name||'طالب غير موجود في القائمة الحالية')+'</td><td>'+esc(s.phone||'—')+'</td><td>'+esc(e.title||'امتحان محذوف أو غير متاح')+(e.is_test?' <span class="badge badge-warning">🧪 تجربة</span>':'')+'</td><td>'+fmt(a.started_at)+'</td><td>'+fmt(a.submitted_at)+'</td><td><b>'+esc(status(a))+'</b><div style="font-size:11px;color:var(--muted)">'+esc(pass)+'</div></td><td>'+esc(result)+answerStats+'</td><td style="max-width:230px;white-space:normal">'+esc(note)+(details?'<details><summary>تفاصيل الملاحظات</summary>'+esc(details)+'</details>':'')+(a.unanswered_count!=null?'<div style="font-size:11px">غير مجاب: '+Number(a.unanswered_count)+'</div>':'')+'</td><td style="white-space:nowrap">'+action+' <button class="btn btn-outline btn-sm" onclick="viewExamAttemptAudit(\''+a.id+'\')">سجل التفاصيل</button></td></tr>';
  }).join('');
 }
 function find(id){return rows.find(a=>a.id===id);}
 function examActionError(reason){const messages={admin_required:'انتهت جلسة الإدارة أو أن الحساب الحالي لا يملك صلاحية تعديل وقت الامتحان. سجّل الدخول كمسؤول ثم أعد المحاولة.',attempt_not_found:'لم يتم العثور على محاولة الطالب. حدّث سجل الامتحانات وحاول مرة أخرى.',attempt_not_in_progress:'محاولة الطالب لم تعد جارية؛ ربما انتهى الامتحان أو تم تسليمه. لا يمكن تعديل وقت محاولة غير جارية.',exam_not_found:'الامتحان المرتبط بالمحاولة غير موجود.',invalid_minutes:'عدد الدقائق غير صحيح. يجب أن يكون من 1 إلى 180.'};return messages[reason]||('تعذر تنفيذ الإجراء. رمز السبب: '+String(reason||'غير معروف'));}
 async function rpc(name,args){try{const db=window.sb||(typeof sb!=='undefined'?sb:null);if(!db){(window.showToast||alert)('الاتصال بقاعدة البيانات غير جاهز. حدّث لوحة الإدارة وسجّل الدخول مرة أخرى.','error');return false;}const {data,error}=await db.rpc(name,args);if(error){console.error('[Andalus exam admin action]',name,error);(window.showToast||alert)('فشل الإجراء: '+(error.message||error.code||'خطأ غير معروف'),'error');return false;}if(!data?.ok){const reason=data?.reason||data?.message;(window.showToast||alert)(examActionError(reason),'error');console.warn('[Andalus exam admin action rejected]',name,data);return false;}(window.showToast||alert)(data.message||'تم تنفيذ الإجراء بنجاح');await load();return true;}catch(err){console.error('[Andalus exam admin action exception]',name,err);(window.showToast||alert)('حدث خطأ أثناء تنفيذ الإجراء: '+(err?.message||String(err)),'error');return false;}}
 window.andalusExamStopAttempt=async id=>{const a=find(id);if(!a||a.status!=='in_progress')return;const s=student(a.student_id),e=exam(a.exam_id);if(!confirm('إيقاف محاولة '+(s.name||a.student_id)+' في امتحان '+(e.title||'')+' الآن؟ سيتم إغلاقها وحساب الدرجة من الإجابات المحفوظة فقط.'))return;await rpc('admin_stop_exam_attempt',{p_attempt_id:id});};
 window.andalusExamAddTime=async id=>{const a=find(id);if(!a)return;const raw=prompt('حدد عدد الدقائق الإضافية (1 إلى 180):','5');if(raw===null)return;const n=Number(raw);if(!Number.isInteger(n)||n<1||n>180)return (window.showToast||alert)('أدخل عدد دقائق صحيحًا من 1 إلى 180','error');await rpc('admin_adjust_exam_attempt_time',{p_attempt_id:id,p_minutes:n,p_reset_full:false});};
 window.andalusExamResetTime=async id=>{if(!confirm('إعادة ضبط وقت المحاولة بالكامل مع الاحتفاظ بالإجابات المحفوظة؟'))return;await rpc('admin_adjust_exam_attempt_time',{p_attempt_id:id,p_minutes:0,p_reset_full:true});};
 window.andalusExamReopen=async id=>{const raw=prompt('كم دقيقة إضافية تريد منحها عند إعادة فتح المحاولة؟','5');if(raw===null)return;const n=Number(raw);if(!Number.isInteger(n)||n<1||n>180)return (window.showToast||alert)('أدخل عدد دقائق صحيحًا من 1 إلى 180','error');await rpc('admin_reopen_exam_attempt',{p_attempt_id:id,p_extra_minutes:n,p_restart:false});};
 window.andalusExamRestart=async id=>{if(!confirm('بدء محاولة جديدة من الصفر؟ سيتم مسح إجابات ونتيجة المحاولة السابقة.'))return;await rpc('admin_reopen_exam_attempt',{p_attempt_id:id,p_extra_minutes:0,p_restart:true});};
 const originalShow=window.showPage;if(typeof originalShow==='function'&&!originalShow.__examRegisterWrapped){const wrapped=function(p){const r=originalShow.apply(this,arguments);if(p==='exams')setTimeout(()=>{mount();load();},0);return r;};wrapped.__examRegisterWrapped=true;window.showPage=wrapped;}
 document.addEventListener('DOMContentLoaded',()=>{mount();});
 setTimeout(()=>{mount();if($('#page-exams')?.classList.contains('active'))load();},1200);
 window.refreshAndalusExamAttemptRegister=load;
})();

/* Unified paper/electronic exam grade register */
(function(){
 'use strict';
 if(window.__andalusUnifiedExamGradesV1)return;window.__andalusUnifiedExamGradesV1=true;
 const $=(s,r=document)=>r.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const digits=v=>String(v??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
 const db=()=>window.sb||(typeof sb!=='undefined'?sb:null);
 const page=()=>$('#page-grades')||$('#page-exam-grades')||$('#page-grades-management')||$('#page-student-grades');
 let mode='paper',round=1,students=[],subjects=[],records=[],payments=[],branch='all',program='all',subjectId='',search='',resultFilter='all';
 function mount(){
  const p=page();if(!p||$('#andalus-unified-grades'))return;
  const box=document.createElement('section');box.id='andalus-unified-grades';box.className='card';box.style.cssText='margin:0 0 18px;padding:16px;border:1px solid var(--border);border-radius:14px';
  box.innerHTML=String.raw`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><h3 style="margin:0">📚 سجل درجات الامتحانات</h3><div style="font-size:12px;color:var(--muted);margin-top:4px">سجل مستقل يحفظ كل محاولة وتحسين دون استبدال الدرجات السابقة</div></div><button type="button" class="btn btn-outline btn-sm" id="ug-refresh">↻ تحديث</button></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0"><button type="button" class="btn btn-primary" id="ug-paper">📝 امتحان ورقي</button><button type="button" class="btn btn-outline" id="ug-electronic">💻 امتحان إلكتروني</button></div>
   <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px;margin-bottom:12px">
    <label style="font-size:12px">الفرع<select id="ug-branch" style="display:block;width:100%;padding:9px;margin-top:4px;border:1px solid var(--border);border-radius:8px"></select></label>
    <label style="font-size:12px">المجموعة / الدفعة<select id="ug-program" style="display:block;width:100%;padding:9px;margin-top:4px;border:1px solid var(--border);border-radius:8px"></select></label>
    <label style="font-size:12px">المادة<select id="ug-subject" style="display:block;width:100%;padding:9px;margin-top:4px;border:1px solid var(--border);border-radius:8px"></select></label>
    <label style="font-size:12px">الدور<select id="ug-round" style="display:block;width:100%;padding:9px;margin-top:4px;border:1px solid var(--border);border-radius:8px"><option value="1">الدور الأول</option><option value="2">الدور الثاني</option></select></label></div>
   <input id="ug-search" placeholder="بحث باسم الطالب أو رقم القيد..." style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:9px;margin-bottom:8px"><select id="ug-result-filter" style="width:100%;padding:9px;margin-bottom:10px;border:1px solid var(--border);border-radius:8px"><option value="all">كل الحالات</option><option value="passed">ناجح</option><option value="failed">راسب</option><option value="eligible">مستحق للدور الثاني</option><option value="pending">لم ترصد درجته</option></select>
   <div id="ug-summary" style="font-size:12px;color:var(--muted);margin:5px 0 10px">اختر المادة لعرض كشف الطلاب.</div>
   <div style="overflow:auto"><table style="width:100%;min-width:980px;border-collapse:collapse"><thead><tr><th>رقم القيد</th><th>اسم الطالب</th><th>الفرع</th><th>المجموعة</th><th>السداد</th><th>المحاولات السابقة</th><th>حالة الطالب</th><th>درجة جديدة</th><th>إجراء</th></tr></thead><tbody id="ug-body"><tr><td colspan="9" style="text-align:center;padding:18px">اختر المادة لعرض كشف الطلاب.</td></tr></tbody></table></div>
   <div style="font-size:11px;color:var(--muted);margin-top:9px">كل رصد جديد يُضاف كمحاولة مستقلة. لا يتم حذف أو استبدال المحاولات السابقة. نتائج الامتحان الإلكتروني الرسمي تُسجل تلقائيًا، والامتحانات التجريبية مستبعدة.</div>`;
  p.insertBefore(box,p.firstChild);
  $('#ug-paper').onclick=()=>setMode('paper');$('#ug-electronic').onclick=()=>setMode('electronic');$('#ug-refresh').onclick=loadAll;
  $('#ug-branch').onchange=e=>{branch=e.target.value;render();};$('#ug-program').onchange=e=>{program=e.target.value;render();};
  $('#ug-subject').onchange=e=>{subjectId=e.target.value;render();};$('#ug-round').onchange=e=>{round=Number(e.target.value);render();};
  $('#ug-search').oninput=e=>{search=e.target.value.trim().toLowerCase();render();};$('#ug-result-filter').onchange=e=>{resultFilter=e.target.value;render();};
  $('#ug-body').addEventListener('click',async e=>{
   const b=e.target.closest('[data-ug-save]');if(!b)return;
   const sid=b.dataset.ugSave,s=students.find(x=>String(x.id)===sid),score=Number(digits($('[data-ug-score="'+sid+'"]')?.value)),max=Number(digits($('[data-ug-max="'+sid+'"]')?.value));
   if(!s||!Number.isFinite(score)||!Number.isFinite(max)||score<0||max<=0||score>max){alert('راجع الدرجة والدرجة النهائية.');return;}
   b.disabled=true;b.textContent='جارٍ الحفظ...';
   try{const d=db();if(!d)throw new Error('قاعدة البيانات غير متاحة');
    const prev=records.filter(x=>x.student_id===sid&&x.subject_id===subjectId&&x.exam_type==='paper'&&Number(x.exam_round)===round),next=Math.max(0,...prev.map(x=>Number(x.attempt_number)||0))+1;
    const {error}=await d.from('exam_grade_attempts').insert({student_id:sid,subject_id:subjectId,exam_type:'paper',exam_round:round,attempt_number:next,score,max_score:max,branch:s.branch||null,program:s.program||null,program_id:s.program_id||null,system_name:s.system_name||null,note:'رصد يدوي لامتحان ورقي'});
    if(error)throw error;(window.showToast||alert)('تم حفظ المحاولة رقم '+next+' بنجاح');await loadAll();
   }catch(err){console.error('[Unified exam grades]',err);alert('تعذر حفظ الدرجة: '+(err.message||String(err)));b.disabled=false;b.textContent='حفظ المحاولة';}
  });
  loadAll();
 }
 function setMode(v){mode=v;$('#ug-paper').className=v==='paper'?'btn btn-primary':'btn btn-outline';$('#ug-electronic').className=v==='electronic'?'btn btn-primary':'btn btn-outline';render();}
 async function loadAll(){
  const d=db();if(!d){$('#ug-body').innerHTML='<tr><td colspan="9">جلسة الإدارة غير متاحة. أعد تسجيل الدخول.</td></tr>';return;}
  $('#ug-body').innerHTML='<tr><td colspan="9" style="text-align:center;padding:18px">جارٍ تحميل السجل...</td></tr>';
  try{
   const [sr,subr,gr,pr]=await Promise.all([d.from('students').select('id,name,branch,program,program_id,system_name,enrollment_number,student_status,total_due').is('deleted_at',null).order('name'),d.from('subjects').select('id,name,max_grade_1,max_grade_2,min_pass,pass_grade_1,pass_grade_2,order_num').order('order_num'),d.from('exam_grade_attempts').select('*').order('recorded_at',{ascending:true}),d.from('payments').select('student_id,amount,paid,applicable')]);
   for(const [n,r] of [['الطلاب',sr],['المواد',subr],['سجل الدرجات',gr],['المدفوعات',pr]])if(r.error)throw new Error(n+': '+r.error.message);
   students=(sr.data||[]).filter(s=>!['0','1','2'].includes(String(s.id)));subjects=subr.data||[];records=gr.data||[];payments=pr.data||[];fillFilters();render();
  }catch(e){console.error('[Unified exam grades load]',e);$('#ug-body').innerHTML='<tr><td colspan="9" style="text-align:center;color:#b42318;padding:18px">تعذر تحميل السجل: '+esc(e.message||e)+'</td></tr>';}
 }
 function fillFilters(){
  const opts=(a,l)=>'<option value="all">'+l+'</option>'+a.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
  const b=$('#ug-branch'),p=$('#ug-program'),sub=$('#ug-subject');if(!b)return;
  const bs=[...new Set(students.map(s=>s.branch).filter(Boolean))].sort(),ps=[...new Set(students.map(s=>s.program).filter(Boolean))].sort(),old=subjectId;
  b.innerHTML=opts(bs,'كل الفروع');b.value=bs.includes(branch)?branch:'all';branch=b.value;p.innerHTML=opts(ps,'كل المجموعات');p.value=ps.includes(program)?program:'all';program=p.value;
  sub.innerHTML='<option value="">اختر المادة</option>'+subjects.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('');sub.value=subjects.some(s=>s.id===old)?old:'';subjectId=sub.value;
 }
 function render(){
  if(!$('#ug-body'))return;const subject=subjects.find(s=>s.id===subjectId),maxDefault=subject?((round===1?subject.max_grade_1:subject.max_grade_2)||100):100;
  const relevant=records.filter(x=>x.exam_type===mode&&Number(x.exam_round)===round&&(!subjectId||x.subject_id===subjectId)),byStudent=new Map();
  relevant.forEach(x=>{if(!byStudent.has(x.student_id))byStudent.set(x.student_id,[]);byStudent.get(x.student_id).push(x);});
  const firstRound=records.filter(x=>x.exam_type===mode&&Number(x.exam_round)===1&&x.subject_id===subjectId),firstByStudent=new Map();
  firstRound.forEach(x=>{if(!firstByStudent.has(x.student_id))firstByStudent.set(x.student_id,[]);firstByStudent.get(x.student_id).push(x);});
  const max1=Number(subject?.max_grade_1)||100,max2=Number(subject?.max_grade_2)||100;
  const pass1=Number(subject?.pass_grade_1??subject?.min_pass??(max1/2)),pass2=Number(subject?.pass_grade_2??(max2/2));
  const bestOnScale=(list,maxGrade)=>{if(!list?.length)return null;return Math.max(...list.map(x=>Number(x.max_score)>0?(Number(x.score||0)/Number(x.max_score))*maxGrade:0));};
  const firstStatus=sid=>{const list=firstByStudent.get(String(sid))||[],best=bestOnScale(list,max1);return best===null?'pending':(best>=pass1?'passed':'failed');};
  const eligibleIds=new Set(students.filter(s=>firstStatus(s.id)==='failed').map(s=>String(s.id)));
  let filtered=students.filter(s=>(branch==='all'||s.branch===branch)&&(program==='all'||s.program===program)&&(!search||(String(s.name||'').toLowerCase().includes(search)||String(s.id).toLowerCase().includes(search)||String(s.enrollment_number||'').toLowerCase().includes(search))));
  if(round===2)filtered=filtered.filter(s=>eligibleIds.has(String(s.id)));
  const statusFor=sid=>{if(round===1)return firstStatus(sid);const list=byStudent.get(String(sid))||[],best=bestOnScale(list,max2);return best===null?'eligible':(best>=pass2?'passed':'failed');};
  filtered=filtered.filter(s=>resultFilter==='all'||(resultFilter==='eligible'?(round===1?statusFor(s.id)==='failed':statusFor(s.id)==='eligible'):(statusFor(s.id)===resultFilter)));
  const counts={passed:filtered.filter(s=>statusFor(s.id)==='passed').length,failed:filtered.filter(s=>statusFor(s.id)==='failed').length,eligible:round===2?filtered.filter(s=>statusFor(s.id)==='eligible').length:eligibleIds.size,pending:round===1?students.filter(s=>firstStatus(s.id)==='pending').length:0};
  $('#ug-summary').textContent=(mode==='paper'?'امتحانات ورقية':'امتحانات إلكترونية')+' • '+(round===1?'الدور الأول':'الدور الثاني')+' • '+(subject?.name||'اختر المادة')+' • ناجح: '+counts.passed+' • راسب: '+counts.failed+' • مستحق للدور الثاني: '+counts.eligible+' • '+filtered.length+' طالب معروض';
  if(!subjectId){$('#ug-body').innerHTML='<tr><td colspan="9" style="text-align:center;padding:18px">اختر المادة لعرض كشف الدرجات.</td></tr>';return;}
  $('#ug-body').innerHTML=filtered.map(s=>{
   const hist=(byStudent.get(String(s.id))||[]).sort((a,b)=>a.attempt_number-b.attempt_number),chips=hist.length?hist.map(x=>'<span title="'+esc(x.note||'')+'" style="display:inline-block;margin:2px;padding:4px 7px;border-radius:7px;background:var(--bg);border:1px solid var(--border);font-size:11px">م'+x.attempt_number+': <b>'+Number(x.score)+'</b> / '+Number(x.max_score)+'</span>').join(''):'<span style="color:var(--muted)">لا توجد درجات</span>';
   const paid=payments.filter(x=>x.student_id===String(s.id)&&x.paid&&x.applicable!==false).reduce((n,x)=>n+Number(x.amount||0),0),balance=Math.max(0,Number(s.total_due||0)-paid);
   const resultStatus=statusFor(s.id),statusLabel=resultStatus==='passed'?'ناجح':resultStatus==='failed'?(round===1?'راسب — مستحق للدور الثاني':'راسب في الدور الثاني'):resultStatus==='eligible'?'مستحق للدور الثاني — لم ترصد الدرجة':'لم ترصد الدرجة',statusColor=resultStatus==='passed'?'#16803c':resultStatus==='failed'?'#b42318':resultStatus==='eligible'?'#b45309':'var(--muted)';
   const statusCell='<span style="display:inline-block;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;color:'+statusColor+';background:color-mix(in srgb, '+statusColor+' 10%, transparent)">'+statusLabel+'</span>';
   const entry=mode==='paper'?'<div style="display:flex;gap:4px;align-items:center"><input data-ug-score="'+esc(s.id)+'" inputmode="decimal" placeholder="الدرجة" style="width:76px;padding:7px;border:1px solid var(--border);border-radius:7px">/<input data-ug-max="'+esc(s.id)+'" inputmode="decimal" value="'+esc(maxDefault)+'" style="width:62px;padding:7px;border:1px solid var(--border);border-radius:7px"></div>':'<span style="color:var(--muted)">تلقائي من الامتحان</span>';
   const action=mode==='paper'?'<button type="button" class="btn btn-success btn-sm" data-ug-save="'+esc(s.id)+'">حفظ المحاولة</button>':'—';
   return '<tr style="border-top:1px solid var(--border)"><td>'+esc(s.enrollment_number||s.id)+'</td><td><b>'+esc(s.name)+'</b><div style="font-size:10px;color:var(--muted)">'+esc(s.student_status||'')+'</div></td><td>'+esc(s.branch||'—')+'</td><td>'+esc(s.program||s.system_name||'—')+'</td><td><span style="font-size:11px;color:'+(balance>0?'#b42318':'#16803c')+'">مسدد: '+paid.toLocaleString('en-US')+' ج</span><div style="font-size:10px;color:var(--muted)">متبقي: '+balance.toLocaleString('en-US')+' ج</div></td><td style="min-width:190px;white-space:normal">'+chips+'</td><td>'+statusCell+'</td><td>'+entry+'</td><td>'+action+'</td></tr>';
  }).join('')||'<tr><td colspan="9" style="text-align:center;padding:18px">لا يوجد طلاب مطابقون للفلاتر.</td></tr>';
 }
 const originalShow=window.showPage;if(typeof originalShow==='function'&&!originalShow.__unifiedGradesWrapped){const wrapped=function(p){const r=originalShow.apply(this,arguments);if(String(p).toLowerCase().includes('grade'))setTimeout(mount,50);return r;};wrapped.__unifiedGradesWrapped=true;window.showPage=wrapped;}
 document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,300));document.addEventListener('click',e=>{const n=e.target.closest('[data-page], [onclick*="grades"]');if(n)setTimeout(mount,250);});setTimeout(mount,1500);window.refreshAndalusUnifiedExamGrades=loadAll;
})();
