package de.bausteinideen.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Hauptfenster: zeigt die App (HTML/JS aus assets/www) in einer WebView
 * und stellt Kamera, Galerie, Erkennung und Speicher bereit.
 */
public class MainActivity extends Activity {

    private static final int REQ_CAMERA = 1;
    private static final int REQ_GALLERY = 2;
    private static final int MAX_SIDE = 1600;
    private static final String[] API = {
            "https://api.brickognize.com/predict/parts/",
            "https://api.brickognize.com/predict/"
    };

    private WebView web;
    private File photoFile;
    private boolean pageReady = false;
    private final List<String> pendingJs = new ArrayList<>();
    private final ExecutorService pool = Executors.newFixedThreadPool(3);

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null && state.getString("photo") != null) {
            photoFile = new File(state.getString("photo"));
        }

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.setBackgroundColor(0xFFFFF6E5);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                for (String js : pendingJs) web.evaluateJavascript(js, null);
                pendingJs.clear();
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        web.loadUrl("file:///android_asset/www/index.html");
        setContentView(web);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (photoFile != null) out.putString("photo", photoFile.getAbsolutePath());
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.app && app.onBack()) === true", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onDestroy() {
        pool.shutdownNow();
        super.onDestroy();
    }

    /** JavaScript im WebView ausführen (wartet, bis die Seite geladen ist) */
    private void callJs(final String script) {
        runOnUiThread(() -> {
            if (pageReady) web.evaluateJavascript(script, null);
            else pendingJs.add(script);
        });
    }

    // ------------------------------------------------------------------
    // Kamera und Galerie
    // ------------------------------------------------------------------
    private void startCamera() {
        try {
            File dir = new File(getCacheDir(), "photos");
            if (!dir.exists()) dir.mkdirs();
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) f.delete();
            photoFile = new File(dir, "foto_" + System.currentTimeMillis() + ".jpg");
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photoFile);
            Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            i.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            i.setClipData(ClipData.newRawUri("", uri));
            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(i, REQ_CAMERA);
        } catch (ActivityNotFoundException e) {
            callJs("app.onPhotoError('Keine Kamera-App gefunden')");
        } catch (Exception e) {
            callJs("app.onPhotoError(" + JSONObject.quote("Kamera-Fehler: " + e.getMessage()) + ")");
        }
    }

    private void startGallery() {
        try {
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.setType("image/*");
            i.addCategory(Intent.CATEGORY_OPENABLE);
            startActivityForResult(Intent.createChooser(i, "Foto auswählen"), REQ_GALLERY);
        } catch (Exception e) {
            callJs("app.onPhotoError('Keine Galerie-App gefunden')");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_CAMERA && requestCode != REQ_GALLERY) return;
        if (resultCode != RESULT_OK) {
            callJs("app.onPhotoCancel()");
            return;
        }
        final Uri src;
        if (requestCode == REQ_CAMERA) {
            src = photoFile != null ? Uri.fromFile(photoFile) : null;
        } else {
            src = data != null ? data.getData() : null;
        }
        if (src == null) {
            callJs("app.onPhotoError('Kein Foto erhalten')");
            return;
        }
        callJs("window.app && app.onPhotoLoading && app.onPhotoLoading()");
        pool.submit(() -> {
            try {
                String dataUrl = loadScaled(src);
                callJs("app.onPhoto('" + dataUrl + "')");
            } catch (Throwable t) {
                callJs("app.onPhotoError(" + JSONObject.quote("Foto konnte nicht gelesen werden") + ")");
            }
        });
    }

    /** Foto laden, richtig drehen, verkleinern und als JPEG-Daten-URL zurückgeben */
    private String loadScaled(Uri uri) throws Exception {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(in, null, bounds);
        }
        int sample = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2;
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        Bitmap bmp;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            bmp = BitmapFactory.decodeStream(in, null, opts);
        }
        if (bmp == null) throw new Exception("decode");

        int rotation = 0;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            ExifInterface exif = new ExifInterface(in);
            int o = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            if (o == ExifInterface.ORIENTATION_ROTATE_90) rotation = 90;
            else if (o == ExifInterface.ORIENTATION_ROTATE_180) rotation = 180;
            else if (o == ExifInterface.ORIENTATION_ROTATE_270) rotation = 270;
        } catch (Exception ignored) {
        }

        float scale = Math.min(1f, (float) MAX_SIDE / Math.max(bmp.getWidth(), bmp.getHeight()));
        if (rotation != 0 || scale < 1f) {
            Matrix m = new Matrix();
            m.postScale(scale, scale);
            m.postRotate(rotation);
            Bitmap b2 = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), m, true);
            if (b2 != bmp) bmp.recycle();
            bmp = b2;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, 86, out);
        bmp.recycle();
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    // ------------------------------------------------------------------
    // Erkennung über Brickognize
    // ------------------------------------------------------------------
    private void doRecognize(String reqId, String dataUrl) {
        String b64 = dataUrl;
        int comma = b64.indexOf(',');
        if (b64.startsWith("data:") && comma > 0) b64 = b64.substring(comma + 1);
        byte[] bytes;
        try {
            bytes = Base64.decode(b64, Base64.DEFAULT);
        } catch (Exception e) {
            sendResult(reqId, false, "Bild fehlerhaft");
            return;
        }
        String lastError = "Keine Verbindung";
        for (String api : API) {
            HttpURLConnection c = null;
            try {
                String boundary = "----BausteinIdeen" + System.nanoTime();
                c = (HttpURLConnection) new URL(api).openConnection();
                c.setConnectTimeout(15000);
                c.setReadTimeout(40000);
                c.setDoOutput(true);
                c.setRequestMethod("POST");
                c.setRequestProperty("Accept", "application/json");
                c.setRequestProperty("User-Agent", "Baustein-Ideen-App/1.0");
                c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                try (OutputStream os = c.getOutputStream()) {
                    String head = "--" + boundary + "\r\n"
                            + "Content-Disposition: form-data; name=\"query_image\"; filename=\"stein.jpg\"\r\n"
                            + "Content-Type: image/jpeg\r\n\r\n";
                    os.write(head.getBytes("UTF-8"));
                    os.write(bytes);
                    os.write(("\r\n--" + boundary + "--\r\n").getBytes("UTF-8"));
                }
                int code = c.getResponseCode();
                InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
                String body = readAll(is);
                if (code == 404 || code == 405) {
                    lastError = "HTTP " + code;
                    continue;
                }
                if (code >= 200 && code < 300) {
                    sendResult(reqId, true, body);
                    return;
                }
                lastError = "Dienst antwortet mit Fehler " + code;
            } catch (Exception e) {
                lastError = "Keine Verbindung zum Erkennungsdienst";
            } finally {
                if (c != null) c.disconnect();
            }
        }
        sendResult(reqId, false, lastError);
    }

    private void sendResult(String reqId, boolean ok, String body) {
        callJs("window.NativeBridge && NativeBridge.onRecognize(" + JSONObject.quote(reqId) + ","
                + (ok ? "true" : "false") + "," + JSONObject.quote(body == null ? "" : body) + ")");
    }

    private static String readAll(InputStream is) throws Exception {
        if (is == null) return "";
        try (InputStream in = is) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    // ------------------------------------------------------------------
    // Schnittstelle, die JavaScript als "window.Android" sieht
    // ------------------------------------------------------------------
    private class Bridge {
        @JavascriptInterface
        public void takePhoto() {
            runOnUiThread(MainActivity.this::startCamera);
        }

        @JavascriptInterface
        public void pickImage() {
            runOnUiThread(MainActivity.this::startGallery);
        }

        @JavascriptInterface
        public void recognize(final String reqId, final String dataUrl) {
            pool.submit(() -> doRecognize(reqId, dataUrl));
        }

        @JavascriptInterface
        public void saveData(String json) {
            SharedPreferences p = getSharedPreferences("daten", MODE_PRIVATE);
            p.edit().putString("state", json).apply();
        }

        @JavascriptInterface
        public String loadData() {
            return getSharedPreferences("daten", MODE_PRIVATE).getString("state", "");
        }

        @JavascriptInterface
        public void toast(final String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }
    }
}
