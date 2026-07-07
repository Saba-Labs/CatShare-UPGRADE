import type { SiteAnnouncementRotation, WebsiteSiteSettings } from '../types/homepage';

export const SITE_ANNOUNCEMENT_SLOT_COUNT = 3;

export const SITE_ANNOUNCEMENT_ROTATION_OPTIONS: {
  value: SiteAnnouncementRotation;
  label: string;
}[] = [
  { value: 'fade', label: 'Crossfade' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'slide-down', label: 'Slide down' },
  { value: 'slide-left', label: 'Slide left' },
  { value: 'none', label: 'Instant switch' },
];

export const DEFAULT_SITE_ANNOUNCEMENT_ROTATION: SiteAnnouncementRotation = 'fade';
export const DEFAULT_SITE_ANNOUNCEMENT_INTERVAL_SEC = 5;

export function normalizeSiteAnnouncementSlots(
  settings: Pick<WebsiteSiteSettings, 'announcementMessages' | 'announcementText'>
): string[] {
  const slots = Array.from({ length: SITE_ANNOUNCEMENT_SLOT_COUNT }, () => '');

  if (Array.isArray(settings.announcementMessages)) {
    settings.announcementMessages.slice(0, SITE_ANNOUNCEMENT_SLOT_COUNT).forEach((message, index) => {
      slots[index] = message ?? '';
    });
    return slots;
  }

  const legacy = settings.announcementText?.trim();
  if (legacy) {
    slots[0] = legacy;
  }

  return slots;
}

export function getActiveSiteAnnouncementMessages(
  settings: Pick<WebsiteSiteSettings, 'announcementMessages' | 'announcementText'>
): string[] {
  return normalizeSiteAnnouncementSlots(settings)
    .map((message) => message.trim())
    .filter(Boolean);
}

export function hasVisibleSiteAnnouncement(
  settings: Pick<WebsiteSiteSettings, 'showAnnouncement' | 'announcementMessages' | 'announcementText'>
): boolean {
  return !!settings.showAnnouncement && getActiveSiteAnnouncementMessages(settings).length > 0;
}

export function resolveSiteAnnouncementRotationInterval(
  settings: Pick<WebsiteSiteSettings, 'announcementRotationInterval'>
): number {
  const seconds = settings.announcementRotationInterval;
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 2) {
    return seconds * 1000;
  }
  return DEFAULT_SITE_ANNOUNCEMENT_INTERVAL_SEC * 1000;
}

export function resolveSiteAnnouncementRotation(
  settings: Pick<WebsiteSiteSettings, 'announcementRotation'>
): SiteAnnouncementRotation {
  return settings.announcementRotation || DEFAULT_SITE_ANNOUNCEMENT_ROTATION;
}

export function patchSiteAnnouncementSlots(
  settings: WebsiteSiteSettings,
  slotIndex: number,
  value: string
): Pick<WebsiteSiteSettings, 'announcementMessages' | 'announcementText'> {
  const slots = normalizeSiteAnnouncementSlots(settings);
  slots[slotIndex] = value;
  const active = slots.map((message) => message.trim()).filter(Boolean);
  return {
    announcementMessages: slots,
    announcementText: active[0] || '',
  };
}
