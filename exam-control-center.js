/* Andalus Exam Control Center — read-only operational dashboard */
(function () {
  'use strict';
  const ID = 'andalus-exam-control-center';
  const $ = (s, root=document) => root.querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db = () => window.sb || null;
  let cache = { attempts: [], exams: [], students: {}, batches: [], questions: [], subjects: [], auditRows: [], auditError: null, bankTotal: 0, totals: {attempts:0,active:0,submitted:0,review:0}, updatedAt: null };
  let timer = null, channel = null, busy = false, activeTab = 'overview', searchTerm = '', attemptFilter = 'all', examFilter = 'all';
  const fmt = v => v ? new Date(v).toLocaleString('ar-EG', { dateStyle:'short', timeStyle:'short' }) : '—';
  const statusLabel = s => ({in_progress:'جاري الآن',submitted:'تم التسليم',expired:'انتهى الوقت',abandoned:'منقطع',cancelled:'ملغي'})[s] || s || 'غير محدد';
  const statusColor = s => s === 'in_progress' ? '#2563eb' : s === 'submitted' ? '#15803d' : '#64748b';
  function isAdmin() { return typeof currentUser !== 'undefined' && !!currentUser && currentUser.role === 'admin'; }
  function shell() {
    const page = document.getElementById('page-exams');
    if (!page || document.getElementById(ID)) return;
    const card = document.createElement('section');
    card.id = ID;
    card.className = 'card';
    card.style.cssText = 'margin:0 0 16px;padding:0;overflow:hidden;border:1px solid #dbe4f0;border-top:4px solid #c59b42;border-radius:16px';
    card.innerHTML = `
      <div style="padding:18px;background:linear-gradient(120deg,#101f38,#233f68);color:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div><div style="font-size:11px;opacity:.75;letter-spacing:.04em">ANDALUS • EXAM OPERATIONS</div><h2 style="font-size:21px;margin:5px 0">🎛️ مركز قيادة الامتحانات</h2><div style="font-size:12px;opacity:.82">متابعة تشغيلية موحدة — بيانات مباشرة من سجلات النظام</div></div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span id="ecc-live-state" style="font-size:11px;padding:6px 10px;border-radius:20px;background:#ffffff20">● جاري الاتصال</span><button id="ecc-refresh" class="btn btn-gold btn-sm" type="button">↻ تحديث البيانات</button></div>
        </div>
      </div>
      <div style="padding:14px">
        <div id="ecc-metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:9px"></div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;margin:14px 0" id="ecc-tabs">
          <button class="btn btn-sm btn-primary" data-tab="overview">نظرة عامة</button>
          <button class="btn btn-sm btn-outline" data-tab="exams">إدارة ومتابعة الامتحانات</button>
          <button class="btn btn-sm btn-outline" data-tab="live">المراقبة المباشرة</button>
          <button class="btn btn-sm btn-outline" data-tab="attempts">سجل المحاولات</button>
          <button class="btn btn-sm btn-outline" data-tab="alerts">الإنذارات للمراجعة</button>
          <button class="btn btn-sm btn-outline" data-tab="results">النتائج والتحليل</button>
          <button class="btn btn-sm btn-outline" data-tab="question-analysis">تحليل الأسئلة والضعف</button>
          <button class="btn btn-sm btn-outline" data-tab="bank">بنك الأسئلة</button>
          <button class="btn btn-sm btn-outline" data-tab="audit">سجل العمليات</button>
        </div>
        <div id="ecc-panel"><div style="padding:24px;text-align:center;color:#64748b">جاري تحميل بيانات مركز القيادة...</div></div>
        <div style="border-top:1px solid #e2e8f0;margin-top:14px;padding-top:10px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;color:#64748b;font-size:11px"><span>المراقبة تعرض إشارات النظام ولا تصدر حكمًا آليًا بالغش.</span><span id="ecc-updated">لم يتم التحديث بعد</span></div>
      </div>`;
    const anchor = document.getElementById('exam-admin-overview');
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(card, anchor);
    else page.prepend(card);
    $('#ecc-refresh', card).addEventListener('click', () => refresh(true));
    $('#ecc-tabs', card).addEventListener('click', e => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      activeTab = b.dataset.tab; render();
    });
    $('#ecc-panel', card).addEventListener('input', e => {
      if (e.target.id === 'ecc-search') { searchTerm = e.target.value; renderTableOnly(); }
    });
  }
  async function refresh(manual) {
    if (busy || !isAdmin() || !db()) return;
    busy = true;
    const live = $('#ecc-live-state');
    if (live) live.textContent = '● جاري التحديث';
    try {
      const client = db();
      const [attemptRes, examRes, studentRes, batchRes, bankCountRes, questionRes, subjectRes, allCountRes, activeCountRes, submittedCountRes, reviewCountRes, auditRes, publishedExamCountRes, testExamCountRes] = await Promise.all([
        client.from('exam_attempts').select('id,exam_id,student_id,status,started_at,submitted_at,score,max_score,flagged_cheating,violation_count,violation_log,time_taken_seconds,question_order,answers').order('started_at',{ascending:false}).limit(1000),
        client.from('exams').select('id,title,subject_id,is_published,total_score,is_test,branch,duration_minutes,available_from,available_until,created_at,round',{count:'exact'}).order('created_at',{ascending:false}).limit(500),
        client.from('students').select('id,name').limit(3000),
        client.from('exam_question_generation_batches').select('id,title,subject_name,question_type,requested_count,saved_count,status,error_message,created_at').order('created_at',{ascending:false}).limit(300),
        client.from('exam_question_bank').select('id',{count:'exact',head:true}),
        client.from('exam_questions').select('id,exam_id,question_text,question_type,correct_answer,difficulty,source_group,source_question_bank_id,points').limit(5000),
        client.from('subjects').select('id,name').limit(500),
        client.from('exam_attempts').select('id',{count:'exact',head:true}),
        client.from('exam_attempts').select('id',{count:'exact',head:true}).eq('status','in_progress'),
        client.from('exam_attempts').select('id',{count:'exact',head:true}).eq('status','submitted'),
        client.from('exam_attempts').select('id',{count:'exact',head:true}).or('flagged_cheating.eq.true,violation_count.gt.0'),
        client.from('employee_activity_log').select('id,actor_user_id,action_type,module,entity_table,entity_id,title,details,created_at').order('created_at',{ascending:false}).limit(150),
        client.from('exams').select('id',{count:'exact',head:true}).eq('is_published',true).eq('is_test',false),
        client.from('exams').select('id',{count:'exact',head:true}).eq('is_test',true)
      ]);
      for (const r of [attemptRes,examRes,studentRes,batchRes,bankCountRes,questionRes,subjectRes,allCountRes,activeCountRes,submittedCountRes,reviewCountRes,publishedExamCountRes,testExamCountRes]) if (r.error) throw r.error;
      cache.attempts = attemptRes.data || [];
      cache.exams = examRes.data || [];
      cache.students = Object.fromEntries((studentRes.data || []).map(s=>[String(s.id),s.name]));
      cache.batches = batchRes.data || [];
      cache.questions = questionRes.data || [];
      cache.subjects = Object.fromEntries((subjectRes.data || []).map(s=>[String(s.id),s.name]));
      cache.auditRows = auditRes.error ? [] : (auditRes.data || []);
      cache.auditError = auditRes.error ? (auditRes.error.message || String(auditRes.error)) : null;
      cache.bankTotal = bankCountRes.count || 0;
      cache.totals = {attempts:allCountRes.count||0,active:activeCountRes.count||0,submitted:submittedCountRes.count||0,review:reviewCountRes.count||0,exams:examRes.count||0,published:publishedExamCountRes.count||0,tests:testExamCountRes.count||0};
      cache.updatedAt = new Date();
      render();
      if (live) { live.textContent = '● متصل'; live.style.background = '#166534'; }
      const updated = $('#ecc-updated'); if (updated) updated.textContent = 'آخر تحديث: ' + cache.updatedAt.toLocaleTimeString('ar-EG');
    } catch (e) {
      if (live) { live.textContent = '● تعذر التحديث'; live.style.background = '#991b1b'; }
      const panel = $('#ecc-panel'); if (panel) panel.innerHTML = '<div style="padding:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;color:#9a3412">تعذر تحميل بيانات مركز القيادة: '+esc(e.message || e)+'<br><small>تحقق من صلاحيات الإدارة واتصال قاعدة البيانات.</small></div>';
      if (manual && typeof window.showToast === 'function') window.showToast('تعذر تحديث مركز القيادة: '+(e.message||e),'error');
    } finally { busy = false; }
  }
  function metrics() {
    const published=cache.totals.published;
    const active=cache.totals.active, submitted=cache.totals.submitted, review=cache.totals.review;
    const notSubmitted=cache.attempts.filter(a=>['expired','abandoned'].includes(a.status)).length;
    const cards=[
      ['📚',cache.totals.exams,'إجمالي الامتحانات','#1e3a8a','exams','all'],
      ['🧪',cache.totals.tests,'امتحانات تجريبية','#6d28d9','exams','test'],
      ['🚀',published,'امتحانات منشورة','#15803d','exams','published'],
      ['📋',cache.totals.attempts,'إجمالي المحاولات','#334155','attempts','all'],
      ['📨',submitted,'محاولات مسلّمة','#0f766e','attempts','submitted'],
      ['⏱️',notSubmitted,'لم يسلم / انتهى وقته','#64748b','attempts','closed'],
      ['🟦',active,'محاولات جارية','#2563eb','live','all'],
      ['⚠️',review,'حالات تحتاج مراجعة','#b45309','alerts','all'],
      ['🧠',cache.bankTotal,'سؤال في البنك','#6d28d9','bank','all']
    ];
    const el=$('#ecc-metrics'); if(!el)return;
    el.innerHTML=cards.map((c,i)=>'<button type="button" data-metric="'+c[4]+'" data-metric-filter="'+c[5]+'" aria-label="فتح '+esc(c[2])+'" style="text-align:right;cursor:pointer;border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff;transition:transform .15s,box-shadow .15s" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 5px 16px #0f172a18\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'none\'"><div style="font-size:19px">'+c[0]+'</div><div style="font-size:25px;font-weight:900;color:'+c[3]+';margin:4px 0">'+Number(c[1]).toLocaleString('en-US')+'</div><div style="font-size:11px;color:#64748b">'+c[2]+'</div><div style="font-size:10px;color:#2563eb;margin-top:6px">اضغط لفتح التفاصيل ←</div></button>').join('');
    el.querySelectorAll('[data-metric]').forEach(b=>b.addEventListener('click',()=>{
      const target=b.dataset.metric, f=b.dataset.metricFilter||'all';
      if(target==='attempts')attemptFilter=f; else if(target==='exams')examFilter=f;
      else {attemptFilter='all';examFilter='all';}
      activeTab=target; searchTerm=''; render();
      const root=$('#'+ID); root?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }
  function examName(id){return cache.exams.find(x=>x.id===id)?.title || 'امتحان غير معروف';}
  function attemptRows(rows) {
    const filtered=rows.filter(a=>{
      if(activeTab==='attempts'&&attemptFilter==='submitted'&&a.status!=='submitted')return false;
      if(activeTab==='attempts'&&attemptFilter==='closed'&&!['expired','abandoned'].includes(a.status))return false;
      if(activeTab==='attempts'&&attemptFilter==='test'&&!cache.exams.find(x=>x.id===a.exam_id)?.is_test)return false;
      const q=searchTerm.trim().toLowerCase();
      if(!q)return true;
      return [cache.students[String(a.student_id)],a.student_id,examName(a.exam_id),statusLabel(a.status)].join(' ').toLowerCase().includes(q);
    });
    return '<div style="overflow:auto"><table style="width:100%;min-width:760px;border-collapse:collapse"><thead><tr style="background:#f1f5f9"><th style="padding:9px">الطالب</th><th>الامتحان</th><th>الحالة</th><th>الدرجة</th><th>البداية</th><th>التسليم</th><th>المخالفات المسجلة</th><th>تفاصيل</th></tr></thead><tbody>'+
      (filtered.length?filtered.map(a=>{
        const flags=Number(a.violation_count||0), signal=!!a.flagged_cheating||flags>0;
        return '<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:9px"><b>'+esc(cache.students[String(a.student_id)]||'طالب '+a.student_id)+'</b><div style="font-size:10px;color:#64748b">قيد '+esc(a.student_id)+'</div></td><td>'+esc(examName(a.exam_id))+'</td><td><span style="color:'+statusColor(a.status)+';font-weight:800">'+esc(statusLabel(a.status))+'</span></td><td>'+(a.score==null?'—':Number(a.score).toLocaleString('en-US')+' / '+(a.max_score??'—'))+'</td><td>'+fmt(a.started_at)+'</td><td>'+fmt(a.submitted_at)+'</td><td>'+(signal?'<span style="color:#b45309;font-weight:800">'+flags+' إشارة — مراجعة يدوية</span>':'—')+'</td><td><button class="btn btn-outline btn-sm" data-attempt="'+esc(a.id)+'">عرض السجل</button></td></tr>';
      }).join(''):'<tr><td colspan="8" style="padding:18px;text-align:center;color:#64748b">لا توجد سجلات مطابقة</td></tr>')+'</tbody></table></div>';
  }
  function details(a) {
    let logs=Array.isArray(a.violation_log)?a.violation_log:[];
    let text=logs.length?logs.map((x,i)=>'<li style="margin:6px 0">'+esc(x.type||x.event||x.reason||'إشارة')+' — '+fmt(x.at||x.created_at||x.timestamp)+'</li>').join(''):'<li>لا توجد تفاصيل مسجلة داخل سجل المخالفات.</li>';
    const panel=$('#ecc-detail'); if(!panel)return;
    panel.innerHTML='<div style="margin-top:12px;padding:14px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc"><div style="display:flex;justify-content:space-between;gap:8px"><b>تفاصيل المحاولة</b><button class="btn btn-outline btn-sm" id="ecc-close-detail">إغلاق</button></div><p style="margin:8px 0">الطالب: '+esc(cache.students[String(a.student_id)]||a.student_id)+' · '+esc(examName(a.exam_id))+'</p><p>الحالة: '+esc(statusLabel(a.status))+' · الدرجة: '+(a.score??'—')+' / '+(a.max_score??'—')+'</p><p>مدة الحل المسجلة: '+Math.round(Number(a.time_taken_seconds||0)/60)+' دقيقة</p><b>سجل الإشارات:</b><ul>'+text+'</ul><small style="color:#92400e">هذه الإشارات للمراجعة البشرية فقط وليست إثباتًا تلقائيًا للغش.</small></div>';
    $('#ecc-close-detail',panel).onclick=()=>panel.innerHTML='';
  }
  function tableSection(rows) {
    return '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0 12px"><b>سجل أحدث '+rows.length+' محاولة</b><input id="ecc-search" placeholder="بحث باسم الطالب أو رقم القيد أو الامتحان" value="'+esc(searchTerm)+'" style="max-width:320px;width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px"></div><div id="ecc-attempt-table">'+attemptRows(rows)+'</div><div id="ecc-detail"></div>';
  }
  function normalizeAnswer(value) {
    let s=String(value==null?'':value).trim().toLowerCase().replace(/\s+/g,' ');
    const aliases={'صح':'true','صحيح':'true','true':'true','1':'true','خطأ':'false','خطا':'false','غلط':'false','false':'false','0':'false'};
    return Object.prototype.hasOwnProperty.call(aliases,s)?aliases[s]:s;
  }
  function questionAnalytics() {
    const questions=new Map(cache.questions.map(q=>[String(q.id),q]));
    const stats=new Map();
    const studentStats=new Map();
    const official=cache.attempts.filter(a=>a.status==='submitted' && !cache.exams.find(x=>x.id===a.exam_id)?.is_test);
    official.forEach(a=>{
      const order=Array.isArray(a.question_order)?a.question_order:[];
      const answers=a.answers&&typeof a.answers==='object'?a.answers:{};
      const studentKey=String(a.student_id);
      if(!studentStats.has(studentKey))studentStats.set(studentKey,{attempts:0,score:0,max:0,wrong:0,blank:0});
      const ss=studentStats.get(studentKey);ss.attempts++;ss.score+=Number(a.score||0);ss.max+=Number(a.max_score||100);
      order.forEach(id=>{
        const q=questions.get(String(id));if(!q)return;
        const key=String(q.id);if(!stats.has(key))stats.set(key,{question:q,seen:0,answered:0,correct:0,incorrect:0,blank:0,gradable:!/(essay|written|short)/i.test(String(q.question_type||''))});
        const st=stats.get(key);st.seen++;
        const raw=answers[key];const has=raw!==undefined&&raw!==null&&String(raw).trim()!=='';
        if(!has){st.blank++;ss.blank++;return;}
        st.answered++;
        if(st.gradable){
          if(normalizeAnswer(raw)===normalizeAnswer(q.correct_answer)){st.correct++;}
          else {st.incorrect++;ss.wrong++;}
        }
      });
    });
    const rows=[...stats.values()].map(s=>({...s,accuracy:s.gradable&&s.answered?s.correct/s.answered*100:null,subject:cache.subjects[String(cache.exams.find(e=>e.id===s.question.exam_id)?.subject_id)]||'غير محدد'})).sort((a,b)=>(a.accuracy??101)-(b.accuracy??101));
    const students=[...studentStats.entries()].map(([id,s])=>({id,name:cache.students[id]||('طالب '+id),...s,average:s.max?s.score/s.max*100:0})).sort((a,b)=>a.average-b.average);
    return {rows,students,officialCount:official.length};
  }
  function downloadCsv(filename, rows, sheetName) {
    const XLSX=window.XLSX;
    if(XLSX?.utils?.aoa_to_sheet && XLSX?.writeFile){
      const wb=XLSX.utils.book_new();
      const ws=XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb,ws,String(sheetName||'التقرير').slice(0,31));
      XLSX.writeFile(wb,filename.replace(/\.csv$/i,'.xlsx'));
      return;
    }
    const csv='\\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\\r\\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  function renderTableOnly(){
    const el=$('#ecc-attempt-table'); if(el)el.innerHTML=attemptRows(activeTab==='live'?cache.attempts.filter(a=>a.status==='in_progress'):activeTab==='alerts'?cache.attempts.filter(a=>a.flagged_cheating||Number(a.violation_count||0)>0):cache.attempts);
  }
  function render() {
    const root=$('#'+ID); if(!root)return;
    metrics();
    const panel=$('#ecc-panel'); if(!panel)return;
    if(activeTab==='exams'){
      const counts={}; cache.attempts.forEach(a=>counts[a.exam_id]=(counts[a.exam_id]||0)+1);
      const shownExams=cache.exams.filter(x=>examFilter==='test'?!!x.is_test:examFilter==='published'?!!x.is_published&&!x.is_test:true);
      panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><b>قائمة الامتحانات</b><span style="font-size:12px;color:#64748b">'+(examFilter==='test'?'الامتحانات التجريبية':examFilter==='published'?'الامتحانات المنشورة':'كل الامتحانات')+' · '+shownExams.length+'</span><button class="btn btn-outline btn-sm" id="ecc-exam-filter-all">عرض الكل</button></div><div style="overflow:auto"><table style="width:100%;min-width:760px;border-collapse:collapse"><thead><tr style="background:#f1f5f9"><th>اسم الامتحان</th><th>الحالة</th><th>الفرع</th><th>المدة</th><th>بداية الإتاحة</th><th>نهاية الإتاحة</th><th>الدرجة النهائية</th><th>محاولات ظاهرة</th></tr></thead><tbody>'+(shownExams.length?shownExams.map(x=>'<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:9px"><b>'+esc(x.title)+'</b></td><td>'+(x.is_test?'<span style="color:#6d28d9">تجريبي</span>':x.is_published?'<span style="color:#15803d">منشور</span>':'مسودة / غير منشور')+'</td><td>'+esc(x.branch||'—')+'</td><td>'+esc(x.duration_minutes||'—')+' دقيقة</td><td>'+fmt(x.available_from)+'</td><td>'+fmt(x.available_until)+'</td><td>'+esc(x.total_score??'—')+'</td><td>'+Number(counts[x.id]||0).toLocaleString('en-US')+'</td></tr>').join(''):'<tr><td colspan="8" style="padding:18px;text-align:center">لا توجد امتحانات مطابقة.</td></tr>')+'</tbody></table></div><p style="margin-top:10px;color:#64748b;font-size:11px">أدوات الإنشاء والتعديل والنشر الحالية لم يتم تغييرها.</p>';
      $('#ecc-exam-filter-all')?.addEventListener('click',()=>{examFilter='all';render();});
    } else if(activeTab==='live'){
      const rows=cache.attempts.filter(a=>a.status==='in_progress');
      panel.innerHTML='<div style="padding:10px 0 14px;color:#475569">المحاولات الجارية حاليًا حسب آخر مزامنة. يتم التحديث التلقائي كل 15 ثانية أثناء فتح صفحة الامتحانات.</div>'+tableSection(rows);
    } else if(activeTab==='attempts'){
      const labels={all:'كل المحاولات',submitted:'المحاولات المسلّمة',closed:'المحاولات التي لم تُسلّم / انتهى وقتها',test:'المحاولات التجريبية'};
      panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px"><b>'+labels[attemptFilter]+'</b><button class="btn btn-outline btn-sm" id="ecc-attempt-filter-all">عرض كل المحاولات</button></div>'+tableSection(cache.attempts);
      $('#ecc-attempt-filter-all')?.addEventListener('click',()=>{attemptFilter='all';render();});
    } else if(activeTab==='alerts'){
      const rows=cache.attempts.filter(a=>a.flagged_cheating||Number(a.violation_count||0)>0);
      panel.innerHTML='<div style="padding:10px 0;color:#92400e;background:#fffbeb;border-radius:9px">تنبيه: كل حالة هنا تحتاج مراجعة بشرية؛ فقد يكون السبب انقطاع اتصال أو حدث متصفح وليس غشًا.</div>'+tableSection(rows);
    } else if(activeTab==='results'){
      const rows=cache.attempts.filter(a=>a.status==='submitted'&&a.score!=null);
      const avg=rows.length?rows.reduce((n,a)=>n+Number(a.score||0),0)/rows.length:0;
      const passed=rows.filter(a=>Number(a.max_score)>0&&Number(a.score)/Number(a.max_score)>=.5).length;
      panel.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px"><div class="card" style="padding:12px"><b style="font-size:24px">'+rows.length+'</b><div>نتائج مكتملة في أحدث السجلات</div></div><div class="card" style="padding:12px"><b style="font-size:24px">'+avg.toFixed(1)+'</b><div>متوسط الدرجة</div></div><div class="card" style="padding:12px"><b style="font-size:24px">'+(rows.length?Math.round(passed/rows.length*100):0)+'%</b><div>نسبة النجاح (50% فأكثر)</div></div></div>'+tableSection(rows);
    } else if(activeTab==='question-analysis'){
      const analytics=questionAnalytics();
      const analyzable=analytics.rows.filter(x=>x.gradable&&x.answered>0);
      const hard=analyzable.filter(x=>x.accuracy<50).length;
      const avg=analyzable.length?analyzable.reduce((n,x)=>n+x.accuracy,0)/analyzable.length:0;
      panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><div><h3 style="margin:0 0 4px">تحليل أداء الأسئلة</h3><div style="font-size:12px;color:#64748b">مبني على المحاولات الرسمية المسلّمة فقط، مع استبعاد الامتحانات التجريبية</div></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn btn-gold btn-sm" id="ecc-export-question-analysis">⬇ تصدير تحليل الأسئلة Excel</button><button class="btn btn-outline btn-sm" id="ecc-export-student-analysis">تصدير تقرير الطلاب</button></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin-bottom:14px"><div class="card" style="padding:12px"><b style="font-size:24px">'+analytics.officialCount+'</b><div>محاولة رسمية مكتملة</div></div><div class="card" style="padding:12px"><b style="font-size:24px">'+analytics.rows.length+'</b><div>أسئلة تم تحليلها</div></div><div class="card" style="padding:12px"><b style="font-size:24px">'+hard+'</b><div>أسئلة نسبة الإجابة الصحيحة عليها أقل من 50%</div></div><div class="card" style="padding:12px"><b style="font-size:24px">'+avg.toFixed(1)+'%</b><div>متوسط دقة الإجابة على الأسئلة القابلة للتصحيح</div></div></div><h4 style="margin:12px 0">الأسئلة الأكثر احتياجًا للمراجعة</h4><div style="overflow:auto"><table style="width:100%;min-width:850px;border-collapse:collapse"><thead><tr style="background:#f1f5f9"><th>السؤال</th><th>المادة</th><th>النوع</th><th>الصعوبة</th><th>عدد مرات الظهور</th><th>إجابات صحيحة</th><th>إجابات خاطئة</th><th>نسبة الصحة</th></tr></thead><tbody>'+(analytics.rows.length?analytics.rows.slice(0,100).map(x=>'<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:9px;max-width:360px">'+esc(x.question.question_text)+'</td><td>'+esc(x.subject)+'</td><td>'+esc(x.question.question_type)+'</td><td>'+esc(x.question.difficulty||'—')+'</td><td>'+x.seen+'</td><td>'+x.correct+'</td><td>'+x.incorrect+'</td><td>'+(x.accuracy==null?'غير قابلة للتصحيح آليًا':x.accuracy.toFixed(1)+'%')+'</td></tr>').join(''):'<tr><td colspan="8" style="padding:18px;text-align:center">لا توجد بيانات كافية لتحليل الأسئلة حتى الآن.</td></tr>')+'</tbody></table></div><h4 style="margin:18px 0 8px">طلاب يحتاجون إلى دعم إضافي</h4><div style="overflow:auto"><table style="width:100%;min-width:620px"><thead><tr><th>الطالب</th><th>عدد المحاولات</th><th>متوسط النتيجة</th><th>إجابات خاطئة مرصودة</th><th>أسئلة بلا إجابة</th></tr></thead><tbody>'+(analytics.students.filter(x=>x.attempts).slice(0,30).map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+x.attempts+'</td><td>'+x.average.toFixed(1)+'%</td><td>'+x.wrong+'</td><td>'+x.blank+'</td></tr>').join('')||'<tr><td colspan="5" style="padding:16px;text-align:center">لا توجد بيانات طلاب كافية.</td></tr>')+'</tbody></table></div><p style="font-size:11px;color:#64748b;margin-top:10px">ملاحظة: الأسئلة المقالية لا تدخل في دقة التصحيح الآلي. انخفاض نسبة الصحة مؤشر تعليمي لمراجعة السؤال وشرح المادة، وليس حكمًا على الطالب أو جودة السؤال وحده.</p>';
      $('#ecc-export-question-analysis')?.addEventListener('click',()=>downloadCsv('andalus-question-analysis.csv',[['السؤال','المادة','النوع','الصعوبة','مرات الظهور','إجابات','صحيحة','خاطئة','بلا إجابة','نسبة الصحة %'],...analytics.rows.map(x=>[x.question.question_text,x.subject,x.question.question_type,x.question.difficulty,x.seen,x.answered,x.correct,x.incorrect,x.blank,x.accuracy==null?'':x.accuracy.toFixed(1)])],'تحليل الأسئلة'));
      $('#ecc-export-student-analysis')?.addEventListener('click',()=>downloadCsv('andalus-student-performance.csv',[['رقم القيد','اسم الطالب','عدد المحاولات','مجموع الدرجات','المجموع النهائي','متوسط النتيجة %','إجابات خاطئة','أسئلة بلا إجابة'],...analytics.students.map(x=>[x.id,x.name,x.attempts,x.score,x.max,x.average.toFixed(1),x.wrong,x.blank])],'أداء الطلاب'));
    } else if(activeTab==='bank'){
      const total=cache.batches.length;
      const sum=cache.batches.reduce((n,b)=>n+Number(b.saved_count||0),0);
      panel.innerHTML='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px"><div class="card" style="padding:12px;min-width:140px"><b style="font-size:24px">'+cache.bankTotal+'</b><div>أسئلة البنك القابلة لإعادة الاستخدام</div></div><div class="card" style="padding:12px;min-width:140px"><b style="font-size:24px">'+cache.questions.length+'</b><div>أسئلة محفوظة داخل الامتحانات</div></div><div class="card" style="padding:12px;min-width:140px"><b style="font-size:24px">'+total+'</b><div>مجموعات التوليد</div></div><div class="card" style="padding:12px;min-width:140px"><b style="font-size:24px">'+sum+'</b><div>مجموع المحفوظ بالمجموعات</div></div></div><div style="overflow:auto"><table style="width:100%;min-width:700px"><thead><tr><th>المجموعة</th><th>المادة</th><th>النوع</th><th>المطلوب</th><th>المحفوظ</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>'+(cache.batches.length?cache.batches.map(b=>'<tr><td>'+esc(b.title||b.id)+'</td><td>'+esc(b.subject_name)+'</td><td>'+esc(b.question_type)+'</td><td>'+b.requested_count+'</td><td>'+b.saved_count+'</td><td>'+esc(b.status)+(b.error_message?' — '+esc(b.error_message):'')+'</td><td>'+fmt(b.created_at)+'</td></tr>').join(''):'<tr><td colspan="7" style="padding:18px;text-align:center">لا توجد مجموعات توليد بعد.</td></tr>')+'</tbody></table></div><p style="margin-top:10px;font-size:12px;color:#64748b">إدارة الأسئلة والتوليد التفصيلية من استوديو إنشاء الامتحان داخل مكتبة المادة.</p>';
    } else if(activeTab==='audit'){
      panel.innerHTML=(cache.auditError ? '<div style="padding:10px;background:#fff7ed;color:#9a3412;border-radius:9px;margin-bottom:10px">تعذر تحميل سجل العمليات فقط: '+esc(cache.auditError)+' — باقي لوحة القيادة تعمل بصورة مستقلة.</div>' : '')+'<div style="margin-bottom:10px;color:#64748b;font-size:12px">آخر 150 عملية مسجلة في سجل نشاط الإدارة والموظفين — عرض فقط دون تعديل السجلات.</div><div style="overflow:auto"><table style="width:100%;min-width:760px"><thead><tr><th>الوقت</th><th>القسم</th><th>نوع العملية</th><th>الوصف</th><th>الكيان</th><th>تفاصيل إضافية</th></tr></thead><tbody>'+(cache.auditRows.length?cache.auditRows.map(x=>'<tr><td>'+fmt(x.created_at)+'</td><td>'+esc(x.module||'—')+'</td><td>'+esc(x.action_type||'—')+'</td><td>'+esc(x.title||'—')+'</td><td>'+esc([x.entity_table,x.entity_id].filter(Boolean).join(' · ')||'—')+'</td><td><details><summary>عرض</summary><pre style="white-space:pre-wrap;max-width:360px">'+esc(JSON.stringify(x.details||{},null,2))+'</pre></details></td></tr>').join(''):'<tr><td colspan="6" style="padding:18px;text-align:center">لا توجد عمليات مسجلة.</td></tr>')+'</tbody></table></div>';
    } else {
      const statuses={};cache.attempts.forEach(a=>statuses[a.status||'unknown']=(statuses[a.status||'unknown']||0)+1);
      const recent=cache.attempts.slice(0,8);
      panel.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px">'+Object.entries(statuses).map(([s,n])=>'<div style="padding:12px;border:1px solid #e2e8f0;border-radius:10px"><b style="font-size:21px;color:'+statusColor(s)+'">'+n+'</b><div style="font-size:12px;color:#64748b">'+esc(statusLabel(s))+'</div></div>').join('')+'</div><h3 style="font-size:15px;margin:10px 0">أحدث النشاط</h3>'+attemptRows(recent);
    }
    panel.querySelectorAll('[data-attempt]').forEach(b=>b.addEventListener('click',()=>{const a=cache.attempts.find(x=>x.id===b.dataset.attempt);if(a)details(a);}));
  }
  function startLive() {
    if(timer)clearInterval(timer);
    timer=setInterval(()=>{if(document.getElementById('page-exams')?.classList.contains('active'))refresh(false);},15000);
    try {
      if(channel)db()?.removeChannel(channel);
      channel=db()?.channel('andalus-exam-control-center').on('postgres_changes',{event:'*',schema:'public',table:'exam_attempts'},()=>refresh(false)).subscribe();
    } catch(e) { console.warn('Exam realtime unavailable; polling remains active.',e); }
  }
  function activate() {
    shell();
    if(!isAdmin()) { const root=$('#'+ID); if(root)root.style.display='none'; return; }
    const root=$('#'+ID); if(root)root.style.display='';
    refresh(false); startLive();
  }
  function install() {
    shell();
    if(typeof window.showPage==='function'&&!window.showPage.__eccWrapped){
      const old=window.showPage;
      const wrapped=function(page,...args){const r=old.call(this,page,...args);if(page==='exams')setTimeout(activate,0);return r;};
      wrapped.__eccWrapped=true;window.showPage=wrapped;
    }
    if(document.getElementById('page-exams')?.classList.contains('active'))activate();
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer){clearInterval(timer);timer=null;}else if(!document.hidden&&document.getElementById('page-exams')?.classList.contains('active'))startLive();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.AndalusExamControlCenter={refresh:()=>refresh(true),openTab:t=>{activeTab=t;render();}};
})();