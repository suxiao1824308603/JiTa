/* 简填 · 内容脚本
 * 在页面里暴露 window.RF 的填表能力，并处理“本站自动填写”。
 */
(function () {
  'use strict';

  if (window.__RF_CONTENT_LOADED__) return;
  window.__RF_CONTENT_LOADED__ = true;

  const RF = window.RF;
  if (!RF) return;
  RF.ready = true;
  RF.version = '0.6.0';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function hostMatches(host, list) {
    return list.some((domain) => host === domain || host.endsWith('.' + domain));
  }

  async function autoFillOnce() {
    const { settings } = await RF.getState();
    const host = location.hostname.toLowerCase();
    if (!hostMatches(host, settings.autoFillDomains || [])) return;
    if (document.visibilityState === 'prerender') return;
    await sleep(900);
    let result = await RF.runFill({ silent: true });
    if (result.filled === 0 && result.total === 0) {
      await sleep(2500);
      result = await RF.runFill({ silent: true });
    }
    if (result.filled > 0) {
      RF.toast(`已自动填写 ${result.filled} 项，请核对后提交`);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { autoFillOnce(); }, { once: true });
  } else {
    autoFillOnce();
  }

  // 单页应用路由切换后补填一次（仅限已开启自动填写的站点）
  let lastUrl = location.href;
  let routeTimer = null;
  setInterval(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    clearTimeout(routeTimer);
    routeTimer = setTimeout(async () => {
      const { settings } = await RF.getState();
      if (hostMatches(location.hostname.toLowerCase(), settings.autoFillDomains || [])) {
        await sleep(1200);
        const result = await RF.runFill({ silent: true });
        if (result.filled > 0) RF.toast(`已自动填写 ${result.filled} 项`);
      }
    }, 600);
  }, 1200);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return false;
    if (message.type === 'RF_PING') {
      sendResponse({ ok: true, ready: true, version: RF.version, top: window.top === window });
      return false;
    }
    if (message.type === 'RF_SCAN') {
      sendResponse(RF.scanPage());
      return false;
    }
    if (message.type === 'RF_FILL') {
      RF.runFill(message.options || {}).then(sendResponse);
      return true;
    }
    if (message.type === 'RF_AI_FILL') {
      RF.fillOpenQuestions(message.options || {}).then(sendResponse);
      return true;
    }
    return false;
  });
})();
