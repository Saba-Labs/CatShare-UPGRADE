import React from 'react';
import { motion } from 'framer-motion';

export type SyncProgressModalProps = {
  open: boolean;
  /** 0–100; ignored when `indeterminate` is true */
  percent: number;
  /** Status line under the title */
  detail: string;
  title?: string;
  helperText?: string;
  /** e.g. z-[130] — above drawer / offline modal */
  zClassName?: string;
  /** Routine sync without step text — show spinner instead of ring % */
  indeterminate?: boolean;
};

const springTransition = { type: 'spring' as const, stiffness: 120, damping: 24, mass: 0.85 };

/** Subtle neutrals */
const TRACK = '#e8ecf1';
const ARC = '#a1aab7';

/**
 * Offline / restore → cloud: ring + percent only, muted tones.
 */
export function SyncProgressModal({
  open,
  percent,
  detail,
  title = 'Syncing to your account',
  helperText = 'Please keep the app open on this screen until the sync finishes.',
  zClassName = 'z-[130]',
  indeterminate = false,
}: SyncProgressModalProps) {
  if (!open) return null;

  const p = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div
      className={`fixed inset-0 ${zClassName} flex items-center justify-center px-4 py-6`}
      role="alertdialog"
      aria-busy="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[3px]" aria-hidden="true" />
      <div
        className="relative w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.12)] sm:p-8 max-h-[90vh]"
      >
        <div className="py-1 text-center">
          {indeterminate ? (
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center" aria-hidden="true">
              <motion.div
                className="h-10 w-10 rounded-full border-2 border-[#e8ecf1] border-t-[#a1aab7]"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.95, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : (
            <div
              className="relative mx-auto mb-6 h-[6.75rem] w-[6.75rem]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={p}
              aria-label={detail || 'Sync progress'}
            >
              <svg className="h-[6.75rem] w-[6.75rem] -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  stroke={TRACK}
                  strokeWidth="2.5"
                />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  stroke={ARC}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="100 100"
                  pathLength={100}
                  initial={false}
                  animate={{ strokeDashoffset: 100 - p }}
                  transition={springTransition}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[1.6rem] font-medium tabular-nums leading-none tracking-tight text-slate-500">
                  {p}%
                </span>
              </div>
            </div>
          )}

          <h2 className="mb-2 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{title}</h2>
          {helperText ? (
            <p className="mb-3 text-sm leading-relaxed text-slate-500">{helperText}</p>
          ) : null}
          <p className="min-h-[2.75rem] px-1 text-xs leading-relaxed text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}
