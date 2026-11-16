/* Turkuaz 3D live traffic dashboard. Never invent analytics.
   Connects to the owner's Cloudflare Worker only after an actual deployment. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const DB_URL='t3-analytics-worker',DB_KEY='t3-analytics-access';
let worker=localStorage.getItem(DB_URL)||'',key=localStorage.getItem(DB_KEY)||'';
let cursor=null, timer=null, loading=false, lastError='';
const set=(id,value)=>{if($(id))$(id).textContent=String(value)};
const clearRows=id=>{if($(id))$(id).replaceChildren()};
const urlOk=value=>/^https:\/\/[a-z0-9.-]+(?::443)?\/?$/i.test(value);
function status(s,ok=false){
 set('analyticsMessage',s);set('analyticsConnection',s);
 set('visitTodayStatus',ok?'Gerçek zamanlı rapor':'Analitik bağlantısı bekleniyor');
 set('notifyStatus',ok?'Aktif':'Bağlı değil');
 set('notifyDesc',ok?'Yönetim uygulaması açıkken bildirimler alınabilir.':'Worker bağlantısı bekleniyor.');
}
function row(target,left,right) {
 const e=document.createElement('div');e.className='live-data-row';
 const l=document.createElement('span');l.textContent=left;
 const r=document.createElement('strong');r.textContent=String(right);
 e.append(l,r);$(target).appendChild(e);
}
function render(stats){
 set('visitToday',stats.today??'—');
 set('visitCity',Array.isArray(stats.cities)?stats.cities.length:'—');
 set('onlineNow',stats.now_online??'—');
 set('weeklyVisits',stats.last_7_days??'—');
 let secs=Math.max(0,Number(stats.avg_seconds)||0);
 set('avgDuration',secs>=60?Math.floor(secs/60)+' dk '+(secs%60)+' sn':secs+' sn');
 set('visitCityStatus','Son 7 günde '+(stats.cities?.length||0)+' farklı şehir/ülke');
 ['cityTable','pageTable','recentTable'].forEach(clearRows);
 (stats.cities||[]).slice(0,12).forEach(x=>row('cityTable',(x.city||'Bilinmiyor')+' / '+(x.country||'—'),x.visits||0));
 (stats.pages||[]).slice(0,10).forEach(x=>row('pageTable',x.page||'/',x.visits||0));
 (stats.recent||[]).slice(0,15).forEach(x=>{
   const d=new Date(x.started_at);
   row('recentTable',(x.city||'Bilinmiyor')+', '+(x.country||'—')+' · '+(x.page||'/'),d.toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}));
 });
 $('visitorTables').classList.remove('hidden');
 status('✓ Gerçek trafik verisi bağlı. Son güncelleme: '+new Date().toLocaleTimeString('tr-TR'),true);
}
function nativeNotification(event){
 const city=event.city||'Bilinmiyor',country=event.country||'Bilinmiyor';
 const title='Turkuaz 3D Web · Yeni ziyaret';
 const message=city+', '+country+' · '+(event.page||'/');
 if(window.TurkuazNative&&typeof window.TurkuazNative.showNotification==='function'){
   window.TurkuazNative.showNotification(title,message);return;
 }
 if(window.chrome?.webview?.postMessage){
   window.chrome.webview.postMessage({type:'new-visit',title,message});return;
 }
 if(window.Notification?.permission==='granted')new Notification(title,{body:message,icon:'/favicon-96x96.png'});
}
function api(path){
 return fetch(worker+path,{headers:{Authorization:'Bearer '+key,Accept:'application/json'},cache:'no-store'})
 .then(async r=>{let obj=await r.json().catch(()=>null);
   if(!r.ok)throw Error(r.status===401?'Yetki reddedildi: analitik anahtarı doğru değil':'Sunucu yanıtı: '+r.status);
   return obj;
 });
}
async function refresh(){
 if(loading||!worker||!key)return;
 loading=true;
 try{
  const stats=await api('/v1/stats');
  if(!stats||stats.connected!==true)throw Error('Analitik sunucusu doğrulanamadı.');
  render(stats);
  if(cursor===null)cursor=Number(stats.cursor)||0; // do not replay past notifications
  else {
    const events=await api('/v1/events?after='+encodeURIComponent(cursor));
    if(Array.isArray(events.events)){
     for(const e of events.events){
      if(e.id>cursor){cursor=e.id;nativeNotification(e)}
     }
    }
  }
  lastError='';
 }catch(e){
   if(e.message!==lastError){status('Bağlantı hatası: '+e.message);lastError=e.message}
 }finally{loading=false}
}
async function connect(){
 const next=$('analyticsWorker').value.trim().replace(/\/$/,'');
 const nextKey=$('analyticsKey').value.trim();
 if(!urlOk(next)){status('HTTPS ile başlayan geçerli Cloudflare Worker adresi gerekiyor.');return}
 if(nextKey.length<32){status('Analitik anahtarı en az 32 karakter olmalı.');return}
 worker=next;key=nextKey;cursor=null;
 try{
  const response=await api('/v1/stats');
  if(!response||response.connected!==true)throw Error('Sunucu geçersiz');
  localStorage.setItem(DB_URL,worker);
  localStorage.setItem(DB_KEY,key);
  $('analyticsKey').value='';
  render(response);
  cursor=Number(response.cursor)||0;
 }catch(e){status('Bağlantı kurulamadı: '+e.message)}
}
$('analyticsConnect')?.addEventListener('click',connect);
$('analyticsNotify')?.addEventListener('click',()=>{
 if(window.TurkuazNative?.enableNotifications){
  window.TurkuazNative.enableNotifications();
  set('analyticsConnection','Android bildirim izni istendi. Uygulama açıkken yeni ziyaretler bildirilecek.');
 } else if(window.chrome?.webview?.postMessage){
  window.chrome.webview.postMessage({type:'notification-permission'});
  set('analyticsConnection','Windows masaüstü bildirimleri bu uygulama açıkken gösterilecek.');
 } else if(window.Notification?.requestPermission){
  window.Notification.requestPermission().then(x=>set('analyticsConnection','Bildirim izni: '+x));
 }else set('analyticsConnection','Bu tarayıcı yerel bildirim iznini desteklemiyor.');
});
if(worker)$('analyticsWorker').value=worker;
if(key){$('analyticsKey').value=key;refresh()}
else {
 fetch('/public/analytics-config.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{
  if(j.enabled&&urlOk(j.worker)&&!$('analyticsWorker').value){
   $('analyticsWorker').value=j.worker;set('analyticsConnection','Sunucu adresi bulundu; analitik erişim anahtarını gir.');
  }
 }).catch(()=>{});
}
timer=setInterval(refresh,12000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
