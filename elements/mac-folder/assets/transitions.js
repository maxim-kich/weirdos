// Warp the window into the folder in horizontal strips: the lower edge
// narrows first, then the upper edge follows through the curved funnel.
const genieCanvas=document.createElement('canvas');
genieCanvas.className='genie';genieCanvas.width=1280;genieCanvas.height=960;
document.querySelector('.scene').append(genieCanvas);
const genieContext=genieCanvas.getContext('2d');
let genieFrame,genieSource;
function makeGenieSource(){
 const surface=document.createElement('canvas');surface.width=1280;surface.height=960;
 const ctx=surface.getContext('2d');ctx.scale(2,2);
 const sceneRect=scene.getBoundingClientRect(),r=document.querySelector('.window').getBoundingClientRect();
 const scale=sceneRect.width/640, x=(r.left-sceneRect.left)/scale,y=(r.top-sceneRect.top)/scale,w=r.width/scale,h=r.height/scale;
 const image=document.querySelector('#window-texture');
 ctx.beginPath();ctx.roundRect(x,y,w,h,mode==='fullscreen'?12:43);ctx.clip();
 if(mode==='fullscreen'){ctx.drawImage(image.full,x-36.05,y-25.75,1030,506.245);ctx.drawImage(image.full,1250,377,157,198,x+524.27,y+168.405,80.855,101.97);ctx.drawImage(document.querySelector('.locations-replacement'),x+18,y+316,224,120);}
 else ctx.drawImage(image,x-66,y-29.7,714.45,678.15);
 return {surface,x,y,w:Math.min(w,640-x),h:Math.min(h,480-y)};
}
function genie(reverse=false,done=()=>{}){
 cancelAnimationFrame(genieFrame);
 if(!reverse)genieSource=makeGenieSource();
 const source=genieSource;if(!source){done();return;}
 genieCanvas.hidden=false;crop.style.visibility='hidden';
 const start=performance.now(),duration=reduce.matches?0:620;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 function render(now){
  const time=duration?Math.min(1,(now-start)/duration):1,p=reverse?1-time:time;
  genieContext.clearRect(0,0,1280,960);
  const pull=smooth((p-.30)/.70),top=source.y+(435-source.y)*pull;
  const bottom=source.y+source.h+(445-source.y-source.h)*smooth(p);
  for(let row=0;row<source.h;row+=1){
   const v=row/source.h,next=Math.min(1,(row+1)/source.h);
   const bend=smooth(p/.62)*smooth(v)*.94;
   const shrink=(1-bend)*(1-pull)+.065*pull;
   const width=source.w*shrink,center=(source.x+source.w/2)*(1-bend)*(1-pull)+320*(1-(1-bend)*(1-pull));
   const dy=top+(bottom-top)*v,dh=Math.max(.6,(bottom-top)*(next-v));
   genieContext.drawImage(source.surface,source.x*2,(source.y+row)*2,source.w*2,2,(center-width/2)*2,dy*2,width*2,dh*2+1);
  }
  if(time<1)genieFrame=requestAnimationFrame(render);
  else{genieCanvas.hidden=true;crop.style.visibility='';done();}
 }
 genieFrame=requestAnimationFrame(render);
}
