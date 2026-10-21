(() => {
  'use strict';
  const esc = (v) => (typeof window.escapeHtml === 'function' ? window.escapeHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c])));
  function injectStudySummaryAiPanel() {
    const page = document.getElementById('page-study-summaries');
    if (!page || document.getElementById('ss-ai-generator-card')) return;
    const cards = page.querySelectorAll('.card'); const anchor = cards[0] || page.firstElementChild; if (!anchor) return;
    const card = document.createElement('div'); card.id = 'ss-ai-generator-card'; card.className = 'card';
    card.innerHTML = `<div class="card-header"><h3>🤖 توليد بنك أسئلة من PDF</h3><span style="font-size:12px;color:var(--muted)">ارفع ملف المادة، وسيتم إنشاء 30 سؤالًا للمراجعة قبل الاعتماد</span></div><div style="padding:18px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px"><div class="form-group"><label>اختر الملخص</label><select id="ss-ai-summary" class="search-input" style="width:100%"><option value="">جاري تحميل الملخصات...</option></select></div><div class="form-group"><label>عدد الأسئلة</label><input id="ss-ai-count" class="search-input" type="number" min="5" max="50" value="30" style="width:100%"></div><div class="form-group"><label>ملف المادة PDF</label><input id="ss-ai-pdf" class="search-input" type="file" accept="application/pdf" style="width:100%"></div></div><div id="ss-ai-file-info" style="margin:8px 0;color:var(--muted);font-size:12px"></div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn btn-gold" id="ss-ai-generate-btn" type="button">✨ رفع الملف وإنشاء الأسئلة</button><span style="font-size:11px;color:var(--muted)">الحد الأقصى 15 ميجابايت. لن تُنشر الأسئلة تلقائيًا.</span></div><div id="ss-ai-status" style="margin-top:12px"></div></div>`;
    anchor.parentNode.insertBefore(card, anchor);
    document.getElementById('ss-ai-pdf').addEventListener('change', e => { const f=e.target.files?.[0]; document.getElementById('ss-ai-file-info').textContent=f?`📄 ${f.name} — ${(f.size/1024/1024).toFixed(2)} MB`:''; });
    document.getElementById('ss-ai-generate-btn').addEventListener('click', generateStudySummaryQuestionsFromPdf);
  }
  async function populateSummarySelect() {
    const select=document.getElementById('ss-ai-summary'); if(!select||typeof sb==='undefined') return;
    const {data,error}=await sb.from('study_summaries').select('id,title,subject_name').order('created_at',{ascending:false});
    if(error){select.innerHTML='<option value="">تعذر تحميل الملخصات</option>';return;}
    select.innerHTML='<option value="">اختر الملخص الذي ستُبنى أسئلته</option>'+(data||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.title)} — ${esc(s.subject_name||'')}</option>`).join('');
  }
  async function generateStudySummaryQuestionsFromPdf() {
    const select=document.getElementById('ss-ai-summary'),input=document.getElementById('ss-ai-pdf'),countInput=document.getElementById('ss-ai-count'),status=document.getElementById('ss-ai-status'),btn=document.getElementById('ss-ai-generate-btn');
    const summaryId=select?.value,file=input?.files?.[0],count=Math.min(50,Math.max(5,Number(countInput?.value||30)));
    if(!summaryId){if(typeof showToast==='function')showToast('اختر الملخص أولًا','error');return;} if(!file||file.type!=='application/pdf'){if(typeof showToast==='function')showToast('اختر ملف PDF للمادة','error');return;} if(file.size>15*1024*1024){if(typeof showToast==='function')showToast('حجم ملف PDF يجب ألا يتجاوز 15 ميجابايت','error');return;}
    btn.disabled=true; status.innerHTML='<div style="background:#eff6ff;color:#1d4ed8;padding:12px;border-radius:10px;font-size:13px">⏳ جاري رفع الملف ثم تحليل المادة وإنشاء الأسئلة...</div>';
    try {
      const {data:auth}=await sb.auth.getSession(); if(!auth?.session)throw new Error('جلسة المدير غير صالحة. سجّل الدخول مرة أخرى.');
      const safeName=file.name.replace(/[^\u0600-\u06FFa-zA-Z0-9._-]+/g,'_').slice(-100),path=`summary-${summaryId}/${Date.now()}-${safeName}`;
      const {error:uploadError}=await sb.storage.from('study-summary-pdfs').upload(path,file,{contentType:'application/pdf',upsert:false}); if(uploadError)throw uploadError;
      const summaryResult=await sb.from('study_summaries').select('subject_name,title').eq('id',summaryId).single(); if(summaryResult.error)throw summaryResult.error;
      const response=await fetch(`${SUPABASE_URL}/functions/v1/generate-study-summary`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.session.access_token}`,apikey:SUPABASE_KEY},body:JSON.stringify({summary_id:summaryId,pdf_path:path,subject:summaryResult.data?.subject_name||summaryResult.data?.title||'المادة التدريبية',count})});
      const result=await response.json().catch(()=>({})); if(!response.ok||!result.success)throw new Error(result.error||'تعذر إنشاء الأسئلة.');
      status.innerHTML=`<div style="background:#ecfdf5;color:#166534;padding:12px;border-radius:10px;font-size:13px">✅ تم إنشاء ${result.generatedCount||count} سؤالًا. راجع الأسئلة في جدول الإدارة قبل اعتمادها.</div>`;
      if(typeof loadStudySummaryAdmin==='function')await loadStudySummaryAdmin(); input.value=''; document.getElementById('ss-ai-file-info').textContent='';
    }catch(e){status.innerHTML=`<div style="background:#fef2f2;color:#991b1b;padding:12px;border-radius:10px;font-size:13px">❌ ${esc(e?.message||e)}</div>`;if(typeof showToast==='function')showToast(e?.message||'تعذر إنشاء الأسئلة','error');}finally{btn.disabled=false;}
  }
  function injectApprovedBankPanel(){
    const page=document.getElementById('page-study-summaries');
    if(!page||document.getElementById('ss-approved-bank-card'))return;
    const card=document.createElement('div');card.id='ss-approved-bank-card';card.className='card';
    card.innerHTML='<div class="card-header"><h3>🎯 إنشاء امتحان من بنك الأسئلة المعتمد</h3><span style="font-size:12px;color:var(--muted)">يسحب أسئلة معتمدة فقط، دون إعادة توليدها بالذكاء الاصطناعي</span></div><div style="padding:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px"><div class="form-group"><label>ملخص / بنك المادة</label><select id="ss-bank-summary" class="search-input" style="width:100%"><option value="">اختر الملخص</option></select></div><div class="form-group"><label>عدد أسئلة الامتحان</label><input id="ss-bank-count" type="number" min="1" max="100" value="20" class="search-input" style="width:100%"></div><div style="display:flex;align-items:end"><button id="ss-bank-create" class="btn btn-gold" type="button">إنشاء امتحان من البنك</button></div><div id="ss-bank-status" style="grid-column:1/-1;font-size:13px"></div></div>';
    const ai=document.getElementById('ss-ai-generator-card'); if(ai)ai.insertAdjacentElement('afterend',card);else page.prepend(card);
    document.getElementById('ss-bank-create').addEventListener('click',createExamFromApprovedSummaryBank);
  }
  async function populateBankSummarySelect(){
    const select=document.getElementById('ss-bank-summary');if(!select||typeof sb==='undefined')return;
    const {data,error}=await sb.from('study_summaries').select('id,title,subject_name').order('created_at',{ascending:false});
    if(error){select.innerHTML='<option value="">تعذر تحميل الملخصات</option>';return;}
    select.innerHTML='<option value="">اختر الملخص</option>'+(data||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+' — '+esc(x.subject_name||'')+'</option>').join('');
  }
  async function createExamFromApprovedSummaryBank(){
    const select=document.getElementById('ss-bank-summary'),countEl=document.getElementById('ss-bank-count'),status=document.getElementById('ss-bank-status'),btn=document.getElementById('ss-bank-create');
    const id=select?.value,count=Math.max(1,Math.min(100,Number(countEl?.value||20)));
    if(!id){status.textContent='اختر الملخص أولًا.';return;}
    btn.disabled=true;status.textContent='جاري جلب الأسئلة المعتمدة...';
    try{
      const {data,error}=await sb.from('study_summary_questions').select('*').eq('summary_id',id).eq('is_approved',true);
      if(error)throw error;
      if(!data?.length)throw new Error('لا توجد أسئلة معتمدة في هذا البنك. راجع الأسئلة واضغط اعتماد أولًا.');
      if(count>data.length)throw new Error('عدد الأسئلة المطلوب ('+count+') أكبر من عدد الأسئلة المعتمدة ('+data.length+').');
      const summary=(await sb.from('study_summaries').select('title,subject_name').eq('id',id).single());
      if(summary.error)throw summary.error;
      const shuffled=[...data].sort(()=>Math.random()-.5).slice(0,count);
      const questions=shuffled.map(q=>{
        let options=Array.isArray(q.options)?q.options:[];
        if(!options.length&&q.options&&typeof q.options==='object')options=Object.values(q.options);
        const rawAnswer=String(q.answer_text||'').trim();
        let answer=rawAnswer;
        if(options.length){
          const normalized=v=>String(v??'').trim().toLowerCase().replace(/[أإآ]/g,'ا');
          const idx=options.findIndex(o=>normalized(o)===normalized(rawAnswer));
          if(idx>=0)answer=String.fromCharCode(97+idx);
        }
        const type=String(q.question_type||'').toLowerCase().includes('true')||String(q.question_type||'').includes('صح')?'true_false':'multiple_choice';
        return {question:q.question_text,options,type,answer,explanation:q.explanation||'',points:1};
      });
      const exam={title:'امتحان '+(summary.data.subject_name||summary.data.title),subject:summary.data.subject_name||summary.data.title,questions};
      if(typeof window.showGeneratedExamReview!=='function')throw new Error('واجهة مراجعة الامتحان غير متاحة. حدّث الصفحة وأعد المحاولة.');
      status.textContent='تم اختيار '+questions.length+' سؤالًا. فتح شاشة المراجعة وإعدادات الامتحان...';
      window.showGeneratedExamReview(exam);
      if(typeof window.showToast==='function')window.showToast('تم سحب '+questions.length+' سؤالًا معتمدًا من بنك الأسئلة');
      setTimeout(()=>{if(typeof window.openGeneratedExamSettings==='function')window.openGeneratedExamSettings();},250);
    }catch(e){status.textContent='❌ '+(e?.message||e);if(typeof window.showToast==='function')window.showToast(e?.message||'تعذر إنشاء الامتحان','error');}
    finally{btn.disabled=false;}
  }
  function wire(){
    const oldLoad=window.loadStudySummaryAdmin; if(typeof oldLoad==='function'&&!oldLoad.__ssAiWrapped){const wrapped=async function(...args){const result=await oldLoad.apply(this,args);injectStudySummaryAiPanel();injectApprovedBankPanel();await populateSummarySelect();await populateBankSummarySelect();return result;};wrapped.__ssAiWrapped=true;window.loadStudySummaryAdmin=wrapped;}
    const oldShowPage=window.showPage; if(typeof oldShowPage==='function'&&!oldShowPage.__ssAiWrapped){const wrapped=function(page,...args){const result=oldShowPage.call(this,page,...args);if(page==='study-summaries')setTimeout(()=>{injectStudySummaryAiPanel();injectApprovedBankPanel();populateSummarySelect();populateBankSummarySelect();},0);return result;};wrapped.__ssAiWrapped=true;window.showPage=wrapped;}
    if(document.getElementById('page-study-summaries')){injectStudySummaryAiPanel();injectApprovedBankPanel();populateSummarySelect();populateBankSummarySelect();}
  }
  setInterval(wire,1000); setTimeout(wire,300);
})();
