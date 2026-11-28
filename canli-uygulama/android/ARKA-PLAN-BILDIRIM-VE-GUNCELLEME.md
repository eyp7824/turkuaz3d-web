# Turkuaz 3D Web Android v1.0.7: Kapalıyken bildirim ve kalıcı APK güncellemesi

## Durum
Android uygulamasına Firebase Cloud Messaging (FCM) bildirim istemcisi eklendi.
Cloudflare Worker yeni ziyaret geldiğinde cihazlara bildirim gönderecek.
**Firebase projesi ve Cloudflare gizli anahtarları tamamlanmadan arka plan bildirimi çalışmaz.**

## FCM kurulumu (bir defalık)
1. Firebase Console'da bir proje oluşturun. Android uygulama paket adı: com.turkuaz3d.web.
2. Firebase Android uygulama ayarlarından appId, apiKey, projectId, senderId değerlerini alın. Bunlar herkese açık istemci yapılandırmasıdır.
3. Turkuaz 3D web projesindeki public/push-config.json dosyasına bu değerleri yerleştirin ve enabled: true yapın. APK'yı yeniden derlemek gerekmez.
4. Firebase Console > Proje Ayarları > Hizmet Hesapları bölümünde FCM HTTP v1 yetkili service account oluşturun.
5. Cloudflare Workers > turkuaz3d-analytics > Settings > Variables and Secrets içine bu değerleri Secret olarak kaydedin:
   - FCM_PROJECT_ID: Firebase project ID
   - FCM_CLIENT_EMAIL: Service Account client_email
   - FCM_PRIVATE_KEY: Service Account private_key (BEGIN ve END satırlarıyla)
   Secret anahtarı GitHub'a, ekrana veya sohbete göndermeyin.
6. Cloudflare dağıtımında D1 0002_fcm_push.sql migrasyonunun uygulandığını kontrol edin.
7. Turkuaz 3D Web uygulaması > Ziyaretçi Trafiği > Telefon Bildirimlerini Aç ve bildirim iznine izin verin.
   Cihaz FCM tokenı mevcut analitik ADMIN_KEY ile sunucuya kaydedilir. Başarılı olunca FCM bağlı görünür.

Android uygulama zorla durdurulmuşsa, yeniden açılana kadar bildirim almayabilir.
Telefon üreticisinin pil yönetimi ve internet kesintileri anlık bildirimleri geciktirebilir.

## APK'yı kaldırmadan güncelleme
Önceki test APK'ları GitHub Actions'ın geçici debug anahtarıyla imzalandı.
Bu özel anahtar kaydedilmediği için eski APK'dan yeni imzalı sürüme **bir kez** kaldırıp kurulum gerekir.
Bu işlem Android uygulamasının yerel giriş bilgilerini de sıfırlar.

KALICI IMZALAMA, BIR KEZ:
1. https://github.com/eyp7824/turkuaz3d-web/settings/secrets/actions/new
2. Name: ANDROID_SIGNING_SEED
3. Secret: En az 32 karakterli, güçlü, rastgele ve değiştirmeyeceğiniz bir gizli parola.
   Bunu sohbette paylaşmayın; güvenli bir parola kasasında saklayın.
4. Add secret düğmesiyle kaydedin.
5. GitHub Actions > Build Turkuaz 3D Web APK and Windows EXE > Run workflow.
6. Turkuaz-3D-Web-Android-SIGNED-v1.0.7-UPDATABLE artifaktını indirip kurun.
7. Gelecekte yalnızca SIGNED / UPDATABLE isimli APK sürümlerini kurun. Paket adı ve imza aynı kalır; sürüm kodu artar.

Android-DEBUG-uninstall-required sürümleri kalıcı güncelleme APK'sı değildir.
ANDROID_SIGNING_SEED gizli anahtarını değiştirir veya silerseniz sonraki APK'nın imzası değişir.
