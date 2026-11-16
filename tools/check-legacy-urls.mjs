// Turkuaz 3D: verify legacy URLs from the old hosting never point to missing pages.
// Run by GitHub Actions on each website/redirect change.
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
const roots=['hizmet','blog','bolge','sayfa','iletisim','sorular','bloglar','urunler','hata'];
const files=[];
for(const root of roots){
 if(!existsSync(root))continue;
 function visit(dir){
  for(const name of readdirSync(dir)){
   const file=path.join(dir,name);
   if(statSync(file).isDirectory())visit(file);
   else if(name==='index.html')files.push(file);
  }
 }
 visit(root);
}
const failures=[];
const validDest=new Set();
let redirects=0;
for(const p of files){
 const html=readFileSync(p,'utf8');
 const refresh=html.match(/http-equiv="refresh"\s+content="0\s*;\s*url=([^"]+)"/i);
 if(!refresh)continue; // canonical articles or the /blog/ index
 redirects++;
 const target=refresh[1].replace(/&amp;/g,'&');
 if(!target.startsWith('/')){failures.push(p+': external or relative redirect '+target);continue;}
 const urlPath=target.split('#')[0].split('?')[0];
 const targetFile=urlPath==='/'?'index.html':path.join(urlPath.replace(/^\//,''),'index.html');
 if(!existsSync(targetFile)) failures.push(p+': missing destination '+targetFile);
 validDest.add(targetFile);
 const canonical='https://turkuaz3d.com'+urlPath;
 if(!html.includes('rel="canonical" href="'+canonical+'"'))
   failures.push(p+': canonical does not match destination '+canonical);
}
const deploy=readFileSync('.github/workflows/pages.yml','utf8');
for(const root of roots){
 if(files.some(f=>f.startsWith(root+'/')) && !(new RegExp('\\b'+root+'\\b')).test(deploy))
   failures.push('Pages workflow does not include '+root);
}
const sitemap=readFileSync('sitemap.xml','utf8');
for(const slug of ['','3d-baskida-malzeme-secimi','disli-ve-cark-uretimi',
 'cnc-robotik-icin-3d-baski','endustriyel-prototip-uretimi',
 'profesyonel-3d-modelleme','kirik-parca-uretimi']){
 const url='https://turkuaz3d.com/blog/'+(slug?slug+'/':'');
 if(!sitemap.includes('<loc>'+url+'</loc>'))failures.push('Sitemap missing: '+url);
}
if(redirects<25)failures.push('Missing old URL redirects: only '+redirects+' found');
if(failures.length){
 console.error('LEGACY URL AUDIT FAILED:\n'+failures.join('\n'));
 process.exit(1);
}
console.log('PASS: '+redirects+' old-hosting redirect pages and '+validDest.size+' unique destinations verified.');
