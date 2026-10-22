/* Andalus Academy — Daily Revenue UI Fix
   Rule: only entries whose details contain "قسط" count in the daily-revenue total.
   Every entry is still kept in the daily revenue log and is synced to the student's file by the DB trigger.
*/
(function () {
  'use strict';

  function getEl(id) { return document.getElementById(id); }
  function localDate() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function isInstallment(rowOrDetails) {
    const details = typeof rowOrDetails === 'string'
      ? rowOrDetails
      : (rowOrDetails?.details || '');
    return String(details).includes('قسط');
  }
  function money(n) { return Number(n || 0).toLocaleString('ar-EG'); }

  window.saveDailyRevenue = async function saveDailyRevenueFixed() {
    const studentId = (getEl('dr-student-id')?.value || '').trim();
    const studentName = (getEl('dr-student-name')?.value || '').trim();
    const revenueDate = getEl('dr-revenue-date')?.value || localDate();
    const amount = parseFloat(getEl('dr-amount')?.value);
    const details = (getEl('dr-details')?.value || '').trim();
    const branch = getEl('dr-branch')?.value || '';

    if (!revenueDate) { showToast('اختر تاريخ الإيراد', 'error'); return; }
    if (!amount || amount <= 0) { showToast('أدخل المبلغ', 'error'); return; }
    if (!details) { showToast('اكتب نوع الإيراد — مثال: قسط أول / كورس إنجليزي / كتاب / بالطو', 'error'); return; }

    const matchedStudent = (window.allStudents || []).find(x =>
      String(x.id || '') === studentId || String(x.name || '').trim() === studentName
    );

    const record = {
      student_id: matchedStudent?.id || studentId || null,
      student_name: matchedStudent?.name || studentName || null,
      amount,
      details,
      branch,
      revenue_date: revenueDate,
      created_by: window.currentAuth?.id || null
    };

    const saveBtn = document.querySelector('[onclick="saveDailyRevenue()"]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.dataset.oldText = saveBtn.textContent; saveBtn.textContent = '⏳ جاري الحفظ...'; }

    try {
      const { data, error } = await window.sb.from('daily_revenue').insert(record).select('*').single();
      if (error) throw error;

      const installment = isInstallment(details);
      await window.logActivity('add', `تسجيل إيراد يومي: ${amount} ج.م${matchedStudent ? ' — ' + matchedStudent.name : ''} (${details})`);

      // Clear the entry fields after a confirmed database insert.
      if (getEl('dr-student-id')) getEl('dr-student-id').value = '';
      if (getEl('dr-student-name')) getEl('dr-student-name').value = '';
      if (getEl('dr-amount')) getEl('dr-amount').value = '';
      if (getEl('dr-details')) getEl('dr-details').value = '';

      showToast(installment
        ? `✅ تم حفظ الإيراد — ${money(amount)} ج قسط، واتحسب في الإجمالي وملف الطالب`
        : `✅ تم حفظ الإيراد — ${money(amount)} ج، اتسجل في ملف الطالب ولن يُخصم من إجمالي الأقساط`);

      if (typeof window.loadDailyRevenueLog === 'function') await window.loadDailyRevenueLog();
      return data;
    } catch (error) {
      console.error('Daily revenue save error:', error);
      const message = error?.message || error?.details || 'تعذر حفظ الإيراد';
      showToast('❌ لم يتم الحفظ: ' + message, 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = saveBtn.dataset.oldText || '💾 حفظ الإيراد'; }
    }
  };

  window.loadDailyRevenueLog = async function loadDailyRevenueLogFixed() {
    const dateEl = getEl('dr-filter-date');
    if (dateEl && !dateEl.value) dateEl.value = localDate();
    const dateFilter = dateEl?.value || '';
    const branchFilter = getEl('dr-filter-branch')?.value || '';

    let q = window.sb.from('daily_revenue').select('*')
      .order('revenue_date', { ascending: false, nullsFirst: false })
      .order('serial_no', { ascending: false });
    if (dateFilter) q = q.eq('revenue_date', dateFilter);
    if (branchFilter) q = q.eq('branch', branchFilter);

    const { data, error } = await q;
    const tbody = getEl('daily-revenue-table');
    if (!tbody) return;
    if (error) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="emoji">⚠️</div><h4>تعذر تحميل سجل الإيراد: ${escapeHtml(error.message || 'خطأ غير معروف')}</h4></div></td></tr>`;
      const totalEl = getEl('dr-total-label');
      if (totalEl) totalEl.textContent = '';
      return;
    }

    const rows = data || [];
    const countedTotal = rows.filter(isInstallment).reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const allTotal = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const nonCountedTotal = allTotal - countedTotal;
    const totalEl = getEl('dr-total-label');
    if (totalEl) {
      totalEl.innerHTML = `الإجمالي المحتسب: <strong>${money(countedTotal)} ج.م</strong>` +
        (nonCountedTotal ? ` <span style="font-size:11px;color:var(--muted);margin-right:10px;">غير محتسب: ${money(nonCountedTotal)} ج.م</span>` : '');
    }

    tbody.innerHTML = rows.length ? rows.map(r => {
      const revenueDate = r.revenue_date || (r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : null);
      const revenueDateText = revenueDate ? new Date(revenueDate + 'T00:00:00').toLocaleDateString('ar-EG') : '—';
      const enteredAt = r.created_at ? new Date(r.created_at).toLocaleString('ar-EG') : '—';
      const counted = isInstallment(r);
      return `<tr>
        <td class="no-print" onclick="event.stopPropagation()"><input type="checkbox" class="dr-row-cb" value="${escapeHtml(r.id)}"></td>
        <td>${escapeHtml(r.serial_no ?? '—')}</td>
        <td>${escapeHtml(r.student_id || '—')}</td>
        <td>${escapeHtml(r.student_name || '—')}</td>
        <td style="color:${counted ? '#16a34a' : '#64748b'};font-weight:700;">${money(r.amount)} ج.م</td>
        <td>${escapeHtml(r.details || '—')} <span class="badge ${counted ? 'badge-success' : 'badge-warning'}" style="margin-right:5px;">${counted ? 'يُحتسب' : 'لا يُحتسب'}</span></td>
        <td><span class="badge ${r.branch === 'كفر الدوار' ? 'badge-info' : 'badge-gold'}">${escapeHtml(r.branch || '—')}</span></td>
        <td style="font-size:11px;color:var(--muted)"><strong>${revenueDateText}</strong><br><span title="تاريخ ووقت تسجيل الإيراد في النظام">تم الإدخال: ${escapeHtml(enteredAt)}</span></td>
      </tr>`;
    }).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="emoji">💵</div><h4>لا توجد إيرادات مسجّلة</h4></div></td></tr>';
  };
})();