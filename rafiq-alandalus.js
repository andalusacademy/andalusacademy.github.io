(function () {
'use strict';
if (window.__andalusRafiqInstalled) return;
window.__andalusRafiqInstalled = true;
var ID='andalus-rafiq-root',busy=false,voiceCache=null;
var css=[
'#'+ID+'{position:fixed;z-index:2147483000;left:0;right:0;bottom:0;height:98px;pointer-events:none;overflow:visible;direction:ltr}',
'#'+ID+' .runner{position:absolute;left:0;bottom:3px;width:78px;height:92px;pointer-events:auto;animation:rafiqPatrol 13s ease-in-out infinite alternate}',
'#'+ID+' .stage{width:78px;height:92px;position:relative;cursor:pointer;filter:drop-shadow(0 7px 5px #183d5830)}',
'#'+ID+' svg{width:100%;height:100%;overflow:visible;animation:rafiqHop .78s ease-in-out infinite}',
'#'+ID+' .head{transform-box:fill-box;transform-origin:center bottom;animation:rafiqNod 2s ease-in-out infinite}',
'#'+ID+' .armL,#'+ID+' .armR{transform-box:fill-box;transform-origin:top center;animation:rafiqSwing .65s ease-in-out infinite alternate}',
'#'+ID+' .armR{animation-delay:-.32s}',
'#'+ID+' .legL,#'+ID+' .legR{transform-box:fill-box;transform-origin:top center;animation:rafiqRun .42s ease-in-out infinite alternate}',
'#'+ID+' .legR{animation-delay:-.21s}',
'#'+ID+' .mouth{transform-box:fill-box;transform-origin:center;animation:rafiqMouth .2s ease-in-out infinite alternate}',
'#'+ID+'.talk .mouth{animation-duration:.13s}',
'#'+ID+' .tap{position:absolute;inset:0;border:0;background:transparent;cursor:pointer}',
'#'+ID+' .heart-pop{position:absolute;z-index:5;pointer-events:none;color:#f21f45;font-family:Arial,sans-serif;font-size:17px;line-height:1;text-shadow:0 2px 5px #b0003033;animation:rafiqHeartFloat 1.15s ease-out forwards}',
'@keyframes rafiqHeartFloat{0%{opacity:0;transform:translate(0,8px) scale(.35) rotate(-12deg)}15%{opacity:1;transform:translate(0,0) scale(1.1) rotate(8deg)}100%{opacity:0;transform:translate(var(--dx),-76px) scale(.65) rotate(var(--rot))}}',
'#'+ID+' .runner.turn svg{animation:rafiqSpin .65s ease-in-out}',
'#'+ID+' .runner.karate .armL{animation:rafiqBlock .7s ease-in-out}',
'#'+ID+' .runner.karate .armL,#'+ID+' .runner.kungfu .armL{animation:rafiqBlock .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.karate .armR{animation:rafiqPunch .7s ease-in-out}',
'#'+ID+' .runner.karate .legR{animation:rafiqKick .7s ease-in-out}',
'#'+ID+' .runner.kungfu .armL{animation:rafiqBlock .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu .stage,#'+ID+' .runner.karate .stage{animation:rafiqFightBounce .42s ease-in-out 4 alternate}',
'#'+ID+' .runner.karate .armR{animation:rafiqPunch .36s ease-in-out 3 alternate}',
'#'+ID+' .runner.karate .legR{animation:rafiqKick .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu .armR{animation:rafiqPunch .36s ease-in-out 3 alternate}',
'#'+ID+' .runner.kungfu .legR{animation:rafiqKick .48s ease-in-out 2 alternate}',
'@keyframes rafiqFightBounce{0%{transform:translateY(0) rotate(-7deg)}50%{transform:translateY(-17px) rotate(8deg)}100%{transform:translateY(-3px) rotate(-5deg)}}'
'#'+ID+' .runner.kungfu .armR{animation:rafiqPunch .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu .legR{animation:rafiqKick .62s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu svg{animation:rafiqHop .36s ease-in-out infinite}',
'@keyframes rafiqPatrol{0%{left:4px;transform:scaleX(1)}48%{left:calc(100% - 82px);transform:scaleX(1)}52%{left:calc(100% - 82px);transform:scaleX(-1)}100%{left:4px;transform:scaleX(-1)}}',
'@keyframes rafiqHop{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-13px) rotate(-4deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-8px) rotate(4deg)}}',
'@keyframes rafiqNod{50%{transform:rotate(5deg)}}@keyframes rafiqSwing{to{transform:rotate(24deg)}}',
'@keyframes rafiqRun{to{transform:rotate(28deg)}}@keyframes rafiqMouth{to{transform:scaleY(1.7)}}',
'@keyframes rafiqSpin{to{transform:rotate(360deg)}}@keyframes rafiqBlock{50%{transform:rotate(-85deg)}}',
'@keyframes rafiqPunch{50%{transform:rotate(95deg)}}@keyframes rafiqKick{50%{transform:rotate(72deg) translateX(10px)}}',
'@media(prefers-reduced-motion:reduce){#'+ID+' .runner{animation:none;left:10px}#'+ID+' svg,#'+ID+' *{animation:none!important}}'
].join('');
function addStyle(){if(document.getElementById('andalus-rafiq-style'))return;var s=document.createElement('style');s.id='andalus-rafiq-style';s.textContent=css;document.head.appendChild(s)}
function robotSvg(){return '<svg viewBox="0 0 180 210" role="img" aria-label="روبوت رفيق الأندلس الكيوت">'+
'<defs><linearGradient id="rCuteBody" x1="0" y1="0" x2="0.9" y2="1"><stop stop-color="#fff"/><stop offset=".65" stop-color="#eaf7ff"/><stop offset="1" stop-color="#b8d9ed"/></linearGradient><linearGradient id="rCuteBlue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#65dcff"/><stop offset="1" stop-color="#159bd4"/></linearGradient></defs>'+
'<ellipse cx="90" cy="198" rx="48" ry="7" fill="#163e5a" opacity=".13"/>'+
'<g class="legL"><path d="M67 157l-3 22q-1 9 9 10h8q9-2 7-11l-3-21" fill="url(#rCuteBody)" stroke="#4d7893" stroke-width="4"/><path d="M61 184q-3 11 9 13h15q10-2 7-12l-5-5H67z" fill="#168fc6" stroke="#28617f" stroke-width="3"/><path d="M69 189q8 4 16 0" fill="none" stroke="#b9f2ff" stroke-width="3" stroke-linecap="round"/></g>'+
'<g class="legR"><path d="M99 157l-3 22q-1 9 9 10h8q9-2 7-11l-3-21" fill="url(#rCuteBody)" stroke="#4d7893" stroke-width="4"/><path d="M93 184q-3 11 9 13h15q10-2 7-12l-5-5H99z" fill="#168fc6" stroke="#28617f" stroke-width="3"/><path d="M101 189q8 4 16 0" fill="none" stroke="#b9f2ff" stroke-width="3" stroke-linecap="round"/></g>'+
'<path d="M90 89v-12" stroke="#4d7893" stroke-width="6" stroke-linecap="round"/><circle cx="90" cy="72" r="9" fill="#ffd35c" stroke="#4d7893" stroke-width="3"/>'+
'<rect x="42" y="88" width="96" height="78" rx="30" fill="url(#rCuteBody)" stroke="#4d7893" stroke-width="5"/><rect x="74" y="113" width="32" height="31" rx="13" fill="#2aa8d8" opacity=".9"/><path d="M82 127h16" stroke="#eaffff" stroke-width="4" stroke-linecap="round"/><circle cx="90" cy="153" r="5" fill="#ffd35c"/>'+
'<g class="armL"><path d="M47 111Q31 119 26 137" fill="none" stroke="#4d7893" stroke-width="13" stroke-linecap="round"/><path d="M26 137l-3 9" stroke="#bde8f8" stroke-width="13" stroke-linecap="round"/><circle cx="21" cy="150" r="11" fill="url(#rCuteBlue)" stroke="#4d7893" stroke-width="3"/><path d="M17 150h8" stroke="#eaffff" stroke-width="3" stroke-linecap="round"/></g>'+
'<g class="armR"><path d="M133 111q16 8 21 26" fill="none" stroke="#4d7893" stroke-width="13" stroke-linecap="round"/><path d="M154 137l3 9" stroke="#bde8f8" stroke-width="13" stroke-linecap="round"/><circle cx="159" cy="150" r="11" fill="url(#rCuteBlue)" stroke="#4d7893" stroke-width="3"/><path d="M155 150h8" stroke="#eaffff" stroke-width="3" stroke-linecap="round"/></g>'+
'<g class="head"><rect x="28" y="12" width="124" height="91" rx="37" fill="url(#rCuteBody)" stroke="#4d7893" stroke-width="5"/><rect x="39" y="25" width="102" height="62" rx="25" fill="#16435f"/><ellipse cx="68" cy="53" rx="11" ry="14" fill="#76e5ff"/><ellipse cx="112" cy="53" rx="11" ry="14" fill="#76e5ff"/><circle cx="72" cy="48" r="4" fill="#fff"/><circle cx="116" cy="48" r="4" fill="#fff"/><ellipse cx="51" cy="69" rx="8" ry="4" fill="#ff9fb1" opacity=".8"/><ellipse cx="129" cy="69" rx="8" ry="4" fill="#ff9fb1" opacity=".8"/><path class="mouth" d="M75 68q15 18 30 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="25" cy="58" r="9" fill="#55c9ed" stroke="#4d7893" stroke-width="3"/><circle cx="155" cy="58" r="9" fill="#55c9ed" stroke="#4d7893" stroke-width="3"/></g></svg>'}

function getStudent(){try{return typeof unifiedPortalStudent!=='undefined'?unifiedPortalStudent:null}catch(e){return null}}
function getDb(){try{return typeof sb!=='undefined'?sb:null}catch(e){return null}}
function mount(){addStyle();var old=document.getElementById(ID);if(old)return old;var r=document.createElement('div');r.id=ID;r.innerHTML='<div class="runner"><div class="stage">'+robotSvg()+'<button class="tap" type="button" aria-label="اضغط لسماع رفيق الأندلس"></button></div></div>';document.body.appendChild(r);r.querySelector('.tap').addEventListener('click',function(){spawnHearts(r);void play(true)});return r}
function spawnHearts(root){var stage=root.querySelector('.stage');if(!stage)return;for(var i=0;i<7;i++){(function(index){var h=document.createElement('span');h.className='heart-pop';h.textContent='♥';h.style.left=(12+Math.random()*62)+'px';h.style.top=(20+Math.random()*38)+'px';h.style.setProperty('--dx',((Math.random()-.5)*55)+'px');h.style.setProperty('--rot',((Math.random()-.5)*55)+'deg');h.style.animationDelay=(index*45)+'ms';stage.appendChild(h);setTimeout(function(){h.remove()},1450)})(i)}}
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
 var malePattern=/male|man|mascul|boy|young|shakir|hesham|mohamed|ahmed|omar|khaled|tarek|طارق|حسام|محمد|عمر|أحمد|خالد|مصطفى|محمود/i;
 var femalePattern=/female|woman|girl|zira|samantha|victoria|karen|susan|female|هند|ليلى|منى|سارة/i;
 voiceCache=voices;
 var arabic=voices.filter(function(v){return /^ar([_-]|$)/i.test(v.lang||'')});
 var egyptian=arabic.filter(function(v){return /^ar[-_]EG$/i.test(v.lang||'')});
 // Prefer a voice explicitly identifiable as masculine; device voice metadata cannot guarantee gender or age.
 return egyptian.find(function(v){return malePattern.test(v.name||'')&&!femalePattern.test(v.name||'')})||
        arabic.find(function(v){return malePattern.test(v.name||'')&&!femalePattern.test(v.name||'')})||
        voices.find(function(v){return malePattern.test(v.name||'')&&!femalePattern.test(v.name||'')})||
        egyptian[0]||arabic[0]||voices[0]||null
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
function speakOnce(text){
 return new Promise(function(resolve){
  if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance){console.warn('Rafiq: SpeechSynthesis غير مدعوم في المتصفح');resolve(false);return}
  var synth=window.speechSynthesis,voice=arabicVoice(),u=new SpeechSynthesisUtterance(spokenText(text)),finished=false;
  u.lang=voice&&voice.lang?voice.lang:'ar-EG';if(voice)u.voice=voice;
  u.rate=.9;u.pitch=.58;u.volume=1;
  function done(ok){if(finished)return;finished=true;clearTimeout(safety);var root=document.getElementById(ID);if(root)root.classList.remove('talk');resolve(ok)}
  // Some mobile speech engines omit onend; release the queue after a safety timeout.
  var safety=setTimeout(function(){if(!finished){try{synth.cancel()}catch(e){}done(false)}},12000);
  u.onstart=function(){var root=document.getElementById(ID);if(root)root.classList.add('talk')};
  u.onend=function(){done(true)};
  u.onerror=function(e){console.warn('Rafiq speech error:',e.error,'lang:',u.lang);done(false)};
  try{synth.resume();synth.speak(u)}catch(e){console.warn('Rafiq speak failed:',e);done(false)}
 });
}
async function play(replay){
 var student=getStudent();if(busy||!student||!student.id)return;busy=true;
 try{
  var root=mount();kungfuCombo(root);
  var name=String(student.name||'يا بطل').trim().split(/\s+/).slice(0,2).join(' ');
  // Start speech directly in the tap gesture, then speak the remaining information as one utterance.
  var intro='إزيك يا '+name+'؟ عامل إيه يا بطل؟ أنا رفيق الأندلس، صاحبك الصغير في الأكاديمية. هفكرك بإيه؟ هفكرك تتابع إشعارات الأكاديمية، ومواعيد الامتحانات، ودرجاتك، والملخصات والفيديوهات، وتراجع الغياب والرسوم. يعني مش هسيبك تنسى حاجة مهمة!';
  var introFinished=speakOnce(intro);
  var details=[];try{details=await loadFacts()}catch(e){console.warn('Rafiq facts unavailable:',e);details=['مش قادر أوصل لبياناتك دلوقتي، تابع إشعاراتك وبياناتك من بوابة الطالب.']}
  // Do not let a missing mobile onend event block the rest of Rafiq's message.
  await Promise.race([introFinished,new Promise(function(resolve){setTimeout(resolve,12500)})]);
  var rest=['وبالمناسبة، أنا كمان بحب أتحرك! استعدوا لحركات الكونغ فو والكاراتيه! هوب! هاا!','عاش يا بطل! تابع إشعارات الأكاديمية، ومواعيد امتحاناتك، ودرجاتك، والملخصات والفيديوهات المتاحة ليك.']
   .concat(details.map(function(x){return String(x).replace(/بص يا بطل/g,'بص يا نجم').replace(/خلي بالك/g,'خد بالك').replace(/لحد دلوقتي/g,'لغاية دلوقتي')}))
   .concat(['شد حيلك يا بطل، إنت قدها وقدود! يلا سلام يا نجم.']).join(' ');
  await speakOnce(rest);
 }finally{busy=false}
}
function install(){var original=window.renderStudentPortalMenu;if(typeof original!=='function'||original.__rafiqWrapped)return false;var wrapped=function(){var result=original.apply(this,arguments);if(getStudent()&&getStudent().id)mount();return result};wrapped.__rafiqWrapped=true;window.renderStudentPortalMenu=wrapped;return true}
if(!install()){var attempts=0,t=setInterval(function(){attempts++;if(install()||attempts>80)clearInterval(t)},250)}
document.addEventListener('visibilitychange',function(){if(document.hidden&&'speechSynthesis'in window)try{window.speechSynthesis.cancel()}catch(e){}});
window.addEventListener('pagehide',function(){if('speechSynthesis'in window)try{window.speechSynthesis.cancel()}catch(e){}});
if('speechSynthesis'in window)window.speechSynthesis.onvoiceschanged=function(){arabicVoice()};
})();