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
 * Foreground service that launches AlarmActivity (full-screen alarm UI).
 * Required as intermediary because BroadcastReceivers cannot start activities
 * directly on Android 10+ when screen is off.
 */
public class AlarmService extends Service {

    static final String CHANNEL_ID = "family_alarm_v4";
    static final int    NOTIF_ID   = 8001;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannel();

        Notification notif = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("\uD83D\uDD14 Task Alarm")
                .setContentText("Opening alarm screen\u2026")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build();
        startForeground(NOTIF_ID, notif);

        Intent activityIntent = new Intent(this, AlarmActivity.class);
        activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_NO_ANIMATION);
        if (intent != null && intent.getExtras() != null) {
            activityIntent.putExtras(intent.getExtras());
        }
        startActivity(activityIntent);

        stopSelf();
        return START_NOT_STICKY;
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
