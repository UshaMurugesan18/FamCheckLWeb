package com.familychecklist.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that:
 * 1. Calls startForeground(LOW) so Android keeps process alive (mandatory).
 * 2. Directly calls startActivity(AlarmActivity) — works when BAL token present.
 * 3. Posts a HIGH+fullScreenIntent notification as fallback for lock screen / Android 15.
 * 4. AlarmActivity cancels the HIGH notification on open so banner disappears.
 */
public class AlarmService extends Service {

    static final String LOW_CHANNEL_ID  = "family_alarm_low_v2";
    static final String HIGH_CHANNEL_ID = "family_alarm_high_v2";
    static final int    NOTIF_ID        = 8001;
    static final int    TRIGGER_ID      = 8002;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();

        Bundle extras = (intent != null && intent.getExtras() != null)
                ? intent.getExtras() : new Bundle();
        String groupName  = extras.getString("groupName",  "Tasks");
        String memberName = extras.getString("memberName", "");

        // ── Step 1: silent keepalive (mandatory foreground notification) ──────
        Notification keepalive = new NotificationCompat.Builder(this, LOW_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Checklist alarm")
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setOngoing(true)
                .setSilent(true)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, keepalive, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIF_ID, keepalive);
        }

        // Don't show alarm UI if user is already inside our app
        if (MainActivity.isInForeground) return START_NOT_STICKY;

        Intent alarmIntent = new Intent(this, AlarmActivity.class);
        alarmIntent.putExtras(extras);
        alarmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent alarmPi = PendingIntent.getActivity(this, 0, alarmIntent, piFlags);

        // ── Step 2: try direct startActivity (works with BAL token on many devices) ──
        try { startActivity(alarmIntent); } catch (Exception ignored) {}

        // ── Step 3: fullScreenIntent fallback (guaranteed on Android 14/15 with permission) ──
        String name = memberName.isEmpty() ? "there" : memberName;
        Notification trigger = new NotificationCompat.Builder(this, HIGH_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("\uD83D\uDD14 " + groupName + " tasks")
                .setContentText("Hi " + name + "! Time to check your tasks.")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(alarmPi, true)
                .setContentIntent(alarmPi)
                .setOngoing(false)
                .setAutoCancel(true)
                .build();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(TRIGGER_ID, trigger);

        return START_NOT_STICKY;
    }

    public static void dismiss(Context ctx) {
        ctx.stopService(new Intent(ctx, AlarmService.class));
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) { nm.cancel(NOTIF_ID); nm.cancel(TRIGGER_ID); }
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            for (String old : new String[]{
                    "family_alarm_v3","family_alarm_v4","family_alarm_v5","family_alarm_v6",
                    "family_alarm_silent","family_alarm_silent_v1",
                    "family_alarm_high_v1","family_alarm_low_v1"}) {
                nm.deleteNotificationChannel(old);
            }
            if (nm.getNotificationChannel(LOW_CHANNEL_ID) == null) {
                NotificationChannel low = new NotificationChannel(
                        LOW_CHANNEL_ID, "Alarm Keepalive", NotificationManager.IMPORTANCE_LOW);
                low.setSound(null, null); low.enableVibration(false); low.setShowBadge(false);
                nm.createNotificationChannel(low);
            }
            if (nm.getNotificationChannel(HIGH_CHANNEL_ID) == null) {
                NotificationChannel high = new NotificationChannel(
                        HIGH_CHANNEL_ID, "Task Alarms", NotificationManager.IMPORTANCE_HIGH);
                high.setSound(null, null);
                high.enableVibration(true);
                high.setVibrationPattern(new long[]{0, 500, 200, 500});
                high.setBypassDnd(true);
                nm.createNotificationChannel(high);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
