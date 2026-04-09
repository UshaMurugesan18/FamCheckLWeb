package com.familychecklist.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.core.app.NotificationCompat;

import java.util.Locale;

/**
 * Foreground service that:
 * 1. Shows a heads-up / full-screen notification with Snooze + Open buttons
 * 2. Speaks task list aloud using Android native TTS (works with screen off)
 * 3. Plays ringtone
 */
public class AlarmService extends Service implements TextToSpeech.OnInitListener {

    static final String CHANNEL_ID   = "family_alarm_v3";
    static final String ACTION_SNOOZE = "com.familychecklist.app.SNOOZE";
    static final String ACTION_OPEN   = "com.familychecklist.app.OPEN";
    static final int    NOTIF_ID      = 8001;

    private TextToSpeech tts;
    private String pendingSpeech;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && (ACTION_SNOOZE.equals(intent.getAction()) || ACTION_OPEN.equals(intent.getAction()))) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String memberName    = intent != null ? intent.getStringExtra("memberName")    : "";
        String groupName     = intent != null ? intent.getStringExtra("groupName")     : "your tasks";
        String assignmentId  = intent != null ? intent.getStringExtra("assignmentId")  : "";
        int    snoozeCount   = intent != null ? intent.getIntExtra("snoozeCount", 0)   : 0;
        int    alarmInterval = intent != null ? intent.getIntExtra("alarmInterval", 5) : 5;

        if (memberName == null) memberName = "";
        if (groupName == null)  groupName  = "your tasks";

        createChannel();
        Notification notif = buildNotification(memberName, groupName, assignmentId, snoozeCount, alarmInterval);
        startForeground(NOTIF_ID, notif);

        // Build TTS text
        pendingSpeech = "Hi " + (memberName.isEmpty() ? "there" : memberName)
                + ", time to complete your " + groupName + " tasks.";

        tts = new TextToSpeech(this, this);
        return START_NOT_STICKY;
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && pendingSpeech != null) {
            tts.setLanguage(Locale.US);
            tts.setSpeechRate(0.85f);
            tts.speak(pendingSpeech, TextToSpeech.QUEUE_FLUSH, null, "alarm_utt");
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String utteranceId) {}
                @Override public void onDone(String utteranceId)  { stopSelf(); }
                @Override public void onError(String utteranceId) { stopSelf(); }
            });
        } else {
            stopSelf();
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

            Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Family Task Alarms", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Rings when your tasks are due");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 500, 300, 500});
            ch.setSound(alarmSound, audioAttrs);
            ch.enableLights(true);
            ch.setLightColor(0xFFFF4444);
            nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String memberName, String groupName,
                                           String assignmentId, int snoozeCount, int alarmInterval) {
        // Snooze action
        Intent snoozeIntent = new Intent(this, AlarmActionReceiver.class);
        snoozeIntent.setAction(ACTION_SNOOZE);
        snoozeIntent.putExtra("assignmentId", assignmentId);
        snoozeIntent.putExtra("snoozeCount", snoozeCount);
        snoozeIntent.putExtra("alarmInterval", alarmInterval);
        snoozeIntent.putExtra("memberName", memberName);
        snoozeIntent.putExtra("groupName", groupName);
        PendingIntent snoozePi = PendingIntent.getBroadcast(this, 1, snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Open app action
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 2, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Full-screen intent — shows over lock screen
        PendingIntent fullScreenPi = PendingIntent.getActivity(this, 3, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String name = memberName.isEmpty() ? "there" : memberName;
        int snoozesLeft = 3 - snoozeCount;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("\uD83D\uDD14 " + groupName + " — Time for your tasks!")
                .setContentText("Hi " + name + "! Your tasks are waiting.")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setFullScreenIntent(fullScreenPi, true)
                .setContentIntent(openPi);

        if (snoozesLeft > 0) {
            builder.addAction(android.R.drawable.ic_media_pause,
                    "\uD83D\uDE34 Snooze " + alarmInterval + "min (" + snoozesLeft + " left)",
                    snoozePi);
        }
        builder.addAction(android.R.drawable.ic_menu_view, "\u2713 Open App", openPi);

        return builder.build();
    }

    @Override
    public void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
