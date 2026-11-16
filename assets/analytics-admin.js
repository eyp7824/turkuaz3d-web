/* Turkuaz 3D live traffic dashboard. Never invent analytics.
   Connects to the owner's Cloudflare Worker only after an actual deployment. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const DB_URL='t3-analytics-worker',DB_KEY='t3-analytics-access';
const DEFAULT_WORKER='https://turkuaz3d-analytics.eyupbozkurt1316.workers.dev';
let worker=localStorage.getItem(DB_URL)||DEFAULT_WORKER,key=localStorage.getItem(DB_KEY)||'';
const REMEMBER_SETTING='t3-remember-analytics-enabled';
const remember=$('rememberAnalytics');
remember.checked=localStorage.getItem(REMEMBER_SETTING)!=='0';
async function saveAuthorization(){
 if(!remember.checked || !worker || !key)return false;
 const payload=JSON.stringify({worker,key});
 try {
  if(window.T3Remember?.available && await window.T3Remember.save('analytics',payload)){
   localStorage.removeItem(DB_KEY); // Do not duplicate sensitive data in unencrypted WebView storage.
   return true;
  }
 }catch(e){}
 // Browser fallback: localStorage persists in the installed app's WebView profile.
 localStorage.setItem(DB_KEY,key);
 return true;
}
async function restoreAuthorization(){
 if(!remember.checked){
  key='';
  localStorage.removeItem(DB_KEY);
 }else{
  try {
   if(window.T3Remember?.available){
    const record=await window.T3Remember.load('analytics');
    if(record){
     const saved=JSON.parse(record);
     if(typeof saved.worker==='string'&&urlOk(saved.worker))worker=saved.worker;
     if(typeof saved.key==='string'&&saved.key.length>=32)key=saved.key;
     localStorage.removeItem(DB_KEY);
    }else if(key)await saveAuthorization();
   }
  }catch(e){}
 }
 $('analyticsWorker').value=worker;
 $('analyticsKey').value='';
 if(key){
  $('analyticsKey').placeholder='Anahtar cihazda kayıtlı – tekrar yazmana gerek yok';
  set('analyticsConnection','Beni Hatırla: kayıtlı bağlantıyla otomatik bağlanılıyor.');
  refresh();
 }else{
  set('analyticsConnection','Sunucu adresi hazır. Bu cihazda henüz kayıtlı analitik erişim anahtarı yok.');
 }
}
if(!localStorage.getItem(DB_URL))localStorage.setItem(DB_URL,worker);
let cursor=null, timer=null, loading=false, lastError='', trackingEnabled=false;
const set=(id,value)=>{if($(id))$(id).textContent=String(value)};
const clearRows=id=>{if($(id))$(id).replaceChildren()};
const urlOk=value=>/^https:\/\/[a-z0-9.-]+(?::443)?\/?$/i.test(value);
function status(s,ok=false){
 set('analyticsMessage',s);set('analyticsConnection',s);
 set('visitTodayStatus',ok?(trackingEnabled?'Gerçek zamanlı rapor':'Sunucu bağlı, site takibi henüz kapalı'):'Analitik bağlantısı bekleniyor');
 set('notifyStatus',ok?(trackingEnabled?'İzleme bağlı':'Site takibi kapalı'):'Bağlı değil');
 set('notifyDesc',ok?(trackingEnabled?'Bildirim izni açıkken, yeni ziyaretlerde bildirim alınabilir.':'Ziyaretçi izin bannerı ve site ölçüm ayarı henüz etkin değil.'):'Worker bağlantısı bekleniyor.');
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
window.T3PushError = function(message) {
 set('analyticsConnection','Arka plan bildirim kurulumu: '+String(message||'Bağlantı hatası'));
};
window.T3ReceivePushToken = async function(deviceToken) {
 if(!worker||!key) {
   set('analyticsConnection','Önce Analitik bağlantısını doğrula. Firebase cihaz kaydı için ADMIN_KEY gerekiyor.');
   return;
 }
 try {
  const response=await fetch(worker+'/v1/push/register',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
   body:JSON.stringify({token:deviceToken})
  });
  const answer=await response.json().catch(()=>({}));
  if(!response.ok||!answer.ok)throw Error(answer.error||'HTTP '+response.status);
  localStorage.setItem('t3-fcm-registered','true');
  set('analyticsConnection','✓ Firebase arka plan bildirimi bağlı. Android uygulaması kapalıyken de bildirim gönderilebilir (telefonun izin ve pil ayarlarına bağlıdır).');
  set('notifyDesc','Android FCM push kaydı tamamlandı; uygulama açık olmasa da gönderim yapılabilir.');
  set('notifyStatus','FCM bağlı');
 }catch(error){
  localStorage.removeItem('t3-fcm-registered');
  set('analyticsConnection','FCM bildirim sunucusu henüz hazır değil: '+error.message);
 }
};
function nativeNotification(event){
 const city=event.city||'Bilinmiyor',country=event.country||'Bilinmiyor';
 const title='Turkuaz 3D Web · Yeni ziyaret';
 const message=city+', '+country+' · '+(event.page||'/');
 if(window.TurkuazNative&&typeof window.TurkuazNative.showNotification==='function'){
   if(localStorage.getItem('t3-fcm-registered')==='true')return; // Push service handles delivery.
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
  await checkSiteTracking();
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
async function checkSiteTracking(){
 try {
   const result=await fetch('/public/analytics-config.json',{cache:'no-store'});
   const cfg=await result.json();
   trackingEnabled=Boolean(cfg&&cfg.enabled&&cfg.worker&&worker&&cfg.worker.replace(/\/$/,'')===worker.replace(/\/$/,''));
 }catch{trackingEnabled=false}
}
async function connect(){
 const next=$('analyticsWorker').value.trim().replace(/\/$/,'');
 const nextKey=$('analyticsKey').value.trim()||key;
 if(!urlOk(next)){status('HTTPS ile başlayan geçerli Cloudflare Worker adresi gerekiyor.');return}
 if(nextKey.length<32){status('Analitik anahtarı en az 32 karakter olmalı.');return}
 worker=next;key=nextKey;cursor=null;
 // Persist the owner's settings BEFORE making a network request. Temporary failures
 // must not force the user to retype the secret on the next app launch.
 localStorage.setItem(DB_URL,worker);
 await saveAuthorization();
 try{
  const response=await api('/v1/stats');
  if(!response||response.connected!==true)throw Error('Sunucu geçersiz');
  localStorage.setItem(DB_URL,worker);
  await saveAuthorization();
  $('analyticsKey').value='';
  $('analyticsKey').placeholder='Anahtar cihazda kayıtlı – tekrar yazmana gerek yok';
  await checkSiteTracking();
  render(response);
  cursor=Number(response.cursor)||0;
 }catch(e){
   status('Bağlantı kontrol edilemedi: '+e.message+'. Kayıtlı bilgiler silinmedi, bağlantı otomatik yeniden denenecek.');
 }
}
$('analyticsConnect')?.addEventListener('click',connect);
$('analyticsNotify')?.addEventListener('click',()=>{
 if(window.TurkuazNative?.enableNotifications){
  window.TurkuazNative.enableNotifications();
  set('analyticsConnection','Android bildirim izni istendi. Firebase arka plan bildirimi bağlantısı kontrol ediliyor...');
 } else if(window.chrome?.webview?.postMessage){
  window.chrome.webview.postMessage({type:'notification-permission'});
  set('analyticsConnection','Windows masaüstü bildirimleri bu uygulama açıkken gösterilecek.');
 } else if(window.Notification?.requestPermission){
  window.Notification.requestPermission().then(x=>set('analyticsConnection','Bildirim izni: '+x));
 }else set('analyticsConnection','Bu tarayıcı yerel bildirim iznini desteklemiyor.');
});
$('analyticsWorker').value=worker;
$('analyticsWorker').addEventListener('change',()=>{
 const typed=$('analyticsWorker').value.trim().replace(/\/$/,'');
 if(urlOk(typed)){
  worker=typed;
  localStorage.setItem(DB_URL,worker);
  saveAuthorization();
 }
});
$('analyticsKey').addEventListener('change',()=>{
 const typed=$('analyticsKey').value.trim();
 if(typed.length>=32){key=typed;saveAuthorization()}
});
remember.addEventListener('change',()=>{
 const enabled=remember.checked;
 localStorage.setItem(REMEMBER_SETTING,enabled?'1':'0');
 if(enabled) saveAuthorization();
 else {
  localStorage.removeItem(DB_KEY);
  window.T3Remember?.clear('analytics');
  set('analyticsConnection','Beni Hatırla kapatıldı; sonraki açılışta anahtar sorulur.');
 }
});
restoreAuthorization();
timer=setInterval(refresh,12000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
