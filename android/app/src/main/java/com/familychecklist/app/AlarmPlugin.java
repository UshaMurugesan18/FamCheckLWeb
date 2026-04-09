package com.familychecklist.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/**
 * Capacitor plugin called from JavaScript to schedule / cancel native alarms.
 * JS usage:
 *   import { AlarmPlugin } from '../plugins/AlarmPlugin';
 *   await AlarmPlugin.schedule({ alarms: [...] });
 *   await AlarmPlugin.cancelAll();
 */
@CapacitorPlugin(name = "AlarmPlugin")
public class AlarmPlugin extends Plugin {

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Context ctx = getContext();

        // Android 14+: USE_FULL_SCREEN_INTENT requires explicit user grant.
        // Without it, fullScreenIntent is demoted to a heads-up banner.
        if (Build.VERSION.SDK_INT >= 34) {
            android.app.NotificationManager nm =
                    (android.app.NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && !nm.canUseFullScreenIntent()) {
                Intent fsi = new Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT",
                        Uri.parse("package:" + ctx.getPackageName()));
                fsi.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { ctx.startActivity(fsi); } catch (Exception ignored) {}
            }
        }

        // Display-over-other-apps permission (all Android versions)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                !Settings.canDrawOverlays(ctx)) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + ctx.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray alarms = call.getArray("alarms");
        if (alarms == null) { call.resolve(); return; }

        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();

        // showIntent — opens MainActivity when user taps the alarm clock icon in status bar
        Intent showIntentRaw = new Intent(ctx, MainActivity.class);
        showIntentRaw.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent showPi = PendingIntent.getActivity(ctx, 0, showIntentRaw,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        try {
            for (int i = 0; i < alarms.length(); i++) {
                JSObject a = JSObject.fromJSONObject(alarms.getJSONObject(i));
                long triggerAt = a.getLong("triggerAt");
                if (triggerAt <= now) continue;

                int requestCode = a.getInteger("id");

                // Point the alarm PendingIntent DIRECTLY to AlarmActivity.
                // setAlarmClock() BAL exemption applies to this PendingIntent itself,
                // so Android launches AlarmActivity full-screen on all versions (5-15).
                Intent alarmIntent = new Intent(ctx, AlarmActivity.class);
                alarmIntent.putExtra("memberName",   a.getString("memberName"));
                alarmIntent.putExtra("groupName",    a.getString("groupName"));
                alarmIntent.putExtra("assignmentId", a.getString("assignmentId"));
                alarmIntent.putExtra("snoozeCount",  a.getInteger("snoozeCount", 0));
                alarmIntent.putExtra("alarmInterval",a.getInteger("alarmInterval", 5));
                alarmIntent.putExtra("taskList",     a.getString("taskList", ""));
                alarmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

                PendingIntent pi = PendingIntent.getActivity(
                        ctx, requestCode, alarmIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

                AlarmManager.AlarmClockInfo info =
                        new AlarmManager.AlarmClockInfo(triggerAt, showPi);
                am.setAlarmClock(info, pi);
            }
        } catch (Exception e) {
            call.reject("Schedule failed: " + e.getMessage());
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids == null) { call.resolve(); return; }
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        try {
            for (int i = 0; i < ids.length(); i++) {
                int requestCode = ids.getInt(i);
                // Must use getActivity() to match how it was scheduled
                Intent intent = new Intent(ctx, AlarmActivity.class);
                PendingIntent pi = PendingIntent.getActivity(
                        ctx, requestCode, intent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                am.cancel(pi);
            }
        } catch (Exception e) {
            call.reject("Cancel failed: " + e.getMessage());
            return;
        }
        call.resolve();
    }
}
