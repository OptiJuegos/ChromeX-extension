(() => {
  if(globalThis.__chromeXLite)return;
  globalThis.__chromeXLite=true;
  let stop=()=>{},dirty=false;
  const host=location.hostname;
  const siteProfiles=globalThis.CHROMEX_SITE_PROFILES||[];
  const site=siteProfiles.find(p=>(p.hosts||[]).some(d=>host===d||host.endsWith('.'+d)));
  const youtube=site?.id==='youtube';
  const optimized=!!site;
  function configure(s){
    stop();
    if(!s.enabled||!(s.background||s.offscreen||s.sites))return;
    if(s.sites&&optimized)document.documentElement.dataset.cxSite=site.id;
    const controller=new AbortController(),signal=controller.signal;
    const listen=(target,event,fn,extra={})=>target.addEventListener(event,fn,{...extra,signal});
    const videos=new Set(),outside=new WeakSet(),allowed=new WeakSet(),original=new Map(),pausedAnimations=new Set();
    let gesture=0,observer=null,discovery=null;
    const io=s.offscreen?new IntersectionObserver(entries=>{
      for(const e of entries){if(e.intersectionRatio<0.15){outside.add(e.target);if(!e.target.paused&&!e.target.srcObject&&document.pictureInPictureElement!==e.target)e.target.pause();}else outside.delete(e.target);}
    },{threshold:[0,0.15]}):null;
    function track(v){
      if(videos.has(v))return;videos.add(v);io?.observe(v);
      if(s.sites&&site?.mediaPolicy==='manual'){original.set(v,{autoplay:v.autoplay,preload:v.getAttribute('preload')});v.autoplay=false;v.preload='none';}
      if((s.background&&document.hidden)||(s.sites&&site?.mediaPolicy==='manual'&&!allowed.has(v))){if(!v.srcObject&&document.pictureInPictureElement!==v)v.pause();}
    }
    function scan(node){if(node.nodeType!==1)return;if(node.matches('video'))track(node);node.querySelectorAll('video').forEach(track);}
    function forget(node){if(node.nodeType!==1)return;for(const v of videos)if(v===node||node.contains(v)){io?.unobserve(v);videos.delete(v);original.delete(v);}}
    document.querySelectorAll('video').forEach(track);
    listen(document,'input',e=>{if(e.isTrusted&&e.target.matches('input:not([type=search]):not([type=range]),textarea,[contenteditable=true]'))dirty=true;},{capture:true});
    listen(document,'pointerdown',()=>{gesture=Date.now();},{capture:true,passive:true});
    listen(document,'keydown',()=>{gesture=Date.now();},{capture:true});
    listen(document,'loadedmetadata',e=>{if(e.target instanceof HTMLVideoElement)track(e.target);},{capture:true});
    listen(document,'play',e=>{
      const v=e.target;if(!(v instanceof HTMLVideoElement))return;
      if(Date.now()-gesture<1500)allowed.add(v);
      track(v);
      if(v.srcObject||document.pictureInPictureElement===v)return;
      if((s.background&&document.hidden)||(s.offscreen&&outside.has(v))||(s.sites&&site?.mediaPolicy==='manual'&&!allowed.has(v)))v.pause();
    },{capture:true});
    listen(document,'visibilitychange',()=>{
      if(document.hidden){
        if(s.background)for(const v of videos)if(!v.paused&&!v.srcObject&&document.pictureInPictureElement!==v)v.pause();
        if(s.motion&&s.profile==='EXTREME')for(const a of document.getAnimations())if(a.playState==='running'){a.pause();pausedAnimations.add(a);}
      }else {for(const a of pausedAnimations)try{a.play();}catch{}pausedAnimations.clear();}
    });
    function youtubeUI(){
      if(!youtube||!s.sites)return;
      const toggle=document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');toggle?.click();
    }
    if(s.sites&&optimized){
      // Observe only each profiled application's main root; no universal body observer.
      const selector=site.root||'main';
      function attach(){
        const root=document.querySelector(selector);if(!root)return false;
        observer?.disconnect();observer=new MutationObserver(records=>{
          for(const r of records){for(const n of r.removedNodes)forget(n);for(const n of r.addedNodes)scan(n);}
        });observer.observe(root,{childList:true,subtree:true});scan(root);return true;
      }
      if(!attach()){
        // Bootstrap observation ends as soon as the application root exists.
        discovery=new MutationObserver(()=>{if(attach()){discovery.disconnect();discovery=null;}});
        discovery.observe(document.documentElement,{childList:true,subtree:true});
      }
      if(youtube){listen(document,'yt-navigate-finish',()=>{youtubeUI();attach();});listen(document,'loadedmetadata',youtubeUI,{capture:true});youtubeUI();}
    }
    function guard(msg,_sender,reply){if(msg?.type==='canDiscard')reply({protect:dirty||!!document.pictureInPictureElement||[...videos].some(v=>!!v.srcObject&&!v.paused)});}
    chrome.runtime.onMessage.addListener(guard);
    stop=()=>{
      controller.abort();io?.disconnect();observer?.disconnect();discovery?.disconnect();chrome.runtime.onMessage.removeListener(guard);
      delete document.documentElement.dataset.cxSite;
      for(const [v,o] of original){v.autoplay=o.autoplay;if(o.preload===null)v.removeAttribute('preload');else v.setAttribute('preload',o.preload);}
      for(const a of pausedAnimations)try{a.play();}catch{}
      videos.clear();original.clear();
    };
  }
  chrome.storage.local.get('settings').then(({settings})=>configure(settings||{}));
  chrome.storage.onChanged.addListener((c,area)=>{if(area==='local'&&c.settings)configure(c.settings.newValue||{});});
})();
