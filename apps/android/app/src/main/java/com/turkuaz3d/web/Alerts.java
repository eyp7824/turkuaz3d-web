package com.turkuaz3d.web;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;

/**
 * Three kinds of alerts, each with its own sound that is bundled inside the app
 * (res/raw), so no server or account is involved in playing them:
 * visitor, WhatsApp button click and phone-call button click.
 * Android fixes a channel's sound when it is first created, so these channel
 * ids are new ("v2") and must change again whenever a sound is replaced.
 */
final class Alerts {
    static final int VISIT = 0, WHATSAPP = 1, PHONE = 2;
    private static final String[] CHANNELS = {
            "turkuaz3d_visit_v2", "turkuaz3d_whatsapp_v2", "turkuaz3d_phone_v2"};

    private Alerts() {}

    static String channel(int kind) { return CHANNELS[kind]; }

    static int notificationId(int kind) { return 12000 + kind; }

    /** Decides the alert type from the texts the analytics server sends. */
    static int kind(String... texts) {
        for (String text : texts) {
            if (text == null) continue;
            if (text.contains("WhatsApp tıklaması")) return WHATSAPP;
            if (text.contains("Telefon tıklaması")) return PHONE;
        }
        return VISIT;
    }

    static void ensureChannels(Context context) {
        NotificationManager manager = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        AudioAttributes audio = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        int[] sounds = {R.raw.ses_ziyaretci, R.raw.ses_whatsapp, R.raw.ses_telefon};
        String[] names = {
                "Ziyaretçi bildirimleri",
                "WhatsApp tıklaması bildirimleri",
                "Telefon arama tıklaması bildirimleri"};
        String[] descriptions = {
                "Turkuaz 3D sitesine gelen yeni ziyaretçiler.",
                "Ziyaretçinin WhatsApp düğmesine bastığında.",
                "Ziyaretçinin telefon arama düğmesine bastığında."};
        long[][] vibration = {{0, 150}, {0, 120, 80, 120}, {0, 500, 200, 500}};
        for (int kind = 0; kind < CHANNELS.length; kind++) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNELS[kind], names[kind], NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription(descriptions[kind]);
            channel.setSound(Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://"
                    + context.getPackageName() + "/" + sounds[kind]), audio);
            channel.enableVibration(true);
            channel.setVibrationPattern(vibration[kind]);
            manager.createNotificationChannel(channel);
        }
    }
}
