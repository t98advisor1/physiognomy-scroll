/* Paper-like local PNG export, with measured wrapping and two selectable layouts. */
((root)=>{
'use strict';
function create({photo,profile,rows,demo,layout='table',site}){
 const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=100;
 const ctx=canvas.getContext('2d'),ops=[],W=1800,M=110,G=80,C=(W-2*M-G)/2;
 const ink='#173b36',body='#243e39',muted='#52665e',gold='#9c773b',rule='#ccd7cf';
 function wrap(text,size,width){ctx.font=`${size}px "Noto Sans KR",sans-serif`;const lines=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width<=width){line=candidate;continue;}if(line){lines.push(line);line='';}for(const char of word){if(line&&ctx.measureText(line+char).width>width&&!/[.,!?。:;％%)]/.test(char)){lines.push(line);line='';}line+=char;}}if(line)lines.push(line);}return lines;}
 function text(value,x,y,width,size=32,color=body,bold=false){const lines=wrap(value,size,width);for(const line of lines){ops.push({kind:'text',line,x,y,size,color,bold});y+=size*1.7;}return y;}
 function line(x,y,w,color=rule){ops.push({kind:'line',x,y,w,color});}
 function section(title,value,x,y,w){line(x,y,w);y+=25;y=text(title,x,y,w,28,gold,true)+18;y=text(value,x,y,w,34)+36;return y;}
 function table(x,y,w){
  ops.push({kind:'rect',x,y,w,h:62,color:'#e8eee6'});text('관찰 항목',x+20,y+10,220,26,ink,true);text('사진에서 확인한 기록',x+260,y+10,w-280,26,ink,true);y+=62;
  for(const [label,value]of rows){const labelLines=wrap(label,28,200),valueLines=wrap(value,31,w-280),h=Math.max(labelLines.length*48,valueLines.length*53)+38;line(x,y,w);text(label,x+20,y+18,200,28,ink,true);text(value,x+260,y+18,w-280,31);y+=h;}line(x,y,w);return y+36;
 }
 text('KWANSANG / VISUAL PORTRAIT',M,75,W-2*M,25,gold,true);line(M,132,W-2*M,ink);
 const photoW=600,photoH=Math.round(photoW*photo.height/photo.width),headerX=M+photoW+G;
 ops.push({kind:'photo',x:M,y:180,w:photoW,h:photoH});let headerY=195;
 headerY=text(demo?'일러스트 데모의 얼굴 지도':'촬영 사진의 얼굴 지도',headerX,headerY,W-M-headerX,27,muted)+22;
 headerY=text(profile.name,headerX,headerY,W-M-headerX,60,ink,true)+12;
 headerY=text(profile.subtitle,headerX,headerY,W-M-headerX,38,gold,true)+24;
 headerY=text('478개의 지점에서 발견한 선과 비율',headerX,headerY,W-M-headerX,29,muted)+25;
 headerY=text('사진 속 모양을 표현하는 시각 유형',headerX,headerY,W-M-headerX,27,muted);
 let y=Math.max(180+photoH,headerY)+65;
 if(layout==='columns'){
  let left=section('01 / 사진의 선과 비율',profile.overview,M,y,C);
  for(const [label,value]of rows)left=section(label,value,M,left,C);
  let right=section('02 / 나만의 얼굴 지도 그리기',profile.advice,M+C+G,y,C);
  right=section('03 / 나에게 보내는 한마디',profile.hope,M+C+G,right,C);
  right=section('읽는 방법','표시한 비율은 촬영 각도·표정·거리·조명에 따라 달라집니다. 한 장의 사진에 나타난 선을 관찰하고 작품으로 표현해 보세요.',M+C+G,right,C);
  y=Math.max(left,right);
 }else{
  y=section('01 / 사진의 선과 비율',profile.overview,M,y,W-2*M);y=table(M,y,W-2*M);
  y=Math.max(section('02 / 얼굴 지도 그리기',profile.advice,M,y,C),section('03 / 나에게 보내는 한마디',profile.hope,M+C+G,y,C));
 }
 y+=10;line(M,y,W-2*M,ink);y+=28;
 y=text('예술적 시각 분류입니다. 외모로 성격·능력·건강·운세를 판단하지 않습니다.',M,y,W-2*M,25,muted)+18;
 y=text('copyright ⓒ math-tong All right reserved.',M,y,W-2*M,25,gold)+8;y=text(site,M,y,W-2*M,23,muted);
 canvas.height=Math.ceil(y+65);ctx.fillStyle='#faf9f3';ctx.fillRect(0,0,W,canvas.height);ctx.textBaseline='top';
 for(const op of ops){if(op.kind==='text'){ctx.fillStyle=op.color;ctx.font=`${op.bold?'600':'400'} ${op.size}px "Noto Sans KR",sans-serif`;ctx.fillText(op.line,op.x,op.y);}else if(op.kind==='photo'){ctx.drawImage(photo,op.x,op.y,op.w,op.h);}else if(op.kind==='rect'){ctx.fillStyle=op.color;ctx.fillRect(op.x,op.y,op.w,op.h);}else{ctx.strokeStyle=op.color;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(op.x,op.y);ctx.lineTo(op.x+op.w,op.y);ctx.stroke();}}
 return canvas;
}
root.Publication={create};
})(typeof window==='undefined'?globalThis:window);
