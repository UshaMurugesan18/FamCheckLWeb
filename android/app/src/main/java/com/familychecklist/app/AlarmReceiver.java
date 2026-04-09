package com.familychecklist.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

/**
 * Receives alarm broadcasts from AlarmManager.
 *
 * AlarmManager grants this receiver a Background Activity Launch (BAL) token,
 * so we can start AlarmActivity directly from here without a notification banner.
 * This works for all 3 cases:
 *   1. Phone locked  — FLAG_SHOW_WHEN_LOCKED + FLAG_TURN_SCREEN_ON in AlarmActivity wakes screen
 *   2. Another app   — System launches AlarmActivity over it (BAL exemption)
 *   3. Same app      — Skipped (MainActivity.isInForeground == true)
 */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Bundle extras = intent.getExtras() != null ? intent.getExtras() : new Bundle();

        // Don't show alarm UI if user is already in our app
        if (!MainActivity.isInForeground) {
            Intent alarmIntent = new Intent(context, AlarmActivity.class);
            alarmIntent.putExtras(extras);
            alarmIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_ACTIVITY_CLEAR_TOP |
                    Intent.FLAG_ACTIVITY_SINGLE_TOP);
            context.startActivity(alarmIntent);
        }

        // Always start AlarmService — keeps process alive during alarm
        Intent serviceIntent = new Intent(context, AlarmService.class);
        serviceIntent.putExtras(extras);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
