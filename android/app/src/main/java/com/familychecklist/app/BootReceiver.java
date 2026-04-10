package com.familychecklist.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Reschedules all saved alarms after the phone reboots.
 * AlarmManager clears all alarms on reboot — this restores them from SharedPreferences.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
                && !"android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(
                AlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String saved = prefs.getString(AlarmPlugin.PREFS_KEY, null);
        if (saved == null) return;

        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            long now = System.currentTimeMillis();

            Intent showIntentRaw = new Intent(context, MainActivity.class);
            showIntentRaw.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent showPi = PendingIntent.getActivity(context, 0, showIntentRaw,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            JSONArray alarms = new JSONArray(saved);
            for (int i = 0; i < alarms.length(); i++) {
                JSONObject a = alarms.getJSONObject(i);
                long triggerAt = a.getLong("triggerAt");
                if (triggerAt <= now) continue; // past alarm — skip

                int requestCode = a.getInt("id");
                Intent alarmIntent = new Intent(context, AlarmReceiver.class);
                alarmIntent.putExtra("memberName",   a.optString("memberName", ""));
                alarmIntent.putExtra("groupName",    a.optString("groupName", "Tasks"));
                alarmIntent.putExtra("assignmentId", a.optString("assignmentId", ""));
                alarmIntent.putExtra("snoozeCount",  a.optInt("snoozeCount", 0));
                alarmIntent.putExtra("alarmInterval",a.optInt("alarmInterval", 5));
                alarmIntent.putExtra("taskList",     a.optString("taskList", ""));

                PendingIntent pi = PendingIntent.getBroadcast(
                        context, requestCode, alarmIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

                AlarmManager.AlarmClockInfo info =
                        new AlarmManager.AlarmClockInfo(triggerAt, showPi);
                am.setAlarmClock(info, pi);
            }
        } catch (Exception ignored) {}
    }
}
