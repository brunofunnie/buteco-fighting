const modes = ['default','none','2x','3x','vignette','crt'];
const storageKey = 'buteco-scanlines';
const layers = [...document.querySelectorAll('.cabinet-noise')];
const buttons = [...document.querySelectorAll('[data-scanline-mode]')];
let mode = 'default';
try { const saved = localStorage.getItem(storageKey); if (modes.includes(saved)) mode = saved; } catch {}

function drawCurvedLines(layer) {
  const canvas = layer.querySelector('canvas');
  if (!canvas || layer.dataset.scanlines !== 'crt') return;
  const {width,height} = layer.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = Math.min(window.devicePixelRatio || 1,2);
  canvas.width = Math.round(width*ratio);
  canvas.height = Math.round(height*ratio);
  const context = canvas.getContext('2d');
  context.scale(ratio,ratio);
  context.strokeStyle = 'rgba(0,0,0,.16)';
  context.lineWidth = 1;
  const bend = Math.min(width,height)*.035;
  // Each line bows toward the center; the bend increases toward the corners.
  for (let y=-bend; y<height+bend; y+=4) {
    const offset = (y-height/2)/(height/2)*bend;
    context.beginPath();
    context.moveTo(0,y-offset);
    context.quadraticCurveTo(width/2,y+offset,width,y-offset);
    context.stroke();
  }
}
function applyMode(next) {
  mode = next;
  for (const layer of layers) {
    layer.dataset.scanlines = mode;
    drawCurvedLines(layer);
  }
  for (const button of buttons) button.setAttribute('aria-pressed',String(button.dataset.scanlineMode === mode));
}
for (const layer of layers) {
  const canvas = document.createElement('canvas');
  canvas.className = 'crt-lines';
  layer.append(canvas);
  new ResizeObserver(()=>drawCurvedLines(layer)).observe(layer);
}
for (const button of buttons) button.addEventListener('click',()=>{
  applyMode(button.dataset.scanlineMode);
  let saved = true;
  try { localStorage.setItem(storageKey,mode); } catch { saved = false; }
  document.querySelector('#scanlineStatus').textContent = `${button.textContent.trim()}${saved ? ' · Salvo neste navegador.' : ' · Ativo nesta sessão.'}`;
});
applyMode(mode);
