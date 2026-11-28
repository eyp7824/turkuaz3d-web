package com.turkuaz3d.web;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** App-private credentials encrypted by the Android hardware-backed keystore where supported.
 *  These are retained on ordinary app closes and upgrades with the same signing identity.
 *  Uninstalling the app removes its secure store and Android Keystore entry. */
public final class NativeVault {
    private static final String ALIAS = "turkuaz3d_web_device_auth_v1";
    private static final String PREFS = "turkuaz_native_credentials_v1";
    private NativeVault() {}
    private static boolean slotOk(String slot) {
        return "analytics".equals(slot) || "github".equals(slot);
    }
    private static SecretKey secret() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) {
            return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return generator.generateKey();
    }
    public static synchronized String read(Context context, String slot) {
        if (!slotOk(slot)) return "";
        try {
            String b64=context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(slot, "");
            if (b64.isEmpty()) return "";
            byte[] data=Base64.decode(b64,Base64.NO_WRAP);
            if(data.length<29) return "";
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,secret(),new GCMParameterSpec(128,Arrays.copyOfRange(data,0,12)));
            return new String(cipher.doFinal(data,12,data.length-12),StandardCharsets.UTF_8);
        }catch(Exception exception){return "";}
    }
    public static synchronized boolean save(Context context, String slot, String value) {
        if (!slotOk(slot) || value == null || value.length() > 2048) return false;
        if(value.isEmpty())return clear(context,slot);
        try {
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,secret());
            byte[] iv=cipher.getIV();
            byte[] encrypted=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            byte[] combined=new byte[iv.length+encrypted.length];
            System.arraycopy(iv,0,combined,0,iv.length);
            System.arraycopy(encrypted,0,combined,iv.length,encrypted.length);
            return context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
                    .putString(slot,Base64.encodeToString(combined,Base64.NO_WRAP)).commit();
        }catch(Exception exception){return false;}
    }
    public static synchronized boolean clear(Context context, String slot) {
        if(!slotOk(slot))return false;
        return context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().remove(slot).commit();
    }
}
