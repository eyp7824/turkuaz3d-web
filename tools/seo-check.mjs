// SEO lint for Turkuaz 3D: protect editorial titles, canonical URLs and meta descriptions.
import {readFileSync} from 'node:fs';
const pages=[
['index.html','https://turkuaz3d.com/'],
['hizmetler/3d-baski/index.html','https://turkuaz3d.com/hizmetler/3d-baski/'],
['hizmetler/3d-tasarim/index.html','https://turkuaz3d.com/hizmetler/3d-tasarim/'],
['hizmetler/prototip-uretimi/index.html','https://turkuaz3d.com/hizmetler/prototip-uretimi/'],
['hizmetler/ozel-parca-uretimi/index.html','https://turkuaz3d.com/hizmetler/ozel-parca-uretimi/']
];
const attr=(h,name)=>{
 const re=new RegExp('<meta\\s+(?:name|property)="'+name+'"\\s+content="([^"]*)"', 'i');
 return h.match(re)?.[1]||'';
};
let errors=[];const titles=new Set(),descs=new Set();
const sitemap=readFileSync('sitemap.xml','utf8'),robot=readFileSync('robots.txt','utf8');
const add=(condition,msg)=>{if(!condition)errors.push(msg)};
for(const [p,canonical] of pages){
 const html=readFileSync(p,'utf8');
 const title=html.match(/<title>([^<]+)<\/title>/)?.[1]||'';
 const description=attr(html,'description');
 const canon=html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]||'';
 add(title.length>=25 && title.length<=68,p+': inappropriate title length '+title.length);
 add(description.length>=90 && description.length<=165,p+': description length '+description.length);
 add(!titles.has(title),p+': duplicate title');titles.add(title);
 add(!descs.has(description),p+': duplicate meta description');descs.add(description);
 add(canon===canonical,p+': canonical mismatch');
 add((html.match(/<h1(?:\s|>)/g)||[]).length===1,p+': exactly one h1 expected');
 add(attr(html,'og:title')===title,p+': OG title missing or mismatched');
 add(attr(html,'og:description')===description,p+': OG desc missing or mismatched');
 add(attr(html,'twitter:title')===title,p+': Twitter title missing or mismatched');
 add(attr(html,'twitter:description')===description,p+': Twitter desc missing or mismatched');
 add(!/name="robots" content="noindex/i.test(html),p+': public landing page noindex');
 add(!/name="keywords"/i.test(html),p+': meta keywords unnecessary for Google Search');
 add(sitemap.includes('<loc>'+canonical+'</loc>'),p+': not in sitemap');
 const script=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
 add(script.length>=1,p+': structured data missing');
 for(const [_,json] of script){try{JSON.parse(json)}catch{errors.push(p+': invalid JSON-LD')}}
 console.log('SEO:',p,'title='+title,'description='+description.length+' chars');
}
add(robot.includes('Sitemap: https://turkuaz3d.com/sitemap.xml'),'robots.txt: sitemap missing');
add((sitemap.match(/<url>/g)||[]).length===pages.length,'Sitemap should contain exactly 5 SEO pages');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('PASS: All 5 pages have unique SEO title, description, OG, Twitter, canonical, structured data and sitemap.');
