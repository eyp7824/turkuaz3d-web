# Turkuaz 3D - Limitsiz görüntüleme hedefli, kendi Google yorum entegrasyonumuz

**Durum (15.11.2026):** Kod hazır, fakat Google'ın Business Profile API erişimi ve OAuth yetkilendirmesi henüz sağlanmadı. Bu nedenle şu an çalışan Elfsight bileşeni, gerçek veriyi kaybetmemek için canlı sitede KORUNUYOR. Yeni Google API bağlantısı çalışmadan Elfsight kaldırılmamalı.

## Neden bu yöntem?

- Google Business Profile API kayıtlı ve onaylı kullanıcılar için ücretsizdir. Google API yetkisi otomatik verilmez. <https://developers.google.com/my-business/content/pricing>
- Google'ın **API erişim başvurusu** gerekir. Başvuruda işletmenin doğrulanmış ve en az 60 gündür aktif olması, web sitesinin profilde listelenmesi istenir: <https://developers.google.com/my-business/content/prereqs>
- Google'ın yorum verilerini uzun süreli saklama / önceden çekme sınırlamaları var (en fazla 30 gün); bu nedenle Google yorumları GitHub commit geçmişine yazılmaz, Worker en fazla 30 dakika önbelleğe alır: <https://developers.google.com/my-business/content/policies>
- Google Places API yerine **Google Business Profile API** kullanılır. Places API, faturalandırma hesabı gerektirir; maliyetten kaçınmak için bu yola geçmeyiz.
- Cloudflare Workers **Free** paketi (2026 itibarıyla) günlük **100.000 istek** içerir, ücretli aboneliğe geçilmez: <https://developers.cloudflare.com/workers/platform/limits/>. Bu tamamen sınırsız değil ama Elfsight'ın 200 görüntüleme/ay sınırından farklıdır.
- Yorumların yıldızlı Google arama sonucuna dönüşeceği garanti edilmez. İşletmenin kendi sitesinde LocalBusiness + review/aggregateRating structured data kullanarak yıldızlı arama sonucu elde etme iddiası doğru değil: <https://developers.google.com/search/docs/appearance/structured-data/review-snippet>

## Kurulum sırası (yetki sonrası)

1. **Google Cloud Console**: İşletme profilini yöneten Google hesabıyla proje oluştur. Google'ın resmi işletme API erişim formundan `Application for Basic API Access` başvurusunu yap. Onay e-postasını bekle. Proje içinde Google My Business API, Business Profile Account Management/Business Information API erişimini etkinleştir. Bilgi: <https://developers.google.com/my-business/content/prereqs>
2. OAuth 2.0 üzerinden `https://www.googleapis.com/auth/business.manage` izniyle bu **kullanıcının kendi** işletme hesabına okuma erişimi oluştur. API başvuru onayı ve Google'ın OAuth izin ekranı koşulları sağlanmalıdır. Hassas doğrulama bilgilerini sohbette veya Github dosyalarında paylaşma.
3. **Cloudflare Workers Free** hesabı aç, `reviews-worker/src/index.js` içeriğini Worker'a yayımla. Ücretli plana yükseltme veya kredi kartı istenirse dur.
4. Cloudflare Worker Secrets ekle: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_ACCOUNT_ID`, `GOOGLE_LOCATION_ID`. **Bunların gerçek değerleri asla bu repoya gönderilmez.** Google Maps Place ID, API'nin `locationId` alanıyla aynı değildir.
5. Açılan `https://<worker-name>.<account>.workers.dev/reviews` adresinde gerçek `reviews` verisini test et. Varsayılan API yolu: `https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews`.
6. Ana sayfadaki `#yorumlar` bölümüne `assets/reviews-native.js` göstericisini ve `data-native-google-reviews data-reviews-endpoint="https://.../reviews"` kabını ekle. Yalnızca bu bağlantı çalıştıktan sonra Elfsight kodunu kaldır.
7. Yorumları veya müşteri kimliklerini sahte olarak üretme, yalnızca yüksek yıldızlıları filtreleme ve review/AggregateRating ile kendi işletmene arama yıldızı vaat etme.

## Güvenlik ve kontrol

- Google OAuth sırrı **yalnızca** Worker Secrets içinde kalır; GitHub Pages istemci koduna girmez.
- Yorumlar en fazla 30 dakika geçici önbelleğe alınır; GitHub deposuna kaydedilmez.
- Kurulum yokken web sitesinde uydurulmuş yorumlar gösterilmez.
- Google API hata verir veya ücretsiz Worker kotası dolarsa, Google Haritalar yorum bağlantısı kullanılmaya devam eder.
- Yeni yorum anında gelmez; Google'da yayınlanması ve önbelleğin sona ermesi gerekir.
- İlk kez Cloudflare ile OAuth bağlantısını kurma adımları kullanıcı hesabına bağlıdır; yalnızca müşteri onayladığında yapılmalıdır.

## Hazır dosyalar

- `reviews-worker/src/index.js` - OAuth ile Google Business Profile yorumlarını güvenli veren Cloudflare Worker
- `assets/reviews-native.js` - yorumları XSS korumalı DOM ile gösteren yerel istemci kodu
- `reviews-worker/README.md` - bu belge
