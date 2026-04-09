package com.familychecklist.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Receives alarm broadcasts from AlarmManager and starts AlarmService.
 * AlarmService handles launching AlarmActivity via fullScreenIntent.
 */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent serviceIntent = new Intent(context, AlarmService.class);
        if (intent.getExtras() != null) serviceIntent.putExtras(intent.getExtras());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
