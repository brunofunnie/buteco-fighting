const KONAMI=['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
const actions=new Map(),listeners=new Set();

export function createKonamiDetector({timeout=2500}={}){
  let recent=[],last=-Infinity;
  const reset=()=>{recent=[];last=-Infinity;};
  return {reset,push(event,now=performance.now()){
    if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing){reset();return false;}
    if(event.repeat)return false;
    if(now-last>timeout)recent=[];
    last=now;recent.push(event.key.toLowerCase());recent=recent.slice(-KONAMI.length);
    if(recent.length===KONAMI.length&&recent.every((key,i)=>key===KONAMI[i])){reset();return true;}
    return false;
  }};
}

// Each tool owns its availability and operation; the popup owns their presentation.
// Registration returns a disposer so tools can also be removed or replaced safely.
export function registerSecretAction(action){
  if(!action?.id||!action.label||typeof action.run!=='function')throw new TypeError('A ferramenta precisa de id, label e run.');
  if(actions.has(action.id))throw new Error(`Ferramenta já registrada: ${action.id}`);
  actions.set(action.id,action);for(const listener of listeners)listener();
  return ()=>{if(actions.get(action.id)!==action)return;actions.delete(action.id);for(const listener of listeners)listener();};
}

export function createSecretMenu({parent=document.body,canOpen=()=>true,onOpen=()=>{},onClose=()=>{}}={}){
  const detector=createKonamiDetector(),dialog=document.createElement('dialog');
  dialog.id='secretMenu';dialog.setAttribute('aria-labelledby','secretMenuTitle');
  dialog.innerHTML='<header><div><h2 id="secretMenuTitle">MENU SECRETO</h2></div><button type="button" id="secretMenuClose" aria-label="Fechar menu secreto">FECHAR ×</button></header><p class="secret-intro">Atalhos para testar o jogo.</p><div id="secretMenuActions"></div><p id="secretMenuStatus" role="status" aria-live="polite"></p>';
  parent.append(dialog);
  const list=dialog.querySelector('#secretMenuActions'),status=dialog.querySelector('#secretMenuStatus'),closeButton=dialog.querySelector('#secretMenuClose');
  let busy=false,returnFocus;
  function render(){
    const focused=document.activeElement?.dataset.secretAction;
    list.replaceChildren();
    for(const action of actions.values()){
      const reason=action.available?.()||'',button=document.createElement('button');
      button.type='button';button.dataset.secretAction=action.id;button.disabled=busy||Boolean(reason);
      const title=document.createElement('strong'),description=document.createElement('span');
      title.textContent=action.label;description.textContent=reason||action.description||'';
      button.append(title,description);button.addEventListener('click',()=>run(action));list.append(button);
    }
    closeButton.disabled=busy;
    if(focused&&dialog.open)([...list.children].find(button=>button.dataset.secretAction===focused&&!button.disabled)||closeButton).focus();
  }
  async function run(action){
    if(busy||action.available?.())return;
    busy=true;status.textContent='Preparando…';render();
    try{
      const shouldClose=await action.run();
      busy=false;status.textContent='';render();
      if(shouldClose)dialog.close();else closeButton.focus();
    }catch(error){busy=false;status.textContent=error.message||'Não foi possível executar esta ação.';render();closeButton.focus();}
  }
  function open(){
    if(dialog.open||!canOpen())return;
    returnFocus=document.activeElement;status.textContent='';render();onOpen();dialog.showModal();
    (list.querySelector('button:not(:disabled)')||closeButton).focus();
  }
  function close(){if(!busy)dialog.close();}
  closeButton.addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{
    detector.reset();onClose();
    if(returnFocus?.isConnected&&returnFocus.getClientRects().length)returnFocus.focus({preventScroll:true});
  });
  function keydown(event){
    if(dialog.open){
      event.stopImmediatePropagation();
      const key=event.key.toLowerCase();
      if(['escape','k','2'].includes(key)){event.preventDefault();close();return;}
      if(['arrowup','arrowdown','arrowleft','arrowright','w','s','a','d'].includes(key)){
        event.preventDefault();const buttons=[...dialog.querySelectorAll('button:not(:disabled)')];
        if(!buttons.length)return;
        const delta=['arrowup','arrowleft','w','a'].includes(key)?-1:1;
        buttons[(buttons.indexOf(document.activeElement)+delta+buttons.length)%buttons.length].focus();
      }else if(['enter',' ','j','1'].includes(key)){
        event.preventDefault();if(!event.repeat)document.activeElement?.closest('#secretMenu button:not(:disabled)')?.click();
      }
      return;
    }
    if(!canOpen()||event.target.closest?.('input,textarea,select,[contenteditable="true"]')){detector.reset();return;}
    if(detector.push(event)){event.preventDefault();event.stopImmediatePropagation();open();}
  }
  const keyup=event=>{if(dialog.open)event.stopImmediatePropagation();};
  window.addEventListener('keydown',keydown,{capture:true});window.addEventListener('keyup',keyup,{capture:true});
  window.addEventListener('blur',detector.reset);listeners.add(render);render();
  return {get isOpen(){return dialog.open;},refresh:render,open,close,destroy(){
    busy=false;if(dialog.open)dialog.close();dialog.remove();listeners.delete(render);
    window.removeEventListener('keydown',keydown,true);window.removeEventListener('keyup',keyup,true);window.removeEventListener('blur',detector.reset);
  }};
}
