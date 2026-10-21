import {DEFAULTS,PRESETS,normalize} from './config.js';
let settings=normalize((await chrome.storage.local.get('settings')).settings);
const status=document.getElementById('status');
function render(){
  for(const [k,v] of Object.entries(settings)){const el=document.getElementById(k);if(el?.type==='checkbox')el.checked=v;}
  document.querySelectorAll('[data-profile]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profile===settings.profile)));
  document.getElementById('profileNote').textContent={LITE:'CSS ligero, RAM, red y movimiento; sin JavaScript de contenido.',PRO:'CSS equilibrado, Site Optimizer y Mobile Site Mode.',EXTREME:'CSS máximo y recortes agresivos: puede alterar funciones y diseño.'}[settings.profile];
}
async function save(){try{settings=normalize(settings);await chrome.storage.local.set({settings});status.textContent='Guardado. Recarga las páginas abiertas.';render();}catch(e){status.textContent='No se pudo guardar: '+e.message;}}
document.querySelectorAll('input[type=checkbox]').forEach(el=>el.addEventListener('change',()=>{settings[el.id]=el.checked;save();}));
document.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>{settings={...settings,...PRESETS[b.dataset.profile],profile:b.dataset.profile,text:false,allImages:false};save();}));
document.getElementById('options')?.addEventListener('click',()=>chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener((c,area)=>{if(area!=='local')return;if(c.settings){settings=normalize(c.settings.newValue);render();}if(c.applyError?.newValue)status.textContent='Error al aplicar: '+c.applyError.newValue;});
const err=(await chrome.storage.local.get('applyError')).applyError;if(err)status.textContent='Error al aplicar: '+err;
render();
