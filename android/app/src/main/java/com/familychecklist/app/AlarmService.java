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
 * Foreground service that shows a fullScreenIntent notification.
 * Android delivers the full-screen AlarmActivity over the lock screen automatically.
 * Works even when app is killed / screen is off (Android 10+).
 */
public class AlarmService extends Service {

    static final String CHANNEL_ID = "family_alarm_v4";
    static final int    NOTIF_ID   = 8001;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannel();

        Bundle extras = (intent != null && intent.getExtras() != null)
                ? intent.getExtras() : new Bundle();

        String groupName  = extras.getString("groupName",  "Tasks");
        String memberName = extras.getString("memberName", "");

        // fullScreenIntent — Android shows AlarmActivity over lock screen
        Intent activityIntent = new Intent(this, AlarmActivity.class);
        activityIntent.putExtras(extras);
        activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT |
                (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent fullScreenPi = PendingIntent.getActivity(this, 0, activityIntent, piFlags);

        String title = "\uD83D\uDD14 " + groupName;
        String body  = "Hi " + (memberName.isEmpty() ? "there" : memberName) + "! Time for your tasks.";

        Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(fullScreenPi, true)
                .setOngoing(true)
                .setAutoCancel(false)
                .build();

        startForeground(NOTIF_ID, notif);
        // Service stays running; AlarmActivity calls stopService() when user acts
        return START_NOT_STICKY;
    }

    public static void dismiss(android.content.Context ctx) {
        ctx.stopService(new Intent(ctx, AlarmService.class));
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        nm.cancel(NOTIF_ID);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.deleteNotificationChannel("family_alarm_v3");
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Family Task Alarms", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 400, 200, 400});
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
