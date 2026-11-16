# Turkuaz 3D — kolay Cloudflare kurulumu

**Tek tıkla dağıtım:** [Turkuaz 3D Analitik Cloudflare kurulumunu aç](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Feyp7824%2Fturkuaz3d-web%2Ftree%2Fmain%2Fanalytics-worker)

Cloudflare'ın resmi dağıtım aracı, GitHub'daki bu klasörü içeri aktararak Worker'ı ve D1 veritabanını kurabilir; `package.json` içindeki `deploy` komutu da SQL tablolarını oluşturur.

1. Linki aç, Cloudflare hesabına giriş yap, **Free** planı seç. Ücretli veya deneme paketi seçme.
2. Dağıtım formunda güvenli ve rastgele 32+ karakterlik **ADMIN_KEY** oluştur. Bu değeri **sadece Cloudflare ve Turkuaz 3D Web uygulamasına** gir; mesaj veya ekran görüntüsünde paylaşma.
3. **Deploy** işlemine izin ver. Kurulumda D1 ve Worker'ın oluştuğunu, `/health` adresinde `db:true` yazdığını kontrol et.
4. Oluşan **herkese açık** `https://turkuaz3d-analytics.<hesap>.workers.dev` adresini yönetim panelindeki **Worker sunucu adresi** alanına gir. Yukarıdaki ADMIN_KEY'i de analitik alanına yapıştır. **Bağlan ve Kontrol Et** de.
5. Site ölçümünün başlaması için `public/analytics-config.json` içindeki `worker` alanına Worker URL'ini yazıp `enabled:true` yaparak GitHub'dan siteyi yeniden yayımla.

**Durum:** Kurulum yapılmadan canlı veriler yoktur. Sitede kullanıcı rızası olmadan ziyaretçi bilgisi toplanmaz. Android uygulaması yalnızca açıkken kendi bildirimini verebilir. Windows tepsiye küçültüldüğünde bildirim takibini sürdürür. Android uygulaması kapalıyken mesaj almak için Telegram bot ayarları isteğe bağlıdır.

---

## Durum
Bu dosyalar tam kaynak kodudur. GitHub Pages **tek başına veri depolayamaz**.
Bu altyapı Cloudflare Workers + D1 hesabına **dağıtılmadan** canlı ziyaretçi sayısı ve bildirimler ÇALIŞMAZ.
Worker Free günlük 100.000 istek üst sınırına tabidir. D1 ücretsiz katmanın kendi limitleri vardır.
Veriler yalnızca ziyaretçinin açık rızasıyla toplanır; ham IP saklanmaz.

## Bir kez yapılması gereken dağıtım (ücretsiz paket seçin)
1. Cloudflare hesabında Workers & Pages / D1 bölümünü açın.
2. Bu deponun analytics-worker klasöründe Node.js komutlarını çalıştırın:
   - npx wrangler login
   - npx wrangler d1 create turkuaz3d-analytics
3. Çıktıdaki database_id değerini analytics-worker/wrangler.toml içine yazın.
4. npx wrangler d1 migrations apply turkuaz3d-analytics --remote
5. Rastgele güçlü 48+ karakterlik bir ANAHTAR belirleyin ve:
   - npx wrangler secret put ADMIN_KEY
   - Anahtarı yalnızca kendinize saklayın; GitHub'a veya sohbet ekranına YAZMAYIN.
6. npx wrangler deploy
7. Çıktıdaki https://turkuaz3d-analytics.<hesap>.workers.dev adresini
   /public/analytics-config.json içindeki worker alanına yazın ve enabled değerini true yapıp GitHub'a kaydedin.
8. Turkuaz 3D Web Android / Windows panelinde "Ziyaretçi Trafiği" ekranına gelin.
   Worker adresini ve ADMIN_KEY değerini bir defa girip Kaydet'e basın.
   Anahtar sadece uygulamanın yerel saklama alanında kalır; Worker'a yalnızca kimlik doğrulama için gönderilir.

## Mobil uygulama kapalıyken bildirim (isteğe bağlı)
Cloudflare Worker'ın ziyaret anında ücretsiz Telegram botuna mesaj göndermesini açabilirsiniz:
- npx wrangler secret put TELEGRAM_BOT_TOKEN
- npx wrangler secret put TELEGRAM_CHAT_ID
- Her yeni tekil ziyaret için bot mesaj gönderir. Telegram uygulaması üzerinden Android ve Windows'ta kapalıyken bile bildirim alınabilir.
- Telegram mesajı: yaklaşık şehir/ülke, sayfa, zaman. Ham IP gönderilmez.
- Bu iki gizli değer GitHub'a yazılmamalıdır.
- Android uygulamasının kendi bildirimleri yönetim ekranı açıkken yaklaşık 10-15 sn içinde gelir.
  Bu uygulama kapalıyken FCM tabanlı native push desteklemiyor; Telegram opsiyonu bu boşluğu doldurur.

## Test
- Worker /health -> {ok:true,deployed:true,db:true}
- Ziyaretçi site üzerinde izin verdiğinde /v1/visit yazılır.
- Admin paneli /v1/stats ve /v1/events endpointlerinden gerçek verileri gösterir.
- Dashboard yanlış veriyi göstermez: Worker bağlanmadan beklemede der.
- Kullanım izinleri ve veri saklama politikası işletme sorumluluğundadır.
