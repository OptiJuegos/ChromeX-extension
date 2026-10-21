(() => {
  if (globalThis.CHROMEX_SITE_PROFILES) return;

  globalThis.CHROMEX_SITE_PROFILES = Object.freeze([
    Object.freeze({
      id: 'youtube',
      name: 'YouTube',
      hosts: Object.freeze(['youtube.com']),
      root: 'ytd-app',
      mediaPolicy: 'manual',
      networkRules: Object.freeze([
        Object.freeze({ urlFilter: '||youtube.com/youtubei/v1/log_event', resourceTypes: Object.freeze(['xmlhttprequest']) }),
        Object.freeze({ urlFilter: '||youtube.com/api/stats/', resourceTypes: Object.freeze(['xmlhttprequest', 'ping']) }),
        Object.freeze({ urlFilter: '||i.ytimg.com/an_webp/', resourceTypes: Object.freeze(['image']) }),
        // Blocks live chat and replay chat frames when Site Optimizer is active.
        Object.freeze({ urlFilter: '||youtube.com/live_chat', resourceTypes: Object.freeze(['sub_frame']) })
      ])
    }),
    Object.freeze({
      id: 'x',
      name: 'X / Twitter',
      hosts: Object.freeze(['x.com', 'twitter.com']),
      root: 'main[role="main"],main',
      mediaPolicy: 'manual',
      networkRules: Object.freeze([])
    }),
    Object.freeze({
      id: 'instagram',
      name: 'Instagram',
      hosts: Object.freeze(['instagram.com']),
      root: 'main',
      mediaPolicy: 'manual',
      networkRules: Object.freeze([])
    })
  ]);
})();
