import os from "os"
import notifier from "node-notifier"

const NOTIFICATION_TITLE = "OpenCode"
const DEBOUNCE_MS = 1000

const platform = os.type()

let platformNotifier: any

if (platform === "Linux" || platform.match(/BSD$/)) {
  const { NotifySend } = notifier
  platformNotifier = new NotifySend({ withFallback: false })
} else if (platform === "Darwin") {
  const { NotificationCenter } = notifier
  platformNotifier = new NotificationCenter({ withFallback: true })
} else if (platform === "Windows_NT") {
  const { WindowsToaster } = notifier
  platformNotifier = new WindowsToaster({ withFallback: false })
} else {
  platformNotifier = notifier
}

const lastNotificationTime: Record<string, number> = {}

export async function sendNotification(
  message: string,
  timeout: number
): Promise<void> {
  const now = Date.now()
  if (lastNotificationTime[message] && now - lastNotificationTime[message] < DEBOUNCE_MS) {
    return
  }
  lastNotificationTime[message] = now

  return new Promise((resolve) => {
    const notificationOptions: any = {
      title: NOTIFICATION_TITLE,
      message: message,
      timeout: timeout,
      icon: undefined,
    }

    if (platform === "Darwin") {
      notificationOptions.sound = false
    }

    platformNotifier.notify(
      notificationOptions,
      () => {
        resolve()
      }
    )
  })
}
