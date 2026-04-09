package com.familychecklist.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * Full-screen alarm activity — shows over lock screen like a real alarm clock.
 * Plays TTS voice, shows tasks, Snooze and Open App buttons.
 */
public class AlarmActivity extends Activity implements TextToSpeech.OnInitListener {

    private static final String BASE_URL = "https://famcheckl-production.up.railway.app";
    private static final int MAX_SNOOZES = 3;

    private TextToSpeech tts;
    private String memberName;
    private String groupName;
    private String assignmentId;
    private int snoozeCount;
    private int alarmInterval;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over lock screen and turn screen on
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
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_alarm);

        Intent intent = getIntent();
        memberName    = intent.getStringExtra("memberName");    if (memberName == null) memberName = "";
        groupName     = intent.getStringExtra("groupName");     if (groupName == null) groupName = "Tasks";
        assignmentId  = intent.getStringExtra("assignmentId");  if (assignmentId == null) assignmentId = "";
        snoozeCount   = intent.getIntExtra("snoozeCount", 0);
        alarmInterval = intent.getIntExtra("alarmInterval", 5);
        String taskListStr = intent.getStringExtra("taskList"); if (taskListStr == null) taskListStr = "";

        // Populate UI
        TextView tvGroup = findViewById(R.id.groupName);
        tvGroup.setText(groupName);

        TextView tvGreeting = findViewById(R.id.memberGreeting);
        tvGreeting.setText("Hi " + (memberName.isEmpty() ? "there" : memberName) + "! Time to complete your tasks.");

        TextView tvTasks = findViewById(R.id.taskList);
        if (taskListStr != null && !taskListStr.isEmpty()) {
            // Show each task on its own line with bullet
            String[] tasks = taskListStr.split(",\\s*");
            StringBuilder sb = new StringBuilder();
            for (String task : tasks) {
                if (sb.length() > 0) sb.append("\n");
                sb.append("☐  ").append(task.trim());
            }
            tvTasks.setText(sb.toString());
        } else {
            tvTasks.setText(groupName);
        }

        int snoozesLeft = MAX_SNOOZES - snoozeCount;
        TextView tvSnoozesLeft = findViewById(R.id.snoozesLeft);
        tvSnoozesLeft.setText(snoozesLeft > 0 ? snoozesLeft + " snooze(s) remaining" : "No snoozes left");

        Button btnSnooze = findViewById(R.id.btnSnooze);
        if (snoozesLeft <= 0) {
            btnSnooze.setEnabled(false);
            btnSnooze.setAlpha(0.4f);
            btnSnooze.setText("No snoozes left");
        } else {
            btnSnooze.setText("\uD83D\uDE34 Snooze " + alarmInterval + " min (" + snoozesLeft + " left)");
            btnSnooze.setOnClickListener(v -> handleSnooze());
        }

        Button btnDismiss = findViewById(R.id.btnDismiss);
        btnDismiss.setOnClickListener(v -> handleDismiss());

        // Start TTS
        tts = new TextToSpeech(this, this);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            // Prefer Indian English accent; fall back to any English
            int result = tts.setLanguage(new Locale("en", "IN"));
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts.setLanguage(Locale.US);
            }
            tts.setSpeechRate(0.85f);

            String name = memberName.isEmpty() ? "there" : memberName;
            String taskListStr = getIntent().getStringExtra("taskList");

            StringBuilder speech = new StringBuilder();
            speech.append("Hi ").append(name).append(", time to complete your ").append(groupName).append(" tasks.");

            if (taskListStr != null && !taskListStr.isEmpty()) {
                speech.append(" Your tasks are: ");
                // Replace commas with pauses for natural reading
                speech.append(taskListStr.replace(",", ","));
            }

            tts.speak(speech.toString(), TextToSpeech.QUEUE_FLUSH, null, "alarm");
        }
    }

    private void handleSnooze() {
        stopTts();
        int newCount = snoozeCount + 1;
        // Call backend API in background thread
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
                } catch (Exception e) {
                    // Silent fail — JS layer will sync on next poll
                }
            }).start();
        }
        finishAndRemoveTask();
    }

    private void handleDismiss() {
        stopTts();
        // Open the main app
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(open);
        finishAndRemoveTask();
    }

    private void stopTts() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
    }

    @Override
    protected void onDestroy() {
        stopTts();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        // Block back button — user must tap Snooze or Open App
    }
}
