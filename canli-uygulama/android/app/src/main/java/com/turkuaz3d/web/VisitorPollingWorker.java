package com.turkuaz3d.web;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Free, account-free fallback for background visit alerts. Unlike server push,
 * WorkManager's 15-minute minimum is inexact and may be delayed by Android.
 * Neither credentials nor visitor logs are stored outside the app's private data.
 */
public final class VisitorPollingWorker extends Worker {
    private static final String STATE = "turkuaz_background_visit_cursor_v1";
    private static final String CHANNEL = "turkuaz3d_visitors";

    public VisitorPollingWorker(@NonNull Context context,@NonNull WorkerParameters parameters) {
        super(context,parameters);
    }

    static final int CHECK_OK = 0;
    static final int CHECK_NOT_CONFIGURED = 1;
    static final int CHECK_FAILED = 2;

    @NonNull @Override public Result doWork() {
        Context context=getApplicationContext();
        // Backup path: if Android killed the live service, try to bring it back.
        LiveAlertService.start(context);
        check(context);
        return Result.success();
    }

    /** Shared by the live service and the periodic backup; synchronized to avoid duplicates. */
    static synchronized int check(Context context) {
        try {
            if(Build.VERSION.SDK_INT>=33 &&
                    context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
                return CHECK_NOT_CONFIGURED;

            String saved=NativeVault.read(context,"analytics");
            if(saved.isEmpty())return CHECK_NOT_CONFIGURED;
            JSONObject config=new JSONObject(saved);
            String endpoint=config.optString("worker","").replaceAll("/+$","");
            String key=config.optString("key","");
            URL base=new URL(endpoint);
            if(!"https".equals(base.getProtocol()) || base.getUserInfo()!=null ||
                    base.getQuery()!=null || base.getRef()!=null ||
                    (base.getPath()!=null && !base.getPath().isEmpty() && !"/".equals(base.getPath())) ||
                    key.length()<32) return CHECK_NOT_CONFIGURED;

            SharedPreferences prefs=context.getSharedPreferences(STATE,Context.MODE_PRIVATE);
            String fingerprint=fingerprint(endpoint);
            if(!fingerprint.equals(prefs.getString("endpoint",""))) {
                prefs.edit().putString("endpoint",fingerprint).remove("cursor").commit();
            }
            long cursor=prefs.getLong("cursor",-1);
            if(cursor<0) {
                JSONObject initial=request(endpoint+"/v1/stats",key);
                if(initial.optBoolean("connected",false))
                    prefs.edit().putLong("cursor",initial.optLong("cursor",0)).apply();
                return CHECK_OK; // Never notify for visits before setup.
            }

            // The Worker returns up to 50 events per page; keep a bounded
            // catch-up loop so a busy day doesn't permanently skip visits.
            for(int page=0;page<10;page++) {
                JSONObject response=request(endpoint+"/v1/events?after="+cursor,key);
                JSONArray events=response.optJSONArray("events");
                if(events==null || events.length()==0)break;
                for(int i=0;i<events.length();i++) {
                    JSONObject event=events.optJSONObject(i);
                    if(event==null)continue;
                    long id=event.optLong("id",0);
                    if(id<=cursor)continue;
                    cursor=id;
                    notifyEvent(context,event);
                }
                // Persist each completed page. Repeated runs never alert twice.
                prefs.edit().putLong("cursor",cursor).commit();
                if(events.length()<50)break;
            }
            return CHECK_OK;
        } catch(Exception ignored) {
            // Connectivity and authorization failures must not clear login data.
            // The next execution retries without duplicating events.
            return CHECK_FAILED;
        }
    }

    private static String fingerprint(String value)throws Exception {
        byte[] digest=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder out=new StringBuilder();
        for(byte b:digest)out.append(String.format(java.util.Locale.ROOT,"%02x",b&0xff));
        return out.toString();
    }

    private static JSONObject request(String address,String secret)throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(address).openConnection();
        try {
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setRequestProperty("Authorization","Bearer "+secret);
            connection.setRequestProperty("Origin","https://turkuaz3d.com");
            connection.setRequestProperty("Accept","application/json");
            connection.setUseCaches(false);
            if(connection.getResponseCode()!=200)throw new IllegalStateException("Worker request failed");
            try(InputStream input=connection.getInputStream();
                    ByteArrayOutputStream output=new ByteArrayOutputStream()) {
                byte[] bytes=new byte[4096];
                int n;
                while((n=input.read(bytes))!=-1) {
                    if(output.size()+n>1024*1024)throw new IllegalStateException("Oversize response");
                    output.write(bytes,0,n);
                }
                return new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
            }
        } finally {connection.disconnect();}
    }

    // Android fixes a channel's sound when it is first created: use a new id to change it.
    // The resource id argument only makes the build fail if the sound file is missing.
    private static String soundChannel(Context context,NotificationManager manager,
            String key,String label,int soundCheck,String fileName) {
        String id="turkuaz3d_ses_"+key;
        NotificationChannel channel=new NotificationChannel(id,label,NotificationManager.IMPORTANCE_HIGH);
        // Name-based address stays valid across updates, unlike a numeric resource id.
        android.net.Uri sound=android.net.Uri.parse(
                "android.resource://"+context.getPackageName()+"/raw/"+fileName);
        channel.setSound(sound,new android.media.AudioAttributes.Builder()
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
        return id;
    }

    // Every event gets its own notification, so a click is never hidden by a later visit.
    private static void notifyEvent(Context context,JSONObject event) {
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(manager==null)return;
        String type=event.optString("city","");
        String channel;
        if(type.startsWith("📲"))
            channel=soundChannel(context,manager,"whatsapp","WhatsApp tıklaması",R.raw.ses_whatsapp,"ses_whatsapp");
        else if(type.startsWith("📞"))
            channel=soundChannel(context,manager,"telefon","Telefon tıklaması",R.raw.ses_telefon,"ses_telefon");
        else
            channel=soundChannel(context,manager,"ziyaretci","Yeni ziyaretçi",R.raw.ses_ziyaretci,"ses_ziyaretci");
        Intent open=new Intent(context,MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent action=PendingIntent.getActivity(context,7,open,
                PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        String city=event.optString("city","Bilinmiyor");
        String title="Turkuaz 3D · Yeni ziyaret";
        // The Worker sends contact clicks as "<label> · <city>".
        if(city.startsWith("📲")||city.startsWith("📞")) {
            int split=city.indexOf(" · ");
            if(split>0) {
                title=city.substring(0,split);
                city=city.substring(split+3);
            }
        }
        String message=city+", "+event.optString("country","Bilinmiyor")+
                " · "+event.optString("page","/");
        Notification note=new Notification.Builder(context,channel)
                .setSmallIcon(R.drawable.t3_icon)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new Notification.BigTextStyle().bigText(message))
                .setContentIntent(action).setAutoCancel(true).build();
        manager.notify(20000+(int)(event.optLong("id",0)%100000),note);
    }
}
