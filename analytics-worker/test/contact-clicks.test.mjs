import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';

function environment(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0002_fcm_push.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0003_contact_clicks.sql',import.meta.url),'utf8'));
  return {
    ADMIN_KEY:'test_'.repeat(12),
    DB:{prepare(sql){
      let values=[];
      return {
        bind(...args){values=args;return this},
        run(){const result=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(result.changes)}}},
        first(){return sqlite.prepare(sql).get(...values)||null},
        all(){return {results:sqlite.prepare(sql).all(...values)}}
      };
    }}
  };
}

function req(path,body,origin='https://turkuaz3d.com',secret){
  const headers={Origin:origin};
  if(secret)headers.Authorization='Bearer '+secret;
  return new Request('https://example.workers.dev'+path,{method:body?'POST':'GET',headers,
    ...(body?{body:JSON.stringify(body)}:{})});
}

test('contact clicks: counted, deduplicated, authorized, and split by channel',async()=>{
  const env=environment();
  const click={id:'abc123abc123abc123abc123abc123ab',eventId:'one123one123one123one123one123ab',path:'/hizmetler/3d-baski/',kind:'whatsapp'};
  let res=await worker.fetch(req('/v1/contact-click',click),env);
  assert.equal(res.status,200);
  assert.equal((await res.json()).new,true);
  res=await worker.fetch(req('/v1/contact-click',click),env);
  assert.equal((await res.json()).new,false);
  res=await worker.fetch(req('/v1/contact-click',{...click,eventId:'two123two123two123two123two123ab',kind:'phone'}),env);
  assert.equal((await res.json()).new,true);
  assert.equal((await worker.fetch(req('/v1/contact-click',{...click,eventId:'three123three123three123three123',kind:'other'}),env)).status,400);
  assert.equal((await worker.fetch(req('/v1/contact-click',{...click,eventId:'four123four123four123four123four123',path:'/yonetim/'},'https://evil.example'),env)).status,403);
  assert.equal((await worker.fetch(req('/v1/stats'),env)).status,401);
  res=await worker.fetch(req('/v1/stats',null,'https://turkuaz3d.com',env.ADMIN_KEY),env);
  assert.equal(res.status,200);
  const stats=await res.json();
  assert.equal(stats.contact.today.whatsapp,1);
  assert.equal(stats.contact.today.phone,1);
  assert.equal(stats.contact.week.whatsapp,1);
  assert.equal(stats.contact.month.phone,1);
  assert.equal(stats.contact.pages.length,2);
  assert.equal(stats.today,0,'Contact clicks must not artificially increase visitor counts');
});

test('contact clicks: new click notifies the owner (events feed, Telegram, FCM path) once',async()=>{
  const env=environment();
  env.TELEGRAM_BOT_TOKEN='123456:test-token';env.TELEGRAM_CHAT_ID='42';
  const calls=[];const realFetch=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{calls.push({url:String(url),body:init?.body});return new Response('{}',{status:200})};
  try{
    const pending=[];const ctx={waitUntil:p=>pending.push(p)};
    const click={id:'abc123abc123abc123abc123abc123ab',eventId:'note123note123note123note123note1',path:'/hizmetler/3d-baski/',kind:'phone'};
    let res=await worker.fetch(req('/v1/contact-click',click),env,ctx);
    assert.equal((await res.json()).new,true);
    res=await worker.fetch(req('/v1/contact-click',click),env,ctx);
    assert.equal((await res.json()).new,false,'a retry must not create a second notification');
    await Promise.all(pending);
    const feed=await (await worker.fetch(req('/v1/events?after=0',null,'https://turkuaz3d.com',env.ADMIN_KEY),env)).json();
    assert.equal(feed.events.length,1);
    assert.match(feed.events[0].city,/^📞 Telefon tıklandı · /,'click type must lead the city so the Android alert shows it');
    assert.equal(feed.events[0].page,'/hizmetler/3d-baski/');
    const telegram=calls.filter(c=>c.url.includes('api.telegram.org'));
    assert.equal(telegram.length,1);
    assert.match(JSON.parse(telegram[0].body).text,/Telefon tıklandı/);
    assert.ok(!JSON.stringify(calls).includes('905423954447'),'phone numbers must never be sent');
    const stats=await (await worker.fetch(req('/v1/stats',null,'https://turkuaz3d.com',env.ADMIN_KEY),env)).json();
    assert.equal(stats.today,0,'click notifications must not inflate visitor counts');
  }finally{globalThis.fetch=realFetch}
});
