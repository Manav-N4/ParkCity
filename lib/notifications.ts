
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function scheduleParkingReminder(
  sessionId: string,
  spotName: string,
  reminderMinutesBefore: number
): Promise<string> {
  if (
    !Number.isInteger(reminderMinutesBefore) ||
    reminderMinutesBefore <= 0
  ) {
    throw new Error('Reminder time must be a positive integer.');
  }

  // Configure the Android notification channel.
  await Notifications.setNotificationChannelAsync('parking-reminders', {
    name: 'Parking Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });

  // Request notification permission when setting a reminder.
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error(
      'Notification permission is required to schedule a parking reminder.'
    );
  }

  // Schedule the local notification directly on the device.
  const notificationId =
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Parking reminder',
        body: `Your parking at ${spotName} may be expiring soon`,
        data: { session_id: sessionId },
        sound: 'default',
        ...(process.env.EXPO_OS === 'android' && {
          channelId: 'parking-reminders',
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: reminderMinutesBefore * 60,
      },
    });

  return notificationId;
}
