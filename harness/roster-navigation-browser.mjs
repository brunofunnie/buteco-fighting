import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const p=await b.newPage({viewport});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(process.env.GAME_URL||'http://localhost:3197');await p.locator('#titleStart').click();await p.locator('#modeScreen .mode-option.active').click();
  const groups=await p.evaluate(()=>[...document.querySelectorAll('.roster-grid')].map(grid=>[...grid.querySelectorAll('button')].filter(b=>!b.hidden).map(b=>({id:b.dataset.player,random:b.dataset.randomPick,row:+getComputedStyle(b).gridRowStart,column:+getComputedStyle(b).gridColumnStart}))));
  const selector=c=>c.id?`[data-player="${c.id}"]`:`[data-random-pick="${c.random}"]`;
  for(const [group,opposite]of [[groups[0],groups[1]],[groups[1],groups[0]]]){
   const row=group.filter(c=>c.row===2).sort((a,b)=>a.column-b.column),other=opposite.filter(c=>c.row===2).sort((a,b)=>a.column-b.column);
   for(const [from,key,to]of [[row.at(-1),'ArrowRight',other[0]],[row[0],'ArrowLeft',other.at(-1)]]){
    await p.locator(selector(from)).focus();await p.keyboard.press(key);assert.ok(await p.locator(selector(to)).evaluate(el=>el===document.activeElement));
   }
   const lane=group.filter(c=>c.column===1).sort((a,b)=>a.row-b.row);
   for(const [from,key,to]of [[lane.at(-1),'ArrowDown',lane[0]],[lane[0],'ArrowUp',lane.at(-1)]]){
    await p.locator(selector(from)).focus();await p.keyboard.press(key);assert.ok(await p.locator(selector(to)).evaluate(el=>el===document.activeElement));
   }
  }
  assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS live keyboard switches wings at both row edges and wraps within each wing column on desktop/mobile');
}finally{await b.close();}
