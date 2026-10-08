/** Render the authored warehouse without procedural overlays. */
export const DEVON_STAGE = 4;
export function drawDevonLair(c,{camera=0,time=0,width=1280,height=720,worldWidth=1920,art}={}) {
  c.save();
  if(art?.complete&&art.naturalWidth)c.drawImage(art,-camera,0,worldWidth,height);
  else{
    c.fillStyle='#101221';c.fillRect(0,0,width,height);
    c.fillStyle='#1d1d2b';c.fillRect(0,height*.79,width,height*.21);
    c.strokeStyle='#383043';c.lineWidth=5;
    for(let x=0;x<worldWidth;x+=220){c.beginPath();c.moveTo(x-camera,0);c.lineTo(x-camera,height*.79);c.stroke();}
  }
  c.restore();
}
