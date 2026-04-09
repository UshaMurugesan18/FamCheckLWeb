package com.familychecklist.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** True when user is actively using this app. AlarmReceiver skips alarm UI when true. */
    public static volatile boolean isInForeground = false;

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        isInForeground = true;
    }

    @Override
    public void onPause() {
        super.onPause();
        isInForeground = false;
    }
}
