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

    static final String CHANNEL_ID        = "family_alarm_v5";
    static final String SILENT_CHANNEL_ID = "family_alarm_silent_v1";
    static final int    NOTIF_ID          = 8001;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();

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

        // fullScreenIntent is the key — Android system launches AlarmActivity directly,
        // bypassing the heads-up banner, when the notification fires.
        Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(alarmPi, true)   // launches AlarmActivity full-screen
                .setContentIntent(alarmPi)
                .setOngoing(true)
                .setAutoCancel(false)
                .build();

        startForeground(NOTIF_ID, notif);

        // Also try direct launch — works when:
        //   • app is already in foreground (same-app case)
        //   • Android < 12 with foreground service
        //   • screen is off (with FLAG_TURN_SCREEN_ON in AlarmActivity)
        try {
            startActivity(activityIntent);
        } catch (Exception ignored) {}

        return START_NOT_STICKY;
    }

    public static void dismiss(android.content.Context ctx) {
        ctx.stopService(new Intent(ctx, AlarmService.class));
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTIF_ID);
    }

    /**
     * Called from AlarmActivity.onCreate() the moment it becomes visible.
     * Replaces the high-priority heads-up notification with a silent background one
     * so the user only ever sees the full-screen alarm UI — no banner on top.
     */
    static void makeSilent(android.content.Context ctx) {
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(
                ctx, 1, new Intent(ctx, AlarmActivity.class), piFlags);
        Notification silent = new NotificationCompat.Builder(ctx, SILENT_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Alarm active")
                .setOngoing(true)
                .setAutoCancel(false)
                .setSilent(true)
                .setContentIntent(pi)
                .build();
        nm.notify(NOTIF_ID, silent);
    }

    private void createChannelss() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.deleteNotificationChannel("family_alarm_v3");
            nm.deleteNotificationChannel("family_alarm_v4");
            nm.deleteNotificationChannel("family_alarm_silent");

            // HIGH importance — required so fullScreenIntent auto-launches AlarmActivity
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "Task Alarms",
                        NotificationManager.IMPORTANCE_HIGH);
                ch.setSound(null, null);
                ch.enableVibration(true);
                ch.setVibrationPattern(new long[]{0, 400, 200, 400});
                ch.setBypassDnd(true);
                nm.createNotificationChannel(ch);
            }

            // IMPORTANCE_MIN — no banner, no sound; used after AlarmActivity is visible
            if (nm.getNotificationChannel(SILENT_CHANNEL_ID) == null) {
                NotificationChannel silent = new NotificationChannel(
                        SILENT_CHANNEL_ID, "Alarm Background",
                        NotificationManager.IMPORTANCE_MIN);
                silent.setSound(null, null);
                silent.enableVibration(false);
                silent.setShowBadge(false);
                nm.createNotificationChannel(silent);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
