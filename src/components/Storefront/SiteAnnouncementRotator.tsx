import { useEffect, useMemo, useState } from 'react';
import type { SiteAnnouncementRotation } from '../../types/homepage';

interface SiteAnnouncementRotatorProps {
  messages: string[];
  animation?: SiteAnnouncementRotation;
  intervalMs?: number;
  className?: string;
}

export default function SiteAnnouncementRotator({
  messages,
  animation = 'fade',
  intervalMs = 5000,
  className = '',
}: SiteAnnouncementRotatorProps) {
  const activeMessages = useMemo(
    () => messages.map((message) => message.trim()).filter(Boolean),
    [messages]
  );
  const [index, setIndex] = useState(0);
  const [cycleKey, setCycleKey] = useState(0);

  useEffect(() => {
    setIndex(0);
    setCycleKey(0);
  }, [activeMessages.join('\u0001')]);

  useEffect(() => {
    if (activeMessages.length <= 1) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % activeMessages.length);
      setCycleKey((current) => current + 1);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [activeMessages.length, intervalMs]);

  if (activeMessages.length === 0) return null;

  const currentMessage = activeMessages[index] ?? activeMessages[0];
  const motionClass =
    activeMessages.length > 1 && animation !== 'none'
      ? ` storefront-site-header__announcement-message--${animation}`
      : '';

  return (
    <span
      className={`storefront-site-header__announcement-inner${className ? ` ${className}` : ''}`}
      aria-live={activeMessages.length > 1 ? 'polite' : undefined}
      aria-atomic="true"
    >
      <span
        key={cycleKey}
        className={`storefront-site-header__announcement-message${motionClass}`}
      >
        {currentMessage}
      </span>
    </span>
  );
}
