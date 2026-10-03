let device='mouse';
const listeners=new Set();
export function getInputDevice(){return device;}
export function setInputDevice(next){
  if(!['mouse','gamepad','keyboard','touch'].includes(next)||next===device)return;
  device=next;if(globalThis.document)document.documentElement.dataset.inputDevice=next;
  for(const listener of listeners)listener(next);
}
export function onInputDeviceChange(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
if(globalThis.document){
 document.documentElement.dataset.inputDevice=device;
 let pointer=null;
 document.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse')return;
  const next={x:event.clientX,y:event.clientY};
  if(!pointer||Math.hypot(next.x-pointer.x,next.y-pointer.y)>=3)setInputDevice('mouse');
  pointer=next;
 },{passive:true});
 document.addEventListener('pointerdown',event=>setInputDevice(event.pointerType==='touch'?'touch':'mouse'),{capture:true,passive:true});
 document.addEventListener('keydown',event=>{if(event.isTrusted)setInputDevice('keyboard');},{capture:true});
}
