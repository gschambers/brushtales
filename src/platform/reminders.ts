export type PermissionState = 'granted' | 'denied' | 'undetermined'

export interface ReminderInput {
  morning: string | null
  evening: string | null
}

export interface ReminderTrigger {
  hour: number
  minute: number
}

export interface NotificationPort {
  request(): Promise<PermissionState>
  schedule(trigger: ReminderTrigger): Promise<string>
  cancelAll(): Promise<void>
}

function createExpoNotificationPort(): NotificationPort {
  // Load notifications only when adult settings actually use reminders.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const notifications = require('expo-notifications') as {
    getPermissionsAsync(): Promise<{ status: string }>
    requestPermissionsAsync(): Promise<{ status: string }>
    scheduleNotificationAsync(input: unknown): Promise<string>
    cancelAllScheduledNotificationsAsync(): Promise<void>
  }
  const permission = async (): Promise<PermissionState> => {
    const current = await notifications.getPermissionsAsync()
    if (current.status === 'granted') return 'granted'
    if (current.status !== 'undetermined') return 'denied'
    const requested = await notifications.requestPermissionsAsync()
    return requested.status === 'granted' ? 'granted' : 'denied'
  }
  return {
    request: permission,
    schedule: (trigger) => notifications.scheduleNotificationAsync({
      content: {
        title: 'BrushTales reminder',
        body: 'A calm brushing adventure is ready when you are.',
        sound: 'default',
      },
      trigger: { ...trigger, repeats: true },
    }),
    cancelAll: () => notifications.cancelAllScheduledNotificationsAsync(),
  }
}

function parseTime(value: string): ReminderTrigger {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  const hour = match ? Number(match[1]) : Number.NaN
  const minute = match ? Number(match[2]) : Number.NaN
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`Reminder time is invalid: ${value}`)
  }
  return { hour, minute }
}

export class ReminderService {
  private readonly notifications: NotificationPort

  constructor(notifications?: NotificationPort) {
    this.notifications = notifications ?? createExpoNotificationPort()
  }

  requestPermission(): Promise<PermissionState> {
    return this.notifications.request()
  }

  async scheduleMorningEvening(input: ReminderInput): Promise<void> {
    if (await this.requestPermission() !== 'granted') return
    await this.notifications.cancelAll()
    for (const value of [input.morning, input.evening]) {
      if (value !== null) await this.notifications.schedule(parseTime(value))
    }
  }

  cancelAll(): Promise<void> {
    return this.notifications.cancelAll()
  }
}
