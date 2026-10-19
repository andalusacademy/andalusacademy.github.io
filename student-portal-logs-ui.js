/* Andalus Academy — Student Portal Logs + menu cleanup */
(() => {
  'use strict';

  const AI_RE = /andalus[-_ ]?ai|أندلس\s*ai|الاندلس\s*ai|الأندلس\s*ai/i;
  const COMP_LOG_RE = /سجل\s*أعمال\s*المسابقات|أعمال\s*المسابقات/i;
  let observerStarted = false;

  function textOf(el) {
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function removeAndalusAI() {
    document.querySelectorAll('a[href],iframe[src],script[src],*[id],*[class]').forEach(el => {
      const id = typeof el.id === 'string' ? el.id : '';
      const cls = typeof el.className === 'string' ? el.className : '';
      const href = el.getAttribute?.('href') || '';
      const src = el.getAttribute?.('src') || '';
      const marker = `${id} ${cls} ${href} ${src}`;
      if (/andalus[-_]?ai/i.test(marker) || /ai[-_]?robot/i.test(marker)) {
        if (!/exam|اختبار|امتحان/i.test(marker)) el.remove();
      }
    });

    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length > 4) return;
      const t = textOf(el);
      if (AI_RE.test(t) && t.length < 120 && !/امتحان|اختبار|توليد أسئلة/i.test(t)) {
        const clickable = el.closest('.nav-item,.nav-card,a,button') || el;
        if (clickable && clickable !== document.body) clickable.remove();
      }
    });
  }

  function removeOldCompetitionLog() {
    document.querySelectorAll('.nav-item,.nav-card,a,button').forEach(el => {
      const t = textOf(el);
      if (COMP_LOG_RE.test(t)) el.remove();
    });
  }

  function ensureLogsNavItem() {
    const sidebar = document.querySelector('.sidebar-nav');
    if (!sidebar || sidebar.querySelector('[data-student-portal-logs-nav]')) return;

    const item = document.createElement('div');
    item.className = 'nav-item';
    item.setAttribute('data-student-portal-logs-nav', '1');
    item.innerHTML = '<span class="nav-icon">🛡️</span><span>تسجيلات بوابة الطالب</span>';
    item.title = 'تقرير مستقل لتسجيلات بوابة الطالب والتحقق من الهوية';
    item.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(x => x.classList.remove('active'));
      item.classList.add('active');
      openStudentPortalLogsPage();
    });

    const target = Array.from(sidebar.querySelectorAll('.nav-item')).find(x => /طلب|المسؤولين/.test(textOf(x)));
    if (target) target.insertAdjacentElement('afterend', item);
    else sidebar.appendChild(item);
  }

  function friendlyType(type) {
    return ({
      student_portal: 'بوابة الطالب',
      public_competition: 'المسابقة',
      weekly_quiz: 'المسابقة الأسبوعية',
      exam_portal: 'الامتحانات الإلكترونية'
    })[type] || type || 'بوابة الطالب';
  }

  function friendlyOutcome(row) {
    if (row.outcome === 'success') return '<span style="color:#15803d;font-weight:900;">نجاح</span>';
    return '<span style="color:#b91c1c;font-weight:900;">فشل</span>';
  }

  function friendlyReason(reason) {
    return ({
      face_match: 'مطابقة الوجه',
      face_mismatch: 'الوجه غير مطابق',
      phone_mismatch: 'الهاتف غير مطابق',
      face_not_enrolled: 'لا توجد بصمة مسجلة',
      face_descriptor_invalid: 'البصمة الحالية غير صالحة',
      reference_descriptor_invalid: 'البصمة المرجعية غير صالحة'
    })[reason] || reason || '—';
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(value));
    } catch (_) { return value || '—'; }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function renderRows(rows) {
    const tbody = document.getElementById('student-portal-logs-tbody');
    const count = document.getElementById('student-portal-logs-count');
    if (!tbody) return;
    const q = (document.getElementById('student-portal-logs-search')?.value || '').trim().toLowerCase();
    const outcome = document.getElementById('student-portal-logs-outcome')?.value || '';
    const filtered = rows.filter(r => {
      const hay = `${r.student_name||''} ${r.student_id||''} ${r.enrollment_number||''} ${r.phone||''} ${r.competition_type||''} ${r.reason||''}`.toLowerCase();
      return (!q || hay.includes(q)) && (!outcome || r.outcome === outcome);
    });
    if (count) count.textContent = `إجمالي السجلات المعروضة: ${filtered.length}`;
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--muted);">لا توجد تسجيلات مطابقة.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(r.student_name || '—')}</strong><br><small style="color:var(--muted);">ID: ${escapeHtml(r.student_id || '—')}</small></td>
        <td>${escapeHtml(r.enrollment_number || '—')}</td>
        <td>${escapeHtml(r.phone || '—')}</td>
        <td>${escapeHtml(friendlyType(r.competition_type))}</td>
        <td>${friendlyOutcome(r)}</td>
        <td>${escapeHtml(friendlyReason(r.reason))}</td>
        <td>${r.distance == null ? '—' : Number(r.distance).toFixed(4)}</td>
        <td>${escapeHtml(formatDate(r.created_at))}</td>
      </tr>`).join('');
  }

  async function loadStudentPortalLogs() {
    const status = document.getElementById('student-portal-logs-status');
    if (status) status.textContent = 'جاري تحميل السجل...';
    try {
      const { data, error } = await sb.from('student_portal_access_logs')
        .select('id,student_id,enrollment_number,student_name,phone,competition_type,competition_id,event_type,outcome,reason,distance,threshold,model_version,provider,created_at')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      window.__studentPortalLogsRows = data || [];
      renderRows(window.__studentPortalLogsRows);
      if (status) status.textContent = `تم تحميل ${window.__studentPortalLogsRows.length} سجل.`;
    } catch (e) {
      if (status) status.textContent = 'تعذر تحميل تسجيلات بوابة الطالب.';
      const tbody = document.getElementById('student-portal-logs-tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:#b91c1c;">${escapeHtml(e?.message || 'خطأ في تحميل السجل')}</td></tr>`;
    }
  }

  window.openStudentPortalLogsPage = function () {
    document.getElementById('student-portal-logs-page')?.remove();
    const page = document.createElement('div');
    page.id = 'student-portal-logs-page';
    page.style.cssText = 'position:fixed;inset:64px 0 0 0;z-index:9998;background:var(--bg);overflow:auto;padding:24px;';
    page.innerHTML = `
      <div style="max-width:1500px;margin:0 auto;">
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header">
            <div><h3 style="font-size:18px;">🛡️ تسجيلات بوابة الطالب</h3><div style="font-size:11px;color:var(--muted);margin-top:4px;">سجل مستقل للتحقق من الهوية والدخول عبر بوابة الطالب والامتحانات والمسابقات.</div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-gold" onclick="window.print()">🖨️ طباعة</button>
              <button class="btn btn-secondary" onclick="document.getElementById('student-portal-logs-page')?.remove();document.querySelector('[data-student-portal-logs-nav]')?.classList.remove('active');">رجوع</button>
            </div>
          </div>
          <div style="padding:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <input id="student-portal-logs-search" class="search-input" placeholder="بحث بالاسم أو رقم القيد أو الهاتف..." style="flex:1;min-width:240px;">
            <select id="student-portal-logs-outcome" class="search-input"><option value="">كل النتائج</option><option value="success">نجاح</option><option value="failure">فشل</option></select>
            <button class="btn btn-outline" id="student-portal-logs-refresh">🔄 تحديث</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>سجل التحقق</h3><span id="student-portal-logs-count" style="font-size:12px;color:var(--muted);"></span></div>
          <div id="student-portal-logs-status" style="padding:8px 18px;font-size:11px;color:var(--muted);"></div>
          <div style="overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:1050px;">
              <thead><tr style="background:#f8fafc;">
                <th style="padding:10px;">#</th><th style="padding:10px;">الطالب</th><th style="padding:10px;">رقم القيد</th><th style="padding:10px;">الهاتف</th><th style="padding:10px;">البوابة</th><th style="padding:10px;">النتيجة</th><th style="padding:10px;">السبب</th><th style="padding:10px;">المسافة</th><th style="padding:10px;">التاريخ</th>
              </tr></thead>
              <tbody id="student-portal-logs-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>`;
    document.body.appendChild(page);
    document.getElementById('student-portal-logs-search')?.addEventListener('input', () => renderRows(window.__studentPortalLogsRows || []));
    document.getElementById('student-portal-logs-outcome')?.addEventListener('change', () => renderRows(window.__studentPortalLogsRows || []));
    document.getElementById('student-portal-logs-refresh')?.addEventListener('click', loadStudentPortalLogs);
    loadStudentPortalLogs();
  };

  function cleanup() {
    removeAndalusAI();
    removeOldCompetitionLog();
    // Records now live in the unified main-dashboard icon, not in a side-nav overlay.
    document.querySelectorAll('[data-student-portal-logs-nav]').forEach(el => el.remove());
    document.getElementById('student-portal-logs-page')?.remove();
  }

  function boot() {
    cleanup();
    if (observerStarted) return;
    observerStarted = true;
    const mo = new MutationObserver(() => {
      window.clearTimeout(window.__andalusPortalUiTimer);
      window.__andalusPortalUiTimer = window.setTimeout(cleanup, 80);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
