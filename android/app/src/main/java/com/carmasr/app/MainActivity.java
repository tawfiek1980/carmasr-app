package com.carmasr.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        handlePushLaunch(getIntent());
        handleDeepLink(getIntent());
    }

    /**
     * لو التطبيق كان مقفول تمامًا واتفتح بالضغط على إشعار FCM، الـonCreate هو اللي بيشتغل
     * (مش onNewIntent)، فإضافة الإشعارات بتفوّت الضغطة. هنا بنقرأ بيانات الإشعار مباشرة
     * وبنوجّه الـWebView لنفس المسار اللي الإشعار كان المفروض يفتحه.
     */
    private void handlePushLaunch(Intent intent) {
        if (intent == null || bridge == null) return;
        if (!intent.hasExtra("google.message_id")) return;
        if (intent.getData() != null) return; // دي App Link مش إشعار
        String url = intent.getStringExtra("url");
        if (url == null || url.isEmpty()) url = intent.getStringExtra("path");
        if (url == null || url.isEmpty() || !url.startsWith("/")) return;
        final String fullUrl = "https://tareeq-eg.vercel.app" + url;
        bridge.getWebView().post(() -> bridge.getWebView().loadUrl(fullUrl));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    private void handleDeepLink(Intent intent) {
        if (intent == null || bridge == null) return;
        Uri data = intent.getData();
        if (data == null) return;
        String host = data.getHost();
        if (host == null || !host.endsWith("tareeq-eg.vercel.app")) return;
        String url = data.toString();
        if (url.startsWith("http://")) url = "https://" + url.substring(7);
        final String finalUrl = url;
        bridge.getWebView().post(() -> bridge.getWebView().loadUrl(finalUrl));
    }
}

