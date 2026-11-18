import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';

function environment(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0002_fcm_push.sql',import.meta.url),'utf8'));
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
