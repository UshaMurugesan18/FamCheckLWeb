package com.familychecklist.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Receives Snooze / Open button taps from the alarm notification.
 * Stops the AlarmService (dismisses alarm sound/TTS).
 * The JS layer handles rescheduling via the normal 30-second poll.
 */
public class AlarmActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // Stop the foreground service (stops TTS + dismisses ongoing notification)
        Intent stopIntent = new Intent(context, AlarmService.class);
        stopIntent.setAction(intent.getAction());
        context.stopService(stopIntent);
    }
}
