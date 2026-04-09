import { registerPlugin } from '@capacitor/core';

/**
 * Native alarm plugin — schedules AlarmManager alarms that fire AlarmService
 * (native Java TTS + foreground notification with Snooze/Open buttons).
 */
export const AlarmPlugin = registerPlugin('AlarmPlugin', {
  // Web stub — does nothing on browser
  web: {
    schedule: async () => {},
    cancelAll: async () => {},
  },
});
