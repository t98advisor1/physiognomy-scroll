/* Local geometry only: no identity, expression, health, temperature, or character inference. */
((root)=>{
'use strict';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const stops=[[0,8,9,32],[.18,31,16,92],[.38,105,24,142],[.59,209,40,100],[.79,255,119,38],[1,255,241,153]];
const thermalLut=Array.from({length:256},(_,i)=>{const value=i/255;let k=1;while(k<stops.length-1&&value>stops[k][0])k++;const a=stops[k-1],b=stops[k],t=(value-a[0])/(b[0]-a[0]);return a.slice(1).map((c,j)=>Math.round(c+(b[j+1]-c)*t));});
function coverMap(sw,sh,w,h,zoom=1,mirror=false){const scale=Math.max(w/sw,h/sh)*zoom,cropWidth=w/scale,cropHeight=h/scale,sx=(sw-cropWidth)/2,sy=(sh-cropHeight)/2;return {sx,sy,sw:cropWidth,sh:cropHeight,scale,point(x,y){const px=(x*sw-sx)*scale;return {x:mirror?w-px:px,y:(y*sh-sy)*scale};}};}
class FaceTracker{
 constructor({onStatus=()=>{},onResult=()=>{}}={}){this.onStatus=onStatus;this.onResult=onResult;this.worker=null;this.ready=false;this.busy=false;this.generation=0;this.lastFrame=-Infinity;this.sequence=0;this.connections=null;this.sourceKey=null;this.staticDone=false;this.readyPromise=null;this.errorNotified=false;}
 start(){
  if(this.readyPromise)return this.readyPromise;
  if(typeof Worker==='undefined'||typeof createImageBitmap==='undefined'||typeof OffscreenCanvas==='undefined'){this.onStatus('unsupported');return Promise.resolve(false);}
  this.onStatus('loading');const worker=this.worker=new Worker(new URL('face-worker.js',document.baseURI).href);this.errorNotified=false;
  this.readyPromise=new Promise(resolve=>{
   const timer=setTimeout(()=>{if(this.worker===worker){worker.terminate();this.worker=null;this.ready=false;this.busy=false;this.onStatus('error');resolve(false);}},45000);
   this.cancelReady=()=>{clearTimeout(timer);resolve(false);};
   worker.onmessage=({data})=>{
    if(this.worker!==worker)return;
    if(data.type==='ready'){clearTimeout(timer);this.ready=true;this.connections=data.connections;this.onStatus('ready');resolve(true);return;}
    if(data.type==='error'){clearTimeout(timer);this.ready=false;this.busy=false;this.onStatus('error');resolve(false);worker.terminate();this.worker=null;return;}
    if(data.type==='result'||data.type==='frame-error'){
     this.busy=false;if(data.generation!==this.generation)return;
     if(data.type==='frame-error'){if(!this.errorNotified){this.errorNotified=true;this.onStatus('error');}this.onResult(null);return;}
     const found=data.landmarks.length>=468*3;this.onStatus(found?'tracking':'no-face',found?data.landmarks.length/3:0);this.onResult(found?{points:data.landmarks,connections:this.connections,elapsed:data.elapsed}:null);
    }
   };
   worker.onerror=()=>{clearTimeout(timer);if(this.worker!==worker)return;this.onStatus('error');this.onResult(null);this.ready=false;this.busy=false;worker.terminate();this.worker=null;resolve(false);};
   worker.postMessage({type:'init'});
  });return this.readyPromise;
 }
 reset(){this.generation++;this.sourceKey=null;this.staticDone=false;this.lastFrame=-Infinity;this.onResult(null);}
 async update(source,key){
  if(!this.worker||!this.ready||this.busy||document.hidden)return;
  if(this.sourceKey!==key){this.generation++;this.sourceKey=key;this.staticDone=false;this.lastFrame=-Infinity;this.onResult(null);}
  const isVideo=typeof source.videoWidth==='number',sw=isVideo?source.videoWidth:(source.naturalWidth||source.width),sh=isVideo?source.videoHeight:(source.naturalHeight||source.height);
  if(!sw||!sh||(isVideo&&source.readyState<2)||(!isVideo&&this.staticDone))return;
  const now=performance.now();if(now-this.lastFrame<150)return;
  this.busy=true;this.lastFrame=now;const generation=this.generation,worker=this.worker;
  try{
   const width=Math.min(320,sw),height=Math.max(1,Math.round(sh*width/sw));
   const bitmap=await createImageBitmap(source,{resizeWidth:width,resizeHeight:height,resizeQuality:'low'});
   if(this.worker!==worker||generation!==this.generation||document.hidden){bitmap.close();this.busy=false;return;}
   this.staticDone=!isVideo;worker.postMessage({type:'frame',bitmap,generation,requestId:++this.sequence,timestamp:performance.now()},[bitmap]);
  }catch{this.busy=false;this.staticDone=true;if(!this.errorNotified){this.errorNotified=true;this.onStatus('error');this.onResult(null);}}
 }
 stop(){this.generation++;this.worker?.terminate();this.cancelReady?.();this.worker=null;this.ready=false;this.busy=false;this.staticDone=false;this.readyPromise=null;this.sourceKey=null;this.onResult(null);}
}
root.ThermalFace={thermalLut,coverMap,FaceTracker};
})(typeof window==='undefined'?globalThis:window);
