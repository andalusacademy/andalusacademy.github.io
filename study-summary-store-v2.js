(() => {
'use strict';
const $ = (s, r=document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const db = () => window.sb || (typeof sb !== 'undefined' ? sb : null);
let mounted=false, loading=false, storageReady=false, storageBusy=false, products=[], students=[], selectedStudentIds=new Set(), selectedProductId='';
let activeMode='ready', reviewVisible=false, orderBusy=false, lastRefreshAt=0, lastPurgeAttempt=0;
const status=(id,msg,ok=false)=>{const el=$('#'+id);if(el)el.innerHTML='<div style="padding:10px 12px;border-radius:9px;background:'+(ok?'#ecfdf5':'#fff7ed')+';color:'+(ok?'#166534':'#9a3412')+';line-height:1.7">'+esc(msg)+'</div>';};
function markup(){
 const page=$('#page-study-summaries');if(!page||$('#ss-store-v2'))return;
 const root=document.createElement('div');root.id='ss-store-v2';root.className='card';
 root.innerHTML=`
 <div class="card-header"><h3>📚 مكتبة ملخصات الأندلس</h3><span id="ss-v2-storage-state" style="font-size:12px;color:var(--muted)">جاري تجهيز المكتبة...</span></div>
 <div style="padding:16px">
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:18px">
   <div style="border:1px solid var(--border);border-radius:12px;padding:13px"><div style="font-size:12px;color:var(--muted)">المنتجات</div><strong id="ss-v2-count" style="font-size:25px">0</strong></div>
   <div style="border:1px solid var(--border);border-radius:12px;padding:13px"><div style="font-size:12px;color:var(--muted)">منشور للطلاب</div><strong id="ss-v2-published" style="font-size:25px">0</strong></div>
   <div style="border:1px solid var(--border);border-radius:12px;padding:13px"><div style="font-size:12px;color:var(--muted)">طلبات تنتظر المراجعة</div><strong id="ss-v2-pending" style="font-size:25px">0</strong></div>
  </div>
  <h4 style="margin:0 0 10px">١) اختار هتجهز الملخص إزاي؟</h4>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">
   <button type="button" data-mode="ready" class="btn btn-gold" style="min-height:72px;white-space:normal">📄 رفع ملخص PDF جاهز</button>
   <button type="button" data-mode="material" class="btn btn-outline" style="min-height:72px;white-space:normal">🤖 توليد أسئلة من المادة</button>
   <button type="button" data-mode="draft" class="btn btn-outline" style="min-height:72px;white-space:normal">📝 اختيار مسودة امتحان</button>
   <button type="button" data-mode="bank" class="btn btn-outline" style="min-height:72px;white-space:normal">🧩 اختيار أسئلة من البنك</button>
  </div>
  <div id="ss-v2-source" style="margin-top:12px;border:1px solid var(--border);border-radius:12px;padding:14px"></div>
  <div id="ss-v2-source-status" style="margin-top:10px"></div>
  <div style="border-top:1px solid var(--border);margin:20px 0"></div>
  <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><h4 style="margin:0">٢) ملخصاتي ومنتجات البيع</h4><button type="button" class="btn btn-outline btn-sm" id="ss-v2-refresh">↻ تحديث</button></div>
  <div id="ss-v2-products" style="display:grid;gap:9px;margin-top:12px"><div style="color:var(--muted)">جاري التحميل...</div></div>
  <div id="ss-v2-settings" style="display:none;margin-top:18px;border:1px solid var(--border);border-radius:12px;padding:14px">
   <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><h4 style="margin:0">٣) سعر ومدة وجمهور المنتج</h4><span id="ss-v2-selected-title" style="font-size:12px;color:var(--muted)"></span></div>
   <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:12px">
    <div class="form-group"><label>السعر بالجنيه</label><input id="ss-v2-price" type="number" min="0" step="0.01" class="search-input" style="width:100%" placeholder="مثال: 40"></div>
    <div class="form-group"><label>وسيلة التحويل</label><input id="ss-v2-provider" type="text" maxlength="80" class="search-input" style="width:100%" placeholder="Orange Cash / Vodafone Cash"></div>
    <div class="form-group"><label>رقم المحفظة</label><input id="ss-v2-wallet" type="text" maxlength="40" class="search-input" style="width:100%" placeholder="رقم المحفظة المستقبلة"></div>
    <div class="form-group"><label>مدة الوصول بعد اعتماد الدفع</label><select id="ss-v2-validity" class="search-input" style="width:100%"><option value="2">يومان</option><option value="7">أسبوع</option><option value="30">شهر</option><option value="custom">مدة مخصصة</option><option value="36500">دائم بدون انتهاء</option></select><input id="ss-v2-custom-days" type="number" min="1" max="3650" class="search-input" style="width:100%;display:none;margin-top:7px" placeholder="عدد الأيام"></div>
    <div class="form-group"><label>مين يقدر يشتري؟</label><select id="ss-v2-audience" class="search-input" style="width:100%"><option value="all">كل الطلاب</option><option value="selected">طلاب محددون فقط</option></select></div>
   </div>
   <div id="ss-v2-student-picker" style="display:none;margin-top:12px;border:1px solid var(--border);border-radius:10px;padding:12px">
    <label>ابحث بالاسم أو رقم القيد وحدد الطلاب</label><input id="ss-v2-student-search" type="search" class="search-input" style="width:100%;margin-top:7px" placeholder="اكتب اسم الطالب أو رقم القيد">
    <div id="ss-v2-student-count" style="font-size:12px;color:var(--muted);margin:8px 0">لم يتم تحديد طلاب.</div>
    <div id="ss-v2-students" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:5px;max-height:220px;overflow:auto"></div>
   </div>
   <div style="font-size:12px;color:var(--muted);margin:10px 0">تبدأ صلاحية الوصول بعد اعتماد الدفع. المنتج المنشور يظهر فقط للجمهور الذي حددته.</div>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-outline" id="ss-v2-save">💾 حفظ الإعدادات</button><button type="button" class="btn btn-gold" id="ss-v2-publish">📢 نشر للطلاب</button><button type="button" class="btn btn-outline" id="ss-v2-unpublish">إيقاف النشر</button><button type="button" class="btn btn-outline" id="ss-v2-review">مراجعة الأسئلة</button></div>
   <div id="ss-v2-settings-status" style="margin-top:10px"></div>
  </div>
  <div style="border-top:1px solid var(--border);margin:20px 0"></div>
  <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><h4 style="margin:0">٤) طلبات الشراء والتحويلات</h4><button type="button" class="btn btn-outline btn-sm" id="ss-v2-orders-refresh">تحديث الطلبات</button></div>
  <div id="ss-v2-orders" style="display:grid;gap:9px;margin-top:12px"></div>
 </div>`;
 page.prepend(root);
 $('#ss-v2-refresh').addEventListener('click',refreshProducts);
 $('#ss-v2-orders-refresh').addEventListener('click',refreshOrders);
 root.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
 $('#ss-v2-validity').addEventListener('change',()=>{$('#ss-v2-custom-days').style.display=$('#ss-v2-validity').value==='custom'?'':'none';});
 $('#ss-v2-audience').addEventListener('change',()=>{const show=$('#ss-v2-audience').value==='selected';$('#ss-v2-student-picker').style.display=show?'':'none';if(show)loadStudents().catch(e=>status('ss-v2-settings-status',e.message||String(e)));});
 $('#ss-v2-student-search').addEventListener('input',renderStudents);
 $('#ss-v2-save').addEventListener('click',()=>saveProduct(false));
 $('#ss-v2-publish').addEventListener('click',()=>saveProduct(true));
 $('#ss-v2-unpublish').addEventListener('click',()=>saveProduct(false,true));
 $('#ss-v2-review').addEventListener('click',openReview);
 setMode('ready');
}
function hideOld(){
 const page=$('#page-study-summaries');if(!page)return;
 for(const card of page.querySelectorAll(':scope > .card')){
  if(card.id==='ss-store-v2')continue;
  if(card.id==='ss-question-review-card'&&reviewVisible){card.style.display='';continue;}
  card.style.display='none';
 }
 const generator=$('#ss-ai-generator-card');if(generator)generator.style.display='none';
 const ready=$('#ss-ready-pdf-card');if(ready)ready.style.display='none';
 const management=$('#ss-summary-management-card');if(management)management.style.display='none';
 const review=$('#ss-question-review-card');if(review&&!reviewVisible)review.style.display='none';
 const back=$('#ss-v2-review-back');if(back)back.style.display=reviewVisible?'':'none';
}
function setMode(mode){
 activeMode=mode;
 const source=$('#ss-v2-source');if(!source)return;
 const buttons=document.querySelectorAll('#ss-store-v2 [data-mode]');
 buttons.forEach(b=>{b.classList.toggle('btn-gold',b.dataset.mode===mode);b.classList.toggle('btn-outline',b.dataset.mode!==mode);});
 if(mode==='ready'){
  source.innerHTML='<h4 style="margin:0 0 10px">رفع ملف جاهز للبيع</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px"><div class="form-group"><label>اسم الملخص</label><input id="ss-v2-ready-title" class="search-input" style="width:100%" placeholder="مثال: ملخص أساسيات التمريض"></div><div class="form-group"><label>اسم المادة</label><input id="ss-v2-ready-subject" class="search-input" style="width:100%" placeholder="اسم المادة"></div><div class="form-group" style="grid-column:1/-1"><label>ملف PDF</label><input id="ss-v2-ready-file" type="file" accept=".pdf,application/pdf" class="search-input" style="width:100%"><small style="color:var(--muted)">حتى 15 ميجابايت.</small></div><div class="form-group" style="grid-column:1/-1"><label>وصف اختياري</label><textarea id="ss-v2-ready-description" class="search-input" style="width:100%" rows="2"></textarea></div></div><button id="ss-v2-ready-create" class="btn btn-gold" type="button">حفظ الملخص الجاهز</button>';
  $('#ss-v2-ready-create').addEventListener('click',createReadyPdf);
 }else if(mode==='material'||mode==='bank'){
  source.innerHTML='<h4 style="margin:0 0 10px">'+(mode==='material'?'توليد أسئلة من ملف المادة':'اختيار أسئلة من بنك الأسئلة')+'</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px"><div class="form-group"><label>اسم الملخص</label><input id="ss-v2-gen-title" class="search-input" style="width:100%" placeholder="اسم الملخص"></div><div class="form-group"><label>اسم المادة</label><input id="ss-v2-gen-subject" class="search-input" style="width:100%" placeholder="اسم المادة"></div>'+(mode==='material'?'<div class="form-group" style="grid-column:1/-1"><label>ملف المادة PDF</label><input id="ss-v2-gen-file" type="file" accept=".pdf,application/pdf" class="search-input" style="width:100%"></div>':'')+'<div class="form-group"><label>اختياري</label><input id="ss-v2-gen-mc" type="number" min="0" max="100" value="20" class="search-input" style="width:100%"></div><div class="form-group"><label>صح وغلط</label><input id="ss-v2-gen-tf" type="number" min="0" max="100" value="20" class="search-input" style="width:100%"></div><div class="form-group"><label>مقالي</label><input id="ss-v2-gen-essay" type="number" min="0" max="100" value="0" class="search-input" style="width:100%"></div></div><button id="ss-v2-generate" class="btn btn-gold" type="button">'+(mode==='material'?'🤖 توليد الأسئلة وحفظ المسودة':'🧩 إنشاء من بنك الأسئلة')+'</button><small style="display:block;color:var(--muted);margin-top:7px">بعد التوليد راجع الأسئلة واعتمدها قبل البيع.</small>';
  $('#ss-v2-generate').addEventListener('click',()=>runLegacyGenerator(mode));
 }else{
  source.innerHTML='<h4 style="margin:0 0 8px">تحويل مسودة امتحان إلى منتج ملخص</h4><p style="color:var(--muted);line-height:1.8">اختار المسودة المطلوبة، وسيتم نسخ أسئلتها إلى ملخص مستقل. المسودة الأصلية والامتحان لن يتغيرا.</p><button id="ss-v2-open-drafts" type="button" class="btn btn-gold">فتح المسودات واختيار مسودة</button>';
  $('#ss-v2-open-drafts').addEventListener('click',()=>{if(typeof window.openAndalusExamDrafts==='function')window.openAndalusExamDrafts();else status('ss-v2-source-status','مدير المسودات لم يجهز بعد. حدّث الصفحة وجرب مرة أخرى.');});
 }
}
async function getSession(){
 const sbc=db();if(!sbc)throw new Error('قاعدة البيانات غير متصلة.');
 const {data,error}=await sbc.auth.getSession();if(error||!data?.session)throw new Error('سجل دخول المدير ثم أعد المحاولة.');
 return {sbc,session:data.session};
}
async function purgeStorage(){
 if(storageReady||storageBusy)return;
 storageBusy=true;
 const label=$('#ss-v2-storage-state');if(label)label.textContent='جاري تنظيف ملفات المكتبة القديمة...';
 try{
  const {sbc,session}=await getSession();
  const response=await fetch(sbc.supabaseUrl+'/functions/v1/admin-purge-study-summary-storage',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,apikey:sbc.supabaseKey},body:'{}'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.ok)throw new Error(result.message||result.reason||'تعذر تنظيف ملفات التخزين القديمة.');
  storageReady=true;
  if(label)label.textContent='المكتبة الجديدة جاهزة';
  if(result.deleted_objects)status('ss-v2-source-status','تم حذف '+result.deleted_objects+' ملف قديم من التخزين نهائيًا.',true);
 }catch(e){if(label)label.textContent='تعذر تنظيف الملفات القديمة';status('ss-v2-source-status',e.message||String(e));}
 finally{storageBusy=false;}
}
async function createReadyPdf(){
 const sbc=db(),title=$('#ss-v2-ready-title').value.trim(),subject=$('#ss-v2-ready-subject').value.trim(),file=$('#ss-v2-ready-file').files?.[0],description=$('#ss-v2-ready-description').value.trim(),button=$('#ss-v2-ready-create');
 if(!title||!subject||!file)return status('ss-v2-source-status','اكتب اسم الملخص والمادة واختر ملف PDF.');
 if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))return status('ss-v2-source-status','الملف لازم يكون PDF.');
 if(file.size>15*1024*1024)return status('ss-v2-source-status','الحد الأقصى لحجم الملف 15 ميجابايت.');
 if(!storageReady)return status('ss-v2-source-status','انتظر انتهاء تنظيف ملفات المكتبة القديمة أولًا.');
 button.disabled=true;button.textContent='جاري الحفظ والرفع...';
 let id='',path='';
 try{
  const {session}=await getSession();
  const made=await sbc.from('study_summaries').insert({title,subject_name:subject,description,price:0,validity_days:30,is_published:false,is_approved:true,created_by:session.user.id,ai_generation_status:'ready',generated_question_count:0,enabled_batches:[],enabled_question_types:[],target_all:true}).select('id').single();
  if(made.error)throw made.error;id=made.data.id;path='summary-'+id+'/delivery-'+Date.now()+'.pdf';
  const upload=await sbc.storage.from('study-summary-pdfs').upload(path,file,{contentType:'application/pdf',upsert:false});if(upload.error)throw upload.error;
  const save=await sbc.from('study_summaries').update({delivery_pdf_path:upload.data?.path||path,updated_at:new Date().toISOString()}).eq('id',id);if(save.error)throw save.error;
  $('#ss-v2-ready-title').value='';$('#ss-v2-ready-subject').value='';$('#ss-v2-ready-description').value='';$('#ss-v2-ready-file').value='';
  selectedProductId=id;await refreshProducts();await loadProduct(id);
  status('ss-v2-source-status','تم رفع وحفظ الملخص كمسودة. اضبط السعر والجمهور ثم انشره.',true);
 }catch(e){
  if(path)await sbc.storage.from('study-summary-pdfs').remove([path]);
  if(id)await sbc.from('study_summaries').delete().eq('id',id);
  status('ss-v2-source-status',e.message||String(e));
 }finally{button.disabled=false;button.textContent='حفظ الملخص الجاهز';}
}
async function runLegacyGenerator(mode){
 if(mode==='material'&&!storageReady)return status('ss-v2-source-status','انتظر انتهاء حذف ملفات المكتبة القديمة قبل رفع ملف المادة.');
 const fresh=$('#ss-ai-new-btn');if(fresh){const oldConfirm=window.confirm;window.confirm=()=>true;fresh.click();window.confirm=oldConfirm;}
 const title=$('#ss-v2-gen-title').value.trim(),subject=$('#ss-v2-gen-subject').value.trim(),mc=Number($('#ss-v2-gen-mc').value||0),tf=Number($('#ss-v2-gen-tf').value||0),essay=Number($('#ss-v2-gen-essay').value||0),button=$('#ss-v2-generate');
 if(!title||!subject||mc+tf+essay<1||mc+tf+essay>100)return status('ss-v2-source-status','اكتب الاسم والمادة وحدد من 1 إلى 100 سؤال.');
 if([mc,tf,essay].some(x=>!Number.isInteger(x)||x<0||x>100))return status('ss-v2-source-status','راجع أعداد الأسئلة.');
 const oldTitle=$('#ss-ai-title'),oldSubject=$('#ss-ai-subject'),oldDescription=$('#ss-ai-description'),oldPdf=$('#ss-ai-pdf');
 if(!oldTitle||!oldSubject||!$('#ss-ai-generate-btn'))return status('ss-v2-source-status','أداة توليد الأسئلة لم تجهز. أعد تحميل الصفحة.');
 oldTitle.value=title;oldSubject.value=subject;oldDescription.value='';
 ['mc','tf','essay'].forEach(k=>{const c=$('#ss-ai-'+k+'-enabled'),n=$('#ss-ai-'+k+'-count');c.checked=({mc,tf,essay}[k]>0);n.disabled=!c.checked;n.value=String(({mc,tf,essay}[k]));});
 if(mode==='material'){
  const file=$('#ss-v2-gen-file').files?.[0];if(!file)return status('ss-v2-source-status','اختر ملف PDF للمادة.');
  if(file.size>15*1024*1024)return status('ss-v2-source-status','حجم ملف المادة يتجاوز 15 ميجابايت.');
  const transfer=new DataTransfer();transfer.items.add(file);oldPdf.files=transfer.files;
 }else{oldPdf.value='';}
 const oldStatus=$('#ss-ai-status');if(oldStatus)oldStatus.textContent='';
 button.disabled=true;button.textContent='جاري التنفيذ...';status('ss-v2-source-status','جاري إنشاء المسودة وحفظ الأسئلة. انتظر حتى تظهر رسالة الاكتمال.');
 $('#ss-ai-'+(mode==='material'?'generate':'from-bank')+'-btn').click();
 const started=Date.now();let done=false;
 while(Date.now()-started<240000){
  await new Promise(r=>setTimeout(r,1000));
  const t=oldStatus?.textContent||'';
  if(t.includes('تم توليد الجزء')||t.includes('تم إنشاء مسودة الملخص من بنك الأسئلة')){
   done=true;break;
  }
  if(t.includes('تعذر توليد')||t.includes('تعذر إنشاء')||t.includes('لم يكتمل الجزء')){
   status('ss-v2-source-status',t);break;
  }
 }
 if(done){
  await refreshProducts();
  const {data}=await db().from('study_summaries').select('id').order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(data?.id){selectedProductId=data.id;await loadProduct(data.id);}
  status('ss-v2-source-status','تم إنشاء المسودة وحفظ الأسئلة. اضغط «مراجعة الأسئلة» لاعتمادها قبل النشر.',true);
 }else if(Date.now()-started>=240000)status('ss-v2-source-status','التوليد استغرق وقتًا أطول من المتوقع. افتح قائمة المنتجات واضغط تحديث للتأكد من حفظ المسودة.');
 button.disabled=false;button.textContent=mode==='material'?'🤖 توليد الأسئلة وحفظ المسودة':'🧩 إنشاء من بنك الأسئلة';
}
async function refreshProducts(){
 const sbc=db();if(!sbc||loading)return;loading=true;
 try{
  const {data,error}=await sbc.from('study_summaries').select('id,title,subject_name,price,validity_days,is_published,is_approved,generated_question_count,delivery_pdf_path,created_at').order('created_at',{ascending:false});
  if(error)throw error;products=data||[];
  $('#ss-v2-count').textContent=products.length;
  $('#ss-v2-published').textContent=products.filter(x=>x.is_published).length;
  const body=$('#ss-v2-products');
  body.innerHTML=products.length?products.map(x=>{
   const state=x.is_published?'منشور للطلاب':(x.delivery_pdf_path||x.is_approved?'مسودة جاهزة للإعداد':'تحتاج مراجعة الأسئلة');
   return '<div style="border:1px solid var(--border);border-radius:11px;padding:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div style="min-width:180px;flex:1"><strong>'+esc(x.title)+'</strong><div style="font-size:12px;color:var(--muted);margin-top:4px">'+esc(x.subject_name||'')+' · '+(x.delivery_pdf_path?'PDF جاهز':Number(x.generated_question_count||0)+' سؤال')+' · '+esc(state)+'</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn btn-outline btn-sm" data-edit="'+esc(x.id)+'">السعر والجمهور</button>'+(x.generated_question_count&&!x.is_approved?'<button type="button" class="btn btn-primary btn-sm" data-review="'+esc(x.id)+'">مراجعة الأسئلة</button>':'')+'<button type="button" class="btn btn-outline btn-sm" data-delete="'+esc(x.id)+'">حذف</button></div></div>';
  }).join(''):'<div style="padding:22px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:10px">لا توجد منتجات بعد. ابدأ برفع PDF أو توليد ملخص من مادة أو مسودة.</div>';
  body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>loadProduct(b.dataset.edit)));
  body.querySelectorAll('[data-review]').forEach(b=>b.addEventListener('click',()=>{selectedProductId=b.dataset.review;openReview();}));
  body.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteProduct(b.dataset.delete)));
  if(selectedProductId&&products.some(x=>x.id===selectedProductId)&&$('#ss-v2-settings')?.style.display==='none')await loadProduct(selectedProductId);
  else if(!products.length){selectedProductId='';$('#ss-v2-settings').style.display='none';}
 }catch(e){$('#ss-v2-products').textContent='تعذر تحميل المنتجات: '+(e.message||String(e));}
 finally{loading=false;}
}
async function loadStudents(){
 if(students.length)return;
 const {data,error}=await db().from('students').select('id,name,enrollment_number,branch').is('deleted_at',null).or('student_status.eq.active,student_status.is.null').order('name').limit(1000);
 if(error)throw error;students=data||[];renderStudents();
}
function renderStudents(){
 const box=$('#ss-v2-students');if(!box)return;
 const term=String($('#ss-v2-student-search').value||'').trim().toLowerCase();
 const rows=students.filter(s=>!term||[s.name,s.id,s.enrollment_number,s.branch].some(v=>String(v||'').toLowerCase().includes(term)));
 box.innerHTML=rows.length?rows.map(s=>'<label style="display:flex;gap:7px;align-items:flex-start;padding:6px;border-bottom:1px solid var(--border)"><input type="checkbox" data-student-id="'+esc(s.id)+'" '+(selectedStudentIds.has(String(s.id))?'checked':'')+'><span><strong>'+esc(s.name||'طالب بدون اسم')+'</strong><small style="display:block;color:var(--muted)">قيد: '+esc(s.enrollment_number||s.id)+' · '+esc(s.branch||'')+'</small></span></label>').join(''):'<div style="color:var(--muted)">لا توجد نتائج.</div>';
 box.querySelectorAll('[data-student-id]').forEach(c=>c.addEventListener('change',()=>{if(c.checked)selectedStudentIds.add(c.dataset.studentId);else selectedStudentIds.delete(c.dataset.studentId);renderStudentCount();}));
 renderStudentCount();
}
function renderStudentCount(){const el=$('#ss-v2-student-count');if(el)el.textContent=selectedStudentIds.size?'تم تحديد '+selectedStudentIds.size+' طالبًا.':'لم يتم تحديد طلاب.';}
async function loadProduct(id){
 const {data,error}=await db().from('study_summaries').select('*').eq('id',id).single();if(error){status('ss-v2-settings-status',error.message);return;}
 selectedProductId=id;$('#ss-v2-settings').style.display='block';$('#ss-v2-selected-title').textContent=data.title;
 $('#ss-v2-price').value=data.price??'';$('#ss-v2-provider').value=data.payment_provider||'';$('#ss-v2-wallet').value=data.payment_wallet_number||'';
 const days=Number(data.validity_days||30),preset=$('#ss-v2-validity'),custom=$('#ss-v2-custom-days');
 if(days===2||days===7||days===30||days>=36500){preset.value=days>=36500?'36500':String(days);custom.value='';}else{preset.value='custom';custom.value=String(days);}
 custom.style.display=preset.value==='custom'?'':'none';
 $('#ss-v2-audience').value=data.target_all===true?'all':'selected';$('#ss-v2-student-picker').style.display=data.target_all===true?'none':'';
 selectedStudentIds.clear();
 if(data.target_all!==true){const targets=await db().from('study_summary_target_students').select('student_id').eq('summary_id',id);if(targets.error)throw targets.error;(targets.data||[]).forEach(x=>selectedStudentIds.add(String(x.student_id)));await loadStudents();}
 renderStudents();renderStudentCount();
 $('#ss-v2-review').style.display=Number(data.generated_question_count||0)>0?'':'none';
 status('ss-v2-settings-status',data.is_published?'المنتج منشور حاليًا. يمكنك تحديث الإعدادات أو إيقاف النشر.':'المنتج محفوظ كمسودة. اضبط الإعدادات ثم انشره.',true);
}
async function saveProduct(publish,unpublish=false){
 if(!selectedProductId)return status('ss-v2-settings-status','اختر منتجًا أولًا.');
 const price=Number($('#ss-v2-price').value),preset=$('#ss-v2-validity').value;
 const days=preset==='custom'?Number($('#ss-v2-custom-days').value):Number(preset);
 const targetAll=$('#ss-v2-audience').value==='all';
 const provider=$('#ss-v2-provider').value.trim(),wallet=$('#ss-v2-wallet').value.trim();
 if(!Number.isFinite(price)||price<0||!Number.isInteger(days)||!(days>=1&&days<=3650||days===36500))return status('ss-v2-settings-status','راجع السعر ومدة الوصول. المدة المخصصة من يوم إلى 3650 يومًا.');
 if(publish&&(!provider||!wallet))return status('ss-v2-settings-status','اكتب وسيلة التحويل ورقم المحفظة قبل النشر.');
 if(!targetAll&&!selectedStudentIds.size)return status('ss-v2-settings-status','حدد طالبًا واحدًا على الأقل أو اختر كل الطلاب.');
 if(wallet&&!/^[0-9+\s()-]{6,40}$/.test(wallet))return status('ss-v2-settings-status','راجع رقم المحفظة.');
 const button=publish?$('#ss-v2-publish'):$('#ss-v2-save');button.disabled=true;
 try{
  const {data,error}=await db().rpc('admin_save_study_summary_product',{p_summary_id:selectedProductId,p_price:price,p_validity_days:days,p_payment_provider:provider||null,p_wallet_number:wallet||null,p_target_all:targetAll,p_student_ids:targetAll?[]:[...selectedStudentIds],p_publish:unpublish?false:!!publish});
  if(error)throw error;if(data?.ok===false)throw new Error(data.reason||'تعذر حفظ المنتج.');
  status('ss-v2-settings-status',publish?'تم نشر المنتج للطلاب المحددين.':(unpublish?'تم إيقاف نشر المنتج.':'تم حفظ الإعدادات بنجاح.'),true);
  await refreshProducts();await refreshOrders();
 }catch(e){status('ss-v2-settings-status',e.message||String(e));}
 finally{button.disabled=false;}
}
function openReview(){
 const review=$('#ss-question-review-card');if(!review)return status('ss-v2-settings-status','واجهة مراجعة الأسئلة غير جاهزة.');
 reviewVisible=true;hideOld();review.style.display='block';
 const sel=$('#ss-review-summary');if(sel&&selectedProductId){sel.value=selectedProductId;sel.dispatchEvent(new Event('change',{bubbles:true}));}
 if(!$('#ss-v2-review-back')){const b=document.createElement('button');b.id='ss-v2-review-back';b.type='button';b.className='btn btn-outline';b.textContent='← العودة إلى مكتبة الملخصات';b.style.margin='12px';b.addEventListener('click',()=>{reviewVisible=false;review.style.display='none';hideOld();refreshProducts();});review.prepend(b);}
 review.scrollIntoView({behavior:'smooth',block:'start'});
}
async function deleteProduct(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 if(!confirm('حذف المنتج «'+p.title+'» نهائيًا؟ سيُحذف معه الأسئلة والطلبات والصلاحيات المرتبطة به.'))return;
 try{
  const q=await db().from('study_summary_activity').delete().eq('summary_id',id);if(q.error)throw q.error;
  const e=await db().from('study_summary_entitlements').delete().eq('summary_id',id);if(e.error)throw e.error;
  const o=await db().from('study_summary_orders').delete().eq('summary_id',id);if(o.error)throw o.error;
  const questions=await db().from('study_summary_questions').delete().eq('summary_id',id);if(questions.error)throw questions.error;
  const targets=await db().from('study_summary_target_students').delete().eq('summary_id',id);if(targets.error)throw targets.error;
  const packages=await db().from('study_summary_package_items').delete().eq('summary_id',id);if(packages.error)throw packages.error;
  const del=await db().from('study_summaries').delete().eq('id',id);if(del.error)throw del.error;
  selectedProductId='';$('#ss-v2-settings').style.display='none';await refreshProducts();status('ss-v2-source-status','تم حذف المنتج وجميع سجلاته المرتبطة.',true);
 }catch(e){status('ss-v2-source-status',e.message||String(e));}
}
async function refreshOrders(){
 const sbc=db();if(!sbc||orderBusy)return;orderBusy=true;
 try{
  const {data,error}=await sbc.from('study_summary_orders').select('id,student_id,summary_id,amount,status,payment_reference,payment_proof_path,created_at,order_code').order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  const rows=data||[];$('#ss-v2-pending').textContent=rows.filter(x=>x.status==='pending_payment').length;
  const ids=[...new Set(rows.map(x=>x.student_id))],sids=[...new Set(rows.map(x=>x.summary_id))];
  const [st,sm]=await Promise.all([ids.length?sbc.from('students').select('id,name,enrollment_number').in('id',ids):Promise.resolve({data:[],error:null}),sids.length?sbc.from('study_summaries').select('id,title').in('id',sids):Promise.resolve({data:[],error:null})]);
  if(st.error)throw st.error;if(sm.error)throw sm.error;
  const studentsMap=new Map((st.data||[]).map(x=>[String(x.id),x])),summariesMap=new Map((sm.data||[]).map(x=>[x.id,x]));
  const box=$('#ss-v2-orders');
  box.innerHTML=rows.length?rows.map(o=>{
   const student=studentsMap.get(String(o.student_id))||{},summary=summariesMap.get(o.summary_id)||{};
   return '<div style="border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap"><div style="min-width:190px;flex:1"><strong>'+esc(student.name||'طالب')+'</strong><div style="font-size:12px;color:var(--muted)">'+esc(summary.title||'ملخص')+' · قيد '+esc(student.enrollment_number||student.id||'—')+'</div><div style="font-size:12px;margin-top:4px">طلب: '+esc(o.order_code||o.id)+' · '+Number(o.amount||0).toLocaleString('ar-EG')+' ج.م · تحويل: '+esc(o.payment_reference||'غير مسجل')+'</div></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="badge '+(o.status==='paid'?'badge-success':o.status==='rejected'?'badge-danger':'badge-warning')+'">'+esc(({paid:'مدفوع',pending_payment:'بانتظار المراجعة',rejected:'مرفوض',expired:'منتهي',cancelled:'ملغي'})[o.status]||o.status)+'</span>'+(o.payment_proof_path?'<button type="button" class="btn btn-outline btn-sm" data-proof="'+esc(o.id)+'">فتح الإيصال</button>':'')+(o.status==='pending_payment'?'<button type="button" class="btn btn-gold btn-sm" data-approve="'+esc(o.id)+'">اعتماد الدفع</button><button type="button" class="btn btn-outline btn-sm" data-reject="'+esc(o.id)+'">رفض</button>':'')+'</div></div>';
  }).join(''):'<div style="padding:18px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:10px">لا توجد طلبات شراء حتى الآن.</div>';
  box.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click',()=>reviewOrder(b.dataset.approve,'paid')));
  box.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',()=>{const reason=prompt('سبب الرفض (اختياري):','الإيصال غير واضح أو بيانات التحويل غير مطابقة.');if(reason!==null)reviewOrder(b.dataset.reject,'rejected',reason);}));
  box.querySelectorAll('[data-proof]').forEach(b=>b.addEventListener('click',()=>openProof(b.dataset.proof,rows)));
 }catch(e){$('#ss-v2-orders').textContent='تعذر تحميل الطلبات: '+(e.message||String(e));}
 finally{orderBusy=false;}
}
async function reviewOrder(id,newStatus,reason=''){
 try{const {error}=await db().rpc('admin_review_study_summary_order',{p_order_id:id,p_status:newStatus,p_reason:reason||null});if(error)throw error;await refreshOrders();status('ss-v2-source-status','تم تحديث حالة طلب الشراء.',true);}
 catch(e){status('ss-v2-source-status',e.message||String(e));}
}
async function openProof(id,rows){
 const order=rows.find(x=>x.id===id);if(!order?.payment_proof_path)return;
 const {data,error}=await db().storage.from('study-summary-pdfs').createSignedUrl(order.payment_proof_path,900);
 if(error) return status('ss-v2-source-status',error.message);
 window.open(data.signedUrl,'_blank','noopener');
}
function wire(){
 const page=$('#page-study-summaries');if(!page)return;
 if(!mounted){markup();mounted=true;refreshProducts();refreshOrders();purgeStorage();loadStudents().catch(e=>status('ss-v2-source-status',e.message||String(e)));}
 hideOld();
 if(!storageReady&&!storageBusy&&Date.now()-lastPurgeAttempt>10000){lastPurgeAttempt=Date.now();purgeStorage();}
 if(page.style.display!=='none'&&Date.now()-lastRefreshAt>8000){lastRefreshAt=Date.now();refreshProducts();refreshOrders();}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('#page-study-summaries')){refreshProducts();refreshOrders();}});
window.addEventListener('focus',()=>{if($('#page-study-summaries')){refreshProducts();refreshOrders();}});
setInterval(wire,700);setTimeout(wire,150);
})();