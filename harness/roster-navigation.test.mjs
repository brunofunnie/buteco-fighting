import assert from 'node:assert/strict';
import {nextRosterCell} from '../src/roster-navigation.js';
const wing=(rows,columns)=>Array.from({length:rows*columns},(_,i)=>({row:Math.floor(i/columns)+2,column:i%columns+1}));
for(const columns of [3,5]){
 const left=wing(6,columns).slice(0,-1),right=wing(5,columns),groups=[left,right];
 for(const [group,opposite]of [[left,right],[right,left]])for(const cell of group){
  for(const key of ['ArrowUp','ArrowDown']){
   const next=nextRosterCell(groups,cell,key);assert.ok(group.includes(next));assert.equal(next.column,cell.column);
   const lane=group.filter(c=>c.column===cell.column);const i=lane.indexOf(cell),delta=key==='ArrowUp'?-1:1;
   assert.equal(next,lane[(i+delta+lane.length)%lane.length]);
  }
  const lane=group.filter(c=>c.row===cell.row);
  if(cell===lane.at(-1))assert.ok(opposite.includes(nextRosterCell(groups,cell,'ArrowRight')));
  if(cell===lane[0])assert.ok(opposite.includes(nextRosterCell(groups,cell,'ArrowLeft')));
 }
 const random={row:1,column:columns};left.unshift(random);
 assert.equal(nextRosterCell(groups,left.find(c=>c.row===2&&c.column===columns),'ArrowUp'),random);
 assert.equal(nextRosterCell(groups,random,'ArrowDown'),left.find(c=>c.row===2&&c.column===columns));
}
console.log('PASS both wings, lateral crossing, vertical same-column wrap, uneven final rows and random card in desktop/mobile grids');
