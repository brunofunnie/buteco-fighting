// Small mirror-match experiment: recolor neutral clothing shadows, preserving warm skin tones.
const cache=new WeakMap();
export function alternateSprite(image){
  if(cache.has(image))return cache.get(image);
  if(!image?.naturalWidth||!globalThis.document)return image;
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
  const width=canvas.width,count=width*canvas.height,clothing=new Uint8Array(count);
  const bodyStart=Math.floor(canvas.height*.28)*width;
  for(let p=0;p<count;p++){
    const i=p*4;if(!data[i+3])continue;
    const r=data[i],g=data[i+1],b=data[i+2],high=Math.max(r,g,b),low=Math.min(r,g,b);
    if(high<25||high>170||high-low>38)continue;
    clothing[p]=1;
  }
  // Follow neutral fabric across the old boundary instead of cutting shoulders
  // horizontally. Separate head regions stay untouched; warm skin blocks traversal.
  const pending=new Int32Array(count);let size=0;
  const visit=p=>{if(p>=0&&p<count&&clothing[p]===1){clothing[p]=2;pending[size++]=p;}};
  for(let p=bodyStart;p<count;p++)visit(p);
  while(size){
    const p=pending[--size],x=p%width;
    if(x>0)visit(p-1);if(x<width-1)visit(p+1);
    visit(p-width);visit(p+width);
  }
  for(let p=0;p<count;p++){
    if(clothing[p]!==2)continue;
    const i=p*4,light=(data[i]+data[i+1]+data[i+2])/3;
    data[i]=light*.5;data[i+1]=light*1.05;data[i+2]=Math.min(255,light*1.6);
  }
  context.putImageData(pixels,0,0);cache.set(image,canvas);return canvas;
}
