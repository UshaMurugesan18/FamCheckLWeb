package com.familychecklist.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that directly launches AlarmActivity as a full-screen overlay.
 * The mandatory foreground notification is silent + low importance (no banner pop-up).
 * AlarmActivity itself covers the screen — no notification interaction needed.
 */
public class AlarmService extends Service {

    // Silent channel for the mandatory foreground notification (no banner)
    static final String SILENT_CHANNEL_ID = "family_alarm_silent";
    static final int    NOTIF_ID          = 8001;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createSilentChannel();

        // Mandatory foreground notification — silent, no pop-up banner
        Notification notif = new NotificationCompat.Builder(this, SILENT_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("\uD83D\uDD14 Task Alarm active")
                .setContentText("Tap to open")
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setSilent(true)
                .setOngoing(true)
                .build();
        startForeground(NOTIF_ID, notif);

        // Launch AlarmActivity directly — no tap needed
        Bundle extras = (intent != null && intent.getExtras() != null)
                ? intent.getExtras() : new Bundle();
        Intent activityIntent = new Intent(this, AlarmActivity.class);
        activityIntent.putExtras(extras);
        activityIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(activityIntent);

        return START_NOT_STICKY;
    }

    public static void dismiss(android.content.Context ctx) {
        ctx.stopService(new Intent(ctx, AlarmService.class));
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(NOTIFICATION_SERVICE);
        nm.cancel(NOTIF_ID);
    }

    private void createSilentChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            // Remove old noisy channels
            nm.deleteNotificationChannel("family_alarm_v3");
            nm.deleteNotificationChannel("family_alarm_v4");
            if (nm.getNotificationChannel(SILENT_CHANNEL_ID) != null) return;
            NotificationChannel ch = new NotificationChannel(
                    SILENT_CHANNEL_ID, "Task Alarm (background)",
                    NotificationManager.IMPORTANCE_MIN); // MIN = no banner, no sound
            ch.setSound(null, null);
            ch.enableVibration(false);
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
