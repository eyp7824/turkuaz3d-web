package com.turkuaz3d.web;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restarts live alerts after a phone reboot or an app update. */
public final class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String action = intent == null ? "" : String.valueOf(intent.getAction());
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
                Intent.ACTION_MY_PACKAGE_REPLACED.equals(action))
            LiveAlertService.start(context);
    }
}
