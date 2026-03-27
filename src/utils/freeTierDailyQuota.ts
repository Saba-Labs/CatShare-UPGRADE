import {
  FREE_MAX_PDF_PER_DAY,
  FREE_MAX_SHARE_LINK_PER_DAY,
} from "../config/freeTierLimits";

const STORAGE_PREFIX = "catshare_free_quota_v1";

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

function readRecord(userId: string): { day: string; pdf: number; shareLink: number } {
  if (typeof localStorage === "undefined") {
    return { day: todayKey(), pdf: 0, shareLink: 0 };
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}_${userId}`);
    if (!raw) return { day: todayKey(), pdf: 0, shareLink: 0 };
    const o = JSON.parse(raw) as { day?: string; pdf?: number; shareLink?: number };
    const day = typeof o.day === "string" ? o.day : todayKey();
    if (day !== todayKey()) {
      return { day: todayKey(), pdf: 0, shareLink: 0 };
    }
    return {
      day,
      pdf: typeof o.pdf === "number" ? o.pdf : 0,
      shareLink: typeof o.shareLink === "number" ? o.shareLink : 0,
    };
  } catch {
    return { day: todayKey(), pdf: 0, shareLink: 0 };
  }
}

function writeRecord(userId: string, rec: { day: string; pdf: number; shareLink: number }) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}_${userId}`, JSON.stringify(rec));
  } catch {
    /* ignore */
  }
}

export function canConsumePdfToday(userId: string | undefined, isPro: boolean): boolean {
  if (!userId) return true;
  if (isPro) return true;
  const rec = readRecord(userId);
  return rec.pdf < FREE_MAX_PDF_PER_DAY;
}

export function recordPdfConsumption(userId: string | undefined): void {
  if (!userId) return;
  const d = todayKey();
  const rec = readRecord(userId);
  const next =
    rec.day !== d ? { day: d, pdf: 1, shareLink: 0 } : { ...rec, pdf: rec.pdf + 1 };
  writeRecord(userId, next);
}

export function canCreateShareLinkToday(
  userId: string | undefined,
  isPro: boolean
): boolean {
  if (!userId) return true;
  if (isPro) return true;
  const rec = readRecord(userId);
  return rec.shareLink < FREE_MAX_SHARE_LINK_PER_DAY;
}

export function recordShareLinkConsumption(userId: string | undefined): void {
  if (!userId) return;
  const d = todayKey();
  const rec = readRecord(userId);
  const next =
    rec.day !== d
      ? { day: d, pdf: 0, shareLink: 1 }
      : { ...rec, shareLink: rec.shareLink + 1 };
  writeRecord(userId, next);
}
