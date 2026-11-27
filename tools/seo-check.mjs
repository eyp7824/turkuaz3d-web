// SEO lint for Turkuaz 3D: protect editorial titles, canonical URLs and meta descriptions.
import {readFileSync} from 'node:fs';
const pages=[
['index.html','https://turkuaz3d.com/'],
['blog/index.html','https://turkuaz3d.com/blog/'],
['blog/3d-baskida-malzeme-secimi/index.html','https://turkuaz3d.com/blog/3d-baskida-malzeme-secimi/'],
['blog/disli-ve-cark-uretimi/index.html','https://turkuaz3d.com/blog/disli-ve-cark-uretimi/'],
['blog/cnc-robotik-icin-3d-baski/index.html','https://turkuaz3d.com/blog/cnc-robotik-icin-3d-baski/'],
['blog/endustriyel-prototip-uretimi/index.html','https://turkuaz3d.com/blog/endustriyel-prototip-uretimi/'],
['blog/profesyonel-3d-modelleme/index.html','https://turkuaz3d.com/blog/profesyonel-3d-modelleme/'],
['blog/kirik-parca-uretimi/index.html','https://turkuaz3d.com/blog/kirik-parca-uretimi/'],
['hizmetler/index.html','https://turkuaz3d.com/hizmetler/'],
['hizmetler/3d-baski-siparisi/index.html','https://turkuaz3d.com/hizmetler/3d-baski-siparisi/'],
['hizmetler/seri-uretim-3d-baski/index.html','https://turkuaz3d.com/hizmetler/seri-uretim-3d-baski/'],
['hizmetler/3d-baski/index.html','https://turkuaz3d.com/hizmetler/3d-baski/'],
['hizmetler/3d-tasarim/index.html','https://turkuaz3d.com/hizmetler/3d-tasarim/'],
['hizmetler/prototip-uretimi/index.html','https://turkuaz3d.com/hizmetler/prototip-uretimi/'],
['hizmetler/ozel-parca-uretimi/index.html','https://turkuaz3d.com/hizmetler/ozel-parca-uretimi/'],
['hizmetler/3d-baski-fiyatlari/index.html','https://turkuaz3d.com/hizmetler/3d-baski-fiyatlari/'],
['hizmetler/stl-dosyasi-ile-3d-baski/index.html','https://turkuaz3d.com/hizmetler/stl-dosyasi-ile-3d-baski/'],
['hizmetler/fason-3d-baski/index.html','https://turkuaz3d.com/hizmetler/fason-3d-baski/'],
['hizmetler/akulu-sandalye-baglanti-aparati/index.html','https://turkuaz3d.com/hizmetler/akulu-sandalye-baglanti-aparati/'],
['hizmetler/ucurtma-cita-branda-klipsi/index.html','https://turkuaz3d.com/hizmetler/ucurtma-cita-branda-klipsi/'],
['hizmetler/cokgen-vazo-kalibi/index.html','https://turkuaz3d.com/hizmetler/cokgen-vazo-kalibi/'],
['hizmetler/yazici-silindirik-baglayici/index.html','https://turkuaz3d.com/hizmetler/yazici-silindirik-baglayici/'],
['hizmetler/prototip-turbofan/index.html','https://turkuaz3d.com/hizmetler/prototip-turbofan/'],
['hizmetler/antika-corap-makinesi-silindiri/index.html','https://turkuaz3d.com/hizmetler/antika-corap-makinesi-silindiri/'],
['hizmetler/vinc-kumanda-muhafaza-kutusu/index.html','https://turkuaz3d.com/hizmetler/vinc-kumanda-muhafaza-kutusu/'],
['hizmetler/18650-pil-mengenesi/index.html','https://turkuaz3d.com/hizmetler/18650-pil-mengenesi/'],
['hizmetler/nfc-koruma-kutusu/index.html','https://turkuaz3d.com/hizmetler/nfc-koruma-kutusu/'],
['hizmetler/kanepe-ayagi-aparati/index.html','https://turkuaz3d.com/hizmetler/kanepe-ayagi-aparati/'],
['hizmetler/kelebek-anahtarlik/index.html','https://turkuaz3d.com/hizmetler/kelebek-anahtarlik/'],
['hizmetler/kahve-makinesi-tus-paneli/index.html','https://turkuaz3d.com/hizmetler/kahve-makinesi-tus-paneli/'],
['hizmetler/metal-dedektor-kizak-takimi/index.html','https://turkuaz3d.com/hizmetler/metal-dedektor-kizak-takimi/'],
['hizmetler/engelli-bardak-tutucu/index.html','https://turkuaz3d.com/hizmetler/engelli-bardak-tutucu/'],
['hizmetler/metal-dedektor-kontrol-kutusu/index.html','https://turkuaz3d.com/hizmetler/metal-dedektor-kontrol-kutusu/'],
['hizmetler/engelli-cay-bardagi-tutucu/index.html','https://turkuaz3d.com/hizmetler/engelli-cay-bardagi-tutucu/'],
['en/index.html','https://turkuaz3d.com/en/'],
['hizmetler/bursa-3d-baski-merkezi/index.html','https://turkuaz3d.com/hizmetler/bursa-3d-baski-merkezi/'],
['hizmetler/maket-uretimi/index.html','https://turkuaz3d.com/hizmetler/maket-uretimi/'],
['hizmetler/akulu-sandalye-parcalari/index.html','https://turkuaz3d.com/hizmetler/akulu-sandalye-parcalari/'],
['blog/engelli-bireyler-icin-yardimci-aparat-3d-baski/index.html','https://turkuaz3d.com/blog/engelli-bireyler-icin-yardimci-aparat-3d-baski/'],
['blog/abs-asa-farki/index.html','https://turkuaz3d.com/blog/abs-asa-farki/'],
['blog/tpu-esnek-parca-baski/index.html','https://turkuaz3d.com/blog/tpu-esnek-parca-baski/'],
['blog/3d-baski-dayaniklilik-doluluk-katman/index.html','https://turkuaz3d.com/blog/3d-baski-dayaniklilik-doluluk-katman/'],
['blog/uretim-aparati-fikstur-3d-baski/index.html','https://turkuaz3d.com/blog/uretim-aparati-fikstur-3d-baski/'],
['bolge/bursa-ilceleri-3d-baski/index.html','https://turkuaz3d.com/bolge/bursa-ilceleri-3d-baski/'],
['bolge/turkiye-geneli-3d-baski/index.html','https://turkuaz3d.com/bolge/turkiye-geneli-3d-baski/'],
['blog/pla-petg-farki/index.html','https://turkuaz3d.com/blog/pla-petg-farki/'],
['blog/stl-dosyasi-hazirlama-rehberi/index.html','https://turkuaz3d.com/blog/stl-dosyasi-hazirlama-rehberi/'],
['blog/prototipten-seri-uretime-gecis/index.html','https://turkuaz3d.com/blog/prototipten-seri-uretime-gecis/']
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
add((sitemap.match(/<url>/g)||[]).length===pages.length,'Sitemap should contain exactly the '+pages.length+' canonical SEO pages');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('PASS: All '+pages.length+' pages have unique SEO title, description, OG, Twitter, canonical, structured data and sitemap.');
