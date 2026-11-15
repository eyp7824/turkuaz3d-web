package com.turkuaz3d.web;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String HOME = "https://turkuaz3d.com/yonetim/?mode=android";
    private WebView browser;
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(4,26,39));
        getWindow().setNavigationBarColor(Color.rgb(4,26,39));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(6,24,36));
        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(6,24,36));
        browser.getSettings().setJavaScriptEnabled(true);
        browser.getSettings().setDomStorageEnabled(true);
        browser.getSettings().setAllowFileAccess(false);
        browser.getSettings().setAllowContentAccess(false);
        browser.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        browser.setWebChromeClient(new WebChromeClient());
        TextView loading = new TextView(this);
        loading.setText("TURKUAZ 3D WEB\n\nYönetim paneli açılıyor...");
        loading.setTextColor(Color.rgb(0,228,223));
        loading.setTextSize(24);
        loading.setGravity(Gravity.CENTER);
        loading.setBackgroundColor(Color.rgb(6,24,36));
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
                loading.setVisibility(View.GONE);
            }
        });
        setContentView(root);
        browser.loadUrl(HOME);
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
