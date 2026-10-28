/* Andalus staged AI exam generator */
(function () {
  'use strict';
  const DRAFT_KEY = 'andalus_exam_generation_draft_v1';
  const TYPES = [
    { key: 'mcq', label: 'اختيار من متعدد', icon: '🔵' },
    { key: 'true_false', label: 'صح / خطأ', icon: '🟢' },
    { key: 'essay', label: 'مقالي', icon: '🟣' }
  ];
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
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
    modal.innerHTML = `<div class="modal" style="max-width:720px;width:94vw;max-height:90vh;overflow:auto"><div class="modal-header"><div><h3 style="margin:0">🧩 توليد الامتحان على مراحل</h3><p style="margin:5px 0 0;color:var(--muted);font-size:12px">كل نوع من الأسئلة يُولد في طلب مستقل ثم يتم تجميعه للمراجعة.</p></div><button class="btn btn-outline" type="button" data-staged-close>إغلاق</button></div><div class="modal-body" style="padding:20px"><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:12px;line-height:1.8"><strong>ميزة مهمة:</strong> لو مرحلة واحدة لم تكتمل، المراحل الناجحة تظل محفوظة كمسودة داخل الجهاز ويمكن مراجعتها وإكمالها.</div><div id="staged-exam-counts" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px"></div><div id="staged-exam-status" style="margin-top:16px"></div><div style="display:flex;gap:8px;justify-content:flex-start;margin-top:18px;flex-wrap:wrap"><button class="btn btn-gold" id="staged-exam-start" type="button">🚀 بدء التوليد على مراحل</button><button class="btn btn-outline" id="staged-exam-clear" type="button">مسح المسودة</button></div></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('#staged-exam-counts').innerHTML = TYPES.map((t, i) => `<label style="border:1px solid var(--border);border-radius:12px;padding:14px;background:#fff;display:block"><span style="display:block;font-weight:900;color:var(--navy);font-size:13px">${t.icon} ${t.label}</span><span style="display:block;color:var(--muted);font-size:11px;margin:5px 0 9px">عدد الأسئلة المطلوبة</span><input id="staged-count-${t.key}" type="number" min="0" max="50" value="${i === 0 ? 20 : i === 1 ? 10 : 0}" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:9px;font-family:inherit;font-size:15px;font-weight:900"></label>`).join('');
    modal.querySelector('[data-staged-close]').onclick = () => { modal.style.display = 'none'; };
    modal.querySelector('#staged-exam-clear').onclick = () => { localStorage.removeItem(DRAFT_KEY); renderDraftStatus(modal); if (typeof showToast === 'function') showToast('تم مسح مسودة توليد الامتحان'); };
    modal.querySelector('#staged-exam-start').onclick = () => runStagedGeneration(modal);
    return modal;
  }
  function openStageModal() { const modal = getStageModal(); renderDraftStatus(modal); modal.style.display = 'flex'; }
  function renderDraftStatus(modal) {
    const box = modal.querySelector('#staged-exam-status'); if (!box) return;
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!draft || !Array.isArray(draft.questions) || !draft.questions.length) { box.innerHTML = '<div style="color:var(--muted);font-size:12px">لا توجد مسودة محفوظة حاليًا.</div>'; return; }
      const counts = draft.questions.reduce((a, q) => { a[q.type] = (a[q.type] || 0) + 1; return a; }, {});
      box.innerHTML = `<div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px;font-size:12px"><strong>📦 مسودة موجودة:</strong> ${draft.questions.length} سؤال — اختيار: ${counts.mcq || 0}، صح/خطأ: ${counts.true_false || 0}، مقالي: ${counts.essay || 0}. يمكنك بدء توليد دفعات إضافية.</div>`;
    } catch (_) { box.innerHTML = ''; }
  }
  function saveDraft(exam, meta) { localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), subject: meta.subject, title: exam.title || `امتحان ${meta.subject}`, questions: Array.isArray(exam.questions) ? exam.questions : [] })); }
  function readDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { return null; } }
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
    if (!files.length) { if (typeof showToast === 'function') showToast('اختار ملف PDF واحدًا على الأقل لتوليد الامتحان', 'error'); return; }
    if (files.length > 5) { if (typeof showToast === 'function') showToast('اختار 5 ملفات PDF كحد أقصى', 'error'); return; }
    const counts = {}; let total = 0;
    for (const t of TYPES) { const value = parseInt(modal.querySelector('#staged-count-' + t.key)?.value || '0', 10); if (!Number.isInteger(value) || value < 0 || value > 50) { if (typeof showToast === 'function') showToast('كل عدد يجب أن يكون من 0 إلى 50', 'error'); return; } counts[t.key] = value; total += value; }
    if (!total) { if (typeof showToast === 'function') showToast('حدد عددًا واحدًا على الأقل من الأسئلة', 'error'); return; }
    if (total > 50) { if (typeof showToast === 'function') showToast('إجمالي أسئلة الامتحان يجب ألا يتجاوز 50 سؤالًا في هذه المرحلة', 'error'); return; }
    const subject = getSubject();
    const startButton = modal.querySelector('#staged-exam-start'); if (startButton) { startButton.disabled = true; startButton.textContent = '⏳ جاري التوليد...'; }
    let draft = readDraft(); if (!draft || draft.subject !== subject) draft = { subject, title: `امتحان ${subject}`, questions: [] };
    const successful = [], failed = [];
    try {
      const token = await getSessionToken();
      for (const t of TYPES) {
        const count = counts[t.key]; if (!count) continue;
        setStatus(modal, `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;font-size:12px">⏳ جاري توليد <strong>${t.label}</strong> — ${count} سؤال...</div>`);
        try {
          const result = await requestStage({ token, files, subject, count, difficulty: 'متوسط', type: t.key });
          const questions = result.exam.questions.map(q => ({ ...q, type: q.type || t.key })); draft.questions.push(...questions); saveDraft(draft, { subject }); successful.push({ type: t.label, requested: count, generated: questions.length });
          setStatus(modal, `<div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:12px;font-size:12px">✅ اكتملت مرحلة <strong>${t.label}</strong>: ${questions.length} سؤال.</div>`);
        } catch (error) { failed.push({ type: t.label, error: error?.message || 'خطأ غير معروف' }); setStatus(modal, `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;font-size:12px">❌ تعذر إكمال <strong>${t.label}</strong>، لكن المراحل الناجحة لن تُفقد.</div>`); }
        await sleep(250);
      }
      saveDraft(draft, { subject });
      const exam = { title: draft.title, subject, questions: draft.questions };
      if (exam.questions.length && typeof showGeneratedExamReview === 'function') showGeneratedExamReview(exam);
      const summary = successful.map(x => `✅ ${x.type}: ${x.generated}/${x.requested}`).join('<br>') || 'لا توجد مراحل مكتملة';
      const errors = failed.map(x => `❌ ${x.type}: ${x.error}`).join('<br>');
      setStatus(modal, `<div style="background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:12px;font-size:12px;line-height:1.8"><strong>تم الانتهاء من التوليد المرحلي.</strong><br>${summary}${errors ? '<br>' + errors : ''}<br><strong>الإجمالي الموجود للمراجعة: ${draft.questions.length} سؤال.</strong></div>`);
      if (typeof showToast === 'function') showToast('تم تجميع الأسئلة الناجحة وعرضها للمراجعة');
    } finally { if (startButton) { startButton.disabled = false; startButton.textContent = '🚀 بدء التوليد على مراحل'; } renderDraftStatus(modal); }
  }
  function install() { window.startAiExamGeneration = openStageModal; window.__andalusStagedExamGeneration = { open: openStageModal, readDraft }; console.info('Andalus staged exam generation loaded.'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
