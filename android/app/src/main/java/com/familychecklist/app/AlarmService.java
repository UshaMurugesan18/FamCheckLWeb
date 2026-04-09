package com.familychecklist.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Silent foreground service — keeps process alive while AlarmActivity is showing.
 * AlarmActivity is launched directly from AlarmReceiver (via setAlarmClock BAL exemption).
 * This service only exists because Android requires a foreground service notification.
 * IMPORTANCE_LOW = no banner, no sound.
 */
public class AlarmService extends Service {

    static final String CHANNEL_ID  = "family_alarm_low_v1";
    static final int    NOTIF_ID    = 8001;
    static final int    TRIGGER_ID  = 8002; // kept for cancellation in AlarmActivity

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannel();
        Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Checklist alarm running")
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setOngoing(true)
                .setSilent(true)
                .build();
        startForeground(NOTIF_ID, notif);
        return START_NOT_STICKY;
    }

    public static void dismiss(Context ctx) {
        ctx.stopService(new Intent(ctx, AlarmService.class));
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIF_ID);
            nm.cancel(TRIGGER_ID);
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            // Clean up old channels
            for (String old : new String[]{
                    "family_alarm_v3","family_alarm_v4","family_alarm_v5","family_alarm_v6",
                    "family_alarm_silent","family_alarm_silent_v1",
                    "family_alarm_high_v1","family_alarm_low_v1"}) {
                nm.deleteNotificationChannel(old);
            }
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Alarm Keepalive",
                    NotificationManager.IMPORTANCE_LOW);
            ch.setSound(null, null);
            ch.enableVibration(false);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
