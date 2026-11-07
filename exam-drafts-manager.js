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
    modal.innerHTML = '<div class="modal" style="max-width:980px;width:96vw;max-height:92vh;overflow:auto"><div class="modal-header"><div><h3 style="margin:0">📚 المسودات المحفوظة للامتحانات</h3><small style="color:var(--muted)">كل مسودة مستقلة — اختر مسودة واحدة فقط</small></div><button class="btn btn-outline" type="button" id="aed-close">إغلاق</button></div><div class="modal-body"><div id="aed-status" style="margin-bottom:12px"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn btn-outline btn-sm" id="aed-refresh">↻ تحديث</button><button class="btn btn-warning btn-sm" id="aed-restore-local">📥 استعادة المسودة المحلية</button><button class="btn btn-success btn-sm" id="aed-approve">اعتماد المحدد</button><button class="btn btn-gold btn-sm" id="aed-create">🧩 إنشاء امتحان من المحدد</button><button class="btn btn-outline btn-sm" id="aed-clear">إلغاء التحديد</button></div><div id="aed-list"></div><div id="aed-preview" style="margin-top:14px"></div></div></div>';
    document.body.appendChild(modal);
    $('#aed-close',modal).onclick = () => modal.classList.remove('open');
    $('#aed-refresh',modal).onclick = load;
    $('#aed-restore-local',modal).onclick = restoreLocalDraft;
    $('#aed-clear',modal).onclick = () => { selected.clear(); render(); };
    $('#aed-approve',modal).onclick = approveSelected;
    $('#aed-create',modal).onclick = createFromSelected;
    $('#aed-list',modal).addEventListener('change', e => {
      const cb = e.target.closest('[data-draft-id]');
      if (!cb) return;
      if (cb.checked) { selected.clear(); selected.add(cb.dataset.draftId); } else selected.delete(cb.dataset.draftId);
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
    $('#aed-preview').innerHTML = '<div class="card" style="padding:14px"><h4>' + esc(d.title) + '</h4><p>' + esc(d.subject_name || '') + ' — ' + (d.questions || []).length + ' سؤال</p><p>اختيار من متعدد: ' + n.mcq + ' | صح/خطأ: ' + n.true_false + ' | مقالي: ' + n.essay + '</p><div style="max-height:340px;overflow:auto">' + (d.questions || []).map((q,i) => { const opts=Array.isArray(q.options)?q.options:(q.options&&typeof q.options==='object'?['a','b','c','d'].map(k=>q.options[k]||q.options[k.toUpperCase()]).filter(Boolean):['a','b','c','d'].map(k=>q['option_'+k]).filter(Boolean)); const typ=String(q.type||q.question_type||'mcq').toLowerCase(); const label=typ.includes('true')||typ.includes('صح')?'صح / غلط':typ.includes('essay')||typ.includes('مقالي')?'مقالي':'اختيار من متعدد'; return '<article style="padding:10px;border:1px solid var(--border);border-radius:9px;margin:7px 0"><strong>سؤال ' + (i+1) + ' — ' + label + '</strong><div style="white-space:pre-wrap;margin:7px 0">' + esc(q.question || q.question_text || q.text || '') + '</div>' + (opts.length?'<div style="margin:6px 0">'+opts.map((o,j)=>'<div style="padding:4px 8px">('+String.fromCharCode(65+j)+') '+esc(o)+'</div>').join('')+'</div>':'') + '<small>الإجابة الصحيحة: ' + esc(q.answer || q.correct_answer || '—') + '</small></article>'; }).join('') + '</div></div>';
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

  function findQuestionArrays(root, out, seen, depth){
    if (!root || depth > 9 || typeof root !== 'object' || seen.has(root)) return;
    seen.add(root);
    if (Array.isArray(root)) {
      const valid = root.filter(q => q && typeof q === 'object' && !Array.isArray(q) &&
        (typeof q.question === 'string' || typeof q.question_text === 'string' || typeof q.text === 'string'));
      if (valid.length >= 20 && valid.length / Math.max(root.length,1) >= 0.8) out.push(valid);
      root.forEach(v => findQuestionArrays(v,out,seen,depth+1));
      return;
    }
    Object.keys(root).forEach(k => findQuestionArrays(root[k],out,seen,depth+1));
  }
  async function restoreLocalDraft(){
    const btn=$('#aed-restore-local');
    if(btn) { btn.disabled=true; btn.textContent='جاري البحث عن المسودة المحلية...'; }
    try {
      const candidates=[];
      const stores=[window.localStorage,window.sessionStorage];
      stores.forEach(store=>{
        try {
          for(let i=0;i<store.length;i++){
            const key=store.key(i), raw=store.getItem(key);
            if(!raw || raw.length<1000) continue;
            try {
              const parsed=JSON.parse(raw), arrays=[];
              findQuestionArrays(parsed,arrays,new WeakSet(),0);
              arrays.forEach(questions=>candidates.push({key,questions,raw,parsed}));
            } catch(_){}
          }
        } catch(_){}
      });
      if(!candidates.length){
        toast('لم أعثر على قائمة أسئلة محفوظة في التخزين المحلي لهذا المتصفح. لم يتم حذف أو تغيير أي بيانات.','error');
        return;
      }
      candidates.sort((a,b)=>b.questions.length-a.questions.length);
      const best=candidates[0];
      if(best.questions.length<20) {
        toast('تم العثور على بيانات، لكنها لا تبدو مسودة أسئلة مكتملة. لم يتم استيرادها.','error');
        return;
      }
      const rawText=best.raw;
      const subjectMatch=rawText.match(/تمريض\s*الباطنة\s*والطوارئ|تمريض الباطنه والطوارئ/i);
      const subject=subjectMatch ? 'تمريض الباطنة والطوارئ' :
        (typeof activeExamMaterialName!=='undefined' && activeExamMaterialName) || 'تمريض الباطنة والطوارئ';
      const sid=subjectId(subject);
      if(!sid){
        toast('وجدت '+best.questions.length+' سؤالًا، لكن المادة غير موجودة في قائمة المواد. لم يتم النقل.','error');
        return;
      }
      const db=client(); if(!db) { toast('تعذر الاتصال بقاعدة البيانات.','error'); return; }
      const n=counts(best.questions);
      const row={title:'مسودة امتحان — '+subject,subject_id:sid,subject_name:subject,
        questions:best.questions,source_files:[],question_counts:n,status:'draft'};
      if(typeof currentAuth!=='undefined' && currentAuth && currentAuth.id) row.created_by=currentAuth.id;
      const {data,error}=await db.from(TABLE).insert(row).select('id,title,subject_name,questions,status').single();
      if(error){ toast('فشل نقل المسودة: '+error.message+' — النسخة المحلية ما زالت محفوظة.','error'); return; }
      const verify=await db.from(TABLE).select('id,title,subject_name,questions,status').eq('id',data.id).single();
      if(verify.error || !verify.data || !Array.isArray(verify.data.questions) || verify.data.questions.length!==best.questions.length){
        toast('تمت محاولة النقل لكن تعذر تأكيد اكتمال الأسئلة عند إعادة القراءة. احتفظنا بالنسخة المحلية. راجع المسودات قبل أي متابعة.','error');
        return;
      }
      toast('تم نقل '+verify.data.questions.length+' سؤالًا إلى المسودات المحفوظة والتحقق منها. النسخة المحلية لم تُحذف.');
      await load();
    } finally {
      if(btn) { btn.disabled=false; btn.textContent='📥 استعادة المسودة المحلية'; }
    }
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
    if(!chosen.length) return toast('حدد مسودة واحدة فقط.', 'error');
    if(chosen.length!==1) return toast('لا يمكن تجميع مسودات متعددة. اختر مسودة واحدة فقط.', 'error');
    const questions=Array.isArray(chosen[0].questions)?chosen[0].questions:[];
    if(!questions.length) return toast('المسودات المحددة لا تحتوي على أسئلة.', 'error');
    const subjectName=chosen[0].subject_name || '';
    const exam={title:chosen[0].title || 'امتحان '+subjectName,subject:subjectName,questions};
    if(typeof window.showGeneratedExamReview!=='function') return toast('واجهة مراجعة الأسئلة غير جاهزة. حدّث الصفحة ثم حاول مرة أخرى.', 'error');
    window.showGeneratedExamReview(exam);
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
