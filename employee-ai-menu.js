(()=>{
'use strict';
const SUPABASE_URL='https://uvwarprsghwvrfmdaaqv.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1dndhcnByc2dod3ZyZm1kYWFxdiIsInJlZiI6InV2d2FycHJzZ2h3dnJmbWRhYXF2Iiwicm9sZSI6ImFub24ifQ';
function removePublicAI(){document.querySelectorAll('#andalus-ai-launcher,#andalus-ai-overlay,[href*="andalus-ai"],iframe[src*="andalus-ai"]').forEach(e=>e.remove());document.querySelectorAll('body *').forEach(e=>{const t=(e.textContent||'').trim();if(t.length<80&&/Andalus\s*AI|أندلس\s*AI/i.test(t)){const x=e.closest('.nav-item,.nav-card,a,button')||e;if(x&&x!==document.body)x.remove();}})}
async function addForEmployee(){
 removePublicAI();
 const sidebar=document.querySelector('.sidebar-nav');
 if(!sidebar||sidebar.querySelector('[data-employee-ai]'))return;
 let client=window.sb;
 try{if(!client&&window.supabase)client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});if(!client)return;const s=await client.auth.getSession();if(!s?.data?.session)return;const r=await client.rpc('is_admin');if(r?.error||r?.data!==true)return;}catch(_){return;}
 const item=document.createElement('div');item.className='nav-item';item.dataset.employeeAi='1';item.innerHTML='<span class="nav-icon">🧠</span><span>Andalus AI</span>';item.title='المساعد الإداري الذكي — للموظفين فقط';item.onclick=()=>{window.location.href='employee-ai.html';};
 const target=Array.from(sidebar.querySelectorAll('.nav-item')).find(x=>/الامتحان|التقارير|الإدارة|الرئيسية/.test(x.textContent||''));
 if(target)target.insertAdjacentElement('afterend',item);else sidebar.appendChild(item);
}
function loadEmployeeActivityAudit(){if(window.__employeeActivityAuditLoaded)return;window.__employeeActivityAuditLoaded=true;const s=document.createElement('script');s.src='employee-activity-log.js?v=1';s.async=true;s.onload=()=>window.employeeActivityLog?.init?.();document.head.appendChild(s);}
function boot(){removePublicAI();addForEmployee();loadEmployeeActivityAudit();setTimeout(addForEmployee,1200);setTimeout(addForEmployee,3000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
new MutationObserver(()=>{clearTimeout(window.__aiMenuTimer);window.__aiMenuTimer=setTimeout(()=>{removePublicAI();addForEmployee();},200)}).observe(document.documentElement,{childList:true,subtree:true});
})();
