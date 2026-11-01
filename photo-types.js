/* Visual proportions only. These labels never predict personality, ability, health or fate. */
((root)=>{
'use strict';
const shapes=[
 {name:'달빛 원형',glyph:'月',description:'세로와 가로의 차이가 비교적 작은 윤곽을 원의 이미지로 표현했어요.',art:'둥근 호와 부드러운 원을 겹쳐 얼굴 지도를 그려 보세요.'},
 {name:'청연 타원형',glyph:'流',description:'가로보다 세로 방향이 조금 긴 윤곽을 타원의 이미지로 표현했어요.',art:'타원과 흐르는 곡선을 겹쳐 얼굴 지도를 그려 보세요.'},
 {name:'유수 세로형',glyph:'水',description:'가로에 비해 세로 방향이 길게 잡힌 윤곽을 수직선의 이미지로 표현했어요.',art:'위아래로 이어지는 선과 긴 타원을 겹쳐 얼굴 지도를 그려 보세요.'},
 {name:'산형 윤곽형',glyph:'山',description:'볼 너비에 비해 아래쪽 윤곽의 너비가 비교적 크게 잡힌 모습을 꺾인 선으로 표현했어요.',art:'짧은 직선과 꺾이는 윤곽선을 겹쳐 얼굴 지도를 그려 보세요.'}
];
const details=[
 {name:'눈선 강조',description:'눈 바깥 지점 사이의 너비를 강조한 구성입니다.'},
 {name:'입선 강조',description:'입 양끝 지점 사이의 너비를 강조한 구성입니다.'},
 {name:'중심선 강조',description:'코의 위아래 지점을 잇는 중심선을 강조한 구성입니다.'},
 {name:'중앙 배치',description:'눈선·입선·중심선을 함께 드러내는 구성입니다.'}
];
const profiles=shapes.flatMap((shape,s)=>details.map((detail,d)=>({index:s*4+d,name:shape.name,glyph:shape.glyph,subtitle:detail.name,overview:shape.description+' '+detail.description,advice:shape.art,hope:'이 결과는 사진 한 장의 선과 비율을 표현한 시각 유형이에요. 모습의 우열이나 성격을 말하지 않아요. 내 이야기는 내가 만들어 가요.'})));
function classify(face,width,height){
 const a=face?.points;if(!a||a.length<478*3||!(width>0&&height>0))throw new Error('사진의 얼굴 지점을 확인하지 못했어요.');
 for(const value of a)if(!Number.isFinite(value))throw new Error('얼굴 지점이 불안정해요. 정면에서 다시 찍어 주세요.');
 const p=i=>({x:a[i*3]*width,y:a[i*3+1]*height});
 const dist=(i,j)=>{const u=p(i),v=p(j);return Math.hypot(u.x-v.x,u.y-v.y);};
 const fw=dist(234,454),fh=dist(10,152),left=dist(33,1),right=dist(263,1);
 if(fw<width*.12||fh<height*.16||Math.min(left,right)/Math.max(left,right)<.52)throw new Error('얼굴을 조금 더 가까이, 정면으로 맞춰 다시 찍어 주세요.');
 for(const i of [10,152,234,454]){const q=p(i);if(q.x<width*.01||q.x>width*.99||q.y<height*.01||q.y>height*.99)throw new Error('얼굴 윤곽이 잘리지 않게 맞춰 다시 찍어 주세요.');}
 const ratios={aspect:fh/fw,jaw:dist(172,397)/fw,eyes:dist(33,263)/fw,mouth:dist(61,291)/fw,nose:dist(168,2)/fh};
 const s=ratios.aspect<1.25?0:ratios.jaw>.82?3:ratios.aspect>1.52?2:1;
 const d=ratios.eyes>.70?0:ratios.mouth>.40?1:ratios.nose>.29?2:3;
 return {index:s*4+d,profile:profiles[s*4+d],ratios,shape:shapes[s].name,detail:details[d].name,count:a.length/3};
}
function rows(result,demo){const r=result.ratios;return [
 ['윤곽',`세로 ÷ 가로 약 ${r.aspect.toFixed(2)}. 이번 촬영의 윤곽 유형은 ‘${result.shape}’입니다.`],
 ['눈선',`눈 바깥 두 지점 사이의 너비는 얼굴 너비의 약 ${Math.round(r.eyes*100)}%로 잡혔어요.`],
 ['코·입선',`코 중심선 길이는 얼굴 세로의 약 ${Math.round(r.nose*100)}%, 입 너비는 얼굴 너비의 약 ${Math.round(r.mouth*100)}%로 잡혔어요.`],
 ['분류 근거',`${demo?'제공된 창작 일러스트를 촬영한 데모':'직접 촬영한 사진'}의 ${result.count}개 지점에서 계산했어요. 설문 답변은 사용하지 않았어요.`]
 ];}
root.PhotoTypes={classify,profiles,rows};
})(typeof window==='undefined'?globalThis:window);
