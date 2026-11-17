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
'#'+ID+' .runner.kungfu .armL{animation:rafiqBlock .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu .armR{animation:rafiqPunch .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu .legR{animation:rafiqKick .62s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu svg{animation:rafiqHop .36s ease-in-out infinite}',
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
 var result=await db.rpc('get_rafiq_student_facts',{p_student_id:String(student.id),p_phone:String(phone)});
 if(result.error)throw result.error;
 var facts=result.data||{};
 if(facts.verified!==true)throw new Error('student identity not verified');
 var out=[],attendance=Array.isArray(facts.attendance)?facts.attendance:[],payments=Array.isArray(facts.payments)?facts.payments:[];
 var absent=attendance.filter(function(x){var st=String(x.status||'').replace(/[أإآ]/g,'ا').trim();return st==='غائب'||st==='غائبة'}).length;
 out.push(absent?'بص يا بطل، متسجل عليك '+numberWords(absent)+' مرات غياب.':'تمام يا بطل، مفيش غياب متسجل عليك لحد دلوقتي.');
 if(payments.length){
  var map={};payments.forEach(function(x){if(x&&x.payment_type)map[x.payment_type]=x});
  var remaining=null,late=0;
  try{if(typeof getPaymentSchedule==='function'&&typeof getStudentPaymentSummary==='function'){var summary=getStudentPaymentSummary(student,getPaymentSchedule(student),map);remaining=Number(summary.remaining)||0;late=Number(summary.lateFeesDue)||0}}catch(e){console.warn('Rafiq payment calculation unavailable:',e)}
  var extras=0;['شنطة_ادوات','فتح_ملف','كورس_انجليزى'].forEach(function(k){var x=map[k];if(x&&x.applicable!==false&&x.paid!==true)extras+=Math.max(0,Number(x.amount)||0)});
  if(remaining!==null)out.push(remaining?'خلي بالك، باقي عليك '+money(remaining)+' من رسوم البرنامج.':'عاش، رسوم البرنامج مسددة بالكامل حسب السجلات.');
  if(late)out.push('وفيه غرامات تأخير مسجلة '+money(late)+'.');
  if(extras)out.push('وفيه مصروفات مستقلة لسه مستحقة '+money(extras)+'.');
  if(remaining===null&&!extras)out.push('محتاجين نراجع حساب الرسوم من لوحة الإدارة عشان أقولك الرقم بدقة.');
 }else out.push('مش ظاهر عندي سجل مصروفات ليك دلوقتي.');
 return out
}
function arabicVoice(){
 if(!('speechSynthesis'in window))return null;
 var voices=window.speechSynthesis.getVoices()||[];
 var arabic=voices.filter(function(v){return /^ar([_-]|$)/i.test(v.lang||'')});
 var egyptian=arabic.filter(function(v){return /^ar[-_]EG$/i.test(v.lang||'')});
 var malePattern=/male|man|mascul|shakir|hesham|mohamed|طارق|حسام|محمد|عمر/i;
 voiceCache=egyptian.length?egyptian:arabic;
 return egyptian.find(function(v){return malePattern.test(v.name||'')})||
        egyptian[0]||
        arabic.find(function(v){return malePattern.test(v.name||'')})||
        arabic[0]||null
}
function soundFx(kind){
 try{
  var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  var ctx=window.__andalusRafiqAudio;if(!ctx){ctx=new AC();window.__andalusRafiqAudio=ctx}
  if(ctx.state==='suspended')ctx.resume();
  var now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=kind==='hit'?'triangle':'sawtooth';
  var start=kind==='hit'?145:(kind==='kick'?390:620),end=kind==='hit'?48:85;
  osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(end,now+.19);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='hit'?.18:.09,now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+.22);
  osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.23);
 }catch(e){}
}
function kungfuCombo(root){
 var runner=root.querySelector('.runner');if(!runner)return;
 runner.classList.remove('karate','turn','kungfu');void runner.offsetWidth;runner.classList.add('kungfu');
 soundFx('whoosh');
 setTimeout(function(){soundFx('hit')},260);
 setTimeout(function(){soundFx('kick')},570);
 setTimeout(function(){soundFx('whoosh')},880);
 setTimeout(function(){runner.classList.add('karate');soundFx('hit')},1120);
 setTimeout(function(){runner.classList.remove('kungfu','karate');runner.classList.add('turn')},1550);
 setTimeout(function(){runner.classList.remove('turn')},2250);
}
var rafiqSpeechQueue=[],rafiqSpeechRunning=false;
function runSpeechQueue(){
 if(rafiqSpeechRunning||!rafiqSpeechQueue.length)return;
 if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance){console.warn('Rafiq: SpeechSynthesis غير مدعوم في المتصفح');rafiqSpeechQueue=[];return}
 var synth=window.speechSynthesis,voice=arabicVoice(),chunk=rafiqSpeechQueue.shift();
 var u=new SpeechSynthesisUtterance(chunk);
 u.lang=voice&&voice.lang?voice.lang:'ar-EG';
 if(voice)u.voice=voice;
 u.rate=.88;u.pitch=1;u.volume=1;
 rafiqSpeechRunning=true;
 var finished=false;
 function next(){if(finished)return;finished=true;rafiqSpeechRunning=false;var root=document.getElementById(ID);if(root)root.classList.remove('talk');setTimeout(runSpeechQueue,80)}
 u.onstart=function(){var root=document.getElementById(ID);if(root)root.classList.add('talk')};
 u.onend=next;
 u.onerror=function(e){console.warn('Rafiq speech error:',e.error,'lang:',u.lang);next()};
 try{
  synth.resume();
  synth.speak(u);
 }catch(e){console.warn('Rafiq speak failed:',e);next()}
}
function speak(parts,append){
 if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance){console.warn('Rafiq: SpeechSynthesis غير مدعوم في المتصفح');return false}
 var synth=window.speechSynthesis;
 var chunks=parts.filter(Boolean).map(spokenText);
 if(!append){rafiqSpeechQueue=[];rafiqSpeechRunning=false;try{synth.cancel()}catch(e){}}
 chunks.forEach(function(chunk){rafiqSpeechQueue.push(chunk)});
 // Resume and submit the first utterance immediately in the actual tap gesture.
 try{synth.resume()}catch(e){}
 runSpeechQueue();
 if(!arabicVoice())console.warn('Rafiq: لا يوجد صوت عربي ظاهر في قائمة الجهاز؛ طلبنا من محرك النظام النطق بالعربية ar-EG.');
 return true
}
async function play(replay){
 var student=getStudent();if(busy||!student||!student.id)return;busy=true;
 try{
  var root=mount();kungfuCombo(root);
  var name=String(student.name||'يا بطل').trim().split(/\\s+/).slice(0,2).join(' ');
  // Start speech synchronously inside the tap gesture before any network/database await.
  speak(['إزيك يا '+name+'؟ عامل إيه يا بطل؟','أنا رفيق الأندلس، صاحبك في الأكاديمية. يلا بينا نفوق ونبدأ يومنا بنشاط!','خد بالك، أنا جاهز! واحد، اتنين، تلاتة... كونغ فو! هُوب! هاااي!','عاش يا وحش! افتكر تذاكر وتراجع دروسك، وتبص على إشعاراتك كل يوم.'],false);
  var details=[];try{details=await loadFacts()}catch(e){console.warn('Rafiq facts unavailable:',e);details=['تابع إشعاراتك وبياناتك من بوابة الطالب.']}
  if(details.length)speak(details.map(function(x){return String(x).replace(/بص يا بطل/g,'بص يا نجم').replace(/خلي بالك/g,'خد بالك').replace(/لحد دلوقتي/g,'لغاية دلوقتي')}),true);
  speak(['شد حيلك يا بطل، إنت قدها وقدود! يلا سلام يا نجم.'],true);
 }finally{busy=false}
}
function install(){var original=window.renderStudentPortalMenu;if(typeof original!=='function'||original.__rafiqWrapped)return false;var wrapped=function(){var result=original.apply(this,arguments);if(getStudent()&&getStudent().id)mount();return result};wrapped.__rafiqWrapped=true;window.renderStudentPortalMenu=wrapped;return true}
if(!install()){var attempts=0,t=setInterval(function(){attempts++;if(install()||attempts>80)clearInterval(t)},250)}
document.addEventListener('visibilitychange',function(){if(document.hidden&&'speechSynthesis'in window)try{window.speechSynthesis.cancel()}catch(e){}});
window.addEventListener('pagehide',function(){if('speechSynthesis'in window)try{window.speechSynthesis.cancel()}catch(e){}});
if('speechSynthesis'in window)window.speechSynthesis.onvoiceschanged=function(){arabicVoice()};
})();