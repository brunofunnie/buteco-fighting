/** Animated details aligned to the authored 2048×768 warehouse background. */
export const DEVON_STAGE = 4;
export const LAIR_MONITORS = Object.freeze([
  [576,257,121,64], [809,258,113,67], [1054,257,122,66], [1362,256,129,65],
]);
const codeLines = ['const node = await connect();','if (signal.ready) {','  sync(network, payload);','  return stream.next();','} // access granted','0xFA :: packet verified','listen("devon", execute);','cache.set(key, buffer);','await server.handshake();'];
export function drawDevonLair(c,{camera=0,time=0,width=1280,height=720,worldWidth=1920,art}={}) {
  c.save();
  if(art?.complete&&art.naturalWidth)c.drawImage(art,-camera,0,worldWidth,height);
  else{
    c.fillStyle='#101221';c.fillRect(0,0,width,height);
    c.fillStyle='#1d1d2b';c.fillRect(0,height*.79,width,height*.21);
    c.strokeStyle='#383043';c.lineWidth=5;
    for(let x=0;x<worldWidth;x+=220){c.beginPath();c.moveTo(x-camera,0);c.lineTo(x-camera,height*.79);c.stroke();}
  }
  c.translate(-camera,0);c.scale(worldWidth/2048,height/768);
  for(const [index,[x,y,w,h]] of LAIR_MONITORS.entries()){
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
    c.fillStyle='#030b12e8';c.fillRect(x,y,w,h);
    c.font='5px monospace';c.textBaseline='top';
    const shift=(time*(6+index))%8,first=Math.floor(time*(6+index)/8);
    for(let row=0;row<11;row++){
      c.fillStyle=index%2?'#77c5b5aa':'#c88df2b0';
      c.fillText(codeLines[(first+row+index)%codeLines.length],x+5,y+row*8-shift,w-10);
    }
    c.fillStyle='#c9a0ff16';for(let scan=y;scan<y+h;scan+=3)c.fillRect(x,scan,w,1);
    c.restore();
  }
  // Low rectangular spot lights and restrained dust cones behind the fighters.
  for(const [index,x] of [308,714,1075,1480,1787].entries()){
    c.save();c.globalAlpha=.035+Math.sin(time*.7+index)*.006;
    const beam=c.createLinearGradient(0,52,0,570);beam.addColorStop(0,'#bc9df0');beam.addColorStop(1,'#bc9df000');c.fillStyle=beam;
    c.beginPath();c.moveTo(x-24,52);c.lineTo(x+24,52);c.lineTo(x+180,570);c.lineTo(x-180,570);c.closePath();c.fill();c.restore();
  }
  c.restore();
}
