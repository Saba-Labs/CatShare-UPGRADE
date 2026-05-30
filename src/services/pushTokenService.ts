import { PushNotifications, type Token } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { getSupabaseClient } from '../supabaseClient';
import { getDeviceId } from './deviceIdService';

/** Set after a token is saved; used to prefer server FCM over duplicate local notifications. */
export const PUSH_REGISTERED_STORAGE_KEY = 'catshare_push_registered';

/**
 * Register for FCM (Android/iOS), save token to `user_push_tokens`, refresh on token change.
 * No-op on web. Call when a real user session exists (not guest), e.g. right after sign-in in App.
 */
export async function initPushTokenForLoggedInUser(userId: string): Promise<() => void> {
  if (Capacitor.getPlatform() === 'web') {
    return () => {};
  }

  // Clear stale state before each registration attempt.
  try {
    localStorage.removeItem(PUSH_REGISTERED_STORAGE_KEY);
  } catch {
    /* ignore */
  }

  const handles: Array<{ remove: () => Promise<void> }> = [];

  const h1 = await PushNotifications.addListener('registration', async (t: Token) => {
    try {
      const deviceId = await getDeviceId();
      const { error } = await getSupabaseClient().from('user_push_tokens').upsert(
        {
          user_id: userId,
          device_id: deviceId,
          token: t.value,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id' },
      );
      if (error) {
        console.warn('[CatShare] push token save failed:', error.message);
        return;
      }
      try {
        localStorage.setItem(PUSH_REGISTERED_STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.warn('[CatShare] push token upsert:', e);
    }
  });

  const h2 = await PushNotifications.addListener('registrationError', (err) => {
    console.warn('[CatShare] Push registration error:', err);
    try {
      localStorage.removeItem(PUSH_REGISTERED_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  });

  const h3 = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    try {
      window.dispatchEvent(
        new CustomEvent('catsharePushReceived', {
          detail: notification,
        }),
      );
    } catch {
      /* ignore */
    }
  });

  const h4 = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    try {
      window.dispatchEvent(
        new CustomEvent('catsharePushAction', {
          detail: action,
        }),
      );
    } catch {
      /* ignore */
    }
  });

  handles.push(h1, h2, h3, h4);

  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      console.warn('[CatShare] Push permission:', perm.receive);
      return async () => {
        for (const h of handles) await h.remove();
      };
    }
    await PushNotifications.register();
  } catch (e) {
    console.warn('[CatShare] PushNotifications.register:', e);
  }

  return async () => {
    for (const h of handles) await h.remove();
  };
}
