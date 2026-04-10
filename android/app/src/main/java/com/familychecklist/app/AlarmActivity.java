package com.familychecklist.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * Full-screen alarm activity.
 * - Shows over lock screen AND over other apps (overlay permission).
 * - TTS loops every 30 seconds until user taps Snooze or Open App.
 * - Back button blocked — must act.
 */
public class AlarmActivity extends Activity implements TextToSpeech.OnInitListener {

    private static final String BASE_URL   = "https://famcheckl-production.up.railway.app";
    private static final int    MAX_SNOOZES = 3;
    private static final long   REPEAT_MS   = 30_000; // repeat voice every 30s

    private TextToSpeech tts;
    private String memberName;
    private String groupName;
    private String assignmentId;
    private String taskListStr;
    private int    snoozeCount;
    private int    alarmInterval;
    private boolean dismissed = false;

    private final Handler repeatHandler = new Handler(Looper.getMainLooper());
    private final Runnable repeatRunnable = new Runnable() {
        @Override public void run() {
            if (!dismissed) {
                speakAlarm();
                repeatHandler.postDelayed(this, REPEAT_MS);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // If user is actively using our app, don't interrupt them with alarm UI
        if (MainActivity.isInForeground) {
            finish();
            return;
        }

        // Cancel the fullScreenIntent trigger notification — banner disappears immediately
        NotificationManager nm2 = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm2 != null) nm2.cancel(AlarmService.TRIGGER_ID);

        // Start silent keepalive service — pass isKeepalive=true so AlarmService
        // does NOT re-trigger the alarm or post another notification
        Intent svc = new Intent(this, AlarmService.class);
        svc.putExtra("isKeepalive", true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(svc);
        } else {
            startService(svc);
        }

        // Show over lock screen + turn screen on
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = getSystemService(KeyguardManager.class);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_alarm);

        Intent intent = getIntent();
        memberName   = intent.getStringExtra("memberName");   if (memberName == null) memberName = "";
        groupName    = intent.getStringExtra("groupName");    if (groupName == null) groupName = "Tasks";
        assignmentId = intent.getStringExtra("assignmentId"); if (assignmentId == null) assignmentId = "";
        taskListStr  = intent.getStringExtra("taskList");     if (taskListStr == null) taskListStr = "";
        snoozeCount  = intent.getIntExtra("snoozeCount", 0);
        alarmInterval= intent.getIntExtra("alarmInterval", 5);

        // Populate UI
        ((TextView) findViewById(R.id.groupName)).setText(groupName);
        ((TextView) findViewById(R.id.memberGreeting)).setText(
                "Hi " + (memberName.isEmpty() ? "there" : memberName) + "! Time to complete your tasks.");

        TextView tvTasks = findViewById(R.id.taskList);
        if (!taskListStr.isEmpty()) {
            String[] tasks = taskListStr.split(",\\s*");
            StringBuilder sb = new StringBuilder();
            for (String task : tasks) {
                if (sb.length() > 0) sb.append("\n");
                sb.append("\u2610  ").append(task.trim());
            }
            tvTasks.setText(sb.toString());
        } else {
            tvTasks.setText(groupName);
        }

        int snoozesLeft = MAX_SNOOZES - snoozeCount;
        ((TextView) findViewById(R.id.snoozesLeft)).setText(
                snoozesLeft > 0 ? snoozesLeft + " snooze(s) remaining" : "No snoozes left");

        Button btnSnooze = findViewById(R.id.btnSnooze);
        if (snoozesLeft <= 0) {
            btnSnooze.setEnabled(false);
            btnSnooze.setAlpha(0.4f);
            btnSnooze.setText("No snoozes left");
        } else {
            btnSnooze.setText("\uD83D\uDE34 Snooze " + alarmInterval + " min (" + snoozesLeft + " left)");
            btnSnooze.setOnClickListener(v -> handleSnooze());
        }
        findViewById(R.id.btnDismiss).setOnClickListener(v -> handleDismiss());

        tts = new TextToSpeech(this, this);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(new Locale("en", "IN"));
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts.setLanguage(Locale.US);
            }
            tts.setSpeechRate(0.85f);
            speakAlarm();
            // Schedule repeating voice every 30s
            repeatHandler.postDelayed(repeatRunnable, REPEAT_MS);
        }
    }

    private void speakAlarm() {
        if (tts == null || dismissed) return;
        String name = memberName.isEmpty() ? "there" : memberName;
        StringBuilder speech = new StringBuilder();
        speech.append("Hi ").append(name)
              .append(", time to complete your ").append(groupName).append(" tasks.");
        if (!taskListStr.isEmpty()) {
            speech.append(" Your tasks are: ").append(taskListStr);
        }
        tts.speak(speech.toString(), TextToSpeech.QUEUE_FLUSH, null, "alarm");
    }

    private void handleSnooze() {
        dismissed = true;
        repeatHandler.removeCallbacks(repeatRunnable);
        stopTts();
        AlarmService.dismiss(this);
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
                    os.write(body.getBytes()); os.close();
                    conn.getResponseCode(); conn.disconnect();
                } catch (Exception ignored) {}
            }).start();
        }
        finishAndRemoveTask();
    }

    private void handleDismiss() {
        dismissed = true;
        repeatHandler.removeCallbacks(repeatRunnable);
        stopTts();
        AlarmService.dismiss(this);
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(open);
        finishAndRemoveTask();
    }

    private void stopTts() {
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
    }

    @Override
    protected void onDestroy() {
        dismissed = true;
        repeatHandler.removeCallbacks(repeatRunnable);
        stopTts();
        super.onDestroy();
    }

    @Override public void onBackPressed() { /* blocked — tap Snooze or Open App */ }
}
