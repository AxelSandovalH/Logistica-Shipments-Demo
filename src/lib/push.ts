import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:noreply@hurryops.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export interface PushPayload {
  title: string
  body:  string
  url?:  string
  tag?:  string
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload,
): Promise<void> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err: any) {
    // 410 Gone = subscription expired/revoked — caller should delete it
    if (err?.statusCode === 410) throw err
    console.error('[push] sendNotification error:', err?.message ?? err)
  }
}

export async function sendPushToDriver(
  pushSubscription: unknown,
  payload: PushPayload,
): Promise<void> {
  if (!pushSubscription) return
  await sendPushNotification(
    pushSubscription as webpush.PushSubscription,
    payload,
  )
}
