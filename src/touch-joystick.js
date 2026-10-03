/** Eight-way touch movement with a neutral center and independent attack fingers. */
export function attachTouchJoystick(element, {bindings, enabled}) {
  let pointer=null;
  const held=new Map();
  const send=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
  const reset=()=>{
    for(const code of held.values())send('keyup',code);
    held.clear();pointer=null;
    element.style.setProperty('--stick-x','0px');
    element.style.setProperty('--stick-y','0px');
    element.classList.remove('active');
  };
  const move=event=>{
    if(event.pointerId!==pointer)return;
    if(!enabled()){reset();return;}
    const rect=element.getBoundingClientRect(),radius=rect.width*.34;
    const dx=event.clientX-rect.left-rect.width/2,dy=event.clientY-rect.top-rect.height/2;
    const distance=Math.hypot(dx,dy),scale=distance>radius?radius/distance:1;
    const x=dx*scale,y=dy*scale;
    element.style.setProperty('--stick-x',`${x}px`);
    element.style.setProperty('--stick-y',`${y}px`);
    const next=new Set();
    if(x/radius < -.3)next.add('left');
    if(x/radius > .3)next.add('right');
    if(y/radius < -.3)next.add('jump');
    if(y/radius > .3)next.add('crouch');
    for(const [action,code]of held)if(!next.has(action)){send('keyup',code);held.delete(action);}
    for(const action of next)if(!held.has(action)){
      const code=[bindings()[action]].flat()[0];
      if(code){held.set(action,code);send('keydown',code);}
    }
  };
  element.addEventListener('pointerdown',event=>{
    if(pointer!==null||!enabled())return;
    event.preventDefault();pointer=event.pointerId;
    element.setPointerCapture(pointer);element.classList.add('active');move(event);
  });
  element.addEventListener('pointermove',move);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,event=>{if(event.pointerId===pointer)reset();});
  window.addEventListener('blur',reset);
  window.addEventListener('resize',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  return reset;
}
