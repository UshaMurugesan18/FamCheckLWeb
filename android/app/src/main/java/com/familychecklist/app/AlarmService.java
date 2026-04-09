package com.familychecklist.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that shows the alarm.
 *
 * Two notifications are used:
 *  1. KEEPALIVE (LOW importance) — required by Android for foreground services.
 *     Never shows a banner. Just keeps the process alive.
 *  2. TRIGGER (HIGH importance + fullScreenIntent) — causes Android to launch
 *     AlarmActivity full-screen. AlarmActivity cancels this immediately on open
 *     so the banner disappears in < 1 second.
 *
 * The TRIGGER notification is skipped when the user is already inside the app
 * (MainActivity.isInForeground == true).
 */
public class AlarmService extends Service {

    static final String LOW_CHANNEL_ID  = "family_alarm_low_v1";
    static final String HIGH_CHANNEL_ID = "family_alarm_high_v1";
    static final int    KEEPALIVE_ID    = 8001;
    static final int    TRIGGER_ID      = 8002;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();

        Bundle extras = (intent != null && intent.getExtras() != null)
                ? intent.getExtras() : new Bundle();
        String groupName  = extras.getString("groupName",  "Tasks");
        String memberName = extras.getString("memberName", "");

        // 1. Silent keepalive — no banner, no sound. Required to run as foreground service.
        Notification keepalive = new NotificationCompat.Builder(this, LOW_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Checklist alarm running")
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setOngoing(true)
                .setSilent(true)
                .build();
        startForeground(KEEPALIVE_ID, keepalive);

        // 2. Trigger notification — only when user is NOT inside our app.
        //    fullScreenIntent makes Android launch AlarmActivity automatically.
        //    AlarmActivity cancels this notification immediately on open.
        if (!MainActivity.isInForeground) {
            Intent activityIntent = new Intent(this, AlarmActivity.class);
            activityIntent.putExtras(extras);
            activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP);

            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                    | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getActivity(this, 0, activityIntent, piFlags);

            String name = memberName.isEmpty() ? "there" : memberName;
            Notification trigger = new NotificationCompat.Builder(this, HIGH_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                    .setContentTitle("\uD83D\uDD14 Task Alarm \u2014 " + groupName)
                    .setContentText("Hi " + name + "! Your tasks are due.")
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setFullScreenIntent(pi, true)   // <-- launches AlarmActivity full-screen
                    .setContentIntent(pi)            // tap fallback if fullScreen is blocked
                    .setOngoing(false)
                    .setAutoCancel(true)
                    .build();

            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(TRIGGER_ID, trigger);
        }

        return START_NOT_STICKY;
    }

    public static void dismiss(Context ctx) {
        ctx.stopService(new Intent(ctx, AlarmService.class));
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(KEEPALIVE_ID);
            nm.cancel(TRIGGER_ID);
        }
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            // Remove old channels
            nm.deleteNotificationChannel("family_alarm_v3");
            nm.deleteNotificationChannel("family_alarm_v4");
            nm.deleteNotificationChannel("family_alarm_v5");
            nm.deleteNotificationChannel("family_alarm_v6");
            nm.deleteNotificationChannel("family_alarm_silent");
            nm.deleteNotificationChannel("family_alarm_silent_v1");

            // LOW channel — keepalive, never shows banner
            if (nm.getNotificationChannel(LOW_CHANNEL_ID) == null) {
                NotificationChannel low = new NotificationChannel(
                        LOW_CHANNEL_ID, "Alarm Keepalive",
                        NotificationManager.IMPORTANCE_LOW);
                low.setSound(null, null);
                low.enableVibration(false);
                low.setShowBadge(false);
                nm.createNotificationChannel(low);
            }

            // HIGH channel — needed for fullScreenIntent to fire AlarmActivity
            if (nm.getNotificationChannel(HIGH_CHANNEL_ID) == null) {
                NotificationChannel high = new NotificationChannel(
                        HIGH_CHANNEL_ID, "Task Alarms",
                        NotificationManager.IMPORTANCE_HIGH);
                high.setSound(null, null);
                high.enableVibration(true);
                high.setVibrationPattern(new long[]{0, 400, 200, 400});
                high.setBypassDnd(true);
                nm.createNotificationChannel(high);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}

