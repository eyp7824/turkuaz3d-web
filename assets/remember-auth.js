/* Device-local secure credential vault for native Turkuaz 3D clients.
   Only Android's trusted-origin WebMessageListener and Windows WebView2 host
   can handle requests. Never put tokens or ADMIN_KEY into this source file. */
(function () {
  'use strict';
  const pending = new Map();
  let serial = 0;
  const android = window.T3Vault;
  const windows = window.chrome && window.chrome.webview;
  const channel = android || windows || null;
  function receive(evt) {
    let data = evt && evt.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (_) { return; }
    }
    if (!data || data.type !== 't3-vault-reply') return;
    const resolve = pending.get(data.id);
    if (resolve) {
      pending.delete(data.id);
      resolve({ok:!!data.ok, value:data.ok?(data.value||''):''});
    }
  }
  if (android) android.onmessage = receive;
  else if (windows) windows.addEventListener('message', receive);
  function request(action, slot, value) {
    if (!channel || !['github', 'analytics'].includes(slot)) return Promise.resolve({ok:false,value:''});
    return new Promise(resolve => {
      const id = ++serial;
      pending.set(id, resolve);
      // A failed native bridge must not keep the UI waiting forever.
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ok:false,value:''}); } }, 2500);
      try {
        channel.postMessage(JSON.stringify({type:'t3-vault',action,slot,id,value:value || ''}));
      } catch (_) {
        pending.delete(id); resolve({ok:false,value:''});
      }
    });
  }
  window.T3Remember = {
    available: !!channel,
    load: slot => request('get', slot).then(result => result.value),
    save: (slot, value) => request('set', slot, value).then(result => result.ok),
    clear: slot => request('delete', slot).then(result => result.ok)
  };
})();
