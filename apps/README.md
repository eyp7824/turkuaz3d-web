# Turkuaz 3D Web — Android + Windows
- Android app: `apps/android`. GitHub Actions builds a debug APK on every app-source change.
- Windows app: `apps/windows`. GitHub Actions builds a Windows x64 executable.
- Both apps open the branded administration interface at https://turkuaz3d.com/yonetim/
- Android **only** presents mobile site editor. Windows presents both mobile/desktop editor.
- Saving requires a fine-grained GitHub personal access token with Contents: read/write permission **only** for eyp7824/turkuaz3d-web. It is kept in sessionStorage and never committed to the repository.
- Visitor analytics and visitor push alerts are NOT connected; the interface correctly shows no data. A trusted collection/notification backend must be deployed to enable them.
- The Android debug APK is a test build, not a Play Store signed release.
