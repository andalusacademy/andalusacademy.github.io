package com.andalusacademy.secureportal;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import java.util.ArrayList;

public class MainActivity extends Activity {
    private static final int MEDIA_PERMISSION_REQUEST = 4107;
    private static final int FILE_CHOOSER_REQUEST = 4108;
    private static final String APP_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private WebViewAssetLoader assetLoader;
    private WebView webView;
    private PermissionRequest pendingRequest;
    private ValueCallback<Uri[]> filePathCallback;
    private OnBackInvokedCallback backInvokedCallback;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return assetLoader.shouldInterceptRequest(request.getUrl());
                }
            });
        }
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override public android.webkit.WebResourceResponse shouldInterceptRequest(
                WebView view, android.webkit.WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                FileChooserParams fileChooserParams) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent chooserIntent = fileChooserParams.createIntent();
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception exception) {
                    filePathCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }

            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (hasMediaPermissions()) grantRequestedMedia(request);
                    else {
                        pendingRequest = request;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            requestPermissions(new String[] {
                                Manifest.permission.CAMERA,
                                Manifest.permission.RECORD_AUDIO
                            }, MEDIA_PERMISSION_REQUEST);
                        } else request.deny();
                    }
                });
            }
        });
        setContentView(webView);
        if (Build.VERSION.SDK_INT >= 33) {
            backInvokedCallback = this::handleAppBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, backInvokedCallback);
        }
        webView.loadUrl(APP_URL);
    }

    private boolean hasMediaPermissions() {
        return checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
            && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void grantRequestedMedia(PermissionRequest request) {
        ArrayList<String> allowed = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
                && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                allowed.add(resource);
            } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                allowed.add(resource);
            }
        }
        if (allowed.isEmpty()) request.deny();
        else request.grant(allowed.toArray(new String[0]));
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MEDIA_PERMISSION_REQUEST && pendingRequest != null) {
            PermissionRequest request = pendingRequest;
            pendingRequest = null;
            if (hasMediaPermissions()) grantRequestedMedia(request);
            else request.deny();
        }
    }

    @Override protected void onResume() {
        super.onResume();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        if (webView != null) webView.onResume();
    }

    @Override protected void onPause() {
        if (webView != null) {
            // Leaving the Android app while an exam is active is an exam exit.
            // The page also listens for visibilitychange; this native hook is a fallback.
            webView.evaluateJavascript(
                "(function(){if(typeof window.finalizeExamOnExit==='function'){window.finalizeExamOnExit('android_app_background');}})();",
                null
            );
            webView.onPause();
        }
        super.onPause();
    }

    private void handleAppBack() {
        if (webView == null) return;
        // The web app owns navigation: return to the previous portal/page instead of closing the app.
        webView.evaluateJavascript(
            "(function(){if(typeof window.andalusGoBack==='function'){window.andalusGoBack();}else if(window.history.length>1){window.history.back();}})();",
            null);
    }

    @Override public void onBackPressed() {
        handleAppBack();
    }

    @Override protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backInvokedCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backInvokedCallback);
            backInvokedCallback = null;
        }
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
