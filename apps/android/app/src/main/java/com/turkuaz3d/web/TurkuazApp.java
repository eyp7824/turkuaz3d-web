package com.turkuaz3d.web;

import android.app.Application;

public class TurkuazApp extends Application {
    @Override public void onCreate() {
        super.onCreate();
        PushHelper.initializeFromSavedConfig(this);
    }
}
