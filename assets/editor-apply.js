(function(){'use strict';
var state={mobile:{},desktop:{}};
function current(){return matchMedia('(max-width: 767px)').matches?'mobile':'desktop'}
function use(data){if(!data||typeof data!=='object')return;var hero=document.querySelector('.hero');if(!hero)return;var head=hero.querySelector('.hero-copy h1'),body=hero.querySelector('.hero-copy p'),img=hero.querySelector('.hero-photo img'),photo=hero.querySelector('.hero-photo');var setting=data[current()]||{};
if(head){if(!head.dataset.originalText)head.dataset.originalText=head.innerHTML;head.innerHTML=head.dataset.originalText;if(typeof setting.heroTitle==='string'&&setting.heroTitle.trim()){head.textContent=setting.heroTitle.trim()}head.style.fontSize=Number(setting.titleSize)>=25&&Number(setting.titleSize)<=90?String(setting.titleSize)+'px':''}
if(body){if(!body.dataset.originalText)body.dataset.originalText=body.textContent;body.textContent=typeof setting.heroDesc==='string'&&setting.heroDesc.trim()?setting.heroDesc:body.dataset.originalText}
if(img){if(!img.dataset.originalSrc)img.dataset.originalSrc=img.getAttribute('src');img.src=typeof setting.imageUrl==='string'&&/^https:\/\//i.test(setting.imageUrl)?setting.imageUrl:img.dataset.originalSrc}
if(photo)photo.style.display=setting.hideImage?'none':'';
document.documentElement.style.setProperty('--cyan',/^#[0-9a-fA-F]{6}$/.test(setting.accent||'')?setting.accent:'#06ddd8');
}
function load(){fetch('/public/editor-settings.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error(r.status);return r.json()}).then(function(j){state=j;use(state)}).catch(function(){})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
addEventListener('resize',function(){use(state)});
addEventListener('message',function(e){if(e.origin!==location.origin||!e.data||e.data.type!=='T3_PREVIEW')return;var next={mobile:state.mobile,desktop:state.desktop};next[e.data.device]=e.data.settings;use(next)});
})();