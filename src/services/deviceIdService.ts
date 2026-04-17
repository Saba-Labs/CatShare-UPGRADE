import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

let cachedDeviceId: string | null = null;

/**
 * Get a unique device ID that persists across app reinstalls.
 * On native platforms, uses the device's unique identifier.
 * On web, generates and stores a UUID in localStorage.
 */
export async function getDeviceId(): Promise<string> {
  // Return cached ID if available
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      // On native platforms, get the device's unique ID
      const info = await Device.getId();
      cachedDeviceId = info.identifier;
      return cachedDeviceId;
    } else {
      // On web, use localStorage to persist a device ID
      const storageKey = 'catshare_web_device_id';
      let deviceId = localStorage.getItem(storageKey);

      if (!deviceId) {
        // Generate a new UUID-like ID if not exists
        deviceId = generateSimpleId();
        try {
          localStorage.setItem(storageKey, deviceId);
        } catch {
          // If localStorage fails, just use the generated ID
        }
      }

      cachedDeviceId = deviceId;
      return deviceId;
    }
  } catch (error) {
    console.warn('[CatShare] Failed to get device ID:', error);
    // Fallback: generate a temporary ID
    const fallbackId = generateSimpleId();
    cachedDeviceId = fallbackId;
    return fallbackId;
  }
}

/**
 * Generate a simple ID (UUID v4-like)
 */
function generateSimpleId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Clear cached device ID (useful for testing or forced refresh)
 */
export function clearCachedDeviceId(): void {
  cachedDeviceId = null;
}
