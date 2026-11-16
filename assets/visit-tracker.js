/* Turkuaz 3D: no analytics sent until the owner configures Cloudflare Worker
   AND visitor opts in. No raw IP or browser fingerprint is transmitted. */
(async function(){
 'use strict';
 if (location.pathname.startsWith('/yonetim/')) return;
 let cfg;
 try {const r=await fetch('/public/analytics-config.json',{cache:'no-store'});if(!r.ok)return;cfg=await r.json()}catch{return}
 if (!cfg || !cfg.enabled || !/^https:\/\/[a-z0-9.-]+(?:\/)?$/i.test(cfg.worker||'')) return;
 const endpoint=cfg.worker.replace(/\/$/,'')+'/v1/visit';
 // Show an opt-in banner; tracking disabled if user declines.
 const key='t3-analytics-consent';
 function start() {
  if (!sessionStorage.getItem('t3-visit-id')) sessionStorage.setItem('t3-visit-id',crypto.randomUUID().replace(/-/g,''));
  const id=sessionStorage.getItem('t3-visit-id'), started=Date.now();
  function send(kind){
    const payload=JSON.stringify({id,path:location.pathname,kind,duration:Math.floor((Date.now()-started)/1000)});
    try{
      const blob=new Blob([payload],{type:'text/plain'});
      if(navigator.sendBeacon && navigator.sendBeacon(endpoint,blob))return;
      fetch(endpoint,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain'},body:payload,keepalive:true}).catch(()=>{});
    }catch{}
  }
  send('enter');
  const interval=setInterval(()=>{if(!document.hidden)send('ping')},30000);
  addEventListener('pagehide',()=>{clearInterval(interval);send('exit')},{once:true});
 }
 const choice=localStorage.getItem(key);
 if(choice==='yes') {start();return}
 if(choice==='no')return;
 if(document.querySelector('#t3-consent'))return;
 const bar=document.createElement('aside');
 bar.id='t3-consent';bar.style.cssText='position:fixed;z-index:2147483640;bottom:8px;left:8px;right:8px;max-width:700px;margin:auto;background:#082d3d;color:#fff;border:1px solid #05c9c9;box-shadow:0 8px 30px #0007;border-radius:14px;padding:14px;font:14px system-ui';
 const msg=document.createElement('div');msg.textContent='Turkuaz 3D, site ziyaretlerini ve yaklaşık şehir/ülke bilgisini ölçmek istiyor. Onay verirseniz anonimleştirilmiş istatistikler kaydedilir.';bar.appendChild(msg);
 const buttons=document.createElement('div');buttons.style.cssText='display:flex;gap:9px;margin-top:11px;flex-wrap:wrap';
 for(const [label,value] of [['Kabul Et','yes'],['Reddet','no']]){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='cursor:pointer;padding:9px 15px;border-radius:9px;border:0;background:'+(value==='yes'?'#00deda':'#42606c')+';color:'+(value==='yes'?'#002630':'white')+';font-weight:bold';
  b.onclick=()=>{localStorage.setItem(key,value);bar.remove();if(value==='yes')start()};
  buttons.appendChild(b);
 }
 bar.appendChild(buttons);document.body.appendChild(bar);
})();