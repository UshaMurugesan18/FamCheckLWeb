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

        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();

        try {
            for (int i = 0; i < alarms.length(); i++) {
                JSObject a = JSObject.fromJSONObject(alarms.getJSONObject(i));
                long triggerAt = a.getLong("triggerAt");
                if (triggerAt <= now) continue;

                int requestCode = a.getInteger("id");
                Intent intent = new Intent(getContext(), AlarmReceiver.class);
                intent.putExtra("memberName",   a.getString("memberName"));
                intent.putExtra("groupName",    a.getString("groupName"));
                intent.putExtra("assignmentId", a.getString("assignmentId"));
                intent.putExtra("snoozeCount",  a.getInteger("snoozeCount", 0));
                intent.putExtra("alarmInterval",a.getInteger("alarmInterval", 5));
                intent.putExtra("taskList",     a.getString("taskList", ""));

                PendingIntent pi = PendingIntent.getBroadcast(
                        getContext(), requestCode, intent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (am.canScheduleExactAlarms()) {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                    } else {
                        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                    }
                } else {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                }
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
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        try {
            for (int i = 0; i < ids.length(); i++) {
                int requestCode = ids.getInt(i);
                Intent intent = new Intent(getContext(), AlarmReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(
                        getContext(), requestCode, intent,
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
