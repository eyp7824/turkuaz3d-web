package com.turkuaz3d.web;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class VisitorFirebaseService extends FirebaseMessagingService {
    private static final String CHANNEL = "turkuaz3d_visitors";
    @Override public void onNewToken(String token) {
        super.onNewToken(token);
        getSharedPreferences("turkuaz_push_config",Context.MODE_PRIVATE)
                .edit().putString("last_fcm_token",token).apply();
    }
    @Override public void onMessageReceived(RemoteMessage incoming) {
        // Firebase automatically displays notification payloads when app is backgrounded;
        // show locally here only for foreground delivery.
        RemoteMessage.Notification n=incoming.getNotification();
        String title=n!=null && n.getTitle()!=null?n.getTitle():"Turkuaz 3D Web · Yeni ziyaret";
        String body=n!=null && n.getBody()!=null?n.getBody():"Turkuaz 3D sitenize yeni ziyaret geldi.";
        NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if(nm==null)return;
        nm.createNotificationChannel(new NotificationChannel(CHANNEL,"Turkuaz 3D ziyaretçi bildirimleri",NotificationManager.IMPORTANCE_HIGH));
        Intent i=new Intent(this,MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent p=PendingIntent.getActivity(this,1,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification note=new Notification.Builder(this,CHANNEL).setSmallIcon(R.drawable.t3_icon)
          .setContentTitle(title).setContentText(body).setAutoCancel(true)
          .setContentIntent(p).build();
        nm.notify((int)(System.currentTimeMillis()%Integer.MAX_VALUE),note);
    }
}
