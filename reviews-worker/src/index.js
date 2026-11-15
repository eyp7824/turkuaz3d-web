/**
 * Turkuaz 3D - ücretsiz Google İşletme yorumları geçidi.
 * Cloudflare Workers Free + yalnızca onaylı Google Business Profile API.
 *
 * GÜVENLİK: OAuth bilgilerini kaynak koda yazmayın. Worker Secrets kullanın.
 * UYUM: Yorumları repoya yazmaz. Cache en fazla 30 dakika (Google sınırı 30 gün).
 * İSTEK: GitHub Pages statik olduğu için tarayıcı doğrudan Google OAuth'a erişmez.
 */
const SITE = "https://turkuaz3d.com";
const MAPS = "https://www.google.com/maps/search/?api=1&query=Turkuaz%203D%20Bursa&query_place_id=ChIJVaBnoe2MlicReTWnbVpiZPc";
const CACHE_SECONDS = 1800;
const STARS = {ONE:1,TWO:2,THREE:3,FOUR:4,FIVE:5};

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Access-Control-Allow-Origin":SITE,
      "Vary":"Origin",
      "X-Content-Type-Options":"nosniff",
      "Cache-Control":status===200?"public, max-age=300, s-maxage=1800":"no-store"
    }
  });
}
const fail=(status="Yorumlar şu an alınamıyor.",code=503)=>json({error:status},code);
async function getAccessToken(env){
  const params=new URLSearchParams({
    client_id:env.GOOGLE_CLIENT_ID,
    client_secret:env.GOOGLE_CLIENT_SECRET,
    refresh_token:env.GOOGLE_REFRESH_TOKEN,
    grant_type:"refresh_token"
  });
  const r=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:params
  });
  if(!r.ok)throw new Error("oauth_error");
  const body=await r.json();
  if(!body.access_token)throw new Error("missing_access_token");
  return body.access_token;
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname!=="/reviews")return fail("Sayfa bulunamadı.",404);
    if(request.method==="OPTIONS"){
      if(request.headers.get("Origin")!==SITE)return fail("İzin verilmiyor.",403);
      return new Response(null,{status:204,headers:{
        "Access-Control-Allow-Origin":SITE,"Access-Control-Allow-Methods":"GET, OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"3600","Vary":"Origin"
      }});
    }
    if(request.method!=="GET")return fail("Yöntem desteklenmiyor.",405);
    const origin=request.headers.get("Origin");
    if(origin && origin!==SITE)return fail("Bu kaynak için izin yok.",403);
    if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REFRESH_TOKEN||
       !env.GOOGLE_ACCOUNT_ID||!env.GOOGLE_LOCATION_ID){
      return fail("Google İşletme API bağlantısı henüz kurulmadı.");
    }
    const cacheKey=new Request(url.origin+"/reviews");
    const cached=await caches.default.match(cacheKey);
    if(cached)return cached;
    try{
      const token=await getAccessToken(env);
      const acct=encodeURIComponent(env.GOOGLE_ACCOUNT_ID);
      const loc=encodeURIComponent(env.GOOGLE_LOCATION_ID);
      const endpoint="https://mybusiness.googleapis.com/v4/accounts/"+acct+"/locations/"+loc+
        "/reviews?pageSize=50&orderBy=updateTime%20desc";
      const response=await fetch(endpoint,{headers:{"Authorization":"Bearer "+token,"Accept":"application/json"}});
      if(!response.ok)throw new Error("google_api_status_"+response.status);
      const raw=await response.json();
      // Sadece Google'ın sunduğu gerçek yorumları göster; beş yıldızlılara özel filtre yok.
      // Müşteri yorumlarını kalıcı diske veya GitHub geçmişine yazmayın.
      const reviews=(Array.isArray(raw.reviews)?raw.reviews:[]).map(r=>({
        author:r.reviewer?.displayName||"Google kullanıcısı",
        avatar:typeof r.reviewer?.profilePhotoUrl==="string"&&
          r.reviewer.profilePhotoUrl.startsWith("https://")?r.reviewer.profilePhotoUrl:null,
        rating:STARS[r.starRating]||null,
        comment:typeof r.comment==="string"?r.comment:"",
        updatedAt:r.updateTime||r.createTime||null,
        sourceUrl:MAPS
      }));
      const result=json({
        source:"Google Business Profile",
        totalReviewCount:Number.isFinite(raw.totalReviewCount)?raw.totalReviewCount:reviews.length,
        averageRating:Number.isFinite(raw.averageRating)?raw.averageRating:null,
        reviews,
        refreshedAt:new Date().toISOString(),
        mapsUrl:MAPS
      });
      // 30 dakika ve ardından otomatik yeniden Google'dan okuma.
      ctx.waitUntil(caches.default.put(cacheKey,result.clone()));
      return result;
    }catch(err){
      // OAuth anahtarları, Google yanıtı ve müşteri verileri hata loglarına yazılmaz.
      return fail("Google yorumları şu an yüklenemiyor. Google İşletme profilinden görebilirsiniz.");
    }
  }
};
