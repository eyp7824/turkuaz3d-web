/* Turkuaz 3D: no analytics sent until the owner configures Cloudflare Worker
   AND visitor opts in. No raw IP or browser fingerprint is transmitted. */
(async function(){
 'use strict';
 if (location.pathname.startsWith('/yonetim/')) return;
 let cfg;
 try {const r=await fetch('/public/analytics-config.json',{cache:'no-store'});if(!r.ok)return;cfg=await r.json()}catch{return}
 if (!cfg || !cfg.enabled || !/^https:\/\/[a-z0-9.-]+(?:\/)?$/i.test(cfg.worker||'')) return;
 const base=cfg.worker.replace(/\/$/,'');
 const endpoint=base+'/v1/visit';
 const clickEndpoint=base+'/v1/contact-click';
 // Show an opt-in banner; tracking disabled if user declines.
 const key='t3-analytics-consent';
 function start() {
  if (!sessionStorage.getItem('t3-visit-id')) sessionStorage.setItem('t3-visit-id',crypto.randomUUID().replace(/-/g,''));
  if (!sessionStorage.getItem('t3-visit-started')) sessionStorage.setItem('t3-visit-started',String(Date.now()));
  const id=sessionStorage.getItem('t3-visit-id'), started=Number(sessionStorage.getItem('t3-visit-started'))||Date.now();
  function send(kind){
    const payload=JSON.stringify({id,path:location.pathname,kind,duration:Math.floor((Date.now()-started)/1000)});
    try{
      const blob=new Blob([payload],{type:'text/plain'});
      if(navigator.sendBeacon && navigator.sendBeacon(endpoint,blob))return;
      fetch(endpoint,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain'},body:payload,keepalive:true}).catch(()=>{});
    }catch{}
  }
  // The consented visitor's explicit click is counted, not a completed call
  // or a WhatsApp message. Never transmit phone numbers or message contents.
  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('a[href]');
    if(!anchor)return;
    const href=anchor.getAttribute('href')||'';
    let kind='';
    if(/^tel:/i.test(href.trim()))kind='phone';
    else {
      try {
        const url=new URL(href,location.href);
        if(['wa.me','api.whatsapp.com','web.whatsapp.com'].includes(url.hostname.toLowerCase()))kind='whatsapp';
      }catch{}
    }
    if(!kind)return;
    const payload=JSON.stringify({id,eventId:crypto.randomUUID().replace(/-/g,''),kind,path:location.pathname});
    try{
      const blob=new Blob([payload],{type:'text/plain'});
      if(navigator.sendBeacon && navigator.sendBeacon(clickEndpoint,blob))return;
      fetch(clickEndpoint,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain'},body:payload,keepalive:true}).catch(()=>{});
    }catch{}
  },{capture:true});
  send('enter');
  const interval=setInterval(()=>{if(!document.hidden)send('ping')},30000);
  addEventListener('pagehide',()=>{clearInterval(interval);send('exit')},{once:true});
 }
 const choice=localStorage.getItem(key);
 if(choice==='yes') {start();return}
 if(choice==='no')return;
 if(document.querySelector('#t3-consent'))return;
 const bar=document.createElement('aside');
 bar.id='t3-consent';bar.style.cssText='position:fixed;z-index:2147483640;bottom:max(8px,env(safe-area-inset-bottom));left:10px;right:10px;max-width:580px;max-height:38vh;overflow:auto;margin:auto;background:#082d3d;color:#fff;border:1px solid #05c9c9;box-shadow:0 8px 30px #0007;border-radius:13px;padding:10px 12px;font:13px/1.4 system-ui';
 const msg=document.createElement('div');msg.textContent='İzin verirseniz site ziyaretlerini, WhatsApp/telefon bağlantısı tıklamalarını ve yaklaşık şehir/ülke bilgisini takma kimlikli istatistik olarak ölçeriz. Mesaj içerikleri veya telefon görüşmeleri izlenmez.';bar.appendChild(msg);
 const buttons=document.createElement('div');buttons.style.cssText='display:flex;gap:8px;margin-top:8px;flex-wrap:wrap';
 for(const [label,value] of [['Kabul Et','yes'],['Reddet','no']]){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='cursor:pointer;padding:7px 13px;border-radius:9px;border:0;min-height:36px;background:'+(value==='yes'?'#00deda':'#42606c')+';color:'+(value==='yes'?'#002630':'white')+';font-weight:bold';
  b.onclick=()=>{localStorage.setItem(key,value);bar.remove();if(value==='yes')start()};
  buttons.appendChild(b);
 }
 bar.appendChild(buttons);document.body.appendChild(bar);
})();
