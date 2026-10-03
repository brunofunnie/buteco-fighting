// Cells use their CSS grid row/column, including reserved gaps and random cards.
export function nextRosterCell(groups, current, key) {
  const groupIndex=groups.findIndex(group=>group.includes(current));
  if(groupIndex<0)return null;
  const group=groups[groupIndex];
  const direction=key==='ArrowLeft'||key==='ArrowUp'?-1:1;
  const vertical=key==='ArrowUp'||key==='ArrowDown';
  const lane=group.filter(cell=>vertical?cell.column===current.column:cell.row===current.row)
    .sort((a,b)=>vertical?a.row-b.row:a.column-b.column);
  const index=lane.indexOf(current);
  if(vertical)return lane[(index+direction+lane.length)%lane.length];
  if(lane[index+direction])return lane[index+direction];
  const opposite=groups[(groupIndex+1)%groups.length];
  if(!opposite.length)return current;
  // Uneven final rows use the closest available row in the opposite wing.
  const row=[...new Set(opposite.map(cell=>cell.row))].sort((a,b)=>Math.abs(a-current.row)-Math.abs(b-current.row)||a-b)[0];
  const otherLane=opposite.filter(cell=>cell.row===row).sort((a,b)=>a.column-b.column);
  return direction>0?otherLane[0]:otherLane.at(-1);
}
