package com.familychecklist.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.view.LayoutInflater;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * Alarm service with two display modes:
 *
 * SCREEN ON  (another app open / phone idle) → WindowManager overlay
 *   Uses SYSTEM_ALERT_WINDOW permission to draw full-screen over ANY app including YouTube.
 *   No Android background-activity restriction applies to WindowManager.addView().
 *
 * SCREEN OFF (phone locked) → fullScreenIntent notification
 *   Android wakes the screen and opens AlarmActivity over the lock screen.
 */
public class AlarmService extends Service implements TextToSpeech.OnInitListener {

    static final String LOW_CHANNEL_ID  = "family_alarm_low_v2";
    static final String HIGH_CHANNEL_ID = "family_alarm_high_v2";
    static final int    NOTIF_ID        = 8001;
    static final int    TRIGGER_ID      = 8002;

    private static final String BASE_URL    = "https://famcheckl-production.up.railway.app";
    private static final int    MAX_SNOOZES = 3;
    private static final long   REPEAT_MS   = 30_000;

    private WindowManager      windowManager;
    private android.view.View  overlayView;
    private TextToSpeech       tts;
    private boolean            dismissed = false;

    private String memberName, groupName, assignmentId, taskListStr;
    private int    snoozeCount, alarmInterval;

    private final Handler  repeatHandler  = new Handler(Looper.getMainLooper());
    private final Runnable repeatRunnable = new Runnable() {
        @Override public void run() {
            if (!dismissed) { speakAlarm(); repeatHandler.postDelayed(this, REPEAT_MS); }
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();

        boolean isKeepalive = intent != null && intent.getBooleanExtra("isKeepalive", false);
        Bundle extras = (intent != null && intent.getExtras() != null)
                ? intent.getExtras() : new Bundle();

        // startForeground must be called immediately (Android requirement)
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

        // Keepalive call from AlarmActivity (lock screen case) — nothing else to do
        if (isKeepalive || MainActivity.isInForeground) return START_NOT_STICKY;

        memberName   = extras.getString("memberName",   "");
        groupName    = extras.getString("groupName",    "Tasks");
        assignmentId = extras.getString("assignmentId", "");
        taskListStr  = extras.getString("taskList",     "");
        snoozeCount  = extras.getInt("snoozeCount",  0);
        alarmInterval= extras.getInt("alarmInterval", 5);
        dismissed    = false;

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        boolean screenOn = pm != null && pm.isInteractive();

        if (screenOn
                && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && Settings.canDrawOverlays(this)) {
            // ── SCREEN ON ─────────────────────────────────────────────────────
            // Start TTS immediately (async init) so voice is ready by the time overlay shows
            tts = new TextToSpeech(this, this);
            showWindowOverlay();
        } else {
            // ── SCREEN OFF ────────────────────────────────────────────────────
            // fullScreenIntent wakes screen and opens AlarmActivity
            Intent alarmIntent = new Intent(this, AlarmActivity.class);
            alarmIntent.putExtras(extras);
            alarmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                    | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getActivity(this, 0, alarmIntent, piFlags);

            String name = memberName.isEmpty() ? "there" : memberName;
            Notification trigger = new NotificationCompat.Builder(this, HIGH_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                    .setContentTitle("\uD83D\uDD14 " + groupName)
                    .setContentText("Hi " + name + "! Time to check your tasks.")
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setFullScreenIntent(pi, true)
                    .setContentIntent(pi)
                    .setAutoCancel(true)
                    .build();
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(TRIGGER_ID, trigger);
        }
        return START_NOT_STICKY;
    }

    /** Inflates activity_alarm.xml as a system-level window over all apps. */
    private void showWindowOverlay() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (windowManager == null) return;

        LayoutInflater inflater = LayoutInflater.from(this);
        overlayView = inflater.inflate(R.layout.activity_alarm, null);

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                        | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                PixelFormat.OPAQUE);

        // Populate UI (same fields as AlarmActivity)
        ((TextView) overlayView.findViewById(R.id.groupName)).setText(groupName);
        ((TextView) overlayView.findViewById(R.id.memberGreeting)).setText(
                "Hi " + (memberName.isEmpty() ? "there" : memberName) + "! Time to complete your tasks.");

        TextView tvTasks = overlayView.findViewById(R.id.taskList);
        if (!taskListStr.isEmpty()) {
            String[] tasks = taskListStr.split(",\\s*");
            StringBuilder sb = new StringBuilder();
            for (String t : tasks) {
                if (sb.length() > 0) sb.append("\n");
                sb.append("\u2610  ").append(t.trim());
            }
            tvTasks.setText(sb.toString());
        } else {
            tvTasks.setText(groupName);
        }

        int snoozesLeft = MAX_SNOOZES - snoozeCount;
        ((TextView) overlayView.findViewById(R.id.snoozesLeft)).setText(
                snoozesLeft > 0 ? snoozesLeft + " snooze(s) remaining" : "No snoozes left");

        Button btnSnooze = overlayView.findViewById(R.id.btnSnooze);
        if (snoozesLeft <= 0) {
            btnSnooze.setEnabled(false);
            btnSnooze.setAlpha(0.4f);
            btnSnooze.setText("No snoozes left");
        } else {
            btnSnooze.setText("\uD83D\uDE34 Snooze " + alarmInterval + " min (" + snoozesLeft + " left)");
            btnSnooze.setOnClickListener(v -> handleSnooze());
        }
        overlayView.findViewById(R.id.btnDismiss).setOnClickListener(v -> handleDismiss());

        try {
            windowManager.addView(overlayView, params);
        } catch (Exception e) {
            overlayView = null;
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int r = tts.setLanguage(new Locale("en", "IN"));
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED)
                tts.setLanguage(Locale.US);
            tts.setSpeechRate(0.85f);
            speakAlarm();
            repeatHandler.postDelayed(repeatRunnable, REPEAT_MS);
        }
    }

    private void speakAlarm() {
        if (tts == null || dismissed) return;
        String name = memberName.isEmpty() ? "there" : memberName;
        String speech = "Hi " + name + ", time to complete your " + groupName + " tasks."
                + (!taskListStr.isEmpty() ? " Your tasks are: " + taskListStr : "");
        tts.speak(speech, TextToSpeech.QUEUE_FLUSH, null, "alarm_svc");
    }

    private void handleSnooze() {
        dismissed = true;
        repeatHandler.removeCallbacks(repeatRunnable);
        stopTts();
        removeOverlay();
        int newCount = snoozeCount + 1;
        if (!assignmentId.isEmpty()) {
            final int count = newCount;
            new Thread(() -> {
                try {
                    URL url = new URL(BASE_URL + "/api/assignments/" + assignmentId);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("PATCH");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);
                    String body = "{\"state\":\"snoozed\",\"snoozeCount\":" + count + "}";
                    OutputStream os = conn.getOutputStream();
                    os.write(body.getBytes());
                    os.close();
                    conn.getResponseCode();
                    conn.disconnect();
                } catch (Exception ignored) {}
            }).start();
        }
        stopSelf();
    }

    private void handleDismiss() {
        dismissed = true;
        repeatHandler.removeCallbacks(repeatRunnable);
        stopTts();
        removeOverlay();
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(open);
        stopSelf();
    }

    private void removeOverlay() {
        if (overlayView != null && windowManager != null) {
            try { windowManager.removeView(overlayView); } catch (Exception ignored) {}
            overlayView = null;
        }
    }

    private void stopTts() {
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
    }

    public static void dismiss(Context ctx) {
        ctx.stopService(new Intent(ctx, AlarmService.class));
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) { nm.cancel(NOTIF_ID); nm.cancel(TRIGGER_ID); }
    }

    @Override
    public void onDestroy() {
        dismissed = true;
        repeatHandler.removeCallbacks(repeatRunnable);
        stopTts();
        removeOverlay();
        super.onDestroy();
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
