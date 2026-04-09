package com.familychecklist.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service for task alarms.
 *
 * When screen is OFF  → fullScreenIntent fires AlarmActivity directly over lock screen.
 * When screen is ON   → heads-up banner appears; it is ONGOING (cannot be swiped away).
 *                        User MUST tap it → AlarmActivity opens.
 * Either way the AlarmActivity loops TTS voice every 30s until Snooze/Open is tapped.
 */
public class AlarmService extends Service {

    static final String CHANNEL_ID = "family_alarm_v5";
    static final int    NOTIF_ID   = 8001;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannel();

        Bundle extras = (intent != null && intent.getExtras() != null)
                ? intent.getExtras() : new Bundle();
        String groupName  = extras.getString("groupName",  "Tasks");
        String memberName = extras.getString("memberName", "");

        // AlarmActivity intent — used both for fullScreenIntent and tap action
        Intent activityIntent = new Intent(this, AlarmActivity.class);
        activityIntent.putExtras(extras);
        activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent alarmPi = PendingIntent.getActivity(this, 0, activityIntent, piFlags);

        String name  = memberName.isEmpty() ? "there" : memberName;
        String title = "\uD83D\uDD14 Task Alarm — " + groupName;
        String body  = "Hi " + name + "! Tap to open your task alarm.";

        Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)        // heads-up banner
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)  // shows on lock screen
                .setFullScreenIntent(alarmPi, true)                   // fires over lock screen
                .setContentIntent(alarmPi)                            // tap when screen is on
                .setOngoing(true)                                     // CANNOT be swiped away
                .setAutoCancel(false)
                .addAction(android.R.drawable.ic_menu_view,
                        "\u25B6 Open Alarm", alarmPi)                // big action button
                .build();

        startForeground(NOTIF_ID, notif);
        return START_NOT_STICKY;
    }

    public static void dismiss(android.content.Context ctx) {
        ctx.stopService(new Intent(ctx, AlarmService.class));
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTIF_ID);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            // Remove old channels
            nm.deleteNotificationChannel("family_alarm_v3");
            nm.deleteNotificationChannel("family_alarm_v4");
            nm.deleteNotificationChannel("family_alarm_silent");
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Task Alarms",
                    NotificationManager.IMPORTANCE_HIGH); // HIGH = heads-up banner
            ch.setSound(null, null);   // no sound — TTS is the sound
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 400, 200, 400});
            ch.setBypassDnd(true);     // fires even in Do Not Disturb
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
