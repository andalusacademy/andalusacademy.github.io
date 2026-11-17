(function () {
'use strict';
if (window.__andalusRafiqInstalled) return;
window.__andalusRafiqInstalled = true;
var ID='andalus-rafiq-root',busy=false,voiceCache=null;
var css=[
'#'+ID+'{position:fixed;z-index:2147483000;left:0;right:0;bottom:0;height:142px;pointer-events:none;overflow:visible;direction:ltr}',
'#'+ID+' .runner{position:absolute;left:0;bottom:3px;width:112px;height:132px;pointer-events:auto;animation:rafiqPatrol 13s ease-in-out infinite alternate}',
'#'+ID+' .stage{width:112px;height:132px;position:relative;cursor:pointer;filter:drop-shadow(0 7px 5px #183d5830)}',
'#'+ID+' svg{width:100%;height:100%;overflow:visible;animation:rafiqHop .78s ease-in-out infinite}',
'#'+ID+' .head{transform-box:fill-box;transform-origin:center bottom;animation:rafiqNod 2s ease-in-out infinite}',
'#'+ID+' .armL,#'+ID+' .armR{transform-box:fill-box;transform-origin:top center;animation:rafiqSwing .65s ease-in-out infinite alternate}',
'#'+ID+' .armR{animation-delay:-.32s}',
'#'+ID+' .legL,#'+ID+' .legR{transform-box:fill-box;transform-origin:top center;animation:rafiqRun .42s ease-in-out infinite alternate}',
'#'+ID+' .legR{animation-delay:-.21s}',
'#'+ID+' .mouth{transform-box:fill-box;transform-origin:center;animation:rafiqMouth .2s ease-in-out infinite alternate}',
'#'+ID+'.talk .mouth{animation-duration:.13s}',
'#'+ID+' .tap{position:absolute;inset:0;border:0;background:transparent;cursor:pointer}',
'#'+ID+' .runner.turn svg{animation:rafiqSpin .65s ease-in-out}',
'#'+ID+' .runner.karate .armL{animation:rafiqBlock .7s ease-in-out}',
'#'+ID+' .runner.karate .armR{animation:rafiqPunch .7s ease-in-out}',
'#'+ID+' .runner.karate .legR{animation:rafiqKick .7s ease-in-out}',
'@keyframes rafiqPatrol{0%{left:4px;transform:scaleX(1)}48%{left:calc(100% - 116px);transform:scaleX(1)}52%{left:calc(100% - 116px);transform:scaleX(-1)}100%{left:4px;transform:scaleX(-1)}}',
'@keyframes rafiqHop{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-13px) rotate(-4deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-8px) rotate(4deg)}}',
'@keyframes rafiqNod{50%{transform:rotate(5deg)}}@keyframes rafiqSwing{to{transform:rotate(24deg)}}',
'@keyframes rafiqRun{to{transform:rotate(28deg)}}@keyframes rafiqMouth{to{transform:scaleY(1.7)}}',
'@keyframes rafiqSpin{to{transform:rotate(360deg)}}@keyframes rafiqBlock{50%{transform:rotate(-85deg)}}',
'@keyframes rafiqPunch{50%{transform:rotate(95deg)}}@keyframes rafiqKick{50%{transform:rotate(72deg) translateX(10px)}}',
'@media(prefers-reduced-motion:reduce){#'+ID+' .runner{animation:none;left:10px}#'+ID+' svg,#'+ID+' *{animation:none!important}}'
].join('');
function addStyle(){if(document.getElementById('andalus-rafiq-style'))return;var s=document.createElement('style');s.id='andalus-rafiq-style';s.textContent=css;document.head.appendChild(s)}
function robotSvg(){return '<svg viewBox="0 0 180 210" role="img" aria-label="روبوت رفيق الأندلس">'+
'<defs><linearGradient id="rMetal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffffff"/><stop offset=".48" stop-color="#b8c9d5"/><stop offset="1" stop-color="#718b9e"/></linearGradient><linearGradient id="rBlue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#36c9f2"/><stop offset="1" stop-color="#0875b2"/></linearGradient></defs>'+
'<g class="legL"><rect x="54" y="151" width="22" height="36" rx="9" fill="url(#rMetal)" stroke="#405c70" stroke-width="4"/><rect x="43" y="181" width="42" height="17" rx="8" fill="#234a68" stroke="#102f48" stroke-width="3"/><circle cx="64" cy="189" r="4" fill="#5dd8ff"/></g>'+
'<g class="legR"><rect x="104" y="151" width="22" height="36" rx="9" fill="url(#rMetal)" stroke="#405c70" stroke-width="4"/><rect x="95" y="181" width="42" height="17" rx="8" fill="#234a68" stroke="#102f48" stroke-width="3"/><circle cx="116" cy="189" r="4" fill="#5dd8ff"/></g>'+
'<rect x="48" y="88" width="84" height="73" rx="22" fill="url(#rMetal)" stroke="#405c70" stroke-width="5"/><rect x="61" y="101" width="58" height="38" rx="12" fill="#163d59"/><path d="M75 119h30" stroke="#39c8f4" stroke-width="5" stroke-linecap="round"/><circle cx="90" cy="149" r="5" fill="#e8b94e"/>'+
'<g class="armL"><path d="M49 103L31 129" stroke="#536f82" stroke-width="13" stroke-linecap="round"/><path d="M31 129l-7 14" stroke="url(#rMetal)" stroke-width="13" stroke-linecap="round"/><circle cx="22" cy="147" r="11" fill="url(#rBlue)" stroke="#31566d" stroke-width="3"/></g>'+
'<g class="armR"><path d="M131 103l18 26" stroke="#536f82" stroke-width="13" stroke-linecap="round"/><path d="M149 129l7 14" stroke="url(#rMetal)" stroke-width="13" stroke-linecap="round"/><circle cx="158" cy="147" r="11" fill="url(#rBlue)" stroke="#31566d" stroke-width="3"/></g>'+
'<g class="head"><rect x="38" y="17" width="104" height="78" rx="27" fill="url(#rMetal)" stroke="#405c70" stroke-width="5"/><rect x="48" y="30" width="84" height="48" rx="17" fill="#153b57"/><ellipse cx="70" cy="52" rx="9" ry="12" fill="#54d8ff"/><ellipse cx="110" cy="52" rx="9" ry="12" fill="#54d8ff"/><circle cx="73" cy="48" r="3" fill="#fff"/><circle cx="113" cy="48" r="3" fill="#fff"/><path class="mouth" d="M77 66q13 12 26 0" fill="none" stroke="#8beaff" stroke-width="4" stroke-linecap="round"/><path d="M90 17V7" stroke="#526e82" stroke-width="5"/><circle cx="90" cy="6" r="7" fill="#f5c34f" stroke="#526e82" stroke-width="3"/><circle cx="36" cy="54" r="8" fill="#36b9e5" stroke="#405c70" stroke-width="3"/><circle cx="144" cy="54" r="8" fill="#36b9e5" stroke="#405c70" stroke-width="3"/></g></svg>'}
function getStudent(){try{return typeof unifiedPortalStudent!=='undefined'?unifiedPortalStudent:null}catch(e){return null}}
function getDb(){try{return typeof sb!=='undefined'?sb:null}catch(e){return null}}
function mount(){addStyle();var old=document.getElementById(ID);if(old)return old;var r=document.createElement('div');r.id=ID;r.innerHTML='<div class="runner"><div class="stage">'+robotSvg()+'<button class="tap" type="button" aria-label="اضغط لسماع رفيق الأندلس"></button></div></div>';document.body.appendChild(r);r.querySelector('.tap').addEventListener('click',function(){void play(true)});return r}
function safeText(x){return String(x||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,260)}
function numberWords(value){var n=Math.max(0,Math.floor(Number(value)||0));var ones=['صفر','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];var tens=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];function under100(x){if(x<20)return ones[x];var t=Math.floor(x/10),u=x%10;return u?ones[u]+' و'+tens[t]:tens[t]}if(n<100)return under100(n);if(n<1000){var h=Math.floor(n/100),r=n%100;var hw=['','مئة','مئتان','ثلاثمئة','أربعمئة','خمسمئة','ستمئة','سبعمئة','ثمانمئة','تسعمئة'][h];return hw+(r?' و'+under100(r):'')}if(n<1000000){var th=Math.floor(n/1000),r=n%1000;var tw=th===1?'ألف':th===2?'ألفان':under100(th)+' ألف';return tw+(r?' و'+numberWords(r):'')}return String(n)}
function spokenText(s){return String(s||'').replace(/[٠-٩0-9]+/g,function(v){var n=parseInt(v.replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d)}),10);return numberWords(n)})}
function money(x){return numberWords(Math.round(Number(x)||0))+' جنيه'}
async function loadFacts(){
 var student=getStudent(),phone='';try{phone=typeof unifiedPortalPhone!=='undefined'?unifiedPortalPhone:''}catch(e){}
 var db=getDb();if(!student||!student.id||!phone||!db)throw new Error('student session unavailable');
 var res=await Promise.all([
 db.rpc('get_portal_notifications',{p_student_id:String(student.id),p_phone:String(phone),p_portal_type:'student'}),
 db.from('attendance').select('status').eq('student_id',student.id),
 db.from('payments').select('*').eq('student_id',student.id)
 ]);
 var out=[],n=res[0],a=res[1],p=res[2];
 if(!n.error&&n.data&&n.data.verified){var unread=(n.data.notifications||[]).filter(function(x){return x.show_on_login===true&&x.is_read!==true});if(unread.length){out.push('عندك '+numberWords(unread.length)+' إشعار جديد من الأكاديمية.');unread.slice(0,3).forEach(function(x){var title=safeText(x.title),body=safeText(x.body);if(title)out.push('تنبيه: '+title+(body?'. '+body:''))})}else out.push('مفيش إشعارات جديدة عندك دلوقتي.')}
 if(!a.error&&Array.isArray(a.data)){var absent=a.data.filter(function(x){var s=String(x.status||'').replace(/[أإآ]/g,'ا').trim();return s==='غائب'||s==='غائبة'}).length;out.push(absent?'عدد مرات الغياب المسجلة عليك '+numberWords(absent)+'.':'مفيش غياب مسجل عليك حتى الآن.')}
 if(!p.error&&Array.isArray(p.data)){var map={};p.data.forEach(function(x){map[x.payment_type]=x});var remaining=null,late=0;try{if(typeof getPaymentSchedule==='function'&&typeof getStudentPaymentSummary==='function'){var summary=getStudentPaymentSummary(student,getPaymentSchedule(student),map);remaining=Number(summary.remaining)||0;late=Number(summary.lateFeesDue)||0}}catch(e){}var extras=0;['شنطة_ادوات','فتح_ملف','كورس_انجليزى'].forEach(function(k){var x=map[k];if(x&&x.applicable!==false&&x.paid!==true)extras+=Math.max(0,Number(x.amount)||0)});if(remaining!==null)out.push(remaining?'المتبقي من رسوم البرنامج '+money(remaining)+'.':'رسوم البرنامج مسددة بالكامل حسب السجلات الحالية.');if(late)out.push('غرامات التأخير المسجلة '+money(late)+'.');if(extras)out.push('المصروفات المستقلة غير المسددة '+money(extras)+'.');if(remaining===null&&!extras)out.push('تعذر حساب رصيد الرسوم بدقة من سجلات النظام الحالية.')}
 return out
}
function arabicVoice(){
 if(!('speechSynthesis'in window))return null;
 var voices=window.speechSynthesis.getVoices()||[];
 voiceCache=voices.filter(function(v){return /^ar([_-]|$)/i.test(v.lang||'')});
 return voiceCache.find(function(v){return /EG/i.test(v.lang||'')})||voiceCache[0]||null
}
function speak(parts){
 if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance)return false;
 var voice=arabicVoice();
 if(!voice){console.warn('Rafiq: no Arabic speech voice installed/available in this browser.');return false}
 var synth=window.speechSynthesis,chunks=parts.filter(Boolean).map(spokenText),i=0;
 function next(){if(i>=chunks.length){var root=document.getElementById(ID);if(root)root.classList.remove('talk');return}var u=new SpeechSynthesisUtterance(chunks[i++]);u.lang=voice.lang;u.voice=voice;u.rate=.88;u.pitch=.98;u.onstart=function(){var root=document.getElementById(ID);if(root)root.classList.add('talk')};u.onend=next;u.onerror=function(e){console.warn('Rafiq speech error:',e.error);next()};synth.speak(u)}
 try{synth.cancel();next();return true}catch(e){return false}
}
async function play(replay){
 var student=getStudent();if(busy||!student||!student.id)return;busy=true;
 try{
  var root=mount(),runner=root.querySelector('.runner');
  runner.classList.add('karate');setTimeout(function(){runner.classList.remove('karate');runner.classList.add('turn');setTimeout(function(){runner.classList.remove('turn')},700)},900);
  var details=[];try{details=await loadFacts()}catch(e){console.warn('Rafiq facts unavailable:',e);details=['تابع إشعاراتك وبياناتك من بوابة الطالب.']}
  var name=String(student.name||'يا بطل').trim().split(/\s+/).slice(0,2).join(' ');
  var lines=['أهلاً يا '+name+'.','أنا رفيق الأندلس، صاحبك في الأكاديمية. يلا نبدأ يومنا بنشاط.','افتكر تراجع دروسك وتتابع بوابتك باستمرار.'].concat(details).concat(['شد حيلك يا بطل، وإحنا دايماً معاك. بالتوفيق!']);
  speak(lines);
 }finally{busy=false}
}
function install(){var original=window.renderStudentPortalMenu;if(typeof original!=='function'||original.__rafiqWrapped)return false;var wrapped=function(){var result=original.apply(this,arguments);if(getStudent()&&getStudent().id)setTimeout(function(){void play(false)},350);return result};wrapped.__rafiqWrapped=true;window.renderStudentPortalMenu=wrapped;return true}
if(!install()){var attempts=0,t=setInterval(function(){attempts++;if(install()||attempts>80)clearInterval(t)},250)}
document.addEventListener('visibilitychange',function(){if(document.hidden&&'speechSynthesis'in window)try{window.speechSynthesis.cancel()}catch(e){}});
window.addEventListener('pagehide',function(){if('speechSynthesis'in window)try{window.speechSynthesis.cancel()}catch(e){}});
if('speechSynthesis'in window)window.speechSynthesis.onvoiceschanged=function(){arabicVoice()};
})();