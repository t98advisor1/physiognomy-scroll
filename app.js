/* Browser-only application. No uploads, tracking, persistence, or face analysis. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const SITE = 'https://kwansang.vercel.app/';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const state = {screen:'home', answers:[null,null,null,null], question:0, index:0, sound:true, motion:!reduced.matches, effects:{mesh:false,ink:true,thermal:false}, yaw:0, zoom:1, custom:null};
const portrait = new Image(); portrait.src = 'assets/portrait.webp';
let stream=null, cameraRequest=0, frame=null, lastFrame=0, revealTimer=null, typingTimer=null, toastTimer=null, audio=null, keyNoise=null, typingTargets=[], followWriting=true, lastFollowAt=0;
const video=$('camera-video');
const dimensions = [
 ['큰 그림','직접 실행'],['일관성','유연한 전환'],['깊은 몰입','넓은 탐색'],['차분한 사색','함께 확장']
];
const mapTexts = [
 ['전체 방향을 떠올리며 배움의 지도를 그려 보기.','작은 시도를 통해 배우며 다음 단서를 찾아보기.'],
 ['함께 지킬 기준을 정하고 믿을 수 있는 과정 만들기.','여러 의견을 듣고 상황에 맞는 방법을 다시 찾아보기.'],
 ['좋아하는 주제를 오래 들여다보고 미세한 차이 발견하기.','서로 다른 분야를 만나며 뜻밖의 연결 발견하기.'],
 ['혼자 정리하는 시간을 두고 나만의 표현을 다듬기.','친구와 생각을 나누며 서로의 아이디어를 확장하기.']
];
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function unlockAudio(){if(!state.sound)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();if(!keyNoise){keyNoise=audio.createBuffer(1,Math.ceil(audio.sampleRate*.028),audio.sampleRate);const samples=keyNoise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/(samples.length*.19));}}catch{}}
function tick(low=false){if(!state.sound||document.hidden)return;unlockAudio();if(!audio||audio.state!=='running')return;try{const t=audio.currentTime,g=audio.createGain();g.gain.setValueAtTime(low?.055:.045,t);g.gain.exponentialRampToValueAtTime(.0001,t+.045);g.connect(audio.destination);if(low){const o=audio.createOscillator();o.type='triangle';o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(55,t+.06);o.connect(g);o.start(t);o.stop(t+.07);}else{const s=audio.createBufferSource(),filter=audio.createBiquadFilter();s.buffer=keyNoise;filter.type='highpass';filter.frequency.value=900;s.connect(filter);filter.connect(g);s.start(t);}}catch{}}
function stopCamera(){cameraRequest++;if(stream)stream.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;$('camera-status').textContent='수묵화 데모';$('camera-toggle').textContent='카메라로 바꾸기';}
async function startCamera(){
 stopCamera(); const request=cameraRequest;
 if(!navigator.mediaDevices?.getUserMedia){toast('카메라를 사용할 수 없어 데모로 진행해요.');return;}
 $('camera-status').textContent='카메라 연결을 기다리는 중';
 try {
  const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:800}},audio:false});
  if(request!==cameraRequest||state.screen!=='studio'||document.hidden){next.getTracks().forEach(track=>track.stop());return;}
  stream=next;video.srcObject=next;await video.play();
  if(request!==cameraRequest){next.getTracks().forEach(track=>track.stop());return;}
  $('camera-status').textContent='카메라 · 내 기기에서만';$('camera-toggle').textContent='수묵화 데모로 바꾸기';schedule();
 } catch {if(request===cameraRequest){stopCamera();toast('카메라를 연결하지 못했어요. 데모로도 똑같이 즐길 수 있어요.');schedule();}}
}
function go(screen){
 clearTimeout(revealTimer);if(screen!=='studio')stopCamera();if(screen!=='result')finishTyping();
 state.screen=screen;document.querySelectorAll('.screen').forEach(el=>{const active=el.id==='screen-'+screen;el.hidden=!active;el.classList.toggle('active',active);});
 window.scrollTo({top:0,behavior:'instant'});const heading=$('screen-'+screen).querySelector('h1,h2');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
 schedule();
}
function begin(camera){unlockAudio();tick(true);state.custom=null;state.answers.fill(null);state.question=0;go('studio');if(camera)startCamera();}
function renderQuestion(){
 const q=QUESTIONS[state.question];$('question-counter').textContent=String(state.question+1).padStart(2,'0')+' / 04';
 const answered=state.answers.filter(a=>a!==null).length;$('question-progress').style.width=(answered/4*100)+'%';document.querySelector('.progress-track').setAttribute('aria-valuenow',String(answered));
 const container=$('question-content');container.replaceChildren();
 const glyph=document.createElement('div');glyph.className='question-symbol';glyph.setAttribute('aria-hidden','true');glyph.textContent=q.glyph;
 const theme=document.createElement('p');theme.className='question-theme';theme.textContent=q.theme;
 const title=document.createElement('h1');title.className='question-title';title.id='question-title';title.textContent=q.title;title.style.whiteSpace='pre-line';title.tabIndex=-1;
 const subtitle=document.createElement('p');subtitle.className='question-subtitle';subtitle.textContent=q.subtitle;container.append(glyph,theme,title,subtitle);
 const choices=document.createElement('div');choices.setAttribute('role','group');choices.setAttribute('aria-label','답변 선택');
 q.options.forEach((option,bit)=>{const button=document.createElement('button');button.className='answer'+(state.answers[state.question]===bit?' selected':'');button.setAttribute('aria-pressed',String(state.answers[state.question]===bit));const letter=document.createElement('span');letter.className='answer-letter';letter.textContent=bit?'B':'A';const text=document.createElement('span');const strong=document.createElement('strong');strong.textContent=option.title;const small=document.createElement('small');small.textContent=option.detail;text.append(strong,small);button.append(letter,text);button.addEventListener('click',()=>{state.answers[state.question]=bit;tick();renderQuestion();choicesFocus(bit);});choices.append(button);});container.append(choices);
 $('next-question').disabled=state.answers[state.question]===null;$('next-question').innerHTML=state.question===3?'나의 교지 펼치기 <span>↗</span>':'다음 질문 <span>→</span>';
 $('previous-question').textContent=state.question===0?'← 스튜디오':'← 이전 질문';
}
function choicesFocus(bit){$('question-content').querySelectorAll('.answer')[bit].focus({preventScroll:true});}
function enterQuiz(){state.question=0;renderQuestion();go('quiz');}
function showReveal(){if(state.answers.some(a=>a===null))return;state.index=state.answers.reduce((index,bit)=>(index<<1)|bit,0);state.custom=null;unlockAudio();tick(true);go('reveal');if(state.motion)revealTimer=setTimeout(showResult,1900);else showResult();}
function bitsFor(index){return [3,2,1,0].map(shift=>(index>>shift)&1);}
function resultData(){const ch=PORTRAITS[state.index];return state.custom||{overview:ch.overview,items:null,advice:ch.advice,hope:ch.hope};}
function finishTyping(){clearInterval(typingTimer);typingTimer=null;typingTargets.forEach(target=>{target.el.textContent=target.text;target.el.removeAttribute('aria-busy');target.el.classList.remove('typing-cursor');target.block.classList.remove('is-writing','waiting-for-ink');});$('writing-status').hidden=true;$('typing-progress').style.width='100%';$('typing-meter').setAttribute('aria-valuenow','100');$('screen-result').dataset.typing='complete';}
function startTyping(){
 clearInterval(typingTimer);typingTimer=null;followWriting=true;lastFollowAt=0;const total=typingTargets.reduce((n,target)=>n+Array.from(target.text).length,0);let section=0,cursor=0,written=0;
 const letters=typingTargets.map(target=>Array.from(target.text));typingTargets.forEach(target=>{target.el.textContent='';target.el.setAttribute('aria-busy','true');target.el.classList.remove('typing-cursor');target.block.classList.add('waiting-for-ink');target.block.classList.remove('is-writing');});
 $('writing-status').hidden=false;$('screen-result').dataset.typing='running';$('typing-progress').style.width='0%';$('typing-meter').setAttribute('aria-valuenow','0');
 function enterSection(){const target=typingTargets[section];target.block.classList.remove('waiting-for-ink');target.block.classList.add('is-writing');target.el.classList.add('typing-cursor');$('typing-phase').textContent=target.phase;}
 enterSection();typingTimer=setInterval(()=>{
  if(document.hidden)return;
  const target=typingTargets[section],chars=letters[section],step=chars.length>900?8:2;cursor=Math.min(chars.length,cursor+step);target.el.textContent=chars.slice(0,cursor).join('');written=letters.slice(0,section).reduce((n,list)=>n+list.length,0)+cursor;
  const percent=Math.round(written/Math.max(1,total)*100);$('typing-progress').style.width=percent+'%';$('typing-meter').setAttribute('aria-valuenow',String(percent));
  if(followWriting&&performance.now()-lastFollowAt>350){lastFollowAt=performance.now();const bottom=target.el.getBoundingClientRect().bottom;if(bottom>innerHeight-64)window.scrollBy({top:bottom-innerHeight+90,behavior:'smooth'});}
  if(/\S/.test(chars[cursor-1]||''))tick(/[。.!?。]/.test(chars[cursor-1]||''));
  if(cursor>=chars.length){target.el.classList.remove('typing-cursor');target.el.removeAttribute('aria-busy');target.block.classList.remove('is-writing');section++;cursor=0;tick(true);if(section>=typingTargets.length){finishTyping();return;}enterSection();}
 },38);
}
function showResult(animate=true){
 finishTyping();go('result');const ch=PORTRAITS[state.index],data=resultData(),bits=bitsFor(state.index);
 $('result-name').textContent=ch.name;$('result-code').textContent=ch.hanja;$('result-subtitle').textContent=ch.subtitle;$('result-emblem').textContent=ch.glyph;$('result-number').textContent=String(state.index+1).padStart(2,'0')+' / 16';
 $('result-tags').replaceChildren(...bits.map((bit,i)=>{const tag=document.createElement('span');tag.className='tag';tag.textContent='#'+dimensions[i][bit];return tag;}));
 $('reading-overview').textContent=data.overview;typingTargets=[];
 const target=(el,text,phase)=>{typingTargets.push({el,text,phase,block:el.closest('.reading-block')});};target($('reading-overview'),data.overview,'나를 닮은 한 장면');
 $('reading-items').replaceChildren();
 if(data.items){const p=document.createElement('p');p.textContent=data.items;$('reading-items').append(p);target(p,data.items,'나의 가능성 지도');}else{['나의 시선','팀 안에서','배움의 방식','에너지'].forEach((label,i)=>{const row=document.createElement('div');row.className='map-row';const strong=document.createElement('strong');strong.textContent=label;const span=document.createElement('span');span.textContent=mapTexts[i][bits[i]];row.append(strong,span);$('reading-items').append(row);target(span,mapTexts[i][bits[i]],'나의 가능성 지도 · '+label);});}
 $('reading-advice').textContent=data.advice;$('reading-hope').textContent=data.hope;target($('reading-advice'),data.advice,'오늘의 작은 실험');target($('reading-hope'),data.hope,'그대에게 보내는 한마디');updatePrompt();
 if(animate&&state.motion){startTyping();}else{finishTyping();}
}
function plainText(){const ch=PORTRAITS[state.index],d=resultData(),bits=bitsFor(state.index);return ['관상 연구소 · '+ch.name,ch.subtitle,'','#'+bits.map((b,i)=>dimensions[i][b]).join(' #'),'','[총평]',d.overview,'','[항목별 리딩]',d.items||mapTexts.map((row,i)=>row[bits[i]]).join('\n'),'','[처세 조언]',d.advice,'','[희망 메시지]',d.hope,'','재미용 창작이며 얼굴·능력·미래를 판단하지 않습니다。',SITE].join('\n');}
async function copy(text){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}}catch{}const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;top:0;left:-9999px';document.body.append(area);area.focus();area.select();let success=false;try{success=document.execCommand('copy');}catch{}area.remove();return success;}
async function share(result){const ch=PORTRAITS[state.index];if(navigator.share){try{await navigator.share(result?{title:'나의 조선 캐릭터 · '+ch.name,text:ch.subtitle+'\n#'+bitsFor(state.index).map((b,i)=>dimensions[i][b]).join(' #')+'\n재미용 창작 캐릭터',url:SITE}:{title:'관상 연구소',text:'내 안에 숨어 있는 조선 캐릭터는? 네 번의 선택으로 만나 보세요.',url:SITE});return;}catch(error){if(error.name==='AbortError')return;}}toast(await copy(result?plainText():SITE)?'공유할 내용을 복사했어요. 원하는 곳에 붙여넣어 주세요.':'복사하지 못했어요. 주소창의 링크를 직접 복사해 주세요.');}
function updatePrompt(){const ch=PORTRAITS[state.index];const answerLines=QUESTIONS.map((q,i)=>(i+1)+'문: '+(state.answers[i]===null?'선택하지 않음 (도감 미리보기)':q.options[state.answers[i]].title)).join('\n');$('gemini-prompt').value=["고등학생을 위한 창작 캐릭터 이야기 작가로서 따뜻한 존댓말로 답해 주세요.","관상은 재미를 위한 수묵화 세계관일 뿐, 실제 얼굴·성격·능력·운명을 판단하지 않습니다. 사진 없이 문답 텍스트만 바탕으로 작성해 주세요.","나의 창작 캐릭터: "+ch.name+' — '+ch.subtitle,answerLines,'관심 주제: '+($('topic').value.trim()||'공부 습관, 협업과 나의 가능성 탐색'),'외모에 근거한 성격 추론, 재물·수명·성공의 예언, 우열 비교는 하지 마세요. 선택은 고정된 성격이 아니며 다른 가능성도 있다는 점을 담아 주세요.','다음 4개 제목으로만 나누고 각 항목은 2~3문장으로 작성해 주세요.','[총평]','나를 닮은 한 장면','[항목별 리딩]','배움, 협업, 탐색의 강점을 가능성으로 표현','[처세 조언]','오늘 해 볼 수 있는 작은 행동 한 가지','[희망 메시지]','나를 유형에 가두지 않는 따뜻한 격려'].join('\n\n');}
function applyGemini(){const raw=$('gemini-response').value.trim();if(!raw){toast('Gemini의 답변을 먼저 붙여넣어 주세요.');return;}
 const headings=['총평','항목별 리딩','처세 조언','희망 메시지'];const found=[];const re=/(?:\[|【)(총평|항목별 리딩|처세 조언|희망 메시지)(?:\]|】)/g;let match;while((match=re.exec(raw)))found.push({name:match[1],start:match.index,end:re.lastIndex});
 const pieces={};found.forEach((item,i)=>pieces[item.name]=raw.slice(item.end,found[i+1]?.start??raw.length).trim());
 if(headings.some(h=>!pieces[h])){toast('답변에 [총평] [항목별 리딩] [처세 조언] [희망 메시지] 제목을 모두 넣어 주세요.');return;}
 state.custom={overview:pieces['총평'],items:pieces['항목별 리딩'],advice:pieces['처세 조언'],hope:pieces['희망 메시지']};unlockAudio();showResult();toast('붙여넣은 이야기를 교지에 반영했어요.');
}
// Perspective projection of an ellipsoid and three independently tilted orbital rings.
function project(x,y,z,yaw,pitch,r,cx,cy){const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw),c=y*Math.cos(pitch)-b*Math.sin(pitch),depth=y*Math.sin(pitch)+b*Math.cos(pitch),scale=4.2/(4.2-depth);return {x:cx+a*r*scale,y:cy+c*r*scale,z:depth};}
function drawWire(ctx,w,h,t,studio){
 const cx=w*.5,cy=h*.49,r=Math.min(w,h)*(studio?.25:.28),yaw=state.yaw*Math.PI/180+(state.motion?Math.sin(t*.3)*.2:0),pitch=-.08;
 const path=points=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();};
 ctx.save();ctx.lineWidth=.8;const green=state.effects.thermal&&studio;const color=green?'130,210,194':'217,189,131';
 for(let ring=0;ring<3;ring++){const pts=[];for(let k=0;k<=100;k++){const a=k/100*Math.PI*2,spin=ring*.9+t*(ring===1?-.06:.04),x=Math.cos(a)*1.5,y=Math.sin(a)*.3,z=Math.sin(a)*1.1;const yr=y*Math.cos(spin)-z*Math.sin(spin),zr=y*Math.sin(spin)+z*Math.cos(spin);pts.push(project(x,yr,zr,yaw+ring*.8,.3+ring*.5,r,cx,cy));}ctx.strokeStyle=`rgba(${color},${ring===0?.45:.24})`;path(pts);const p=pts[Math.floor((t*7+ring*31)%100)];ctx.fillStyle='rgba('+color+',.9)';ctx.beginPath();ctx.arc(p.x,p.y,2.8,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle=`rgba(${color},.18)`;
 const node=(lat,lon)=>{let x=Math.cos(lat)*Math.sin(lon)*.72,y=Math.sin(lat)*1.1,z=Math.cos(lat)*Math.cos(lon)*.7;const chin=1-Math.max(0,Math.sin(lat))*.18;x*=chin;z+=Math.exp(-(x*x*28+y*y*20))*.24;return project(x,y,z,yaw,pitch,r,cx,cy);};
 if(!studio||state.effects.mesh){for(let j=-5;j<=5;j++){const pts=[];for(let k=-9;k<=9;k++)pts.push(node(j/6*Math.PI/2,k/9*Math.PI/2));path(pts);}for(let k=-6;k<=6;k++){const pts=[];for(let j=-10;j<=10;j++)pts.push(node(j/11*Math.PI/2,k/6*Math.PI/2));path(pts);}for(let j=-3;j<=3;j++)for(let k=-3;k<=3;k++){const p=node(j/4*1.1,k/4*1.2);ctx.fillStyle=`rgba(${color},.5)`;ctx.beginPath();ctx.arc(p.x,p.y,1.3,0,Math.PI*2);ctx.fill();}}
 if(!studio){ctx.strokeStyle='rgba(217,189,131,.17)';ctx.beginPath();ctx.ellipse(cx,cy+r*1.54,r*1.15,r*.14,0,0,Math.PI*2);ctx.stroke();for(let i=0;i<22;i++){const a=i*2.399,x=cx+Math.cos(a)*r*(1.5+(i%3)*.16),y=cy+Math.sin(a)*r*(1.5+(i%4)*.09);ctx.fillStyle='rgba(217,189,131,'+(.15+(i%3)*.12)+')';ctx.fillRect(x,y,1.3,1.3);}}
 ctx.restore();
}
function fitCanvas(canvas){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(rect.width),h=Math.round(rect.height);if(!w||!h)return null;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);return {ctx,w,h};}
const inkCanvas=document.createElement('canvas');
const inkContext=inkCanvas.getContext('2d',{willReadFrequently:true});
// All live video goes through this low-resolution ink renderer. Never draw raw video to the visible canvas.
function renderInkSource(source,sw,sh,w,h,mirror){
 const iw=180,ih=Math.max(1,Math.round(iw*h/w));if(inkCanvas.width!==iw||inkCanvas.height!==ih){inkCanvas.width=iw;inkCanvas.height=ih;}
 const scale=Math.max(iw/sw,ih/sh)*state.zoom,cw=iw/scale,ch=ih/scale;
 inkContext.save();inkContext.clearRect(0,0,iw,ih);if(mirror){inkContext.translate(iw,0);inkContext.scale(-1,1);}inkContext.drawImage(source,(sw-cw)/2,(sh-ch)/2,cw,ch,0,0,iw,ih);inkContext.restore();
 const image=inkContext.getImageData(0,0,iw,ih),pixels=image.data,luma=new Float32Array(iw*ih);
 for(let i=0,p=0;i<pixels.length;i+=4,p++)luma[p]=(.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2])/255;
 const palette=state.effects.thermal?[[18,27,43],[40,62,71],[74,104,91],[137,143,98],[191,166,116]]:[[16,25,23],[42,52,45],[79,86,67],[126,125,95],[183,167,126]];
 for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){
  const p=y*iw+x,i=p*4;let value=luma[p];
  // Neighbour averaging and a few ink tones suppress pores, sharp detail, and natural skin colour.
  if(x>0&&y>0&&x<iw-1&&y<ih-1)value=(value*4+luma[p-1]+luma[p+1]+luma[p-iw]+luma[p+iw])/8;
  const edge=x>0&&y>0?Math.abs(luma[p]-luma[p-1])+Math.abs(luma[p]-luma[p-iw]):0;
  const paper=((x*13+y*7)%17)/500;let level=Math.max(0,Math.min(4,Math.floor((value+paper)*4.8)));
  if(state.effects.ink&&edge>.12)level=Math.max(0,level-1);
  const color=palette[level];pixels[i]=color[0];pixels[i+1]=color[1];pixels[i+2]=color[2];pixels[i+3]=255;
 }
 inkContext.putImageData(image,0,0);return inkCanvas;
}
function drawInkGuides(ctx,w,h,t){
 const x=w*.5,y=h*.49,rx=w*.27,ry=h*.34;ctx.save();ctx.lineWidth=1;ctx.strokeStyle='rgba(217,189,131,.43)';ctx.setLineDash([3,7]);ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 for(const ny of [.29,.48,.68]){ctx.strokeStyle='rgba(217,189,131,.18)';ctx.beginPath();ctx.moveTo(w*.28,h*ny);ctx.lineTo(w*.72,h*ny);ctx.stroke();}
 const points=[[.5,.28],[.5,.39],[.39,.43],[.61,.43],[.5,.51],[.42,.58],[.58,.58],[.5,.7]];
 for(let i=0;i<points.length;i++){const [nx,ny]=points[i],pulse=state.motion?Math.sin(t*2+i)*.8:0;ctx.fillStyle='rgba(231,206,151,.7)';ctx.beginPath();ctx.arc(w*nx,h*ny,1.7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(217,189,131,.2)';ctx.beginPath();ctx.arc(w*nx,h*ny,5+pulse,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
function drawStudio(t){const fit=fitCanvas($('studio-canvas'));if(!fit)return;const {ctx,w,h}=fit;ctx.fillStyle='#0c1716';ctx.fillRect(0,0,w,h);const source=stream&&video.readyState>=2?video:portrait,sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;
 if(sw&&sh){try{const ink=renderInkSource(source,sw,sh,w,h,source===video);ctx.save();ctx.imageSmoothingEnabled=true;ctx.globalAlpha=source===portrait?.30:.58;ctx.drawImage(ink,0,0,w,h);ctx.restore();}catch{/* If processing fails, keep the ink background; never reveal unprocessed video. */}}
 const shade=ctx.createRadialGradient(w*.5,h*.48,w*.12,w*.5,h*.5,h*.67);shade.addColorStop(0,'#0c17161a');shade.addColorStop(.65,'#0c171666');shade.addColorStop(1,'#0c1716f0');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);drawInkGuides(ctx,w,h,t);
 if(state.effects.mesh){ctx.save();ctx.globalAlpha=.6;ctx.translate(w/2,h/2);ctx.scale(state.zoom,state.zoom);ctx.translate(-w/2,-h/2);drawWire(ctx,w,h,t,true);ctx.restore();}
 if(state.motion){const y=h*(.2+(Math.sin(t*.8)+1)*.3);ctx.strokeStyle='#d9bd8340';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.15,y);ctx.lineTo(w*.85,y);ctx.stroke();}
}
function draw(time){const t=state.motion?time/1000:0;if(state.screen==='home'){const fit=fitCanvas($('hero-canvas'));if(fit)drawWire(fit.ctx,fit.w,fit.h,t,false);}if(state.screen==='studio')drawStudio(t);}
function loop(time){frame=null;if(document.hidden)return;if(time-lastFrame>=(state.screen==='studio'?50:33)){draw(time);lastFrame=time;}if((state.motion||stream)&&(state.screen==='home'||state.screen==='studio'))frame=requestAnimationFrame(loop);}
function schedule(){if(frame)cancelAnimationFrame(frame);frame=null;draw(performance.now());if(!document.hidden&&(state.motion||stream)&&(state.screen==='home'||state.screen==='studio'))frame=requestAnimationFrame(loop);}
function syncMotion(){document.body.classList.toggle('motion-off',!state.motion);$('motion-button').textContent='움직임 '+(state.motion?'ON':'OFF');$('motion-button').setAttribute('aria-pressed',String(state.motion));$('motion-button').setAttribute('aria-label',state.motion?'움직임 끄기':'움직임 켜기');if(!state.motion&&state.screen==='reveal')showResult(false);if(!state.motion)finishTyping();schedule();}
function reset(){stopCamera();finishTyping();state.answers.fill(null);state.custom=null;state.question=0;state.index=0;$('topic').value='';$('gemini-response').value='';$('gemini-box').open=false;go('home');}
function openDialog(id){tick();$(id).showModal();}
function init(){
 $('start-demo').onclick=()=>begin(false);$('start-camera').onclick=()=>begin(true);$('skip-studio').onclick=enterQuiz;$('go-quiz').onclick=enterQuiz;
 $('camera-toggle').onclick=()=>{if(stream){stopCamera();schedule();}else startCamera();};
 $('next-question').onclick=()=>{if(state.answers[state.question]===null)return;tick();if(state.question===3)showReveal();else{state.question++;renderQuestion();$('question-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}};
 $('previous-question').onclick=()=>{tick();if(state.question===0)go('studio');else{state.question--;renderQuestion();$('question-title').focus({preventScroll:true});}};
 $('skip-reveal').onclick=()=>showResult();$('home-button').onclick=reset;$('restart').onclick=reset;
 $('sound-button').onclick=()=>{state.sound=!state.sound;$('sound-button').textContent='소리 '+(state.sound?'ON':'OFF');$('sound-button').setAttribute('aria-pressed',String(state.sound));$('sound-button').setAttribute('aria-label',state.sound?'소리 끄기':'소리 켜기');tick();};
 $('motion-button').onclick=()=>{state.motion=!state.motion;syncMotion();};reduced.addEventListener('change',e=>{state.motion=!e.matches;syncMotion();});
 $('rotation').oninput=e=>{state.yaw=Number(e.target.value);$('rotation-value').value=state.yaw+'°';schedule();};$('zoom').oninput=e=>{state.zoom=Number(e.target.value);$('zoom-value').value=state.zoom.toFixed(1)+'×';schedule();};
 document.querySelectorAll('.lens').forEach(button=>button.onclick=()=>{const name=button.dataset.effect;state.effects[name]=!state.effects[name];button.classList.toggle('active',state.effects[name]);button.setAttribute('aria-pressed',String(state.effects[name]));tick();schedule();});
 $('info-button').onclick=()=>openDialog('info-dialog');$('open-collection').onclick=()=>openDialog('collection-dialog');$('result-collection').onclick=()=>openDialog('collection-dialog');
 document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
 PORTRAITS.forEach((ch,i)=>{const card=document.createElement('div');card.className='collection-card';const glyph=document.createElement('span');glyph.className='glyph';glyph.textContent=ch.glyph;const name=document.createElement('strong');name.textContent=ch.name;const text=document.createElement('p');text.textContent=ch.subtitle;card.append(glyph,name,text);$('collection-grid').append(card);});
 $('share-result').onclick=()=>share(true);$('copy-link').onclick=()=>share(false);$('copy-result').onclick=async()=>{finishTyping();toast(await copy(plainText())?'교지 전문을 복사했어요.':'텍스트를 복사하지 못했어요.');};$('print-result').onclick=()=>{finishTyping();window.print();};
 const finish=document.createElement('button');finish.className='text-button';finish.id='finish-typing';finish.textContent='한 번에 읽기';finish.onclick=finishTyping;$('result-number').before(finish);
 const replay=document.createElement('button');replay.className='text-button';replay.id='replay-reading';replay.textContent='타이핑 다시 보기';replay.onclick=()=>{unlockAudio();showResult();};$('result-collection').before(replay);
 $('topic').oninput=updatePrompt;$('open-gemini').onclick=async()=>{const tab=window.open('https://gemini.google.com/app','_blank','noopener,noreferrer');const copied=await copy($('gemini-prompt').value);toast(copied?'질문을 복사했어요. Gemini 대화창에 붙여넣어 주세요.':'복사가 안 되면 질문 칸을 길게 눌러 직접 복사해 주세요.');};
 $('apply-gemini').onclick=applyGemini;$('restore-reading').onclick=()=>{state.custom=null;unlockAudio();showResult();toast('원래 캐릭터 이야기로 돌아왔어요.');};
 ['wheel','touchstart','pointerdown'].forEach(event=>window.addEventListener(event,()=>{if(typingTimer)followWriting=false;},{passive:true}));
 portrait.onload=schedule;portrait.onerror=()=>toast('수묵화를 불러오지 못했어요. 문답은 계속 이용할 수 있어요.');new ResizeObserver(schedule).observe($('main'));window.addEventListener('resize',schedule);document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCamera();if(frame)cancelAnimationFrame(frame);frame=null;}else schedule();});window.addEventListener('pagehide',stopCamera);
 syncMotion();renderQuestion();updatePrompt();
}
init();
})();
