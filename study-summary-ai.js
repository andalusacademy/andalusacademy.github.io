(() => {
  'use strict';

  const esc = (v) => (typeof window.escapeHtml === 'function' ? window.escapeHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c])));

  function injectStudySummaryAiPanel() {
    const page = document.getElementById('page-study-summaries');
    if (!page || document.getElementById('ss-ai-generator-card')) return;
    const cards = page.querySelectorAll('.card');
    const anchor = cards[0] || page.firstElementChild;
    if (!anchor) return;
    const card = document.createElement('div');
    card.id = 'ss-ai-generator-card';
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header">
        <h3>🤖 توليد بنك أسئلة من PDF</h3>
        <span style="font-size:12px;color:var(--muted)">ارفع ملف المادة، وسيتم إنشاء 30 سؤالًا للمراجعة قبل الاعتماد</span>
      </div>
      <div style="padding:18px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
          <div class="form-group"><label>اختر الملخص</label><select id="ss-ai-summary" class="search-input" style="width:100%"><option value="">جاري تحميل الملخصات...</option></select></div>
          <div class="form-group"><label>عدد الأسئلة</label><input id="ss-ai-count" class="search-input" type="number" min="5" max="50" value="30" style="width:100%"></div>
          <div class="form-group"><label>ملف المادة PDF</label><input id="ss-ai-pdf" class="search-input" type="file" accept="application/pdf" style="width:100%"></div>
        </div>
        <div id="ss-ai-file-info" style="margin:8px 0;color:var(--muted);font-size:12px"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-gold" id="ss-ai-generate-btn" type="button">✨ رفع الملف وإنشاء الأسئلة</button>
          <span style="font-size:11px;color:var(--muted)">الحد الأقصى 15 ميجابايت. لن تُنشر الأسئلة تلقائيًا.</span>
        </div>
        <div id="ss-ai-status" style="margin-top:12px"></div>
      </div>`;
    anchor.parentNode.insertBefore(card, anchor);

    document.getElementById('ss-ai-pdf').addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      document.getElementById('ss-ai-file-info').textContent = f ? `📄 ${f.name} — ${(f.size / 1024 / 1024).toFixed(2)} MB` : '';
    });
    document.getElementById('ss-ai-generate-btn').addEventListener('click', generateStudySummaryQuestionsFromPdf);
  }

  async function populateSummarySelect() {
    const select = document.getElementById('ss-ai-summary');
    if (!select || typeof sb === 'undefined') return;
    const { data, error } = await sb.from('study_summaries').select('id,title,subject_name').order('created_at', { ascending: false });
    if (error) { select.innerHTML = '<option value="">تعذر تحميل الملخصات</option>'; return; }
    select.innerHTML = '<option value="">اختر الملخص الذي ستُبنى أسئلته</option>' + (data || []).map(s => `<option value="${esc(s.id)}">${esc(s.title)} — ${esc(s.subject_name || '')}</option>`).join('');
  }

  async function generateStudySummaryQuestionsFromPdf() {
    const select = document.getElementById('ss-ai-summary');
    const input = document.getElementById('ss-ai-pdf');
    const countInput = document.getElementById('ss-ai-count');
    const status = document.getElementById('ss-ai-status');
    const btn = document.getElementById('ss-ai-generate-btn');
    const summaryId = select?.value;
    const file = input?.files?.[0];
    const count = Math.min(50, Math.max(5, Number(countInput?.value || 30)));
    if (!summaryId) { if (typeof showToast === 'function') showToast('اختر الملخص أولًا','error'); return; }
    if (!file || file.type !== 'application/pdf') { if (typeof showToast === 'function') showToast('اختر ملف PDF للمادة','error'); return; }
    if (file.size > 15 * 1024 * 1024) { if (typeof showToast === 'function') showToast('حجم ملف PDF يجب ألا يتجاوز 15 ميجابايت','error'); return; }

    btn.disabled = true;
    status.innerHTML = '<div style="background:#eff6ff;color:#1d4ed8;padding:12px;border-radius:10px;font-size:13px">⏳ جاري رفع الملف ثم تحليل المادة وإنشاء الأسئلة...</div>';
    try {
      const { data: auth } = await sb.auth.getSession();
      if (!auth?.session) throw new Error('جلسة المدير غير صالحة. سجّل الدخول مرة أخرى.');
      const safeName = file.name.replace(/[^\u0600-\u06FFa-zA-Z0-9._-]+/g, '_').slice(-100);
      const path = `summary-${summaryId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await sb.storage.from('study-summary-pdfs').upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;
      const summary = (await sb.from('study_summaries').select('subject_name,title').eq('id', summaryId).single()).data;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-study-summary`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.session.access_token}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ summary_id: summaryId, pdf_path: path, subject: summary?.subject_name || summary?.title || 'المادة التدريبية', count })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'تعذر إنشاء الأسئلة.');
      status.innerHTML = `<div style="background:#ecfdf5;color:#166534;padding:12px;border-radius:10px;font-size:13px">✅ تم إنشاء ${result.generatedCount || count} سؤالًا. راجع الأسئلة في جدول الإدارة قبل اعتمادها.</div>`;
      if (typeof loadStudySummaryAdmin === 'function') await loadStudySummaryAdmin();
      input.value = '';
      document.getElementById('ss-ai-file-info').textContent = '';
    } catch (e) {
      status.innerHTML = `<div style="background:#fef2f2;color:#991b1b;padding:12px;border-radius:10px;font-size:13px">❌ ${esc(e?.message || e)}</div>`;
      if (typeof showToast === 'function') showToast(e?.message || 'تعذر إنشاء الأسئلة','error');
    } finally { btn.disabled = false; }
  }

  function showAiOptionsInQuestionTable() {
    const table = document.getElementById('ss-questions-list');
    if (!table || table.dataset.aiEnhanced === '1') return;
    table.dataset.aiEnhanced = '1';
  }

  const oldLoad = window.loadStudySummaryAdmin;
  if (typeof oldLoad === 'function') {
    window.loadStudySummaryAdmin = async function(...args) {
      const result = await oldLoad.apply(this, args);
      injectStudySummaryAiPanel();
      await populateSummarySelect();
      showAiOptionsInQuestionTable();
      return result;
    };
  }

  const oldShowPage = window.showPage;
  if (typeof oldShowPage === 'function') {
    window.showPage = function(page, ...args) {
      const result = oldShowPage.call(this, page, ...args);
      if (page === 'study-summaries') setTimeout(() => { injectStudySummaryAiPanel(); populateSummarySelect(); }, 0);
      return result;
    };
  }

  setTimeout(() => { if (document.getElementById('page-study-summaries')) { injectStudySummaryAiPanel(); populateSummarySelect(); } }, 500);
})();
