// Firebase Messaging Service Worker
// This handles background push notifications from Firebase

self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw] Push notification received:', event);
  
  if (!event.data) {
    console.log('[firebase-messaging-sw] Push event has no data');
    return;
  }

  let notificationData = {};
  
  try {
    notificationData = event.data.json();
  } catch (e) {
    console.log('[firebase-messaging-sw] Could not parse notification data as JSON');
    notificationData = {
      notification: {
        title: 'CatShare',
        body: event.data.text()
      }
    };
  }

  const { notification } = notificationData;
  
  const notificationOptions = {
    body: notification?.body || 'Rendering Complete',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'firebase-notification',
    data: notificationData.data || {}
  };

  console.log('[firebase-messaging-sw] Showing notification:', {
    title: notification?.title,
    options: notificationOptions
  });

  event.waitUntil(
    self.registration.showNotification(notification?.title || 'CatShare', notificationOptions)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw] Notification clicked');
  event.notification.close();
  
  // Open or focus the app window
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const appPath = '/';
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        try {
          const url = new URL(client.url);
          if (url.pathname === appPath && 'focus' in client) {
            return client.focus();
          }
        } catch {
          // Fall through to opening the app.
        }
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(appPath);
      }
    })
  );
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw] Service Worker activated');
  event.waitUntil(clients.claim());
});
