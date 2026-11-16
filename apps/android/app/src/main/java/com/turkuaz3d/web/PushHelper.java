package com.turkuaz3d.web;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

public final class PushHelper {
    private PushHelper() {}
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private static final String PREF = "turkuaz_push_config";
    private static final String CONFIG_URL = "https://turkuaz3d.com/public/push-config.json";
    private static final String CHANNEL = "turkuaz3d_visitors";

    public static void initializeFromSavedConfig(Context context) {
        try {
            String raw = context.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString("firebase", "");
            if (!raw.isEmpty()) initializeFirebase(context, new JSONObject(raw));
        } catch (Exception ignored) {}
    }
    private static synchronized void initializeFirebase(Context context, JSONObject config) {
        if (FirebaseApp.getApps(context).size() > 0) return;
        String appId=config.optString("appId");
        String apiKey=config.optString("apiKey");
        String projectId=config.optString("projectId");
        String senderId=config.optString("senderId");
        if(appId.isEmpty()||apiKey.isEmpty()||projectId.isEmpty()||senderId.isEmpty()) return;
        FirebaseOptions opts=new FirebaseOptions.Builder().setApplicationId(appId).setApiKey(apiKey)
                .setProjectId(projectId).setGcmSenderId(senderId).build();
        FirebaseApp.initializeApp(context,opts);
    }
    private static String fetchConfig() throws Exception {
        HttpURLConnection con=(HttpURLConnection)new URL(CONFIG_URL).openConnection();
        con.setRequestMethod("GET");
        con.setConnectTimeout(7000);con.setReadTimeout(7000);
        con.setRequestProperty("Accept","application/json");
        con.setUseCaches(false);
        try {
            if(con.getResponseCode()!=200)throw new Exception("Firebase ayar dosyasına ulaşılamadı");
            try(InputStream stream=con.getInputStream()){
                byte[] body=stream.readNBytes(4096);
                return new String(body, StandardCharsets.UTF_8);
            }
        }finally{con.disconnect();}
    }
    public static void getDeviceToken(Activity activity, Consumer<String> ready,Consumer<String> error) {
        IO.submit(()->{
            try{
                JSONObject config=new JSONObject(fetchConfig());
                if(!config.optBoolean("enabled",false))throw new Exception("Firebase bildirim servisi henüz etkinleştirilmedi");
                if(!"com.turkuaz3d.web".equals(config.optString("packageName")))throw new Exception("Firebase paket kimliği uyuşmuyor");
                initializeFirebase(activity.getApplicationContext(),config);
                if(FirebaseApp.getApps(activity).isEmpty())throw new Exception("Firebase bağlantısı kurulamadı");
                activity.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit().putString("firebase",config.toString()).apply();
                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{
                    if(task.isSuccessful() && task.getResult()!=null){
                        String token=task.getResult();
                        activity.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit().putString("last_fcm_token",token).apply();
                        activity.runOnUiThread(()->ready.accept(token));
                    }else{
                        activity.runOnUiThread(()->error.accept("FCM cihaz kaydı başarısız oldu"));
                    }
                });
            }catch(Exception exception){activity.runOnUiThread(()->error.accept(exception.getMessage()));}
        });
    }
}
