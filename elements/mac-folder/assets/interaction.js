const scene = document.querySelector('.scene');
const crop = document.querySelector('.finder-crop');
const controls = document.querySelector('.controls');
controls.classList.add('live');
const lights = [...document.querySelectorAll('.light')];
const liquid = document.querySelector('.liquid-fill');
const label = document.querySelector('.gesture-label');
const restore = document.querySelector('.restore');
const texture=document.querySelector('#window-texture');
texture.full=new Image();texture.full.src='assets/finder-full.png';
const status = document.querySelector('.status');
const actions = ['Close','Minimize','Full screen'];
const centers = [-16.5,20.5,57.5];
const COMMIT = 12;
const MAX_PULL = 18;
let gesture = null, expandTimer, collapseTimer, frame, springFrame;
let selected = -1, shownY = 0, shownX = 0, targetY = 0, targetX = 0;
let mode = 'normal';
let minimizedFrom='normal';
let lensX=20.5,lastFrameTime=0,lastDrawSelected=-1,openedAt=0,openAmount=1;
const magnifications=[0,0,0];
addEventListener('keydown',e=>{if(['Tab','ArrowLeft','ArrowRight','ArrowDown','Enter',' '].includes(e.key))document.documentElement.classList.add('keyboard-navigation');},true);
addEventListener('pointerdown',()=>document.documentElement.classList.remove('keyboard-navigation'),true);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
function local(e){const r=controls.getBoundingClientRect();const scale=r.width/69;return{x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale};}
function nearest(x){return centers.reduce((best,c,i)=>Math.abs(x-c)<Math.abs(x-centers[best])?i:best,0);}
function select(i){selected=i;lights.forEach((l,n)=>l.classList.toggle('selected',i===n));}
function clearTimers(){clearTimeout(expandTimer);clearTimeout(collapseTimer);}
function openPanel(){clearTimers();openAmount=1;controls.classList.add('expanded');draw();}
function updateHint(){
 const armed=!!gesture?.armed;
 controls.classList.toggle('armed',armed);
 label.textContent=selected>=0?(armed?'Release to '+actions[selected].toLowerCase():'Pull to '+actions[selected].toLowerCase()):'';
}
function draw(){
 controls.style.setProperty('--panel-sx',String(.67753+.32247*openAmount));
 controls.style.setProperty('--panel-sy',String(.888889+.111111*openAmount));
 const x=centers[Math.max(0,selected)]+shownX,y=18+shownY;
 lights.forEach((l,i)=>{l.style.setProperty('--drag-x',((i===selected?shownX:0)+(1-openAmount)*(11.5+i*23-centers[i]))+'px');l.style.setProperty('--drag-y',(i===selected?shownY:0)+'px');l.style.setProperty('--orb-scale',(1+openAmount*(.85+1.35*magnifications[i])).toFixed(4));});
 // Smooth union of the capsule and a moving circular lens. Sampling the
 // distance field keeps tangent continuity at every stage of the merge.
 const amount=Math.min(1,shownY/9), radius=18, smoothing=14*amount;
 function distance(px,py){
  const cx=Math.max(-19.8,Math.min(60.8,px));
  const a=Math.hypot(px-cx,py-18)-radius;
  let d=a;
  for(let i=0;i<3;i++){
   if(i!==selected||(magnifications[i]<.001&&shownY<=0))continue;
   const cx=centers[i]+(i===selected?shownX:0),cy=18+(i===selected?shownY:0);
   const r=17+9.1*magnifications[i],b=Math.hypot(px-cx,py-cy)-r;
   const k=shownY>1&&i===selected?smoothing:5;
   const h=k?Math.max(k-Math.abs(d-b),0)/k:0;
   d=Math.min(d,b)-h*h*k*.25;
  }
  return d;
 }
 const points=[];
 for(let i=0;i<120;i++){
  const angle=i*Math.PI*2/120,dx=Math.cos(angle),dy=Math.sin(angle);
  let lo=0,hi=160;
  for(let j=0;j<13;j++){const r=(lo+hi)/2;if(distance(20.5+dx*r,18+dy*r)<0)lo=r;else hi=r;}
  points.push([20.5+dx*lo,18+dy*lo]);
 }
 const path=(ox=0,oy=0)=>points.map((p,i)=>`${i?'L':'M'}${(p[0]+ox).toFixed(2)} ${(p[1]+oy).toFixed(2)}`).join(' ')+' Z';
 liquid.setAttribute('d',path());
 document.querySelector('.liquid-highlight').setAttribute('d',path());
 // Alpha masking clips both the material and its composited backdrop blur.
 const mask=`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="110"><path fill="white" d="${path(45,5)}"/></svg>`)}")`;
 const backdrop=document.querySelector('.liquid-backdrop');
 backdrop.style.maskImage=mask;backdrop.style.webkitMaskImage=mask;
 controls.classList.toggle('pulling',!!gesture||shownY>1);
 updateHint();
 label.style.setProperty('--label-x','20.5px');label.style.setProperty('--label-y','-17px');
}
function animate(now=performance.now()){
 if(!gesture)return;
 const before=[shownY,shownX,...magnifications,openAmount];
 openAmount=reduce.matches?1:1-Math.pow(1-Math.min(1,(now-openedAt)/200),3);
 const dt=Math.max(0,lastFrameTime?now-lastFrameTime:16.67);lastFrameTime=now;
 const factor=reduce.matches?1:1-Math.exp(-dt/16);
 for(let i=0;i<3;i++){const influence=i===selected?Math.exp(-Math.pow((centers[i]-lensX)/23,2)):0;magnifications[i]+=(influence-magnifications[i])*(reduce.matches?1:1-Math.exp(-dt/45));}
 shownY+=(targetY-shownY)*factor;shownX+=(targetX-shownX)*factor;
 if([shownY,shownX,...magnifications,openAmount].some((v,i)=>Math.abs(v-before[i])>.001)||lastDrawSelected<0||lastDrawSelected!==selected){draw();lastDrawSelected=selected;}
 frame=requestAnimationFrame(animate);
}
function retract(){
 cancelAnimationFrame(frame);cancelAnimationFrame(springFrame);
 const fromMagnifications=[...magnifications],fromOpen=openAmount;
 const fromY=shownY,fromX=shownX,start=performance.now(),duration=reduce.matches?0:300;
 controls.classList.remove('armed');label.textContent='';
 function tick(now){const t=duration?Math.min(1,(now-start)/duration):1;const decay=Math.pow(1-t,3);if(controls.classList.contains('expanded'))openAmount=1-(1-fromOpen)*decay;magnifications.forEach((_,i)=>magnifications[i]=fromMagnifications[i]*decay);shownY=fromY*decay;shownX=fromX*decay;targetY=0;draw();label.textContent='';if(t<1)springFrame=requestAnimationFrame(tick);else{shownY=shownX=targetX=targetY=0;controls.classList.remove('pulling');select(-1);draw();}}
 springFrame=requestAnimationFrame(tick);
}
function cancel(){clearTimers();gesture=null;cancelAnimationFrame(frame);retract();controls.classList.remove('expanded');}
function finishAction(index){
 if(mode==='fullscreen'&&index===2){restoreWindow();return;}
 if(index===1){minimizedFrom=mode;genie();}
 clearTimers();controls.classList.remove('expanded');retract();
 if(index===0){mode='closed';crop.classList.add('is-closed');restore.hidden=false;status.textContent='Finder closed. Open the folder to start again.';restore.focus({preventScroll:true});}
 if(index===1){mode='minimized';crop.classList.add('is-minimized');restore.hidden=false;status.textContent='Finder minimized.';restore.focus({preventScroll:true});}
 if(index===2){mode='fullscreen';crop.classList.add('is-fullscreen');actions[2]='Exit full screen';lights[2].querySelector('path').setAttribute('d','M14 4v8.5q0 1.5-1.5 1.5H4ZM14 24v-8.5q0-1.5 1.5-1.5H24Z');lights[2].setAttribute('aria-label','Exit full screen — slide down to confirm');status.textContent='Finder is full screen.';lights[2].focus({preventScroll:true});}
 scene.dataset.mode=mode;
}
function restoreWindow(){
 const wasMinimized=mode==='minimized',returnFull=wasMinimized&&minimizedFrom==='fullscreen';
 cancel();crop.classList.remove('is-closed','is-minimized');crop.classList.toggle('is-fullscreen',returnFull);
 restore.hidden=true;mode=returnFull?'fullscreen':'normal';scene.dataset.mode=mode;
 actions[2]=returnFull?'Exit full screen':'Full screen';
 lights[2].querySelector('path').setAttribute('d',returnFull?'M14 4v8.5q0 1.5-1.5 1.5H4ZM14 24v-8.5q0-1.5 1.5-1.5H24Z':'M11 8h5.8q.8 0 .65 .55l-8.9 8.9Q8 18 8 17.2V11q0-3 3-3ZM17 20h-5.8q-.8 0-.65-.55l8.9-8.9Q20 10 20 10.8V17q0 3-3 3Z');
 lights[2].setAttribute('aria-label',actions[2]+' — slide down to confirm');
 status.textContent=returnFull?'Finder restored to full screen.':'Finder restored.';
 lights[returnFull?2:0].focus({preventScroll:true});if(wasMinimized)genie(true);
}
controls.addEventListener('pointerdown',e=>{
 if(e.button!==0||gesture||(mode!=='normal'&&mode!=='fullscreen'))return;
 const b=e.target.closest('.light');if(!b&&!controls.classList.contains('expanded'))return;
 e.preventDefault();clearTimers();cancelAnimationFrame(springFrame);
 const p=local(e),initial=controls.classList.contains('expanded')?nearest(p.x):(b?lights.indexOf(b):nearest(p.x));
 gesture={id:e.pointerId,start:p,last:p,locked:false,armed:false,anchorY:p.y};
 shownX=shownY=targetX=targetY=0;lastFrameTime=0;lastDrawSelected=-1;openedAt=performance.now();openAmount=0;lensX=centers[initial];magnifications.fill(0);select(initial);controls.setPointerCapture(e.pointerId);
 expandTimer=setTimeout(()=>{controls.classList.add('expanded');if(gesture)frame=requestAnimationFrame(animate);},0);
});
controls.addEventListener('pointermove',e=>{
 if(!gesture||e.pointerId!==gesture.id)return;
 e.preventDefault();const p=local(e);gesture.last=p;
 if(!controls.classList.contains('expanded')&&Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>4){clearTimeout(expandTimer);controls.classList.add('expanded');cancelAnimationFrame(frame);frame=requestAnimationFrame(animate);}
 const dy=Math.max(0,p.y-gesture.anchorY);
 if(dy<6){gesture.locked=false;if(Math.abs(p.x-gesture.start.x)>6||gesture.hasSlid){gesture.hasSlid=true;lensX=Math.max(centers[0],Math.min(centers[2],p.x));select(nearest(p.x));}targetX=0;targetY=0;}
 else{
  if(!gesture.locked){gesture.locked=true;gesture.anchorX=p.x;lensX=centers[selected];}
  targetY=MAX_PULL*(1-Math.exp(-Math.max(0,dy-6)/16));targetX=5*Math.tanh((p.x-gesture.anchorX)/24);
 }
 // A distinct return threshold prevents release jitter from undoing a shown confirmation.
 if(targetY>=COMMIT)gesture.armed=true;
 else if(targetY<=COMMIT*.5)gesture.armed=false;
 updateHint();
});
controls.addEventListener('pointerup',e=>{
 if(!gesture||e.pointerId!==gesture.id)return;
 const index=selected,commit=gesture.armed;gesture=null;clearTimeout(expandTimer);cancelAnimationFrame(frame);
 if(controls.hasPointerCapture(e.pointerId))controls.releasePointerCapture(e.pointerId);
 if(commit){finishAction(index);return;}
 retract();controls.classList.add('expanded');collapseTimer=setTimeout(()=>controls.classList.remove('expanded'),900);
});
controls.addEventListener('pointercancel',cancel);
controls.addEventListener('lostpointercapture',()=>{if(gesture)cancel();});
controls.addEventListener('keydown',e=>{
 if(e.key===' '||e.key==='Enter'){e.preventDefault();openPanel();select(Math.max(0,lights.indexOf(e.target)));}
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();openPanel();select(Math.max(0,Math.min(2,(selected<0?0:selected)+(e.key==='ArrowRight'?1:-1))));}
 if(e.key==='ArrowDown'&&selected>=0){e.preventDefault();finishAction(selected);}
});
restore.addEventListener('click',restoreWindow);
addEventListener('blur',()=>{if(gesture)cancel();});
addEventListener('resize',()=>{if(gesture)cancel();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(gesture||controls.classList.contains('expanded')){cancel();return;}if(mode!=='normal'){restoreWindow();return;}if(parent!==window)parent.postMessage({type:'weirdos:close'},'*');}});
document.addEventListener('pointerdown',e=>{if(!gesture&&!controls.contains(e.target)){clearTimers();controls.classList.remove('expanded');select(-1);}});
addEventListener('load',()=>requestAnimationFrame(()=>{if(parent!==window)parent.postMessage({type:'weirdos:ready'},'*');}));
