package com.turkuaz3d.web;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.JavascriptInterface;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebMessageCompat;
import org.json.JSONObject;
import java.util.Collections;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.view.WindowInsets;
import android.graphics.Insets;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ImageView;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String HOME = "https://turkuaz3d.com/yonetim/?mode=android&layout=8&view=stats";
    private WebView browser;
    private static final String VISIT_CHANNEL = "turkuaz3d_visitors";
    private int notificationId = 100;
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(4,26,39));
        getWindow().setNavigationBarColor(Color.rgb(4,26,39));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(6,24,36));
        // Android 15/16 enforce edge-to-edge for target SDK 35+.
        // Place the actual WebView below the status bar and above navigation/gesture area.
        // CSS padding alone cannot fix content obscured by Android system bars.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safe = insets.getInsets(
                        WindowInsets.Type.statusBars()
                        | WindowInsets.Type.navigationBars()
                        | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return insets;
            });
        }
        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(6,24,36));
        browser.getSettings().setJavaScriptEnabled(true);
        // This bridge only exists on the trusted first-party origin.
        // A third-party iframe cannot read or overwrite stored secrets.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(browser, "T3Vault",
                Collections.singleton("https://turkuaz3d.com"),
                (view, message, origin, mainFrame, reply) -> {
                    if (!mainFrame || !"https".equals(origin.getScheme()) ||
                        !"turkuaz3d.com".equals(origin.getHost()) ||
                        (origin.getPort() != -1 && origin.getPort() != 443) ||
                        message.getType() != WebMessageCompat.TYPE_STRING) return;
                    Uri current = Uri.parse(view.getUrl() == null ? "" : view.getUrl());
                    if (!"https".equals(current.getScheme()) ||
                        !"turkuaz3d.com".equals(current.getHost()) ||
                        current.getPath() == null ||
                        !current.getPath().startsWith("/yonetim/")) return;
                    try {
                        JSONObject input = new JSONObject(message.getData());
                        if (!"t3-vault".equals(input.optString("type"))) return;
                        String slot = input.optString("slot");
                        String action = input.optString("action");
                        JSONObject output = new JSONObject();
                        output.put("type", "t3-vault-reply");
                        output.put("id", input.optInt("id", 0));
                        boolean ok = false;
                        String value = "";
                        if ("get".equals(action)) {
                            value = NativeVault.read(this, slot);
                            ok = true;
                        } else if ("set".equals(action)) {
                            ok = NativeVault.save(this, slot, input.optString("value"));
                        } else if ("delete".equals(action)) {
                            ok = NativeVault.clear(this, slot);
                        }
                        output.put("ok", ok);
                        output.put("value", value);
                        reply.postMessage(output.toString());
                    } catch(Exception ignored) {}
                });
        }

        browser.addJavascriptInterface(new VisitorBridge(), "TurkuazNative");
        browser.getSettings().setDomStorageEnabled(true);
        browser.getSettings().setUseWideViewPort(true);
        browser.getSettings().setLoadWithOverviewMode(false);
        browser.getSettings().setTextZoom(100);
        browser.getSettings().setSupportZoom(false);
        browser.getSettings().setBuiltInZoomControls(false);
        browser.getSettings().setDisplayZoomControls(false);
        browser.setInitialScale(100);
        browser.getSettings().setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
        // Preserve WebView profile, localStorage and cache when the app is reopened.
        browser.getSettings().setAllowFileAccess(false);
        browser.getSettings().setAllowContentAccess(false);
        browser.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        browser.setWebChromeClient(new WebChromeClient());
        LinearLayout loading = new LinearLayout(this);
        loading.setOrientation(LinearLayout.VERTICAL);
        loading.setGravity(Gravity.CENTER);
        loading.setBackgroundColor(Color.rgb(6,24,36));
        ImageView loadingLogo = new ImageView(this);
        loadingLogo.setImageResource(R.drawable.t3_icon);
        int logoSize=(int)(130 * getResources().getDisplayMetrics().density);
        loading.addView(loadingLogo,new LinearLayout.LayoutParams(logoSize,logoSize));
        TextView loadingText = new TextView(this);
        loadingText.setText("TURKUAZ 3D WEB\n\nYönetim paneli açılıyor...");
        loadingText.setTextColor(Color.rgb(0,228,223));
        loadingText.setTextSize(24);
        loadingText.setGravity(Gravity.CENTER);
        loading.addView(loadingText, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(browser, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(loading, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !"turkuaz3d.com".equals(uri.getHost())
                    || !uri.getPath().startsWith("/yonetim/")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch(Exception ignored) { }
                    return true;
                }
                return false;
            }
            @Override public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript("window.scrollTo(0,0);", null);
                loading.setVisibility(View.GONE);
                // Refresh FCM registration after app relaunch; Android may rotate the token.
                if (!getSharedPreferences("turkuaz_push_config", MODE_PRIVATE).getString("firebase","").isEmpty()
                    && (Build.VERSION.SDK_INT < 33 ||
                        checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)) {
                    prepareRemoteNotifications();
                }
            }
        });
        NotificationManager notifications = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if (notifications != null) {
            NotificationChannel channel = new NotificationChannel(VISIT_CHANNEL, "Turkuaz 3D ziyaretçi bildirimleri", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Turkuaz 3D sitesine gelen yeni ziyaret bildirimleri.");
            notifications.createNotificationChannel(channel);
        }
        setContentView(root);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) root.requestApplyInsets();
        browser.loadUrl(HOME);
    }
    public class VisitorBridge {
        @JavascriptInterface public void enableNotifications() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
                } else {
                    prepareRemoteNotifications();
                }
            });
        }
        @JavascriptInterface public void showNotification(String title, String message) {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
                NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
                if(nm==null) return;
                Intent intent=new Intent(MainActivity.this,MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent tap=PendingIntent.getActivity(MainActivity.this,0,intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                Notification n=new Notification.Builder(MainActivity.this,VISIT_CHANNEL)
                    .setSmallIcon(R.drawable.t3_icon)
                    .setContentTitle(title==null?"Turkuaz 3D Web":title.substring(0,Math.min(70,title.length())))
                    .setContentText(message==null?"Yeni ziyaret":message.substring(0,Math.min(150,message.length())))
                    .setAutoCancel(true).setContentIntent(tap).build();
                nm.notify(++notificationId,n);
            });
        }
    }
    private void showPushMessage(String event, String message) {
        if(browser==null)return;
        String code="window."+event+"&&window."+event+"("+org.json.JSONObject.quote(message)+");";
        browser.evaluateJavascript(code,null);
    }
    private void prepareRemoteNotifications() {
        PushHelper.getDeviceToken(this,
            token->showPushMessage("T3ReceivePushToken",token),
            error->showPushMessage("T3PushError",error));
    }
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(requestCode,permissions,results);
        if(requestCode==1001) {
            if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)prepareRemoteNotifications();
            else showPushMessage("T3PushError","Telefon bildirim izni verilmedi.");
        }
    }
    @Override public void onBackPressed() {
        if(browser!=null && browser.canGoBack()) browser.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if(browser!=null) {browser.destroy();browser=null;}
        super.onDestroy();
    }
}
