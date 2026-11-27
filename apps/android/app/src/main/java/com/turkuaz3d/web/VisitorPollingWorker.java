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

    @NonNull @Override public Result doWork() {
        Context context=getApplicationContext();
        try {
            if(Build.VERSION.SDK_INT>=33 &&
                    context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
                return Result.success();

            String saved=NativeVault.read(context,"analytics");
            if(saved.isEmpty())return Result.success();
            JSONObject config=new JSONObject(saved);
            String endpoint=config.optString("worker","").replaceAll("/+$","");
            String key=config.optString("key","");
            URL base=new URL(endpoint);
            if(!"https".equals(base.getProtocol()) || base.getUserInfo()!=null ||
                    base.getQuery()!=null || base.getRef()!=null ||
                    (base.getPath()!=null && !base.getPath().isEmpty() && !"/".equals(base.getPath())) ||
                    key.length()<32) return Result.success();

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
                return Result.success(); // Never notify for visits before setup.
            }

            int[] counts=new int[3];
            String[] latest={"","",""};
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
                    String city=event.optString("city","Bilinmiyor");
                    String country=event.optString("country","Bilinmiyor");
                    String eventPage=event.optString("page","");
                    int kind=Alerts.kind(city,eventPage);
                    counts[kind]++;
                    latest[kind]=kind==Alerts.VISIT?city+", "+country
                            :city+", "+country+" \u00b7 "+eventPage;
                }
                // Persist each completed page. Repeated runs never alert twice.
                prefs.edit().putLong("cursor",cursor).commit();
                if(events.length()<50)break;
            }
            for(int k=0;k<3;k++)if(counts[k]>0)notifyKind(context,k,counts[k],latest[k]);
        } catch(Exception ignored) {
            // Connectivity and authorization failures must not clear login data.
            // The next periodic execution retries without duplicating events.
        }
        return Result.success();
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

    private static void notifyKind(Context context,int kind,int count,String latest) {
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(manager==null)return;
        Alerts.ensureChannels(context);
        Intent open=new Intent(context,MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent action=PendingIntent.getActivity(context,7+kind,open,
                PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        String title,message;
        if(kind==Alerts.WHATSAPP) {
            title="Turkuaz 3D Web \u00b7 WhatsApp t\u0131klamas\u0131";
            message=(count==1?"":count+" t\u0131klama. Son: ")+latest;
        } else if(kind==Alerts.PHONE) {
            title="Turkuaz 3D Web \u00b7 Telefon t\u0131klamas\u0131";
            message=(count==1?"":count+" t\u0131klama. Son: ")+latest;
        } else {
            title="Turkuaz 3D Web \u00b7 Ziyaret\u00e7i bildirimi";
            message=(count==1?"Yeni ziyaret: ":count+" yeni ziyaret. Son ziyaret: ")+latest;
        }
        Notification note=new Notification.Builder(context,Alerts.channel(kind))
                .setSmallIcon(R.drawable.t3_icon)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new Notification.BigTextStyle().bigText(message))
                .setContentIntent(action).setAutoCancel(true).build();
        manager.notify(Alerts.notificationId(kind),note);
    }
}
