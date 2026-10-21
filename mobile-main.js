(() => {
  if (globalThis.__chromeXMobileSiteMode) return;
  globalThis.__chromeXMobileSiteMode = true;

  const nativeUA = navigator.userAgent || '';
  const major = (nativeUA.match(/(?:Chrome|Chromium)\/(\d+)/) || [])[1] || '120';
  const mobileUA = `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36`;

  const defineNavigator = (name, value) => {
    try {
      Object.defineProperty(Navigator.prototype, name, {
        configurable: true,
        get: () => value
      });
    } catch {}
  };

  defineNavigator('userAgent', mobileUA);
  defineNavigator('appVersion', mobileUA.replace(/^Mozilla\//, ''));
  defineNavigator('platform', 'Linux armv8l');
  defineNavigator('maxTouchPoints', 5);

  try {
    const nativeData = navigator.userAgentData;
    if (nativeData) {
      const mobileData = {
        brands: nativeData.brands,
        mobile: true,
        platform: 'Android',
        getHighEntropyValues: async hints => {
          const result = await nativeData.getHighEntropyValues(hints);
          return {
            ...result,
            mobile: true,
            platform: 'Android',
            platformVersion: '10.0.0',
            architecture: 'arm',
            bitness: '64',
            model: 'K'
          };
        },
        toJSON: () => ({ brands: nativeData.brands, mobile: true, platform: 'Android' })
      };
      defineNavigator('userAgentData', mobileData);
    }
  } catch {}

  try { document.documentElement.dataset.cxMobile = '1'; } catch {}
})();
