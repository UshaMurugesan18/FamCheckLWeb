package com.familychecklist.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Receives alarm broadcasts from AlarmManager (scheduled with setAlarmClock).
 *
 * setAlarmClock() grants a BAL (Background Activity Launch) exemption — same
 * privilege the system clock app uses. This means startActivity() works from
 * here on ALL Android versions (10, 11, 12, 13, 14, 15) without needing
 * fullScreenIntent or any special permission from the user.
 *
 * Same-app case: skipped when MainActivity.isInForeground == true.
 */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // Skip alarm UI if user is actively using our app right now
        if (!MainActivity.isInForeground) {
            Intent alarmIntent = new Intent(context, AlarmActivity.class);
            if (intent.getExtras() != null) alarmIntent.putExtras(intent.getExtras());
            alarmIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_ACTIVITY_CLEAR_TOP |
                    Intent.FLAG_ACTIVITY_SINGLE_TOP);
            context.startActivity(alarmIntent);
        }

        // Start AlarmService as a silent keepalive so the process stays alive
        Intent serviceIntent = new Intent(context, AlarmService.class);
        if (intent.getExtras() != null) serviceIntent.putExtras(intent.getExtras());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
