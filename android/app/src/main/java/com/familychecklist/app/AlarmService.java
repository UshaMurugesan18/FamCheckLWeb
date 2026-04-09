package com.familychecklist.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service — keeps the app process alive while AlarmActivity is showing.
 * Uses IMPORTANCE_LOW so NO heads-up banner is ever shown.
 * AlarmActivity is launched directly from AlarmReceiver (not from here).
 */
public class AlarmService extends Service {

    static final String CHANNEL_ID = "family_alarm_v6";
    static final int    NOTIF_ID   = 8001;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannel();
        Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Checklist alarm active")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setAutoCancel(false)
                .setSilent(true)
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
            // Delete old high-importance channels so they don't linger
            nm.deleteNotificationChannel("family_alarm_v3");
            nm.deleteNotificationChannel("family_alarm_v4");
            nm.deleteNotificationChannel("family_alarm_v5");
            nm.deleteNotificationChannel("family_alarm_silent");
            nm.deleteNotificationChannel("family_alarm_silent_v1");
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Alarm Keepalive",
                    NotificationManager.IMPORTANCE_LOW); // LOW = no banner, no sound
            ch.setSound(null, null);
            ch.enableVibration(false);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
