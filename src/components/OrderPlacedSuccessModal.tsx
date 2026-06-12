import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './OrderPlacedSuccessModal.css';

export type OrderPlacedSuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Full https URL to /track/{token} */
  trackingUrl: string | null;
  title?: string;
  subtitle?: string;
  /** When set, shows a secondary button to message the seller on WhatsApp */
  whatsAppHref?: string | null;
};

function CheckIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
      <motion.path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.45, ease: 'easeOut' }}
      />
    </svg>
  );
}

export default function OrderPlacedSuccessModal({
  isOpen,
  onClose,
  trackingUrl,
  title = 'Order placed!',
  subtitle = 'Save your tracking link to view status and edit your order anytime while it is pending.',
  whatsAppHref,
}: OrderPlacedSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleCopy = useCallback(async () => {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = trackingUrl;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } catch {
        /* user can tap the link */
      }
    }
  }, [trackingUrl]);

  const openTracking = useCallback(() => {
    if (!trackingUrl) return;
    window.location.assign(trackingUrl);
  }, [trackingUrl]);

  const openWhatsApp = useCallback(() => {
    if (!whatsAppHref) return;
    window.location.href = whatsAppHref;
  }, [whatsAppHref]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="ops-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.button
            type="button"
            className="ops-backdrop"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="ops-card"
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <div className="ops-confetti" aria-hidden>
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className={`ops-confetti-dot ops-confetti-dot--${i % 6}`} />
              ))}
            </div>

            <motion.div
              className="ops-check"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.08 }}
            >
              <CheckIcon />
            </motion.div>

            <h2 id="ops-title" className="ops-title">
              {title}
            </h2>
            <p className="ops-subtitle">{subtitle}</p>

            {trackingUrl ? (
              <div className="ops-link-block">
                <p className="ops-link-label">Your tracking link</p>
                <a
                  className="ops-link-url"
                  href={trackingUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    openTracking();
                  }}
                >
                  {trackingUrl}
                </a>
                <div className="ops-link-actions">
                  <button type="button" className="ops-btn ops-btn--primary" onClick={openTracking}>
                    Track my order
                  </button>
                  <button
                    type="button"
                    className={`ops-btn ops-btn--secondary${copied ? ' ops-btn--copied' : ''}`}
                    onClick={() => void handleCopy()}
                  >
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="ops-no-link">
                Your order was saved. The seller will contact you soon.
              </p>
            )}

            {whatsAppHref ? (
              <button type="button" className="ops-btn ops-btn--whatsapp" onClick={openWhatsApp}>
                Send order to seller on WhatsApp
              </button>
            ) : null}

            <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>
              {trackingUrl ? 'Continue shopping' : 'Done'}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
