package com.turkuaz3d.web;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Keeps alerts working while the app is closed, without Firebase or any account:
 * a foreground service asks our own Cloudflare Worker for new events.
 * Android's "Force stop" still disables it until the app is opened again.
 */
public final class LiveAlertService extends Service {
    private static final String CHANNEL = "turkuaz3d_live";
    private static final int ID = 11000;
    private static final long INTERVAL_MS = 30_000L;

    private HandlerThread thread;
    private Handler handler;
    private PowerManager.WakeLock wakeLock;
    private String shownText = "";

    static void start(Context context) {
        if (Build.VERSION.SDK_INT >= 33 &&
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            return;
        try {
            context.startForegroundService(new Intent(context, LiveAlertService.class));
        } catch (Exception ignored) {
            // Android may refuse a background start; opening the app starts it.
        }
    }

    private final Runnable loop = new Runnable() {
        @Override public void run() {
            int result = VisitorPollingWorker.check(getApplicationContext());
            String time = new SimpleDateFormat("HH:mm", new Locale("tr", "TR")).format(new Date());
            if (result == VisitorPollingWorker.CHECK_OK) show("Açık · son kontrol " + time);
            else if (result == VisitorPollingWorker.CHECK_NOT_CONFIGURED)
                show("Bekliyor: uygulamayı açıp yönetim girişi yapın");
            else show("Bağlantı kurulamadı " + time + " · tekrar denenecek");
            handler.postDelayed(this, INTERVAL_MS);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        NotificationManager manager = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL,
                "Canlı bildirim servisi", NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            // Reopening the app calls this again: keep the latest status on screen.
            Notification note = build(shownText.isEmpty() ? "Başlatılıyor..." : shownText);
            if (Build.VERSION.SDK_INT >= 34)
                startForeground(ID, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(ID, note);
        } catch (Exception refused) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (thread == null) {
            // Without this the processor sleeps with the screen off and checks stop.
            wakeLock = getSystemService(PowerManager.class)
                    .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "turkuaz3d:alerts");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire();
            thread = new HandlerThread("t3-alerts");
            thread.start();
            handler = new Handler(thread.getLooper());
            handler.post(loop);
        }
        return START_STICKY;
    }

    private Notification build(String text) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(this, 8, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.t3_icon)
                .setContentTitle("Turkuaz 3D bildirimleri")
                .setContentText(text)
                .setOngoing(true).setOnlyAlertOnce(true)
                .setContentIntent(tap).build();
    }

    private void show(String text) {
        if (text.equals(shownText)) return;
        shownText = text;
        getSystemService(NotificationManager.class).notify(ID, build(text));
    }

    @Override public void onDestroy() {
        if (handler != null) handler.removeCallbacksAndMessages(null);
        if (thread != null) thread.quitSafely();
        thread = null;
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) {
        return null;
    }
}
