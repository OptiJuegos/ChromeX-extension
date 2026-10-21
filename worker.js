import {DEFAULTS,normalize,web,cssFiles,globalCssFiles,siteCssFiles,SITE_MATCHES,ALL_CSS,dynamicRules,MINUTES} from './config.js';
const ALARM='chromex-next-discard', KEY='scheduler';
// Queue only while awake; durable state is in storage.session, never this variable.
let queue=Promise.resolve();
function run(fn){const p=queue.then(fn);queue=p.catch(e=>console.error('ChromeX:',e));return p;}
async function settings(){return normalize((await chrome.storage.local.get('settings')).settings);}
async function state(){return (await chrome.storage.session.get(KEY))[KEY]||{active:{},due:{}};}
async function save(st){await chrome.storage.session.set({[KEY]:st});await arm(st);}
async function arm(st){const times=Object.values(st.due);if(!times.length){await chrome.alarms.clear(ALARM);return;}const when=Math.max(Date.now()+500,Math.min(...times));const old=await chrome.alarms.get(ALARM);if(!old||Math.abs(old.scheduledTime-when)>1000)await chrome.alarms.create(ALARM,{when});}
const eligible=(t,s)=>s.enabled&&s.ram&&web(t.url)&&!t.active&&!t.discarded&&!t.pinned&&!t.audible&&t.autoDiscardable!==false;
async function getTab(id){try{return await chrome.tabs.get(Number(id));}catch{return null;}}
async function reconcile(reset=false){
  const s=await settings(),st=reset?{active:{},due:{}}:await state();
  const tabs=await chrome.tabs.query({}),live=new Set(tabs.map(t=>String(t.id)));
  for(const id of Object.keys(st.due))if(!live.has(id))delete st.due[id];
  st.active={};
  for(const t of tabs){if(t.active)st.active[t.windowId]=t.id;if(eligible(t,s)){st.due[t.id]??=Date.now()+MINUTES*60000;}else delete st.due[t.id];}
  await save(st);
}
async function registrations(s){
  const old=await chrome.scripting.getRegisteredContentScripts();
  if(old.length)await chrome.scripting.unregisterContentScripts({ids:old.map(x=>x.id)});
  if(!s.enabled)return;
  const base={matches:['http://*/*','https://*/*'],persistAcrossSessions:true};
  const scripts=[],css=globalCssFiles(s),siteCss=siteCssFiles(s);
  if(css.length)scripts.push({...base,id:'cx-css',css,runAt:'document_start',allFrames:false});
  // Site-only styles no longer parse/match on unrelated pages.
  if(siteCss.length&&SITE_MATCHES.length)scripts.push({matches:SITE_MATCHES,persistAcrossSessions:true,id:'cx-css-sites',css:siteCss,runAt:'document_start',allFrames:false});
  if(s.mobileUI)scripts.push({...base,id:'cx-mobile-main',js:['mobile-main.js'],runAt:'document_start',world:'MAIN'});
  if(s.background||s.offscreen||s.sites)scripts.push({...base,id:'cx-media',js:['site-profiles.js','media.js'],runAt:'document_idle'});
  if(scripts.length)await chrome.scripting.registerContentScripts(scripts);
}
async function apply(s){
  await chrome.storage.local.set({applyError:null});
  const old=await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:old.map(r=>r.id),addRules:dynamicRules(s,globalThis.navigator?.userAgent||'')});
  await chrome.declarativeNetRequest.updateEnabledRulesets({enableRulesetIds:s.enabled&&s.network?['telemetry']:[],disableRulesetIds:s.enabled&&s.network?[]:['telemetry']});
  await registrations(s);
  // One pass on a user settings change, never on a timer or every navigation.
  const tabs=await chrome.tabs.query({});
  await Promise.all(tabs.filter(t=>web(t.url)&&!t.discarded).map(async t=>{
    await Promise.all(ALL_CSS.map(file=>chrome.scripting.removeCSS({target:{tabId:t.id,allFrames:false},files:[file]}).catch(()=>{})));
    const css=cssFiles(s,t.url);
    if(css.length)await chrome.scripting.insertCSS({target:{tabId:t.id,allFrames:false},files:css}).catch(()=>{});
    if(s.enabled&&s.mobileUI)await chrome.scripting.executeScript({target:{tabId:t.id},files:['mobile-main.js'],world:'MAIN'}).catch(()=>{});
    if(s.enabled&&(s.background||s.offscreen||s.sites))await chrome.scripting.executeScript({target:{tabId:t.id},files:['site-profiles.js','media.js']}).catch(()=>{});
  }));
  await reconcile();
  await chrome.action.setBadgeText({text:s.enabled?s.profile.slice(0,1):'OFF'});
  await chrome.action.setBadgeBackgroundColor({color:s.profile==='EXTREME'?'#e86d41':'#227c68'});
}
chrome.runtime.onInstalled.addListener(()=>run(async()=>{
  const raw=(await chrome.storage.local.get('settings')).settings;
  if(!raw)await chrome.storage.local.set({settings:DEFAULTS});else await apply(normalize(raw));
  await reconcile(true);
}));
chrome.runtime.onStartup.addListener(()=>run(async()=>{await apply(await settings());await reconcile(true);}));
chrome.tabs.onActivated.addListener(info=>run(async()=>{
  const s=await settings(),st=await state(),previous=st.active[info.windowId];
  st.active[info.windowId]=info.tabId;delete st.due[info.tabId];
  if(previous!==undefined&&previous!==info.tabId){const t=await getTab(previous);if(t&&eligible(t,s))st.due[previous]=Date.now()+MINUTES*60000;}
  await save(st);
}));
chrome.tabs.onCreated.addListener(t=>run(async()=>{const s=await settings(),st=await state();if(t.active){const prev=st.active[t.windowId];if(prev!==undefined&&prev!==t.id){const p=await getTab(prev);if(p&&eligible(p,s))st.due[prev]=Date.now()+MINUTES*60000;}st.active[t.windowId]=t.id;}else if(eligible(t,s))st.due[t.id]=Date.now()+MINUTES*60000;await save(st);}));
chrome.tabs.onUpdated.addListener((id,change,t)=>{
  // Irrelevant title/favicon/load progress updates cause no storage/API work.
  if(!['url','audible','pinned','discarded','autoDiscardable'].some(k=>k in change))return;
  run(async()=>{const s=await settings(),st=await state();if(eligible(t,s))st.due[id]??=Date.now()+MINUTES*60000;else delete st.due[id];await save(st);});
});
chrome.tabs.onRemoved.addListener(id=>run(async()=>{const st=await state();delete st.due[id];for(const w in st.active)if(st.active[w]===id)delete st.active[w];await save(st);}));
chrome.tabs.onReplaced.addListener(()=>run(()=>reconcile()));
chrome.tabs.onAttached.addListener(()=>run(()=>reconcile()));
chrome.tabs.onDetached.addListener(()=>run(()=>reconcile()));
chrome.windows.onRemoved.addListener(w=>run(async()=>{const st=await state();delete st.active[w];await save(st);}));
chrome.alarms.onAlarm.addListener(a=>{if(a.name!==ALARM)return;run(async()=>{
  const s=await settings(),st=await state(),now=Date.now();
  for(const [id,deadline] of Object.entries(st.due)){
    if(deadline>now)continue;delete st.due[id];const t=await getTab(id);
    if(t&&eligible(t,s)){
      // If present, consult the event-driven form/media guard once before discard.
      let guard;try{guard=await chrome.tabs.sendMessage(t.id,{type:'canDiscard'});}catch{}
      if(guard?.protect)continue;
      const fresh=await getTab(id);if(fresh&&eligible(fresh,s))await chrome.tabs.discard(fresh.id).catch(()=>{});
    }
  }
  await save(st);
});});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.settings)run(async()=>{try{await apply(normalize(changes.settings.newValue));}catch(e){await chrome.storage.local.set({applyError:String(e.message||e)});throw e;}});});
// Alarm recovery on a genuine worker wake; this does not keep the worker alive.
run(async()=>{const st=await state();await arm(st);});
