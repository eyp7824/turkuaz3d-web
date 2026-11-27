import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../../assets/visit-tracker.js',import.meta.url),'utf8');

async function simulate(consent,legacy=false){
  const sent=[];
  const handlers={};
  const storage=new Map([['t3-analytics-consent',consent]]);
  const session=new Map();
  const context={
    location:{pathname:'/hizmetler/3d-baski/',href:'https://turkuaz3d.com/hizmetler/3d-baski/'},
    document:{addEventListener:(type,cb)=>{handlers[type]=cb}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)},
    crypto:{randomUUID:()=>String(sent.length+1).repeat(32)},
    navigator:{sendBeacon:(url,body)=>{sent.push({url,body});return true}},
    Blob,URL,Date,JSON,Math,
    setInterval:()=>1,
    addEventListener:()=>{},
    fetch:async(url)=>String(url).endsWith('/v1/contact-click')?{ok:false,status:legacy?404:400}:({ok:true,json:async()=>({enabled:true,worker:'https://worker.example'})})
  };
  runInNewContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  const click=href=>handlers.click?.({target:{closest:()=>({getAttribute:()=>href})}});
  return {sent,click,handlers};
}

test('click tracking is consent-gated and distinguishes links without collecting destination text',async()=>{
  const visitor=await simulate('yes');
  visitor.click('https://wa.me/905423954447?text=Private+message');
  visitor.click('tel:+905423954447');
  visitor.click('https://example.com');
  const clicks=visitor.sent.filter(x=>x.url.endsWith('/v1/contact-click'));
  assert.equal(clicks.length,2);
  assert.deepEqual((await Promise.all(clicks.map(x=>x.body.text()))).map(x=>JSON.parse(x).kind),['whatsapp','phone']);
  assert.ok(!JSON.stringify(await Promise.all(clicks.map(x=>x.body.text()))).includes('Private'));
  const denied=await simulate('no');
  denied.click('tel:+905423954447');
  assert.equal(denied.sent.length,0);
});

test('legacy Worker (no /v1/contact-click): consented click is reported as a labelled visit, never when the Worker is current',async()=>{
  const legacy=await simulate('yes',true);
  await new Promise(resolve=>setImmediate(resolve));
  legacy.click('https://wa.me/905423954447?text=Private+message');
  const visits=await Promise.all(legacy.sent.filter(x=>x.url.endsWith('/v1/visit')).map(x=>x.body.text()));
  const labelled=visits.map(x=>JSON.parse(x)).filter(x=>x.path.includes('WhatsApp tıklaması'));
  assert.equal(labelled.length,1);
  assert.ok(labelled[0].path.includes('/hizmetler/3d-baski/'));
  assert.ok(!JSON.stringify(visits).includes('Private')&&!JSON.stringify(visits).includes('905423954447'),'no phone number or message text');
  const current=await simulate('yes',false);
  await new Promise(resolve=>setImmediate(resolve));
  current.click('tel:+905423954447');
  const extra=await Promise.all(current.sent.filter(x=>x.url.endsWith('/v1/visit')).map(x=>x.body.text()));
  assert.equal(extra.map(x=>JSON.parse(x)).filter(x=>x.path.includes('tıklaması')).length,0);
  const denied=await simulate('no',true);
  await new Promise(resolve=>setImmediate(resolve));
  denied.click('tel:+905423954447');
  assert.equal(denied.sent.length,0);
});
