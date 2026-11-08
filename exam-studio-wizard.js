/* ANDALUS EXAM STUDIO — premium guided wizard
 * UI-only orchestration: existing form controls and save/publish handlers remain the source of truth.
 */
(function () {
  'use strict';
  if (window.__andalusExamStudioV1) return;
  window.__andalusExamStudioV1 = true;

  const $ = (s, r=document) => r.querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const steps = [
    { title: 'بيانات الامتحان', hint: 'حدد الاسم والمادة قبل الانتقال للأسئلة.' },
    { title: 'مصدر الأسئلة والاستهداف', hint: 'الأسئلة من بنك الأندلس فقط، وحدد من سيؤدي الامتحان.' },
    { title: 'الوقت والدرجات', hint: 'راجع المدة والدرجة والموعد وإعدادات عرض الإجابات.' },
    { title: 'المراجعة والنشر', hint: 'تأكد من البيانات ثم احفظ أو انشر بالطريقة المناسبة.' }
  ];
  const fields = [
    { id: 'exam-title', step: 0, label: 'اسم الامتحان', type: 'text', placeholder: 'اكتب اسمًا واضحًا للامتحان' },
    { id: 'exam-subject', step: 0, label: 'المادة', type: 'select' },
    { id: 'exam-duration', step: 2, label: 'مدة الامتحان بالدقائق', type: 'number' },
    { id: 'exam-total-score', step: 2, label: 'الدرجة النهائية', type: 'number' },
    { id: 'exam-from', step: 2, label: 'موعد بداية الامتحان', type: 'datetime-local' },
    { id: 'exam-until', step: 2, label: 'موعد نهاية الامتحان', type: 'datetime-local' },
    { id: 'exam-show-answers', step: 2, label: 'إظهار الإجابات بعد التسليم', type: 'checkbox' },
    { id: 'exam-placement-test', step: 2, label: 'امتحان تحديد مستوى', type: 'checkbox' }
  ];

  function addStyles() {
    if ($('#and-exam-studio-style')) return;
    const style = document.createElement('style');
    style.id = 'and-exam-studio-style';
    style.textContent = `
      #and-exam-studio{font-family:inherit;color:var(--text,#172033);direction:rtl}
      #and-exam-studio .aes-hero{background:linear-gradient(125deg,#101f38 0%,#1d3b63 58%,#28558a 100%);color:#fff;border-radius:18px;padding:20px;margin-bottom:16px;box-shadow:0 12px 30px #10213c22}
      #and-exam-studio .aes-kicker{font-size:10px;letter-spacing:1.6px;opacity:.72;font-weight:800}
      #and-exam-studio .aes-hero h2{font-size:23px;margin:6px 0 4px;font-weight:900}
      #and-exam-studio .aes-hero p{margin:0;color:#dbeafe;font-size:12px}
      #and-exam-studio .aes-stepper{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0 18px}
      #and-exam-studio .aes-step{border:1px solid var(--border,#dbe3ee);border-radius:12px;padding:10px 8px;background:var(--card-bg,#fff);text-align:center;min-width:0}
      #and-exam-studio .aes-step b{display:block;font-size:12px;white-space:normal}
      #and-exam-studio .aes-step small{display:block;color:var(--muted,#64748b);font-size:10px;margin-top:4px}
      #and-exam-studio .aes-step.active{border-color:#2869a9;background:#eff6ff;box-shadow:inset 0 0 0 1px #2869a9}
      #and-exam-studio .aes-step.done{border-color:#86b99b;background:#f0fdf4}
      #and-exam-studio .aes-panel{border:1px solid var(--border,#dbe3ee);border-radius:16px;background:var(--card-bg,#fff);padding:18px;min-height:230px}
      #and-exam-studio .aes-panel h3{font-size:18px;margin:0 0 5px}
      #and-exam-studio .aes-muted{font-size:12px;color:var(--muted,#64748b);margin:0 0 16px;line-height:1.8}
      #and-exam-studio .aes-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      #and-exam-studio .aes-field{display:grid;gap:7px;min-width:0}
      #and-exam-studio .aes-field>span{font-size:12px;font-weight:800}
      #and-exam-studio .aes-field input,#and-exam-studio .aes-field select{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--border,#cbd5e1);border-radius:10px;background:var(--input-bg,#fff);color:inherit;font:inherit;box-sizing:border-box}
      #and-exam-studio .aes-check{display:flex;align-items:center;gap:10px;padding:13px;border:1px solid var(--border,#dbe3ee);border-radius:11px;font-size:12px;font-weight:700}
      #and-exam-studio .aes-check input{width:18px;height:18px}
      #and-exam-studio .aes-actions{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:16px}
      #and-exam-studio .aes-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      #and-exam-studio .aes-summary article{background:var(--hover-bg,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:11px;padding:12px}
      #and-exam-studio .aes-summary small{display:block;color:var(--muted,#64748b);font-size:10px;margin-bottom:5px}
      #and-exam-studio .aes-summary b{font-size:13px;overflow-wrap:anywhere}
      #and-exam-studio .aes-note{padding:12px;border-radius:11px;background:#eff6ff;color:#1e3a8a;font-size:12px;line-height:1.8;margin-top:12px}
      #and-exam-studio .aes-error{color:#b91c1c;font-size:12px;margin-top:10px;min-height:18px}
      @media(max-width:650px){#and-exam-studio .aes-stepper{grid-template-columns:repeat(2,minmax(0,1fr))}#and-exam-studio .aes-grid,#and-exam-studio .aes-summary{grid-template-columns:1fr}#and-exam-studio .aes-hero h2{font-size:19px}}
    `;
    document.head.appendChild(style);
  }

  function findSaveButton(modal) {
    return [...modal.querySelectorAll('button')].find(b =>
      (b.getAttribute('onclick') || '').replace(/\s/g,'') === 'saveExam()' ||
      /نشر الامتحان|حفظ الامتحان|إنشاء الامتحان/.test(b.textContent || '')
    );
  }
  function cloneField(field, host) {
    const source = $('#' + field.id);
    if (!source) return;
    const label = document.createElement('label');
    label.className = 'aes-field';
    if (field.type === 'checkbox') {
      label.className = 'aes-check';
      const clone = source.cloneNode(true);
      clone.removeAttribute('id'); clone.removeAttribute('onchange'); clone.removeAttribute('onclick');
      clone.checked = source.checked;
      clone.addEventListener('change', () => { source.checked = clone.checked; source.dispatchEvent(new Event('change',{bubbles:true})); });
      label.append(clone, document.createTextNode(field.label));
    } else {
      const caption = document.createElement('span'); caption.textContent = field.label;
      const clone = source.cloneNode(true);
      clone.removeAttribute('id'); clone.removeAttribute('onchange'); clone.removeAttribute('onclick');
      clone.style.cssText = '';
      if (field.placeholder) clone.placeholder = field.placeholder;
      clone.addEventListener('input', () => { source.value = clone.value; source.dispatchEvent(new Event('input',{bubbles:true})); });
      clone.addEventListener('change', () => { source.value = clone.value; source.dispatchEvent(new Event('change',{bubbles:true})); });
      // Keep cloned selects synchronized with the existing subject/program catalog.
      if (source.tagName === 'SELECT') clone.value = source.value;
      label.append(caption, clone);
    }
    host.appendChild(label);
    return { source, clone: label.querySelector('input,select,textarea') };
  }

  function decorate(modal) {
    if (!modal || modal.dataset.aesReady === '1') return;
    const body = modal.querySelector('.modal-body');
    if (!body) return;
    addStyles();
    modal.dataset.aesReady = '1';

    const studio = document.createElement('section');
    studio.id = 'and-exam-studio';
    studio.innerHTML = `
      <div class="aes-hero"><div class="aes-kicker">ANDALUS ACADEMY · EXAM STUDIO</div><h2>استوديو إنشاء الامتحانات</h2><p>خطوات واضحة من البيانات إلى المعاينة والنشر — بدون فقدان إعداداتك.</p></div>
      <nav class="aes-stepper" aria-label="مراحل إنشاء الامتحان">
        ${steps.map((s,i)=>'<div class="aes-step '+(i===0?'active':'')+'" data-step-chip="'+i+'"><b>'+(i+1)+' · '+s.title+'</b><small>'+(i===0?'ابدأ هنا':i===1?'الأسئلة والمستهدفون':i===2?'الوقت والدرجة':'تأكيد نهائي')+'</small></div>').join('')}
      </nav>
      <div class="aes-panel" id="aes-stage-panel"></div>
      <div class="aes-error" id="aes-error" role="status"></div>
      <div class="aes-actions"><button type="button" class="btn btn-outline" id="aes-back">السابق</button><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-outline" id="aes-close">إغلاق</button><button type="button" class="btn btn-primary" id="aes-next">التالي</button></div></div>`;
    body.insertBefore(studio, body.firstChild);

    const fieldMap = new Map();
    const panel = $('#aes-stage-panel', studio);
    const stepHosts = [0,2].map(i=>{const d=document.createElement('div');d.className='aes-grid';d.dataset.fieldsStep=i;return d;});
    fields.forEach(f=>{const host=stepHosts.find(x=>Number(x.dataset.fieldsStep)===f.step);if(host){const pair=cloneField(f,host);if(pair)fieldMap.set(f.id,pair);}});
    let stage=0;
    const targetPanel = $('#andalus-exam-targeting',modal);
    const programWrappers = [...modal.querySelectorAll('.exam-prog-cb')].map(cb=>cb.closest('label')||cb.parentElement).filter((el,i,arr)=>el&&!arr.slice(0,i).includes(el));

    function updateSummary() {
      const val=id=>$('#'+id,studio)?.value || $('#' + id,modal)?.value || '—';
      const text=id=>{const s=$('#'+id,studio);if(!s)return '—';return s.tagName==='SELECT'?(s.selectedOptions[0]?.textContent||'—'):s.value||'—';};
      const subject = fieldMap.get('exam-subject')?.clone;
      const selectedSubject = subject?.selectedOptions?.[0]?.textContent || '—';
      const generated = window._andalusGeneratedExam?.questions?.length;
      const target = window.getAndalusExamTargetSelection?.();
      let targetText='لم يتم تحديد المستهدف بعد';
      if(target){targetText=target.mode==='students'?'طلاب محددون: '+(target.studentIds||[]).length:'الفروع: '+((target.branches||[]).join('، ')||'—');}
      return `
        <div class="aes-summary">
          <article><small>اسم الامتحان</small><b>${esc(text('exam-title')||val('exam-title'))}</b></article>
          <article><small>المادة</small><b>${esc(selectedSubject)}</b></article>
          <article><small>الأسئلة المختارة</small><b>${generated?generated+' سؤال من بنك الأسئلة':'لم يتم اختيار الأسئلة بعد'}</b></article>
          <article><small>مدة الامتحان</small><b>${esc(val('exam-duration'))} دقيقة</b></article>
          <article><small>الدرجة النهائية</small><b>${esc(val('exam-total-score'))}</b></article>
          <article><small>موعد البداية</small><b>${esc(val('exam-from'))}</b></article>
          <article><small>موعد النهاية</small><b>${esc(val('exam-until'))}</b></article>
          <article><small>المستهدفون</small><b>${esc(targetText)}</b></article>
        </div>
        <div class="aes-note">النشر الرسمي ينشئ الامتحان للطلاب المستهدفين. النشر التجريبي يظل منفصلًا ويُدار من زر «نشر تجريبي» في قائمة الامتحانات، ولا يسجل درجات رسمية.</div>`;
    }

    function render() {
      studio.querySelectorAll('[data-step-chip]').forEach((chip,i)=>{chip.classList.toggle('active',i===stage);chip.classList.toggle('done',i<stage);});
      $('#aes-back',studio).disabled=stage===0;
      $('#aes-next',studio).textContent=stage===3?'حفظ ونشر الامتحان':'التالي';
      $('#aes-error',studio).textContent='';
      if(stage===0){
        panel.innerHTML='<h3>البيانات الأساسية</h3><p class="aes-muted">ابدأ باسم واضح وحدد المادة التي سيُسحب منها بنك الأسئلة.</p>';
        panel.appendChild(stepHosts[0]);
      } else if(stage===1){
        panel.innerHTML='<h3>مصدر الأسئلة وتحديد الطلاب</h3><p class="aes-muted">مصدر أسئلة الامتحان هو بنك الأسئلة المركزي فقط. لا يتم دمج مجموعات التوليد أو تعديل الأسئلة الأصلية.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button type="button" class="btn btn-primary" id="aes-open-bank">📚 اختيار الأسئلة من بنك الأسئلة</button><button type="button" class="btn btn-outline" id="aes-open-generator">⚙️ توليد أسئلة جديدة إلى البنك</button></div><div id="aes-target-slot"></div><div id="aes-program-slot" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:12px"></div>';
        if(targetPanel)$('#aes-target-slot',panel).appendChild(targetPanel);
        programWrappers.forEach(el=>$('#aes-program-slot',panel).appendChild(el));
        $('#aes-open-bank',panel).onclick=()=>{if(typeof window.startAiExamGeneration==='function')window.startAiExamGeneration();else window.showToast?.('واجهة بنك الأسئلة غير جاهزة.');};
        $('#aes-open-generator',panel).onclick=()=>{if(typeof window.startAiExamGeneration==='function')window.startAiExamGeneration();else window.showToast?.('واجهة بنك الأسئلة غير جاهزة.');};
      } else if(stage===2){
        panel.innerHTML='<h3>الوقت والدرجات</h3><p class="aes-muted">حدد مدة كافية ونافذة زمنية صحيحة. تأكد أن النهاية بعد البداية.</p>';
        panel.appendChild(stepHosts[1]);
      } else {
        panel.innerHTML='<h3>مراجعة قبل النشر</h3><p class="aes-muted">راجع المعلومات التالية. لن يتم حذف أو تعديل أي سؤال في البنك أثناء إنشاء الامتحان.</p>'+updateSummary();
        const save=findSaveButton(modal);
        if(save){save.style.display='';save.textContent='🚀 نشر الامتحان رسميًا';const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-start;margin-top:14px';actions.appendChild(save);panel.appendChild(actions);}
      }
      const footer=modal.querySelector('.modal-footer');
      if(footer){footer.querySelectorAll('button').forEach(b=>{if(b!==findSaveButton(modal))b.style.display='none';});}
    }

    function validate() {
      const error=$('#aes-error',studio);
      const get=id=>fieldMap.get(id)?.clone;
      if(stage===0){
        if(!get('exam-title')?.value.trim()){error.textContent='اكتب اسم الامتحان أولًا.';return false;}
        if(!get('exam-subject')?.value){error.textContent='اختر المادة أولًا.';return false;}
      }
      if(stage===1){
        const target=window.getAndalusExamTargetSelection?.();
        if(target?.mode==='students'&&!(target.studentIds||[]).length){error.textContent='حدد طالبًا واحدًا على الأقل.';return false;}
        if(target?.mode!=='students'&&target&&!(target.branches||[]).length){error.textContent='حدد فرعًا واحدًا على الأقل.';return false;}
        if(!window._andalusGeneratedExam?.questions?.length){error.textContent='اختَر أسئلة من بنك الأسئلة قبل الانتقال.';return false;}
      }
      if(stage===2){
        const duration=Number(get('exam-duration')?.value);
        const score=Number(get('exam-total-score')?.value);
        const from=get('exam-from')?.value,until=get('exam-until')?.value;
        if(!duration||duration<1){error.textContent='أدخل مدة امتحان صحيحة بالدقائق.';return false;}
        if(!score||score<=0){error.textContent='أدخل الدرجة النهائية.';return false;}
        if(!from||!until||new Date(until)<=new Date(from)){error.textContent='راجع موعد البداية والنهاية؛ النهاية يجب أن تكون بعد البداية.';return false;}
      }
      return true;
    }

    $('#aes-back',studio).onclick=()=>{if(stage>0){stage--;render();}};
    $('#aes-next',studio).onclick=()=>{
      if(stage<3){if(!validate())return;stage++;render();return;}
      const save=findSaveButton(modal);
      if(!save){$('#aes-error',studio).textContent='زر النشر الأصلي غير موجود. لم يتم تنفيذ أي إجراء.';return;}
      save.click();
    };
    $('#aes-close',studio).onclick=()=>{if(typeof window.closeModal==='function')window.closeModal('modal-exam');else modal.classList.remove('open');};
    // Keep original form state in sync; original controls remain in the DOM and keep their IDs.
    fieldMap.forEach(({source,clone})=>{
      source.addEventListener('change',()=>{if(clone.type==='checkbox')clone.checked=source.checked;else clone.value=source.value;});
      if(source.tagName==='SELECT')source.addEventListener('change',()=>{clone.innerHTML=source.innerHTML;clone.value=source.value;});
    });
    const originalBodyChildren=[...body.children].filter(el=>el!==studio);
    originalBodyChildren.forEach(el=>{if(el.id!=='andalus-exam-targeting')el.style.display='none';});
    // Hide original controls only; the new controls are visual clones that write back to originals.
    render();
  }

  function wrapOpen() {
    const original=window.openCreateExam;
    if(typeof original!=='function'||original.__aesWrapped)return false;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      setTimeout(()=>decorate($('#modal-exam')),0);
      return result;
    };
    wrapped.__aesWrapped=true;
    window.openCreateExam=wrapped;
    return true;
  }

  function boot() {
    wrapOpen();
    let tries=0;
    const timer=setInterval(()=>{
      if(wrapOpen()||++tries>120)clearInterval(timer);
    },250);
    const observer=new MutationObserver(()=>{
      const modal=$('#modal-exam');
      if(modal?.classList.contains('open')&&modal.dataset.aesReady!=='1')decorate(modal);
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
