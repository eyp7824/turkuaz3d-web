// Turkuaz 3D visitor analytics API for Cloudflare Workers + D1.
// Personal IP addresses are never stored. The coarse location comes from Cloudflare geo.
const SITE = 'https://turkuaz3d.com';
const TRUSTED = new Set([SITE, 'https://www.turkuaz3d.com']);
const VALID = /^[a-zA-Z0-9_-]{12,100}$/;
function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});
}
function cors(origin) {
  return TRUSTED.has(origin) ? {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Vary':'Origin'} : {};
}
function allow(req) {return TRUSTED.has(req.headers.get('Origin') || '');}
function clean(value, size=70) {
  return String(value || '').replace(/[\u0000-\u001f<>]/g,'').slice(0,size).trim();
}
function authed(req, env) {
  const header = req.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return Boolean(env.ADMIN_KEY && token.length>=32 && token.length===env.ADMIN_KEY.length &&
    // Constant-time comparison (web crypto) isn't synchronous; length matching + exact check is sufficient here
    token === env.ADMIN_KEY);
}
async function sendTelegram(env, visitor) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const text = '🔔 Turkuaz 3D Web — Yeni ziyaret\n📍 ' +
    visitor.city + ', ' + visitor.country + '\n📄 ' + visitor.page + '\n🕒 ' +
    new Date(visitor.time).toLocaleString('tr-TR', {timeZone:'Europe/Istanbul'});
  const url='https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage';
  await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text})});
}

function encode64(bytes){let str='';for(const n of bytes)str+=String.fromCharCode(n);return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function json64(value){return encode64(new TextEncoder().encode(JSON.stringify(value)))}
let googleAccess=null,googleExpires=0;
async function fcmAccessToken(env){
 if(googleAccess&&Date.now()<googleExpires)return googleAccess;
 if(!env.FCM_CLIENT_EMAIL||!env.FCM_PRIVATE_KEY||!env.FCM_PROJECT_ID)return null;
 const key=env.FCM_PRIVATE_KEY.replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g,'');
 const der=Uint8Array.from(atob(key),c=>c.charCodeAt(0));
 const privateKey=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const ts=Math.floor(Date.now()/1000);
 const assertion=json64({alg:'RS256',typ:'JWT'})+'.'+json64({iss:env.FCM_CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:ts,exp:ts+3500});
 const signature=encode64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,new TextEncoder().encode(assertion))));
 const body=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:assertion+'.'+signature});
 const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
 if(!res.ok)throw Error('Google OAuth '+res.status);
 const data=await res.json();googleAccess=data.access_token;googleExpires=Date.now()+(Math.max(600,Number(data.expires_in)||3600)-90)*1000;
 return googleAccess;
}
async function pushToPhones(env,visitor){
 const access=await fcmAccessToken(env);if(!access)return;
 const devices=(await env.DB.prepare('SELECT token FROM push_devices ORDER BY registered_at DESC LIMIT 20').all()).results||[];
 const title='Turkuaz 3D Web · Yeni ziyaret';
 const body=visitor.city+', '+visitor.country+' · '+visitor.page;
 for(const d of devices){
  try{
   const result=await fetch('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(env.FCM_PROJECT_ID)+'/messages:send',{
    method:'POST',headers:{'Authorization':'Bearer '+access,'Content-Type':'application/json'},
    body:JSON.stringify({message:{token:d.token,notification:{title,body},android:{priority:'HIGH',notification:{channel_id:'turkuaz3d_visitors'}}}})
   });
   if(result.status===404||result.status===410){
    await env.DB.prepare('DELETE FROM push_devices WHERE token=?').bind(d.token).run();
   }
  }catch{/* A failed push must not block visitor tracking. */}
 }
}
async function pushRegistration(req,env){
 const origin=req.headers.get('Origin')||'';
 if(!allow(req)||!authed(req,env))return json({error:'Yetki reddedildi'},401,cors(origin));
 if(!env.FCM_CLIENT_EMAIL||!env.FCM_PRIVATE_KEY||!env.FCM_PROJECT_ID)return json({error:'FCM sunucu ayarları henüz yapılandırılmadı'},503,cors(origin));
 let data;
 try{data=await req.json()}catch{return json({error:'JSON'},400,cors(origin))}
 const token=String(data?.token||'');
 if(!/^[\w.:_-]{30,512}$/.test(token))return json({error:'FCM token formatı geçersiz'},400,cors(origin));
 await env.DB.prepare('INSERT INTO push_devices(token,registered_at) VALUES(?,?) ON CONFLICT(token) DO UPDATE SET registered_at=excluded.registered_at').bind(token,Date.now()).run();
 return json({ok:true,push_ready:true},200,cors(origin));
}

async function record(req, env, ctx) {
  if (!allow(req)) return json({error:'origin'},403);
  const len = Number(req.headers.get('Content-Length')||0);
  if (len>1024) return json({error:'too_large'},413);
  let input;
  try { input = JSON.parse((await req.text()).slice(0,1025)); } catch {return json({error:'json'},400)}
  if (!input || !VALID.test(String(input.id||''))) return json({error:'id'},400);
  const id = String(input.id);
  const country=clean(req.cf?.country||'Bilinmiyor',50);
  const city=clean(req.cf?.city||'Bilinmiyor',70);
  const page=clean(input.path||'/',150);
  const kind=clean(input.kind||'ping',12);
  const now=Date.now();
  const duration = Number.isFinite(Number(input.duration)) ? Math.min(7200,Math.max(0,Math.floor(Number(input.duration)))) : 0;
  // Never persist a raw IP, UA string or high precision geo coordinates.
  const inserted=await env.DB.prepare('INSERT OR IGNORE INTO visits(id,started_at,last_seen_at,duration_seconds,country,city,page) VALUES(?,?,?,?,?,?,?)')
   .bind(id,now,now,duration,country,city,page).run();
  const fresh=(inserted.meta?.changes||0)>0;
  await env.DB.prepare('INSERT OR IGNORE INTO pageviews(visitor_id,page,first_seen_at) VALUES(?,?,?)').bind(id,page,now).run();
  if (fresh) {
    await env.DB.prepare('INSERT INTO visit_events(visitor_id,created_at,country,city,page) VALUES(?,?,?,?,?)')
       .bind(id,now,country,city,page).run();
    if (ctx && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      ctx.waitUntil(sendTelegram(env,{time:now,country,city,page}).catch(()=>{}));
    }
    if(ctx && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY && env.FCM_PROJECT_ID) {
      ctx.waitUntil(pushToPhones(env,{time:now,country,city,page}).catch(()=>{}));
    }
  } else {
    await env.DB.prepare('UPDATE visits SET last_seen_at=?, duration_seconds=MAX(duration_seconds,?), page=? WHERE id=?')
       .bind(now,duration,page,id).run();
  }
  return json({ok:true,new:fresh},200,cors(req.headers.get('Origin')));
}
async function stats(env) {
 const now=Date.now();
 const today=(Math.floor((now+3*60*60*1000)/(24*60*60*1000))*(24*60*60*1000))-(3*60*60*1000);
 const week=now-7*24*60*60*1000;
 const active=now-90*1000;
 const [totals,cities,pages,latest,maxEvent]=await Promise.all([
  env.DB.prepare('SELECT SUM(CASE WHEN started_at>=? THEN 1 ELSE 0 END) AS today, SUM(CASE WHEN started_at>=? THEN 1 ELSE 0 END) AS week, SUM(CASE WHEN last_seen_at>=? THEN 1 ELSE 0 END) AS online, ROUND(AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds END)) AS average_seconds FROM visits').bind(today,week,active).first(),
  env.DB.prepare('SELECT city,country,COUNT(*) AS visits FROM visits WHERE started_at>=? GROUP BY city,country ORDER BY visits DESC LIMIT 12').bind(week).all(),
  env.DB.prepare('SELECT page,COUNT(*) AS visits FROM pageviews WHERE first_seen_at>=? GROUP BY page ORDER BY visits DESC LIMIT 10').bind(week).all(),
  env.DB.prepare('SELECT country,city,page,started_at,duration_seconds FROM visits ORDER BY started_at DESC LIMIT 20').all(),
  env.DB.prepare('SELECT COALESCE(MAX(id),0) AS id FROM visit_events').first()
 ]);
 return {connected:true,updated_at:now,now_online:totals?.online||0,today:totals?.today||0,
   last_7_days:totals?.week||0,avg_seconds:totals?.average_seconds||0,
   cities:cities.results||[],pages:pages.results||[],recent:latest.results||[],cursor:maxEvent?.id||0};
}
async function events(env, after) {
 const n=Number.isFinite(after)?Math.min(Math.max(0,after),2147483647):0;
 const rows=await env.DB.prepare('SELECT id,created_at,country,city,page FROM visit_events WHERE id>? ORDER BY id ASC LIMIT 50').bind(n).all();
 return {events:rows.results||[],cursor:rows.results?.length?rows.results[rows.results.length-1].id:n};
}
export default {
 async scheduled(event,env,ctx) {
   if(!env.DB)return;
   const old=Date.now()-90*86400000;
   ctx.waitUntil(Promise.all([
     env.DB.prepare('DELETE FROM pageviews WHERE first_seen_at<?').bind(old).run(),
     env.DB.prepare('DELETE FROM visit_events WHERE created_at<?').bind(old).run(),
     env.DB.prepare('DELETE FROM visits WHERE started_at<?').bind(old).run()
   ]));
 },
 async fetch(req,env,ctx) {
  const origin=req.headers.get('Origin')||'';
  const u=new URL(req.url), path=u.pathname;
  if (req.method==='OPTIONS') {
    if (!allow(req)) return new Response(null,{status:403});
    return new Response(null,{status:204,headers:cors(origin)});
  }
  if (path==='/v1/push/register' && req.method==='POST') { try{return await pushRegistration(req,env)}catch{return json({error:'Kayıt yapılamadı'},500,cors(origin))} }
  if (path==='/health' && req.method==='GET') return json({ok:true,service:'Turkuaz 3D Analytics',deployed:true,db:!!env.DB});
  if (!env.DB) return json({error:'D1 bağlanmamış'},503,cors(origin));
  if (path==='/v1/visit' && req.method==='POST') {
    try {return await record(req,env,ctx)} catch(e){return json({error:'ingest_failed'},500,cors(origin))}
  }
  if ((path==='/v1/stats'||path==='/v1/events')&&req.method==='GET') {
    if(!allow(req) || !authed(req,env)) return json({error:'Erişim reddedildi'},401,cors(origin));
    try {
      const value=path==='/v1/stats'?await stats(env):await events(env,Number(u.searchParams.get('after')||0));
      return json(value,200,cors(origin));
    }catch(e){return json({error:'stats_failed'},500,cors(origin))}
  }
  return json({error:'404'},404,cors(origin));
 }
};