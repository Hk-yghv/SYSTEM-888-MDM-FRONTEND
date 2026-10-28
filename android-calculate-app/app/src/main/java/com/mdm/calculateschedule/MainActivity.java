package com.mdm.calculateschedule;

import android.annotation.SuppressLint;
import android.Manifest;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

import java.io.IOException;
import java.io.OutputStream;

public class MainActivity extends AppCompatActivity {

    private static final int CAMERA_PERMISSION_REQUEST = 1001;
    private static final int STORAGE_PERMISSION_REQUEST = 1002;
    private WebView webView;
    private PermissionRequest pendingCameraRequest;
    private byte[] pendingImage;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setBuiltInZoomControls(false);
        webSettings.setDisplayZoomControls(false);

        // Add JavaScript bridge for native share & clipboard support
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean requestsCamera = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            requestsCamera = true;
                        } else {
                            request.deny();
                            return;
                        }
                    }
                    if (!requestsCamera) {
                        request.deny();
                        return;
                    }
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                            || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                        return;
                    }
                    if (pendingCameraRequest != null) {
                        pendingCameraRequest.deny();
                    }
                    pendingCameraRequest = request;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                });
            }
        });

        // Load 100% offline local HTML asset
        webView.loadUrl("file:///android_asset/www/index.html");

        // Handle Back button
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                webView.evaluateJavascript(
                        "window.handleAppBack ? window.handleAppBack() : false",
                        handled -> {
                            if ("true".equals(handled)) {
                                return;
                            }
                            if (webView.canGoBack()) {
                                webView.goBack();
                            } else {
                                finish();
                            }
                        }
                );
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            PermissionRequest request = pendingCameraRequest;
            pendingCameraRequest = null;
            if (request != null) {
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                } else {
                    request.deny();
                    Toast.makeText(this, "សូមអនុញ្ញាតសិទ្ធិ Camera ដើម្បីថតរូប", Toast.LENGTH_LONG).show();
                }
            }
        } else if (requestCode == STORAGE_PERMISSION_REQUEST) {
            byte[] image = pendingImage;
            pendingImage = null;
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            boolean saved = granted && image != null && saveImageToGallery(image);
            if (!granted) {
                Toast.makeText(this, "មិនទាន់មានសិទ្ធិរក្សាទុករូបភាពទេ", Toast.LENGTH_LONG).show();
            }
            notifyImageSaveResult(saved);
        }
    }

    @Override
    protected void onDestroy() {
        if (pendingCameraRequest != null) {
            pendingCameraRequest.deny();
            pendingCameraRequest = null;
        }
        super.onDestroy();
    }

    private void saveCapturedImage(String dataUrl) {
        if (dataUrl == null || !dataUrl.startsWith("data:image/jpeg;base64,")) {
            Toast.makeText(this, "ទម្រង់រូបភាពមិនត្រឹមត្រូវ", Toast.LENGTH_LONG).show();
            notifyImageSaveResult(false);
            return;
        }

        final byte[] image;
        try {
            image = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            Toast.makeText(this, "មិនអាចអានទិន្នន័យរូបភាពបានទេ", Toast.LENGTH_LONG).show();
            notifyImageSaveResult(false);
            return;
        }
        if (image.length == 0) {
            Toast.makeText(this, "រូបភាពទទេ មិនអាចរក្សាទុកបានទេ", Toast.LENGTH_LONG).show();
            notifyImageSaveResult(false);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingImage = image;
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, STORAGE_PERMISSION_REQUEST);
            return;
        }
        notifyImageSaveResult(saveImageToGallery(image));
    }

    private boolean saveImageToGallery(byte[] image) {
        String fileName = "id-card-" + System.currentTimeMillis() + ".jpg";
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/MDM Calculate");
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
        }

        final Uri imageUri;
        try {
            imageUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        } catch (SecurityException error) {
            Toast.makeText(this, "គ្មានសិទ្ធិរក្សាទុករូបភាព៖ " + error.getMessage(), Toast.LENGTH_LONG).show();
            return false;
        }
        if (imageUri == null) {
            Toast.makeText(this, "មិនអាចបង្កើតឯកសាររូបភាពបានទេ", Toast.LENGTH_LONG).show();
            return false;
        }
        try (OutputStream output = getContentResolver().openOutputStream(imageUri)) {
            if (output == null) {
                throw new IOException("Unable to open image destination");
            }
            output.write(image);
            output.flush();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues completed = new ContentValues();
                completed.put(MediaStore.Images.Media.IS_PENDING, 0);
                getContentResolver().update(imageUri, completed, null, null);
            }
            Toast.makeText(this, "បានរក្សាទុករូបភាពក្នុង Photos", Toast.LENGTH_LONG).show();
            return true;
        } catch (IOException | SecurityException error) {
            getContentResolver().delete(imageUri, null, null);
            Toast.makeText(this, "រក្សាទុករូបភាពមិនបាន៖ " + error.getMessage(), Toast.LENGTH_LONG).show();
            return false;
        }
    }

    private void notifyImageSaveResult(boolean success) {
        if (webView == null) {
            return;
        }
        String script = "document.getElementById('cameraFrame')?.contentWindow?.postMessage("
                + "{ type: 'camera-image-save-result', success: " + success + " }, '*')";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    // Bridge class exposed to JavaScript in index.html
    public static class WebAppInterface {
        private final MainActivity activity;
        private final Context mContext;

        WebAppInterface(MainActivity activity) {
            this.activity = activity;
            mContext = activity;
        }

        @JavascriptInterface
        public void copyToClipboard(String text) {
            ClipboardManager clipboard = (ClipboardManager) mContext.getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = ClipData.newPlainText("MDM Calculate Summary", text);
            if (clipboard != null) {
                clipboard.setPrimaryClip(clip);
                Toast.makeText(mContext, "បានចម្លងរួចរាល់! Copied to clipboard", Toast.LENGTH_SHORT).show();
            }
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            Intent sendIntent = new Intent();
            sendIntent.setAction(Intent.ACTION_SEND);
            sendIntent.putExtra(Intent.EXTRA_TEXT, text);
            sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            sendIntent.setType("text/plain");

            Intent shareIntent = Intent.createChooser(sendIntent, "ចែករំលែកតារាងគណនា (Share Calculation)");
            shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            mContext.startActivity(shareIntent);
        }

        @JavascriptInterface
        public void showToast(String message) {
            Toast.makeText(mContext, message, Toast.LENGTH_SHORT).show();
        }

        @JavascriptInterface
        public void saveImage(String dataUrl) {
            activity.runOnUiThread(() -> activity.saveCapturedImage(dataUrl));
        }
    }
}
