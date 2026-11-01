/* All capture and landmark processing stays in memory on this device. No API, uploads or persistence. */
(() => {
'use strict';
const $=id=>document.getElementById(id),SITE='https://kwansang.vercel.app/';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={screen:'home',index:0,sound:true,motion:!reduced.matches,effects:{mesh:true,ink:false,thermal:true},yaw:0,zoom:1,typingDelay:110,typingPaused:false,outputLayout:'table',photo:null,demo:true};
const portrait=new Image();portrait.src='assets/portrait.webp';
const video=$('camera-video');
let stream=null,cameraRequest=0,frame=null,lastFrame=0,revealTimer=null,typingTimer=null,toastTimer=null,audio=null,keyNoise=null,typingTargets=[],followWriting=true,lastFollowAt=0;
let trackedFace=null,trackingState='idle',captureSource=null,captureMirror=false,captureId=0,capturePending=false,captureTimer=null,reportUrl=null;
function trackingStatus(status,count=0){trackingState=status;const labels={loading:'얼굴 지도 준비 중 · 첫 실행은 잠시 걸려요',ready:'얼굴 위치를 찾고 있어요',tracking:(stream?'실제 얼굴 지점 ':'일러스트 얼굴 지점 ')+count+'개 · 촬영 준비 완료','no-face':'얼굴이 잘리지 않게 정면으로 맞춰 주세요',unsupported:'이 기기는 얼굴 지점 추적을 지원하지 않아요',error:'얼굴 지점을 불러오지 못했어요. 다시 시작해 주세요.'};$('tracking-status').textContent=labels[status]||'눈 · 코 · 입 · 윤곽을 따라가는 빛';$('tracking-status').dataset.state=status;syncShutter();}
const faceTracker=new ThermalFace.FaceTracker({onStatus:trackingStatus,onResult:result=>{trackedFace=result;syncShutter();if(capturePending){if(result)completeCapture(result);else if(trackingState==='no-face')captureFailed('사진에서 얼굴을 찾지 못했어요. 정면에서 다시 찍어 주세요.');}if(state.screen==='studio')queueMicrotask(()=>{if(state.screen==='studio')schedule();});}});
function syncShutter(){if(!$('capture-photo'))return;$('capture-photo').disabled=capturePending||!trackedFace||trackingState!=='tracking';$('capture-photo').textContent=capturePending?'촬영 사진의 지점 확인 중…':state.demo?'일러스트 촬영 · 유형 보기':'사진 찍고 내 유형 보기';}
function startFaceTracking(){faceTracker.start().then(ok=>{if(state.screen==='studio'){if(ok)schedule();syncShutter();}});}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function unlockAudio(){if(!state.sound)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();if(!keyNoise){keyNoise=audio.createBuffer(1,Math.ceil(audio.sampleRate*.028),audio.sampleRate);const samples=keyNoise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/(samples.length*.19));}}catch{}}
function tick(low=false){if(!state.sound||document.hidden)return;unlockAudio();if(!audio||audio.state!=='running')return;try{const t=audio.currentTime,g=audio.createGain();g.gain.setValueAtTime(low?.055:.045,t);g.gain.exponentialRampToValueAtTime(.0001,t+.045);g.connect(audio.destination);if(low){const o=audio.createOscillator();o.type='triangle';o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(55,t+.06);o.connect(g);o.start(t);o.stop(t+.07);}else{const s=audio.createBufferSource(),filter=audio.createBiquadFilter();s.buffer=keyNoise;filter.type='highpass';filter.frequency.value=900;s.connect(filter);filter.connect(g);s.start(t);}}catch{}}
function stopCamera(){cameraRequest++;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;faceTracker.reset();trackedFace=null;syncShutter();}
function clearCapture(){clearTimeout(captureTimer);capturePending=false;captureSource=null;captureMirror=false;state.photo=null;$('retake-photo').hidden=true;if(reportUrl){URL.revokeObjectURL(reportUrl);reportUrl=null;}$('report-download').hidden=true;$('report-download').removeAttribute('href');}
function captureFailed(message){clearCapture();faceTracker.reset();toast(message);schedule();}
async function startCamera(){
 clearCapture();stopCamera();const request=cameraRequest;state.demo=false;$('camera-status').textContent='카메라 연결을 기다리는 중';syncShutter();
 try{if(!navigator.mediaDevices?.getUserMedia)throw Error();const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:800}},audio:false});
 if(request!==cameraRequest||state.screen!=='studio'||document.hidden){next.getTracks().forEach(t=>t.stop());return;}stream=next;video.srcObject=next;await video.play();if(request!==cameraRequest){next.getTracks().forEach(t=>t.stop());return;}
 $('camera-status').textContent='열화상 카메라 · 기기 내';$('camera-toggle').textContent='일러스트 데모로 바꾸기';faceTracker.reset();startFaceTracking();schedule();
 }catch{if(request===cameraRequest){useDemo();toast('카메라를 연결하지 못했어요. 카메라 권한을 확인하거나 일러스트 데모를 이용해 주세요.');}}
}
function useDemo(){clearCapture();stopCamera();state.demo=true;$('camera-status').textContent='일러스트 데모 · 내 얼굴 결과 아님';$('camera-toggle').textContent='내 카메라로 바꾸기';faceTracker.reset();startFaceTracking();schedule();}
function go(screen){clearTimeout(revealTimer);if(screen!=='studio'){stopCamera();faceTracker.stop();trackedFace=null;}if(screen!=='result')finishTyping();state.screen=screen;document.querySelectorAll('.screen').forEach(el=>{el.hidden=el.id!=='screen-'+screen;el.classList.toggle('active',!el.hidden);});window.scrollTo({top:0,behavior:'instant'});const heading=$('screen-'+screen).querySelector('h1,h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}schedule();}
function begin(camera){unlockAudio();tick(true);clearCapture();go('studio');if(camera)startCamera();else useDemo();}
function capturePhoto(){
 if(capturePending||!trackedFace||trackingState!=='tracking')return;unlockAudio();tick(true);
 const source=stream&&video.readyState>=2?video:portrait,sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;if(!sw||!sh)return;
 const photo=document.createElement('canvas');photo.width=Math.min(720,sw);photo.height=Math.round(sh*photo.width/sw);photo.getContext('2d').drawImage(source,0,0,photo.width,photo.height);
 captureSource=photo;captureMirror=source===video;captureId++;faceTracker.reset();capturePending=true;syncShutter();$('retake-photo').hidden=false;$('capture-hint').textContent='방금 촬영한 한 장에서 얼굴 지점을 다시 확인하고 있어요.';
 captureTimer=setTimeout(()=>{if(capturePending)captureFailed('사진의 지점을 확인하지 못했어요. 다시 찍어 주세요.');},12000);schedule();
}
function completeCapture(face){
 try{const result=PhotoTypes.classify(face,captureSource.width,captureSource.height);state.index=result.index;state.photo={...result,face:{points:face.points.slice(),connections:face.connections},demo:state.demo};capturePending=false;clearTimeout(captureTimer);syncShutter();$('camera-status').textContent=state.demo?'일러스트 데모 촬영 완료':'사진 촬영 완료 · 기기 내 처리';tick(true);go('reveal');revealTimer=setTimeout(()=>showResult(),1600);}
 catch(error){captureFailed(error.message);}
}
function resultData(){return state.photo?.profile||PhotoTypes.profiles[state.index];}
function finishTyping(){clearTimeout(typingTimer);typingTimer=null;state.typingPaused=false;$('pause-typing').disabled=true;$('pause-typing').textContent='잠시 멈춤';$('pause-typing').setAttribute('aria-pressed','false');typingTargets.forEach(target=>{target.el.textContent=target.text;target.el.removeAttribute('aria-busy');target.el.classList.remove('typing-cursor');target.block.classList.remove('is-writing','waiting-for-ink');});$('writing-status').hidden=true;$('typing-progress').style.width='100%';$('typing-meter').setAttribute('aria-valuenow','100');$('screen-result').dataset.typing='complete';}
function startTyping(){
 clearTimeout(typingTimer);typingTimer=null;state.typingPaused=false;followWriting=true;lastFollowAt=0;
 const letters=typingTargets.map(target=>Array.from(target.text)),total=letters.reduce((n,list)=>n+list.length,0);let section=0,cursor=0,written=0;
 typingTargets.forEach(target=>{target.el.textContent='';target.el.setAttribute('aria-busy','true');target.el.classList.remove('typing-cursor');target.block.classList.add('waiting-for-ink');target.block.classList.remove('is-writing');});
 $('writing-status').hidden=false;$('screen-result').dataset.typing='running';$('typing-progress').style.width='0%';$('typing-meter').setAttribute('aria-valuenow','0');$('pause-typing').disabled=false;$('pause-typing').textContent='잠시 멈춤';$('pause-typing').setAttribute('aria-pressed','false');
 function enterSection(){const target=typingTargets[section];target.block.classList.remove('waiting-for-ink');target.block.classList.add('is-writing');target.el.classList.add('typing-cursor');$('typing-phase').textContent=target.phase;}
 function next(){
  if(document.hidden||state.typingPaused){typingTimer=setTimeout(next,120);return;}
  const target=typingTargets[section],chars=letters[section];cursor=Math.min(chars.length,cursor+1);const char=chars[cursor-1]||'';target.el.textContent=chars.slice(0,cursor).join('');written++;
  const percent=Math.round(written/Math.max(1,total)*100);$('typing-progress').style.width=percent+'%';$('typing-meter').setAttribute('aria-valuenow',String(percent));
  if(followWriting&&performance.now()-lastFollowAt>500){lastFollowAt=performance.now();const bottom=target.el.getBoundingClientRect().bottom;if(bottom>innerHeight-64)window.scrollBy({top:bottom-innerHeight+90,behavior:'smooth'});}
  if(/\S/.test(char))tick(/[.!?。]/.test(char));let delay=state.typingDelay+(/[.!?。]/.test(char)?500:/[,，:：]/.test(char)?230:char==='\n'?380:0);
  if(cursor>=chars.length){target.el.classList.remove('typing-cursor');target.el.removeAttribute('aria-busy');target.block.classList.remove('is-writing');section++;cursor=0;if(section>=typingTargets.length){finishTyping();return;}enterSection();delay=850;}
  typingTimer=setTimeout(next,delay);
 }
 enterSection();typingTimer=setTimeout(next,state.typingDelay);
}
function showResult(animate=true){
 if(!state.photo){begin(false);return;}finishTyping();go('result');const ch=resultData();$('result-name').textContent=ch.name;$('result-code').textContent=state.photo.demo?'일러스트 데모의 시각 유형':'촬영 사진에서 찾은 시각 유형';$('result-subtitle').textContent=ch.subtitle;$('result-emblem').textContent=ch.glyph;$('result-number').textContent=String(state.index+1).padStart(2,'0')+' / 16';
 $('result-tags').replaceChildren(...[ch.subtitle,'478개 얼굴 지점','설문 없이 사진 분류'].map(text=>{const el=document.createElement('span');el.className='tag';el.textContent=text;return el;}));
 typingTargets=[];const target=(el,text,phase)=>{el.textContent=text;typingTargets.push({el,text,phase,block:el.closest('.reading-block')});};
 target($('reading-overview'),ch.overview,'사진에서 찾은 선과 비율');$('reading-items').replaceChildren();
 const table=document.createElement('table');table.className='observation-table';const caption=document.createElement('caption');caption.textContent='촬영 사진의 관찰 항목과 기록';const body=document.createElement('tbody');table.append(caption,body);$('reading-items').append(table);
 PhotoTypes.rows(state.photo,state.photo.demo).forEach(([label,text])=>{const row=document.createElement('tr');const th=document.createElement('th');th.scope='row';th.textContent=label;const td=document.createElement('td');const span=document.createElement('span');td.append(span);row.append(th,td);body.append(row);target(span,text,'사진 지점의 기록 · '+label);});
 target($('reading-advice'),ch.advice,'나만의 얼굴 지도 그리기');target($('reading-hope'),ch.hope,'나에게 보내는 한마디');updatePrompt();drawStudio(0,'result-photo');if(animate)startTyping();else finishTyping();
}
function plainText(){if(!state.photo)return SITE;const ch=resultData();return ['관상 연구소 · '+ch.name+' / '+ch.subtitle,state.photo.demo?'일러스트 데모의 결과':'내 사진의 시각적 유형','','[사진의 선과 비율]',ch.overview,'',...PhotoTypes.rows(state.photo,state.photo.demo).map(([label,text])=>label+': '+text),'','[얼굴 지도 그리기]',ch.advice,'','[한마디]',ch.hope,'','시각적 분류이며 과학적 진단이 아닙니다. 촬영 각도·표정·거리·조명에 따라 결과가 달라질 수 있어요.','copyright ⓒ math-tong All right reserved.',SITE].join('\n');}
async function copy(text){const previous=document.activeElement,area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;top:0;left:-9999px;font-size:17px';document.body.append(area);area.focus();area.select();area.setSelectionRange(0,text.length);let success=false;try{success=document.execCommand('copy');}catch{}area.remove();previous?.focus({preventScroll:true});if(success)return true;try{if(navigator.clipboard?.writeText)return await Promise.race([navigator.clipboard.writeText(text).then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),1500))]);}catch{}return false;}
// Perspective projection of an ellipsoid and three independently tilted orbital rings.
function project(x,y,z,yaw,pitch,r,cx,cy){const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw),c=y*Math.cos(pitch)-b*Math.sin(pitch),depth=y*Math.sin(pitch)+b*Math.cos(pitch),scale=4.2/(4.2-depth);return {x:cx+a*r*scale,y:cy+c*r*scale,z:depth};}
function drawWire(ctx,w,h,t,studio){
 const cx=w*.5,cy=h*.49,r=Math.min(w,h)*(studio?.25:.28),yaw=state.yaw*Math.PI/180+(state.motion?Math.sin(t*.3)*.2:0),pitch=-.08;
 const path=points=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();};
 ctx.save();ctx.lineWidth=.8;const green=state.effects.thermal&&studio;const color=green?'130,210,194':'217,189,131';
 for(let ring=0;ring<3;ring++){const pts=[];for(let k=0;k<=100;k++){const a=k/100*Math.PI*2,spin=ring*.9+t*(ring===1?-.06:.04),x=Math.cos(a)*1.5,y=Math.sin(a)*.3,z=Math.sin(a)*1.1;const yr=y*Math.cos(spin)-z*Math.sin(spin),zr=y*Math.sin(spin)+z*Math.cos(spin);pts.push(project(x,yr,zr,yaw+ring*.8,.3+ring*.5,r,cx,cy));}ctx.strokeStyle=`rgba(${color},${ring===0?.45:.24})`;path(pts);const p=pts[Math.floor((t*7+ring*31)%100)];ctx.fillStyle='rgba('+color+',.9)';ctx.beginPath();ctx.arc(p.x,p.y,2.8,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle=`rgba(${color},.42)`;
 const node=(lat,lon)=>{let x=Math.cos(lat)*Math.sin(lon)*.72,y=Math.sin(lat)*1.1,z=Math.cos(lat)*Math.cos(lon)*.7;const chin=1-Math.max(0,Math.sin(lat))*.18;x*=chin;z+=Math.exp(-(x*x*28+y*y*20))*.24;return project(x,y,z,yaw,pitch,r,cx,cy);};
 if(!studio||state.effects.mesh){for(let j=-8;j<=8;j++){const pts=[];for(let k=-14;k<=14;k++)pts.push(node(j/9*Math.PI/2,k/14*Math.PI/2));path(pts);}for(let k=-10;k<=10;k++){const pts=[];for(let j=-10;j<=10;j++)pts.push(node(j/11*Math.PI/2,k/10*Math.PI/2));path(pts);}for(let j=-6;j<=6;j++)for(let k=-6;k<=6;k++){const p=node(j/7*1.1,k/7*1.2);ctx.fillStyle=`rgba(${color},.5)`;ctx.beginPath();ctx.arc(p.x,p.y,1.3,0,Math.PI*2);ctx.fill();}}
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
 const palette=[[16,25,23],[42,52,45],[79,86,67],[126,125,95],[183,167,126]];
 const histogram=new Uint32Array(256);for(const value of luma)histogram[Math.min(255,Math.floor(value*255))]++;let count=0,low=0,high=255;const lower=luma.length*.04,upper=luma.length*.96;for(let i=0;i<256;i++){count+=histogram[i];if(count<lower)low=i;if(count<upper)high=i;}const lowValue=low/255,range=Math.max(.25,(high-low)/255);
 for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){
  const p=y*iw+x,i=p*4;let value=luma[p];
  // Neighbour averaging and a few ink tones suppress pores, sharp detail, and natural skin colour.
  if(x>0&&y>0&&x<iw-1&&y<ih-1)value=(value*4+luma[p-1]+luma[p+1]+luma[p-iw]+luma[p+iw])/8;
  const edge=x>0&&y>0?Math.abs(luma[p]-luma[p-1])+Math.abs(luma[p]-luma[p-iw]):0;
  const paper=((x*13+y*7)%17)/500;let color;
  if(state.effects.thermal){const normalized=Math.max(0,Math.min(1,(value-lowValue)/range));const level=Math.max(0,Math.min(255,Math.round(normalized*23)/23*255));color=ThermalFace.thermalLut[Math.round(level)];}
  else{let level=Math.max(0,Math.min(4,Math.floor((value+paper)*4.8)));if(state.effects.ink&&edge>.12)level=Math.max(0,level-1);color=palette[level];}
  pixels[i]=color[0];pixels[i+1]=color[1];pixels[i+2]=color[2];pixels[i+3]=255;
 }
 inkContext.putImageData(image,0,0);return inkCanvas;
}
function drawFaceLandmarks(ctx,w,h,t,sw,sh,mirror,face=trackedFace){
 if(!face){ctx.save();ctx.lineWidth=1;ctx.strokeStyle='rgba(139,231,243,.24)';ctx.setLineDash([2,8]);ctx.beginPath();ctx.ellipse(w*.5,h*.48,w*.28,h*.33,0,0,Math.PI*2);ctx.stroke();ctx.restore();return;}
 const {points,connections}=face,map=ThermalFace.coverMap(sw,sh,w,h,state.zoom,mirror),point=index=>map.point(points[index*3],points[index*3+1]);
 const line=(pairs,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();for(const [a,b]of pairs||[]){if(a*3+1>=points.length||b*3+1>=points.length)continue;const p=point(a),q=point(b);ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);}ctx.stroke();};
 ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
 if(state.effects.mesh)line(connections.mesh,'rgba(142,237,255,.30)',.65);
 ctx.fillStyle='rgba(157,241,255,.65)';for(let i=0;i<points.length/3;i++){const p=point(i);ctx.beginPath();ctx.arc(p.x,p.y,1.25,0,Math.PI*2);ctx.fill();}
 line(connections.oval,'rgba(159,244,255,.83)',1.2);line(connections.eyes,'rgba(226,255,255,.98)',1.5);line(connections.irises,'rgba(105,255,220,.98)',1.4);line(connections.brows,'rgba(255,223,142,.9)',1.3);line(connections.lips,'rgba(255,219,255,.98)',1.4);
 line([[168,6],[6,197],[197,195],[195,5],[5,4],[4,1],[1,2],[98,2],[2,327]],'rgba(211,255,247,.85)',1.1);
 const highlights=[10,21,251,54,284,234,454,172,397,152,33,133,160,158,144,153,263,362,385,387,373,380,70,63,105,300,293,334,168,6,197,4,1,2,98,327,61,291,13,14,0,17,78,308,468,473];for(const index of highlights){if(index*3+2>=points.length)continue;const p=point(index),pulse=state.motion?Math.sin(t*2.4+index)*.8:0;ctx.fillStyle='rgba(108,247,255,.18)';ctx.beginPath();ctx.arc(p.x,p.y,8+pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#eaffff';ctx.beginPath();ctx.arc(p.x,p.y,3.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(126,245,255,.85)';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(p.x,p.y,5.6+pulse,0,Math.PI*2);ctx.stroke();}
 ctx.font='500 14px "Noto Sans KR", sans-serif';for(const [index,label,dx,dy]of [[33,'눈',-29,-14],[263,'눈',12,-14],[1,'코',12,6],[13,'입',14,18],[10,'윤곽',12,-12]]){const p=point(index),x=Math.max(5,Math.min(w-39,p.x+dx)),y=Math.max(21,Math.min(h-8,p.y+dy));ctx.fillStyle='rgba(6,16,35,.82)';ctx.fillRect(x-4,y-13,label.length*15+8,22);ctx.fillStyle='#d8ffff';ctx.fillText(label,x,y);}
 ctx.restore();
}
function drawStudio(t,id='studio-canvas'){
 const fit=fitCanvas($(id));if(!fit)return;const {ctx,w,h}=fit;ctx.fillStyle='#080d22';ctx.fillRect(0,0,w,h);
 const source=captureSource||(stream&&video.readyState>=2?video:portrait),sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height,mirror=captureSource?captureMirror:source===video;
 if(sw&&sh){if(state.screen==='studio')faceTracker.update(source,captureSource?'capture-'+captureId:source===video?'camera':'illustration');try{const ink=renderInkSource(source,sw,sh,w,h,mirror);ctx.save();ctx.imageSmoothingEnabled=true;ctx.globalAlpha=state.effects.thermal?.94:.58;ctx.drawImage(ink,0,0,w,h);ctx.restore();}catch{}}
 const shade=ctx.createRadialGradient(w*.5,h*.48,w*.15,w*.5,h*.5,h*.7);shade.addColorStop(0,'#080f2000');shade.addColorStop(.65,'#080f2033');shade.addColorStop(1,'#080f20d9');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
 if(sw&&sh)drawFaceLandmarks(ctx,w,h,t,sw,sh,mirror,id==='result-photo'?state.photo?.face:trackedFace);
 if(state.motion&&!captureSource){const y=h*(.2+(Math.sin(t*.8)+1)*.3);ctx.strokeStyle='#d9bd8340';ctx.beginPath();ctx.moveTo(w*.15,y);ctx.lineTo(w*.85,y);ctx.stroke();}
}
function draw(time){const t=state.motion?time/1000:0;if(state.screen==='home'){const fit=fitCanvas($('hero-canvas'));if(fit)drawWire(fit.ctx,fit.w,fit.h,t,false);}if(state.screen==='studio')drawStudio(t);if(state.screen==='result'&&state.photo)drawStudio(t,'result-photo');}
function loop(time){frame=null;if(document.hidden)return;if(time-lastFrame>=(state.screen==='studio'?50:33)){draw(time);lastFrame=time;}if((state.motion||stream||capturePending)&&(state.screen==='home'||state.screen==='studio'))frame=requestAnimationFrame(loop);}
function schedule(){if(frame)cancelAnimationFrame(frame);frame=null;draw(performance.now());if(!document.hidden&&(state.motion||stream||capturePending)&&(state.screen==='home'||state.screen==='studio'))frame=requestAnimationFrame(loop);}
async function share(result){if(navigator.share){try{await navigator.share({title:'관상 연구소',text:result?resultData().name+' · '+resultData().subtitle+' — 사진 속 선과 비율의 시각 유형':'입체 격자와 열화상으로 만나는 나의 얼굴 지도',url:SITE});return;}catch(e){if(e.name==='AbortError')return;}}toast(await copy(result?plainText():SITE)?'공유할 내용을 복사했어요.':'주소창의 링크를 복사해 주세요.');}
function updatePrompt(){const ch=resultData();$('gemini-prompt').value=[
 '당신은 한국어 교육·문화 잡지의 아트 디렉터이자 인포그래픽 편집 디자이너입니다. 아래 자료를 바탕으로 고등학생이 읽기 쉬운, 상업 출판물에 실을 수 있을 정도로 정돈된 한 장짜리 시각 리포트를 제작해 주세요.',
 '[프로젝트] 관상 연구소 / VISUAL PORTRAIT ATLAS',
 '[입력 자료]\n시각 유형: '+ch.name+' / '+ch.subtitle+'\n관찰 설명: '+ch.overview+'\n제작 활동: '+ch.advice+'\n마무리 문장: '+ch.hope+'\n추가 주제: '+($('topic').value.trim()||'열화상과 입체 격자로 표현하는 나만의 디지털 자화상'),
 '[해석 범위] 이것은 사진의 선과 비율을 예술적으로 이름 붙인 시각 유형입니다. 성격·지능·능력·감정·건강·운세를 외모에서 추론하지 마세요. 사진·얼굴 좌표·실제 측정 수치는 제공하지 않습니다. 없는 수치·백분위·신뢰도·과학적 근거를 만들지 마세요. 정량 자료가 없으므로 통계 그래프 대신 선·면·도형의 개념도를 사용하세요.',
 '[판형과 그리드] A4 세로 210×297mm, 사방 14mm 안전 여백, 2단 그리드, 단 사이 7mm. 위 18%는 제목·한 줄 요약, 중앙 52%는 대표 도해와 관찰 표, 아래 24%는 3단계 제작 활동과 짧은 메시지, 마지막 6%는 주석·저작권으로 구성하세요. 모바일 요약은 세로 1080×1920px, 1단으로 재배치해 주세요. 작은 글씨로 내용을 억지로 채우지 마세요.',
 '[정보 계층] ① 제목 12자 내외 ② 리드 45자 이내 ③ 윤곽·눈선·중심선·입선의 개념 도해 ④ 관찰 요소/시각 표현/작품 적용의 3열 표 ⑤ 직접 해보는 3단계 ⑥ 60자 이내의 따뜻한 마무리. 한 문단 2~3문장, 카드당 본문 80자 안팎. 제목·도해·표·활동이 중복 설명하지 않게 편집하세요.',
 '[비주얼] 아이보리 #FAF9F3 바탕, 짙은 청록 #173B36 본문, 골드 #9C773B 강조. 열화상 보라 #69188E·주황 #FF7726·노랑 #FFF199는 대표 도해에만 쓰고, 글자는 고대비로 유지하세요. 얼굴 도해는 특정 인물 사진 대신 추상적인 선과 점, 입체 와이어프레임으로 만드세요. 격자·랜드마크·곡선을 3단계로 시각화하고 작은 범례를 넣으세요. 기성 브랜드·작가의 고유 스타일·타인의 사진·캐릭터·로고를 모방하거나 삽입하지 마세요.',
 '[타이포그래피] 한국어 제목은 명조 계열, 본문·표는 가독성 높은 고딕 계열. A4 기준 제목 26~32pt, 소제목 14~17pt, 본문 11.5~13pt, 주석 최소 9pt, 행간 1.6~1.8. 모바일 본문 최소 32px. 표는 옅은 행 구분선과 충분한 셀 여백을 사용하고 줄바꿈·고아행·잘림을 점검하세요. 실제 사용 글꼴의 상업 이용 라이선스는 출판 전 확인 항목으로 남겨 주세요.',
 '[반드시 넣을 주석] 예술적 시각 분류이며 성격·능력·건강·운세를 판단하지 않습니다. 촬영 조건에 따라 달라질 수 있습니다.\n[푸터 원문] copyright ⓒ math-tong All right reserved.',
 '[요청 결과물] 먼저 6개 영역별 완성 원고를 표로 제시하세요. 이어서 도해·색상·범례·배치가 포함된 완성형 인포그래픽을 만들어 주세요. 파일 생성이 가능하면 외부 라이브러리·추적 코드 없이 한 파일로 열리는 인쇄용 HTML/CSS(A4·2단·인쇄 스타일 포함)와 편집 가능한 SVG를 제공하고, 글자가 선택 가능한 벡터 PDF로 출력할 수 있게 해 주세요. 이미지 생성만 가능한 경우 PNG 한 장과 정확한 한국어 원고를 따로 주세요. 파일을 직접 만들 수 없으면 가능하다고 주장하지 말고 복사해서 저장할 수 있는 전체 HTML 코드를 제공하세요. 마지막에는 줄바꿈·대비·수치 출처·저작권·인쇄 잘림의 실제 점검 결과와 남은 확인 사항을 짧게 적어 주세요.'
 ].join('\n\n');}
async function openGemini(){updatePrompt();const copied=await copy($('gemini-prompt').value);toast(copied?'프롬프트를 복사했어요. Gemini 대화창에 붙여넣어 주세요.':'질문 칸을 길게 눌러 복사한 뒤 Gemini에 붙여넣어 주세요.');window.open('https://gemini.google.com/app','_blank','noopener,noreferrer');}
function saveImage(){
 if(!state.photo)return;finishTyping();drawStudio(0,'result-photo');
 const layout=state.outputLayout,photoState=state.photo,canvas=Publication.create({photo:$('result-photo'),profile:resultData(),rows:PhotoTypes.rows(state.photo,state.photo.demo),demo:state.photo.demo,layout,site:SITE});
 canvas.toBlob(blob=>{if(state.photo!==photoState)return;if(!blob){toast('이미지를 만들지 못했어요. 인쇄 · PDF 저장을 이용해 주세요.');return;}if(reportUrl)URL.revokeObjectURL(reportUrl);reportUrl=URL.createObjectURL(blob);const link=$('report-download');link.href=reportUrl;link.download='관상연구소_'+(layout==='columns'?'2단':'표형')+'_리포트.png';link.textContent=(layout==='columns'?'2단':'표형')+' PNG 직접 저장 ↓';link.hidden=false;link.click();toast('리포트를 만들었어요. 다운로드가 안 되면 PNG 직접 저장을 눌러 주세요.');},'image/png');
}
function syncMotion(){document.body.classList.toggle('motion-off',!state.motion);$('motion-button').textContent='격자 움직임 '+(state.motion?'ON':'OFF');$('motion-button').setAttribute('aria-pressed',String(state.motion));schedule();}
function reset(){clearCapture();stopCamera();finishTyping();state.index=0;$('topic').value='';$('gemini-box').open=false;go('home');}
function openDialog(id){tick();$(id).showModal();}
function init(){
 $('start-demo').onclick=()=>begin(false);$('start-camera').onclick=()=>begin(true);$('capture-photo').onclick=capturePhoto;$('retake-photo').onclick=()=>{clearCapture();faceTracker.reset();$('capture-hint').textContent='얼굴을 정면으로 맞춘 뒤 촬영 버튼을 눌러 주세요.';schedule();};$('camera-toggle').onclick=()=>stream?useDemo():startCamera();
 $('skip-reveal').onclick=()=>showResult();$('home-button').onclick=reset;$('restart').onclick=reset;$('retake-result').onclick=()=>begin(!state.demo);
 $('sound-button').onclick=()=>{state.sound=!state.sound;$('sound-button').textContent='소리 '+(state.sound?'ON':'OFF');$('sound-button').setAttribute('aria-pressed',String(state.sound));$('sound-button').setAttribute('aria-label',state.sound?'소리 끄기':'소리 켜기');tick();};
 $('motion-button').onclick=()=>{state.motion=!state.motion;syncMotion();};reduced.addEventListener('change',e=>{state.motion=!e.matches;syncMotion();});
 $('zoom').oninput=e=>{state.zoom=Number(e.target.value);$('zoom-value').value=state.zoom.toFixed(1)+'×';schedule();};
 document.querySelectorAll('.lens').forEach(button=>button.onclick=()=>{const name=button.dataset.effect;if(name==='mesh')state.effects.mesh=!state.effects.mesh;else{state.effects.thermal=name==='thermal';state.effects.ink=name==='ink';}document.querySelectorAll('.lens').forEach(control=>{const enabled=state.effects[control.dataset.effect];control.classList.toggle('active',enabled);control.setAttribute('aria-pressed',String(enabled));});tick();schedule();});
 $('info-button').onclick=()=>openDialog('info-dialog');$('open-collection').onclick=()=>openDialog('collection-dialog');$('result-collection').onclick=()=>openDialog('collection-dialog');
 document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
 PhotoTypes.profiles.forEach(ch=>{const card=document.createElement('div');card.className='collection-card';const glyph=document.createElement('span');glyph.className='glyph';glyph.textContent=ch.glyph;const name=document.createElement('strong');name.textContent=ch.name;const text=document.createElement('p');text.textContent=ch.subtitle;card.append(glyph,name,text);$('collection-grid').append(card);});
 $('share-result').onclick=()=>share(true);$('copy-link').onclick=()=>share(false);$('copy-result').onclick=async()=>{finishTyping();toast(await copy(plainText())?'결과 전문을 복사했어요.':'텍스트를 복사하지 못했어요.');};$('print-result').onclick=()=>{finishTyping();window.print();};window.addEventListener('beforeprint',finishTyping);$('save-image').onclick=saveImage;$('finish-typing').onclick=finishTyping;$('replay-reading').onclick=()=>{unlockAudio();showResult();};
 $('typing-speed').onchange=e=>{state.typingDelay=Number(e.target.value);};$('pause-typing').onclick=()=>{if(!typingTimer)return;state.typingPaused=!state.typingPaused;$('pause-typing').textContent=state.typingPaused?'이어서 읽기':'잠시 멈춤';$('pause-typing').setAttribute('aria-pressed',String(state.typingPaused));$('screen-result').dataset.typing=state.typingPaused?'paused':'running';};
 $('output-layout').onchange=e=>{state.outputLayout=e.target.value;$('printable-result').dataset.layout=state.outputLayout;};
 $('topic').oninput=updatePrompt;$('open-gemini').onclick=openGemini;$('quick-gemini').onclick=openGemini;
 ['wheel','touchstart','pointerdown'].forEach(event=>window.addEventListener(event,()=>{if(typingTimer)followWriting=false;},{passive:true}));
 portrait.onload=schedule;portrait.onerror=()=>toast('일러스트를 불러오지 못했어요. 카메라로 이용해 주세요.');new ResizeObserver(schedule).observe($('main'));window.addEventListener('resize',schedule);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(capturePending)captureFailed('촬영이 잠시 중단됐어요. 다시 찍어 주세요.');stopCamera();faceTracker.stop();if(frame)cancelAnimationFrame(frame);frame=null;}else{if(state.screen==='studio'){state.demo=true;$('camera-status').textContent='카메라가 멈췄어요 · 다시 켜 주세요';$('camera-toggle').textContent='내 카메라로 바꾸기';startFaceTracking();}schedule();}});window.addEventListener('pagehide',()=>{stopCamera();faceTracker.stop();});syncMotion();updatePrompt();
}
init();
})();
