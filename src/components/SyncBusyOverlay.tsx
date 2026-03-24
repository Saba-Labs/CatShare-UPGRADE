import React from 'react';
import Lottie from 'lottie-react';
import syncAnimationData from '../loading.json';

type Props = {
  title?: string;
  subtitle?: string;
  /** e.g. z-[110] to sit under another layer */
  zClassName?: string;
};

/** Same Lottie as global “Syncing to cloud” — reuse for other long-running native/network work. */
export function SyncBusyOverlay({
  title = 'Please wait…',
  subtitle,
  zClassName = 'z-[120]',
}: Props) {
  return (
    <div
      className={`fixed inset-0 ${zClassName} flex flex-col items-center justify-center bg-black/50 pointer-events-auto`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-52 h-52">
        <Lottie animationData={syncAnimationData} loop autoplay style={{ width: '100%', height: '100%' }} />
      </div>
      {title ? (
        <p className="text-white font-semibold text-lg mt-2 text-center px-4">{title}</p>
      ) : null}
      {subtitle ? (
        <p className="text-white/60 text-sm mt-1 text-center px-4">{subtitle}</p>
      ) : null}
    </div>
  );
}
