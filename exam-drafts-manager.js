/* Andalus persistent exam draft manager */
(function () {
  'use strict';
  const TABLE = 'exam_drafts';
  let drafts = [];
  let selected = new Set();
  let pendingApprovalIds = [];
  const $ = (s, r=document) => r.querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = (m, type) => { if (typeof window.showToast === 'function') window.showToast(m, type || 'success'); else alert(m); };
  function client(){ return window.sb || (typeof sb !== 'undefined' ? sb : null); }
  function subjectId(name){
    const norm = v => String(v || '').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\sـ]+/g,' ').trim().toLowerCase();
    const list = typeof allSubjects !== 'undefined' ? allSubjects : [];
    const w = norm(name);
    const found = list.find(x => norm(x.name) === w) || list.find(x => norm(x.name).includes(w) || w.includes(norm(x.name)));
    return found ? found.id : null;
  }
  function counts(questions){
    const out = {mcq:0,true_false:0,essay:0};
    (questions || []).forEach(q => {
      const t = String(q.type || q.question_type || '').toLowerCase();
      if (t.includes('essay') || t.includes('مقالي')) out.essay++;
      else if (t.includes('true') || t.includes('صح') || t.includes('false')) out.true_false++;
      else out.mcq++;
    });
    return out;
  }
  function ensureModal(){
    if ($('#andalus-exam-drafts-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'andalus-exam-drafts-modal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1300';
    modal.innerHTML = '<div class="modal" style="max-width:980px;width:96vw;max-height:92vh;overflow:auto"><div class="modal-header"><div><h3 style="margin:0">📚 المسودات المحفوظة للامتحانات</h3><small style="color:var(--muted)">حفظ دائم في قاعدة البيانات — اختر مسودة أو أكثر لتجميعها</small></div><button class="btn btn-outline" type="button" id="aed-close">إغلاق</button></div><div class="modal-body"><div id="aed-status" style="margin-bottom:12px"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn btn-outline btn-sm" id="aed-refresh">↻ تحديث</button><button class="btn btn-success btn-sm" id="aed-approve">اعتماد المحدد</button><button class="btn btn-gold btn-sm" id="aed-create">🧩 إنشاء امتحان من المحدد</button><button class="btn btn-outline btn-sm" id="aed-clear">إلغاء التحديد</button></div><div id="aed-list"></div><div id="aed-preview" style="margin-top:14px"></div></div></div>';
    document.body.appendChild(modal);
    $('#aed-close',modal).onclick = () => modal.classList.remove('open');
    $('#aed-refresh',modal).onclick = load;
    $('#aed-clear',modal).onclick = () => { selected.clear(); render(); };
    $('#aed-approve',modal).onclick = approveSelected;
    $('#aed-create',modal).onclick = createFromSelected;
    $('#aed-list',modal).addEventListener('change', e => {
      const cb = e.target.closest('[data-draft-id]');
      if (!cb) return;
      if (cb.checked) selected.add(cb.dataset.draftId); else selected.delete(cb.dataset.draftId);
      render();
    });
    $('#aed-list',modal).addEventListener('click', e => {
      const btn = e.target.closest('[data-preview-id]');
      if (btn) preview(btn.dataset.previewId);
    });
  }
  async function load(){
    const db = client();
    if (!db) return toast('تعذر الاتصال بقاعدة البيانات.', 'error');
    $('#aed-status').textContent = 'جاري تحميل المسودات...';
    const {data,error} = await db.from(TABLE).select('*').order('updated_at',{ascending:false});
    if (error) { $('#aed-status').textContent = 'تعذر تحميل المسودات: ' + error.message; return; }
    drafts = data || [];
    selected = new Set([...selected].filter(id => drafts.some(d => d.id === id)));
    $('#aed-status').textContent = 'إجمالي المسودات: ' + drafts.length;
    render();
  }
  function render(){
    const box = $('#aed-list'); if (!box) return;
    if (!drafts.length) { box.innerHTML = '<div class="empty-state"><div class="emoji">🗂️</div><h4>لا توجد مسودات محفوظة بعد</h4><p>ولّد الأسئلة من مكتبة المادة ثم اختر «حفظ كمسودة دائمة».</p></div>'; return; }
    box.innerHTML = '<div style="overflow:auto"><table><thead><tr><th>اختيار</th><th>العنوان / المادة</th><th>عدد الأسئلة</th><th>الحالة</th><th>آخر تحديث</th><th>معاينة</th></tr></thead><tbody>' + drafts.map(d => {
      const n = counts(d.questions || []);
      return '<tr><td><input type="checkbox" data-draft-id="' + esc(d.id) + '" ' + (selected.has(d.id) ? 'checked' : '') + '></td><td><strong>' + esc(d.title) + '</strong><br><small>' + esc(d.subject_name || '—') + '</small></td><td>' + (d.questions || []).length + ' <small>(اختيار ' + n.mcq + '، صح/خطأ ' + n.true_false + '، مقالي ' + n.essay + ')</small></td><td>' + (d.status === 'approved' ? 'معتمدة' : d.status === 'archived' ? 'مؤرشفة' : 'مسودة') + '</td><td>' + (d.updated_at ? new Date(d.updated_at).toLocaleString('ar-EG') : '—') + '</td><td><button class="btn btn-info btn-sm" data-preview-id="' + esc(d.id) + '">عرض</button></td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function preview(id){
    const d = drafts.find(x => x.id === id); if (!d) return;
    const n = counts(d.questions || []);
    $('#aed-preview').innerHTML = '<div class="card" style="padding:14px"><h4>' + esc(d.title) + '</h4><p>' + esc(d.subject_name || '') + ' — ' + (d.questions || []).length + ' سؤال</p><p>اختيار من متعدد: ' + n.mcq + ' | صح/خطأ: ' + n.true_false + ' | مقالي: ' + n.essay + '</p><div style="max-height:340px;overflow:auto">' + (d.questions || []).map((q,i) => '<article style="padding:10px;border:1px solid var(--border);border-radius:9px;margin:7px 0"><strong>سؤال ' + (i+1) + ' — ' + esc(q.type || q.question_type || 'اختيار') + '</strong><div>' + esc(q.question || q.question_text || '') + '</div><small>الإجابة: ' + esc(q.answer || q.correct_answer || '—') + '</small></article>').join('') + '</div></div>';
  }
  async function saveCurrentDraft(){
    const exam = window._andalusGeneratedExam;
    if (!exam || !Array.isArray(exam.questions) || !exam.questions.length) return toast('لا توجد أسئلة جاهزة للحفظ.', 'error');
    const subject = exam.subject || (typeof activeExamMaterialName !== 'undefined' ? activeExamMaterialName : '') || 'مادة تدريبية';
    const sid = subjectId(subject);
    if (!sid) return toast('المادة غير مسجلة في قائمة المواد. أضفها أولًا ثم أعد الحفظ.', 'error');
    const db = client(); if (!db) return toast('تعذر الاتصال بقاعدة البيانات.', 'error');
    const files = [...document.querySelectorAll('#exam-material-files-list .exam-material-file-cb:checked')].map(x => x.value);
    const n = counts(exam.questions);
    const row = {title:exam.title || ('امتحان ' + subject),subject_id:sid,subject_name:subject,questions:exam.questions,source_files:files,question_counts:n,status:'draft'};
    if (typeof currentAuth !== 'undefined' && currentAuth && currentAuth.id) row.created_by = currentAuth.id;
    const {error} = await db.from(TABLE).insert(row);
    if (error) return toast('فشل حفظ المسودة: ' + error.message, 'error');
    toast('تم حفظ المسودة بشكل دائم في قاعدة البيانات.');
    if (typeof window.closeModal === 'function') window.closeModal('modal-ai-exam-review');
    if ($('#andalus-exam-drafts-modal')?.classList.contains('open')) await load();
  }
  async function approveSelected(){
    if (!selected.size) return toast('حدد مسودة واحدة على الأقل.', 'error');
    const db=client(); const ids=[...selected];
    const {error}=await db.from(TABLE).update({status:'approved',updated_at:new Date().toISOString()}).in('id',ids);
    if(error) return toast('تعذر اعتماد المسودات: '+error.message,'error');
    toast('تم اعتماد '+ids.length+' مسودة.');
    await load();
  }
  async function createFromSelected(){
    const chosen=drafts.filter(d=>selected.has(d.id));
    if(!chosen.length) return toast('حدد مسودة واحدة على الأقل.', 'error');
    const subjects=[...new Set(chosen.map(d=>d.subject_id))];
    if(subjects.length!==1) return toast('لا يمكن دمج مسودات من مواد مختلفة في امتحان واحد.', 'error');
    const questions=chosen.flatMap(d=>Array.isArray(d.questions)?d.questions:[]);
    if(!questions.length) return toast('المسودات المحددة لا تحتوي على أسئلة.', 'error');
    const essay=questions.some(q=>String(q.type||q.question_type||'').toLowerCase().includes('essay')||String(q.type||'').includes('مقالي'));
    if(essay) return toast('المسودات تحتوي أسئلة مقالية. لا يمكن تحويلها حاليًا إلى بنك الامتحان الموضوعي دون دعم المقالي في جدول الأسئلة.', 'error');
    const subjectName=chosen[0].subject_name || '';
    window._andalusGeneratedExam={title:'امتحان '+subjectName,subject:subjectName,questions};
    pendingApprovalIds=chosen.map(d=>d.id);
    if(typeof window.openGeneratedExamSettings!=='function') return toast('تعذر فتح إعدادات إنشاء الامتحان.', 'error');
    window.openGeneratedExamSettings();
    const modal=$('#andalus-exam-drafts-modal'); if(modal) modal.classList.remove('open');
  }
  function addButton(parent,label,handler,id){
    if(!parent||$('#'+id))return;
    const b=document.createElement('button');b.type='button';b.className='btn btn-info';b.textContent=label;b.id=id;b.onclick=handler;parent.appendChild(b);
  }
  function install(){
    ensureModal();
    const toolbar=$('#exams-table')?.closest('.card')?.parentElement?.querySelector('.search-bar');
    addButton(toolbar,'📚 المسودات المحفوظة',()=>{ensureModal();$('#andalus-exam-drafts-modal').classList.add('open');load();},'open-andalus-exam-drafts');
    const workspace=$('#modal-exam-material-workspace .modal-footer');
    addButton(workspace,'📚 المسودات المحفوظة',()=>{ensureModal();$('#andalus-exam-drafts-modal').classList.add('open');load();},'open-andalus-exam-drafts-workspace');
    const review=window.showGeneratedExamReview;
    if(typeof review==='function'&&!review.__draftWrapped){
      const wrapped=function(exam){review.apply(this,arguments);const footer=$('#modal-ai-exam-review .modal-footer');addButton(footer,'💾 حفظ كمسودة دائمة',saveCurrentDraft,'save-generated-exam-draft');};
      wrapped.__draftWrapped=true;window.showGeneratedExamReview=wrapped;
    }
    const originalSave=window.saveExam;
    if(typeof originalSave==='function'&&!originalSave.__draftWrapped){
      const wrappedSave=async function(){
        await originalSave.apply(this,arguments);
        if(pendingApprovalIds.length && typeof generatedExamPending!=='undefined' && generatedExamPending===false){
          const ids=pendingApprovalIds.slice();pendingApprovalIds=[];
          const db=client();
          const {error}=await db.from(TABLE).update({status:'approved',updated_at:new Date().toISOString()}).in('id',ids);
          if(error) toast('تم إنشاء الامتحان، لكن تعذر تحديث حالة المسودات: '+error.message,'error');
          else toast('تم إنشاء مسودة الامتحان واعتماد مصادرها.');
        }
      };
      wrappedSave.__draftWrapped=true;window.saveExam=wrappedSave;
    }
  }
  window.openAndalusExamDrafts=()=>{ensureModal();$('#andalus-exam-drafts-modal').classList.add('open');load();};
  window.saveAndalusGeneratedExamDraft=saveCurrentDraft;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
