import './site-profiles.js';

export const MINUTES = 10;
export const SITE_PROFILES = globalThis.CHROMEX_SITE_PROFILES || [];
export const PRESETS = {
  LITE: {ram:true,cpu:true,network:true,motion:true,fonts:false,background:false,offscreen:false,sites:false,mobileUI:false,widgets:false,thirdPartyJS:false,secondary:false,avoidAvif:false},
  PRO: {ram:true,cpu:true,network:true,motion:true,fonts:false,background:true,offscreen:true,sites:true,mobileUI:true,widgets:true,thirdPartyJS:false,secondary:false,avoidAvif:false},
  EXTREME: {ram:true,cpu:true,network:true,motion:true,fonts:true,background:true,offscreen:true,sites:true,mobileUI:true,widgets:true,thirdPartyJS:true,secondary:true,avoidAvif:true}
};
export const DEFAULTS = {enabled:true,profile:'PRO',...PRESETS.PRO,text:false,allImages:false};
export function normalize(raw={}) {
  const migrated={...raw};
  if(migrated.profile==='ECO')migrated.profile='LITE';
  // Settings removed in 1.3 are deliberately ignored by the runtime.
  delete migrated.quality;
  delete migrated.exclude;
  delete migrated.hideChat;
  const s={...DEFAULTS,...migrated};
  if(!PRESETS[s.profile]) s.profile='PRO';
  for(const k of Object.keys(DEFAULTS)) if(typeof DEFAULTS[k]==='boolean') s[k]=typeof s[k]==='boolean'?s[k]:DEFAULTS[k];
  return s;
}
export const web = url => /^https?:\/\//.test(url||'');
const CSS_PERF_SHEET={LITE:'lite',PRO:'pro',EXTREME:'extreme'};
const BASE_CSS=['motion','lite','pro','extreme','fonts','text'];
const SITE_CSS=['sites','chat','secondary'];

export const SITE_MATCHES = Object.freeze([...new Set(
  SITE_PROFILES.flatMap(profile=>(profile.hosts||[]).flatMap(host=>[
    `*://${host}/*`,
    `*://*.${host}/*`
  ]))
)]);

export function profiledUrl(url='') {
  let host='';
  try{host=new URL(url).hostname;}catch{return false;}
  return SITE_PROFILES.some(profile=>(profile.hosts||[]).some(domain=>host===domain||host.endsWith('.'+domain)));
}

export function globalCssFiles(s) {
  if(!s.enabled)return [];
  return [s.motion&&'motion',s.cpu&&CSS_PERF_SHEET[s.profile],s.fonts&&'fonts',s.text&&'text'].filter(Boolean).map(x=>'css/'+x+'.css');
}

export function siteCssFiles(s) {
  if(!s.enabled||!s.sites)return [];
  return ['css/sites.css','css/chat.css',s.secondary&&'css/secondary.css'].filter(Boolean);
}

export function cssFiles(s,url='') {
  const files=globalCssFiles(s);
  if(url&&profiledUrl(url))files.push(...siteCssFiles(s));
  return files;
}
export const ALL_CSS=[...BASE_CSS,...SITE_CSS].map(x=>'css/'+x+'.css');
export function mobileUserAgent(source='') {
  const major=(String(source).match(/(?:Chrome|Chromium)\/(\d+)/)||[])[1]||'120';
  return `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36`;
}
export function dynamicRules(s,sourceUA='') {
  if(!s.enabled)return [];
  const rules=[];let id=1000;
  const add=(condition,action={type:'block'},priority=1)=>rules.push({id:id++,priority,action,condition});
  if(s.mobileUI)add({resourceTypes:['main_frame']},{type:'modifyHeaders',requestHeaders:[{header:'user-agent',operation:'set',value:mobileUserAgent(sourceUA)}]},20);
  if(s.avoidAvif)add({resourceTypes:['image']},{type:'modifyHeaders',requestHeaders:[{header:'accept',operation:'set',value:'image/avif;q=0,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'}]},15);
  if(s.fonts||s.text)add({resourceTypes:['font']});
  if(s.widgets)add({domainType:'thirdParty',resourceTypes:['sub_frame'],requestDomains:['disqus.com','disquscdn.com','intercom.io','intercomcdn.com','crisp.chat','tawk.to','elfsight.com','platform.twitter.com','facebook.com','maps.google.com','google.com','youtube.com','youtube-nocookie.com']});
  if(s.thirdPartyJS)add({domainType:'thirdParty',resourceTypes:['script']});
  if(s.text)add({resourceTypes:['media','sub_frame','object']});
  if(s.text&&s.allImages)add({resourceTypes:['image']});
  if(s.sites){
    for(const profile of SITE_PROFILES){
      for(const rule of profile.networkRules||[])add({initiatorDomains:profile.hosts,urlFilter:rule.urlFilter,resourceTypes:[...rule.resourceTypes]});
    }
  }
  return rules;
}
