package com.turkuaz3d.web;

import android.app.Activity;
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
    private static final String HOME = "https://turkuaz3d.com/yonetim/?mode=android&layout=5";
    private WebView browser;
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
        browser.getSettings().setDomStorageEnabled(true);
        browser.getSettings().setUseWideViewPort(true);
        browser.getSettings().setLoadWithOverviewMode(false);
        browser.getSettings().setTextZoom(100);
        browser.getSettings().setSupportZoom(false);
        browser.getSettings().setBuiltInZoomControls(false);
        browser.getSettings().setDisplayZoomControls(false);
        browser.setInitialScale(100);
        browser.getSettings().setCacheMode(android.webkit.WebSettings.LOAD_NO_CACHE);
        browser.clearCache(true);
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
            }
        });
        setContentView(root);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) root.requestApplyInsets();
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
