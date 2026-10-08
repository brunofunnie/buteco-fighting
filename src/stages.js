import {DEVON_STAGE,drawDevonLair} from './devon-lair.js';
import {crowdLayouts} from './crowd-layout.js';
const cache = new Map();
const TAU = Math.PI * 2;
const palettes = [
  {sky:'#172331',haze:'#554b43',dark:'#242628',ambient:'#dfb895',reflection:'#d1af83'},
  {sky:'#294656',haze:'#d7b394',dark:'#6c5c4a',ambient:'#e6c596',reflection:'#c0d4d4'},
  {sky:'#152126',haze:'#424344',dark:'#1c2528',ambient:'#dfbc8a',reflection:'#dfba77'},
  {sky:'#243940',haze:'#a78b66',dark:'#39322a',ambient:'#d0c299',reflection:'#b9cdb5'},
  {sky:'#0a1020',haze:'#241b32',dark:'#121321',ambient:'#b397ce',reflection:'#8d66af'},
];
export function arenaPalette(stage=0){return palettes[Math.max(0,Math.min(4,stage|0))];}
function canvas(w,h){const a=document.createElement('canvas');a.width=w;a.height=h;return a;}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function line(c,x,y,xx,yy,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
function arch(c,x,y,w,h,color){c.fillStyle=color;c.beginPath();c.moveTo(x,y+h);c.lineTo(x,y+w/2);c.arc(x+w/2,y+w/2,w/2,Math.PI,0);c.lineTo(x+w,y+h);c.closePath();c.fill();}
function makeLayers(stage,width,height,floor,worldWidth){
  const key=[stage,width,height,floor,worldWidth].join(':');if(cache.has(key))return cache.get(key);
  const p=arenaPalette(stage),far=canvas(worldWidth,height),mid=canvas(worldWidth,height),ground=canvas(worldWidth,height);
  const f=far.getContext('2d'),m=mid.getContext('2d'),g=ground.getContext('2d');
  const sky=f.createLinearGradient(0,0,0,floor);sky.addColorStop(0,p.sky);sky.addColorStop(1,p.haze);f.fillStyle=sky;f.fillRect(0,0,worldWidth,height);
  if(stage===0){
    for(let x=0;x<worldWidth;x+=105){const h=60+x*13%130;rect(f,x,300-h,96,h+220,'#26323a');for(let y=325-h;y<300;y+=24)rect(f,x+18,y,5,8,'#bb986b55');}
    // MASP's red suspended structure leaves the whole plaza open below it.
    rect(m,310,140,1300,174,'#31363b');rect(m,332,166,1256,112,'#6d797955');
    for(const x of[290,1605]){rect(m,x,102,27,400,'#9e3531');rect(m,x-16,101,59,20,'#b74436');}
    rect(m,290,305,1342,24,'#a73b32');rect(m,0,493,worldWidth,35,'#494642');
    for(let x=40;x<worldWidth;x+=180)rect(m,x,510,85,5,'#bbb4a155');
  }else if(stage===1){
    rect(f,0,320,worldWidth,215,'#507982');
    f.fillStyle='#324e51';f.beginPath();f.moveTo(1250,355);f.quadraticCurveTo(1360,160,1420,310);f.quadraticCurveTo(1510,95,1655,350);f.lineTo(1780,380);f.closePath();f.fill();
    const sand=m.createLinearGradient(0,500,0,floor);sand.addColorStop(0,'#b5a082');sand.addColorStop(1,'#c1ab8b');m.fillStyle=sand;m.fillRect(0,500,worldWidth,floor-500);
    for(const x of[220,1730]){line(m,x,520,x+12,342,'#675c42',8);for(let j=0;j<6;j++)line(m,x+12,342,x+Math.cos(j)*70,335+Math.sin(j)*28,'#3f6250',9);}
    rect(m,1830,420,75,112,'#86745a');rect(m,1810,411,110,14,'#5b725e');
  }else if(stage===2){
    const walls=['#627f78','#b97b53','#b49c66','#955f54'];
    for(let x=-30,n=0;x<worldWidth;x+=218,n++){
      const top=224+n%3*22;rect(m,x,top,214,floor-top-26,walls[n%4]);rect(m,x-3,top-10,220,13,'#4c4034');
      for(const wx of[x+28,x+137]){arch(m,wx,top+42,47,102,'#343e3b');rect(m,wx+5,top+63,37,66,'#62705e');for(let y=top+68;y<top+126;y+=9)line(m,wx+7,y,wx+40,y,'#25342b',2);}
      arch(m,x+48,floor-172,75,146,'#252c29');rect(m,x,floor-26,214,26,'#4a493f');
    }
  }else{
    // The central meeting of black and brown water remains visible behind the deck.
    rect(f,0,330,worldWidth/2,245,'#253c40');rect(f,worldWidth/2,330,worldWidth/2,245,'#79684d');
    for(let x=0;x<worldWidth;x+=90){f.fillStyle='#2f483d';f.beginPath();f.arc(x,330-(x%43),65,Math.PI,TAU);f.fill();}
    rect(m,170,510,1580,80,'#65533d');
    for(let x=190;x<1750;x+=125){rect(m,x,474,8,85,'#4e4235');line(m,x,493,x+125,493,'#61513e',4);}
    for(const x of[190,1730]){m.strokeStyle='#1e2424';m.lineWidth=13;m.beginPath();m.ellipse(x,567,21,30,0,0,TAU);m.stroke();}
  }
  const groundColors=stage===1?['#c8b293','#9a8266']:stage===3?['#877052','#44372b']:['#55534b',p.dark];
  const pavement=g.createLinearGradient(0,floor,0,height);pavement.addColorStop(0,groundColors[0]);pavement.addColorStop(1,groundColors[1]);g.fillStyle=pavement;g.fillRect(0,floor,worldWidth,height-floor);
  if(stage===3){for(let x=0;x<worldWidth;x+=84){line(g,x,floor,x-25,height,'#2d2b2544',2);for(let y=floor+16;y<height;y+=28)line(g,x+6,y,x+58,y-1,'#c7a77922');}}
  else if(stage!==1){for(let y=floor+12,row=0;y<height;y+=24,row++){line(g,0,y,worldWidth,y,'#141d2345');for(let x=row%2*44;x<worldWidth;x+=88)line(g,x,y,x+8,y+24,'#141d2340');}}
  const layers={far,mid,ground};cache.set(key,layers);return layers;
}
function patron(c,x,y,height,time,images,offset=0,mirrored=false,contactShadow=false){
  if(!images?.length)return;const img=images[(Math.floor(time*(images.animation?.fps||3))+offset)%images.length];if(!img?.naturalWidth)return;
  const meta=img.spriteMeta||{},scale=height*(meta.scale||1/352),w=img.naturalWidth*scale,h=img.naturalHeight*scale;
  c.save();c.translate(x,y);if(mirrored)c.scale(-1,1);
  c.save();c.translate(contactShadow?w*((meta.contactX??meta.anchorX??.5)-(meta.anchorX??.5)):0,1);c.scale(contactShadow?height*.085:height*.17,contactShadow?2.5:4);const shadow=c.createRadialGradient(0,0,0,0,0,1);shadow.addColorStop(0,'#10191138');shadow.addColorStop(1,'#10191100');c.fillStyle=shadow;c.fillRect(-1,-1,2,2);c.restore();
  c.drawImage(img,-w*(meta.anchorX??.5),-h*(meta.anchorY??.96),w,h);c.restore();
}
function details(c,stage,camera,time,worldWidth,crowdArt){
  c.save();c.translate(-camera,0);
  for(const[n,person]of crowdLayouts[stage].entries()){
    const images=crowdArt?.[person.id]||crowdArt?.[person.fallback];
    const x=person.motion==='walk'?230+((time*24+person.x)%(worldWidth-460)):person.x;
    patron(c,x,person.y,person.height,time,images,n,Boolean(person.mirrored),person.motion==='walk');
  }
  c.restore();
}
export function drawArena(ctx,{stage=0,cameraX=0,time=0,width=1280,height=720,floor=590,worldWidth=1920,art,crowdArt}={}){
  stage=Math.max(0,Math.min(4,stage|0));const camera=Math.max(0,Math.min(worldWidth-width,cameraX||0));ctx.save();ctx.imageSmoothingEnabled=true;
  if(stage===DEVON_STAGE){drawDevonLair(ctx,{camera,time,width,height,worldWidth,art});ctx.restore();return;}
  if(art?.complete&&art.naturalWidth){ctx.drawImage(art,-camera,0,worldWidth,height);}
  else{const layers=makeLayers(stage,width,height,floor,worldWidth);ctx.drawImage(layers.far,-camera*.2,0);ctx.drawImage(layers.mid,-camera*.6,0);ctx.drawImage(layers.ground,-camera,0);}
  details(ctx,stage,camera,time,worldWidth,crowdArt);ctx.restore();
}
