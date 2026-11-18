# Turkuaz 3D Web — Android + Windows
- Android app: `apps/android`. GitHub Actions builds a debug APK on every app-source change.
- Windows app: `apps/windows`. GitHub Actions builds a Windows x64 executable.
- Both apps open the branded administration interface at https://turkuaz3d.com/yonetim/
- Android **only** presents mobile site editor. Windows presents both mobile/desktop editor.
- Saving requires a fine-grained GitHub personal access token with Contents: read/write permission **only** for eyp7824/turkuaz3d-web. It is never committed to the repository.
- **Beni Hatırla is always checked.** The GitHub token and Cloudflare `ADMIN_KEY` are saved in the Android Keystore-backed encrypted vault and in the Windows user's DPAPI-encrypted vault. After ordinary app restarts or updates with the same signing identity, these are restored automatically. Only uninstalling/resetting the app, a signing-identity change, token expiration/revocation, or clearing device data can require a new entry.
- The live visitor and contact-click counters depend on the owner's configured Cloudflare Worker + D1. The website counts WhatsApp/telephone **button clicks only after consent**, not sent messages or completed calls. To enable the new counters, deploy the updated `analytics-worker` source to the **existing** Worker; website publication alone does not update the Worker.
- The Android debug APK is a test build, not a Play Store signed release.
- **Without another account or subscription**, Android v1.0.11 supports periodic visitor alerts via WorkManager when the owner has granted notification permission and saved the analytics credentials. It checks about every 15 minutes when Android permits; Doze, battery restrictions, and force-stop can delay or prevent checks. This is not instantaneous push and does not depend on Firebase. Windows already keeps polling in the notification area after the window is closed; explicitly exiting the tray app stops notifications.
