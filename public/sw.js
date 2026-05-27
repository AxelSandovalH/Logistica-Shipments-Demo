// HurryOps — Service Worker for Web Push Notifications

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'HurryOps', {
      body:    data.body  ?? '',
      icon:    '/logo.png',
      badge:   '/logo.png',
      tag:     data.tag   ?? 'hurryops',
      vibrate: [200, 100, 200],
      data:    { url: data.url ?? '/driver' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/driver'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
