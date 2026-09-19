import { ReminderService, type NotificationPort, type PermissionState } from '../../src/platform/reminders'

class FakeNotifications implements NotificationPort {
  schedule = jest.fn(async () => 'notification-id')
  cancelAll = jest.fn(async () => undefined)
  request = jest.fn(async (): Promise<PermissionState> => 'granted')
}

describe('ReminderService', () => {
  it('schedules at most one morning and one evening reminder', async () => {
    const notifications = new FakeNotifications()
    const reminders = new ReminderService(notifications)

    await reminders.scheduleMorningEvening({ morning: '07:30', evening: '19:30' })

    expect(notifications.schedule).toHaveBeenCalledTimes(2)
    expect(notifications.schedule).toHaveBeenNthCalledWith(1, { hour: 7, minute: 30 })
    expect(notifications.schedule).toHaveBeenNthCalledWith(2, { hour: 19, minute: 30 })
    expect(notifications.schedule.mock.calls.flat()).not.toContain('profile-1')
  })

  it('keeps reminders disabled when permission is denied', async () => {
    const notifications = new FakeNotifications()
    notifications.request.mockResolvedValue('denied')
    const reminders = new ReminderService(notifications)

    await reminders.scheduleMorningEvening({ morning: '07:30', evening: null })

    expect(notifications.schedule).not.toHaveBeenCalled()
    await expect(reminders.requestPermission()).resolves.toBe('denied')
  })
})
