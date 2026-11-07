/* Andalus staged AI exam generator */
(function () {
  'use strict';
  const DRAFT_KEY = 'andalus_exam_generation_draft_v2_';
  const TYPES = [
    { key: 'mcq', label: 'اختيار من متعدد', icon: '🔵' },
    { key: 'true_false', label: 'صح / خطأ', icon: '🟢' },
    { key: 'essay', label: 'مقالي', icon: '🟣' }
  ];
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }\n  function notify(message, type) { if (typeof window.showToast === 'function') window.showToast(message, type || 'success'); else alert(message); }
  function getSelectedFiles() { return [...document.querySelectorAll('#exam-material-files-list .exam-material-file-cb:checked')].map(el => el.value); }
  function getSubject() {
    const title = document.getElementById('exam-material-workspace-title')?.textContent || '';
    const fromTitle = title.replace(/^\s*📚\s*مكتبة المادة\s*:\s*/i, '').trim();
    return fromTitle || 'المادة التدريبية';
  }
  function getStageModal() {
    let modal = document.getElementById('modal-staged-exam-generation');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'modal-staged-exam-generation'; modal.className = 'modal-overlay'; modal.style.zIndex = '1200';
    modal.innerHTML = `<div class="modal" style="max-width:720px;width:94vw;max-height:90vh;overflow:auto"><div class="modal-header"><div><h3 style="margin:0">🧩 توليد الامتحان على مراحل</h3><p style="margin:5px 0 0;color:var(--muted);font-size:12px">كل عملية توليد تُحفظ كمجموعة مستقلة في بنك الأسئلة.</p></div><button class="btn btn-outline" type="button" data-staged-close>إغلاق</button></div><div class="modal-body" style="padding:20px"><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:12px;line-height:1.8"><strong>ميزة مهمة:</strong> كل مجموعة تُحفظ في قاعدة البيانات مستقلة، ولا تختلط بالمجموعات السابقة.</div><div id="staged-exam-counts" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px"></div><div id="staged-exam-status" style="margin-top:16px"></div><div style="display:flex;gap:8px;justify-content:flex-start;margin-top:18px;flex-wrap:wrap"><button class="btn btn-gold" id="staged-exam-start" type="button">🚀 توليد مجموعات جديدة للبنك</button><button class="btn btn-primary" id="staged-exam-from-bank" type="button">🧩 إنشاء امتحان من بنك الأسئلة</button></div></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('#staged-exam-counts').innerHTML = TYPES.map((t, i) => `<label style="border:1px solid var(--border);border-radius:12px;padding:14px;background:#fff;display:block"><span style="display:block;font-weight:900;color:var(--navy);font-size:13px">${t.icon} ${t.label}</span><span style="display:block;color:var(--muted);font-size:11px;margin:5px 0 9px">عدد الأسئلة المطلوبة</span><input id="staged-count-${t.key}" type="number" min="0" max="50" value="${i === 0 ? 20 : i === 1 ? 10 : 0}" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:9px;font-family:inherit;font-size:15px;font-weight:900"></label>`).join('');
    modal.querySelector('[data-staged-close]').onclick = () => { modal.style.display = 'none'; };
    modal.querySelector('#staged-exam-clear').onclick = () => { if (typeof showToast === 'function') showToast('المجموعات المحفوظة في بنك الأسئلة لا تُحذف من هذه الشاشة.'); };
    modal.querySelector('#staged-exam-start').onclick = () => runStagedGeneration(modal);\n    modal.querySelector('#staged-exam-from-bank').onclick = () => createExamFromBank(modal);
    return modal;
  }
  function openStageModal() { const modal = getStageModal(); renderDraftStatus(modal); modal.style.display = 'flex'; }
  function renderDraftStatus(modal) {
    const box = modal.querySelector('#staged-exam-status'); if (!box) return;
    box.innerHTML = '<div style="color:var(--muted);font-size:12px">كل عملية توليد جديدة ستُحفظ كمجموعة مستقلة في بنك الأسئلة. راجع المجموعات من شاشة البنك.</div>';
  }
  function saveDraft(exam, meta) {
    const key = DRAFT_KEY + String(meta.batchId || Date.now());
    localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), batchId: meta.batchId || null, subject: meta.subject, title: exam.title || `أسئلة ${meta.subject}`, questions: Array.isArray(exam.questions) ? exam.questions : [] }));
  }
  function readDraft(batchId) {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY + String(batchId)) || 'null'); } catch (_) { return null; }
  }
  function findSubjectId(subject) {
    const norm = v => String(v || '').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\\sـ]+/g,' ').trim().toLowerCase();
    const list = typeof allSubjects !== 'undefined' ? allSubjects : [];
    const wanted = norm(subject);
    const found = list.find(x => norm(x.name) === wanted) || list.find(x => norm(x.name).includes(wanted) || wanted.includes(norm(x.name)));
    return found?.id || null;
  }
  function normalizeQuestion(q, type, subject, batchId, userId) {
    const options = Array.isArray(q.options) ? q.options : [];
    return {
      generation_batch_id: batchId,
      subject_id: findSubjectId(subject),
      subject_name: subject,
      question_text: String(q.question || q.question_text || q.text || '').trim(),
      question_type: type,
      options,
      correct_answer: String(q.answer || q.correct_answer || '').trim(),
      explanation: q.explanation ? String(q.explanation) : null,
      difficulty: ({'سهل':'easy','متوسط':'medium','صعب':'hard'})[q.difficulty] || q.difficulty || 'medium',
      created_by: userId || null
    };
  }
  async function persistGenerationBatch({ db, userId, subject, type, requested, files, questions, errorMessage }) {
    const sid = findSubjectId(subject);
    const title = `${TYPES.find(x => x.key === type)?.label || type} — ${subject} — ${new Date().toLocaleString('ar-EG')}`;
    const made = await db.from('exam_question_generation_batches').insert({
      subject_id: sid, subject_name: subject, title, question_type: type,
      requested_count: requested, saved_count: 0, source_files: files,
      difficulty: 'medium', status: 'processing', created_by: userId || null
    }).select('id').single();
    if (made.error) throw new Error('تعذر إنشاء سجل مجموعة التوليد: ' + made.error.message);
    const batchId = made.data.id;
    let saved = 0;
    try {
      const rows = (questions || []).map(q => normalizeQuestion(q, type, subject, batchId, userId)).filter(q =>
        q.question_text && q.correct_answer &&
        (type !== 'mcq' || (q.options.length === 4 && q.options.includes(q.correct_answer))) &&
        (type !== 'true_false' || (q.options.length === 2 && ['صح','خطأ'].includes(q.correct_answer))) &&
        (type !== 'essay' || q.correct_answer)
      );
      if (rows.length) {
        const inserted = await db.from('exam_question_bank').insert(rows).select('id');
        if (inserted.error) throw new Error('تعذر حفظ أسئلة البنك: ' + inserted.error.message);
        saved = inserted.data?.length || 0;
      }
      const verify = await db.from('exam_question_bank').select('id', { count: 'exact', head: true }).eq('generation_batch_id', batchId);
      if (verify.error) throw new Error('تعذر التحقق من عدد الأسئلة المحفوظة: ' + verify.error.message);
      saved = verify.count || 0;
      const status = saved === requested ? 'completed' : saved > 0 ? 'partial' : 'failed';
      const updated = await db.from('exam_question_generation_batches').update({
        saved_count: saved, status, error_message: errorMessage || (saved < requested ? 'لم يكتمل العدد المطلوب.' : null),
        completed_at: new Date().toISOString()
      }).eq('id', batchId);
      if (updated.error) throw new Error('تم حفظ الأسئلة لكن تعذر تحديث حالة المجموعة: ' + updated.error.message);
      return { batchId, saved, status };
    } catch (error) {
      await db.from('exam_question_generation_batches').update({
        saved_count: saved, status: saved ? 'partial' : 'failed',
        error_message: String(error?.message || error), completed_at: new Date().toISOString()
      }).eq('id', batchId);
      throw error;
    }
  }
  async function getSessionToken() { const sessionResult = await window.sb.auth.getSession(); const session = sessionResult?.data?.session; if (session?.access_token) return session.access_token; throw new Error('انتهت جلسة الإدارة. سجّل الدخول مرة أخرى ثم أعد المحاولة.'); }
  async function requestStage({ token, files, subject, count, difficulty, type }) {
    const response = await fetch(SUPABASE_URL + '/functions/v1/generate-exam', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: files, subject, count, difficulty, questionType: type }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { const details = result?.details ? ' — ' + result.details : ''; throw new Error((result?.error || 'فشل توليد هذه المرحلة') + details); }
    if (!result?.exam?.questions?.length) throw new Error('لم تُنتج هذه المرحلة أسئلة صالحة.');
    return result;
  }
  function setStatus(modal, html) { const box = modal.querySelector('#staged-exam-status'); if (box) box.innerHTML = html; }
  async function runStagedGeneration(modal) {
    const files = getSelectedFiles();
    if (!files.length) { if (typeof showToast === 'function') showToast('اختار ملف PDF واحدًا على الأقل لتوليد أسئلة البنك', 'error'); return; }
    if (files.length > 5) { if (typeof showToast === 'function') showToast('اختار 5 ملفات PDF كحد أقصى', 'error'); return; }
    const counts = {}; let total = 0;
    for (const t of TYPES) { const value = parseInt(modal.querySelector('#staged-count-' + t.key)?.value || '0', 10); if (!Number.isInteger(value) || value < 0 || value > 100) { if (typeof showToast === 'function') showToast('كل عدد يجب أن يكون من 0 إلى 100', 'error'); return; } counts[t.key] = value; total += value; }
    if (!total) { if (typeof showToast === 'function') showToast('حدد عددًا واحدًا على الأقل من الأسئلة', 'error'); return; }
    if (total > 300) { if (typeof showToast === 'function') showToast('إجمالي التوليد في العملية الواحدة لا يتجاوز 300 سؤال. يمكنك تنفيذ مجموعات إضافية مستقلة.', 'error'); return; }
    const subject = getSubject(), db = window.sb;
    if (!db) { if (typeof showToast === 'function') showToast('اتصال قاعدة البيانات غير جاهز.', 'error'); return; }
    const startButton = modal.querySelector('#staged-exam-start'); if (startButton) { startButton.disabled = true; startButton.textContent = '⏳ جاري التوليد والحفظ...'; }
    const successful = [], failed = [], runQuestions = [];
    try {
      const token = await getSessionToken();
      const sessionResult = await db.auth.getSession();
      const userId = sessionResult?.data?.session?.user?.id || null;
      for (const t of TYPES) {
        const count = counts[t.key]; if (!count) continue;
        setStatus(modal, `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;font-size:12px">⏳ جاري توليد وحفظ <strong>${t.label}</strong> — ${count} سؤال...</div>`);
        let result = null, questions = [];
        try {
          result = await requestStage({ token, files, subject, count, difficulty: 'متوسط', type: t.key });
          questions = result.exam.questions.map(q => ({ ...q, type: q.type || t.key }));
          const persisted = await persistGenerationBatch({ db, userId, subject, type: t.key, requested: count, files, questions });
          saveDraft({ title: `أسئلة ${t.label} — ${subject}`, questions }, { subject, batchId: persisted.batchId });
          runQuestions.push(...questions);
          successful.push({ type: t.label, requested: count, generated: questions.length, saved: persisted.saved, batchId: persisted.batchId, status: persisted.status });
          setStatus(modal, `<div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:12px;font-size:12px">✅ ${t.label}: تم حفظ ${persisted.saved} سؤال في مجموعة مستقلة.</div>`);
        } catch (error) {
          failed.push({ type: t.label, error: error?.message || 'خطأ غير معروف' });
          setStatus(modal, `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;font-size:12px">❌ تعذر حفظ ${t.label}: ${String(error?.message || error)}</div>`);
        }
        await sleep(250);
      }
      const summary = successful.map(x => `✅ ${x.type}: ${x.saved}/${x.requested} — مجموعة ${x.batchId.slice(0,8)}`).join('<br>') || 'لا توجد مجموعات مكتملة';
      const errors = failed.map(x => `❌ ${x.type}: ${x.error}`).join('<br>');
      setStatus(modal, `<div style="background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:12px;font-size:12px;line-height:1.8"><strong>انتهت عملية التوليد.</strong><br>${summary}${errors ? '<br>' + errors : ''}<br><strong>تم حفظ ${successful.reduce((n,x)=>n+x.saved,0)} سؤال في مجموعات مستقلة داخل بنك الأسئلة.</strong></div>`);
      if (typeof showToast === 'function') showToast('تم حفظ كل مجموعة توليد بصورة مستقلة في بنك الأسئلة.');
    } finally { if (startButton) { startButton.disabled = false; startButton.textContent = '🚀 بدء التوليد على مراحل'; } renderDraftStatus(modal); }
  }
  async function createExamFromBank(modal) {
    const db = window.sb;
    if (!db) return notify('اتصال قاعدة البيانات غير جاهز.', 'error');
    const subject = getSubject(), subjectId = findSubjectId(subject);
    if (!subjectId) return notify('تعذر تحديد المادة الحالية. افتح مكتبة المادة الصحيحة أولًا.', 'error');
    const requested = {};
    let total = 0;
    for (const t of TYPES) {
      const n = Number.parseInt(modal.querySelector('#staged-count-' + t.key)?.value || '0', 10);
      if (!Number.isInteger(n) || n < 0) return notify('راجع أعداد الأسئلة المطلوبة.', 'error');
      requested[t.key] = n; total += n;
    }
    if (!total) return notify('حدد عدد الأسئلة المطلوب من كل نوع.', 'error');
    if (total > 100) return notify('الحد الأقصى للنموذج الواحد 100 سؤال.', 'error');
    const button = modal.querySelector('#staged-exam-from-bank');
    if (button) { button.disabled = true; button.textContent = '⏳ جاري فحص البنك والسحب العشوائي...'; }
    try {
      const { data, error } = await db.from('exam_question_bank')
        .select('id,question_text,question_type,options,correct_answer,explanation,difficulty')
        .eq('subject_id', subjectId).eq('is_active', true);
      if (error) throw error;
      const available = data || [];
      const typeMap = { mcq: 'mcq', true_false: 'true_false', essay: 'essay' };
      const shortages = [];
      const picked = [];
      for (const t of TYPES) {
        const pool = available.filter(q => q.question_type === typeMap[t.key]);
        const wanted = requested[t.key];
        if (pool.length < wanted) shortages.push(t.label + ': المطلوب ' + wanted + ' والمتاح ' + pool.length);
        else {
          for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
          picked.push(...pool.slice(0, wanted).map(q => ({
            bankQuestionId: q.id, type: q.question_type, question: q.question_text,
            options: Array.isArray(q.options) ? q.options : [],
            answer: q.correct_answer, explanation: q.explanation || '', points: 1
          })));
        }
      }
      if (shortages.length) throw new Error('عدد الأسئلة في البنك غير كافٍ:\n' + shortages.join('\n') + '\nلم يتم إنشاء الامتحان.');
      for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }
      if (typeof window.showGeneratedExamReview !== 'function') throw new Error('واجهة مراجعة الامتحان غير جاهزة. حدّث الصفحة ثم حاول مرة أخرى.');
      window.showGeneratedExamReview({ title: 'امتحان ' + subject, subject, questions: picked, source: 'question_bank' });
      modal.style.display = 'none';
      if (typeof showToast === 'function') showToast('تم سحب ' + picked.length + ' سؤالًا عشوائيًا من البنك دون تكرار.');
    } catch (error) {
      if (typeof showToast === 'function') showToast(error?.message || String(error), 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = '🧩 إنشاء امتحان من بنك الأسئلة'; }
    }
  }
  function install() { window.startAiExamGeneration = openStageModal; window.__andalusStagedExamGeneration = { open: openStageModal, readDraft, persistGenerationBatch }; console.info('Andalus staged exam generation loaded.'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
