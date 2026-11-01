/* MediaPipe Face Landmarker runs only in this device's worker. No frame uploads. */
'use strict';
let detector=null,initializing=null;
async function initialize(){
 if(initializing)return initializing;
 initializing=(async()=>{
  importScripts(new URL('vendor/mediapipe/vision_bundle.js',self.location.href).href);
  const files=await Vision.FilesetResolver.forVisionTasks(new URL('vendor/mediapipe/wasm/',self.location.href).href,false);
  detector=await Vision.FaceLandmarker.createFromOptions(files,{
   baseOptions:{modelAssetPath:new URL('models/face_landmarker.task',self.location.href).href,delegate:'CPU'},
   runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,minTrackingConfidence:.5,
   outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false
  });
  const F=Vision.FaceLandmarker,pairs=name=>(F[name]||[]).map(p=>[p.start,p.end]);
  self.postMessage({type:'ready',connections:{oval:pairs('FACE_LANDMARKS_FACE_OVAL'),eyes:[...pairs('FACE_LANDMARKS_LEFT_EYE'),...pairs('FACE_LANDMARKS_RIGHT_EYE')],brows:[...pairs('FACE_LANDMARKS_LEFT_EYEBROW'),...pairs('FACE_LANDMARKS_RIGHT_EYEBROW')],lips:pairs('FACE_LANDMARKS_LIPS'),irises:[...pairs('FACE_LANDMARKS_LEFT_IRIS'),...pairs('FACE_LANDMARKS_RIGHT_IRIS')],mesh:pairs('FACE_LANDMARKS_TESSELATION')}});
 })();return initializing;
}
self.onmessage=async({data})=>{
 if(data.type==='init'){try{await initialize();}catch(error){self.postMessage({type:'error',message:String(error?.message||error)});}return;}
 if(data.type!=='frame')return;
 const {bitmap,generation,requestId,timestamp}=data;
 try{
  if(!detector)throw Error('Face model is not ready');
  const started=performance.now(),result=detector.detectForVideo(bitmap,timestamp),points=result.faceLandmarks?.[0]||[];
  const landmarks=new Float32Array(points.length*3);points.forEach((p,i)=>{landmarks[i*3]=p.x;landmarks[i*3+1]=p.y;landmarks[i*3+2]=p.z;});
  self.postMessage({type:'result',landmarks,generation,requestId,elapsed:performance.now()-started},[landmarks.buffer]);
 }catch(error){self.postMessage({type:'frame-error',generation,requestId,message:String(error?.message||error)});}
 finally{bitmap.close();}
};
