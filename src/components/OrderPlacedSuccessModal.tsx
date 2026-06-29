import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { buildUpiPaymentUrl } from '../utils/upiPayment';
import { claimUpiPaymentByTrackingToken } from '../services/orderTrackingService';
import UpiQrCode from './UpiQrCode';
import './OrderPlacedSuccessModal.css';

export type OrderPlacedSuccessUpiPayment = {
  vpa: string;
  amount: number;
  orderRef: string;
};

export type OrderPlacedSuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Full https URL to /track/{token} */
  trackingUrl: string | null;
  /** Tracking token — used to record "I've paid" for UPI orders */
  trackingToken?: string | null;
  title?: string;
  subtitle?: string;
  paymentTitle?: string;
  paymentSubtitle?: string;
  /** When set, shows a secondary button to message the seller on WhatsApp */
  whatsAppHref?: string | null;
  upiPayment?: OrderPlacedSuccessUpiPayment | null;
  storeName?: string;
};

type ModalPhase = 'payment' | 'success';

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

function UpiIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 12h4M13 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function OrderPlacedSuccessModal({
  isOpen,
  onClose,
  trackingUrl,
  trackingToken,
  title = 'Order placed!',
  subtitle = 'Save your tracking link to view status and edit your order while it is still pending. Once the seller confirms, changes are locked.',
  paymentTitle = 'Complete your payment',
  paymentSubtitle = 'Pay via UPI, then tap I\'ve paid.',
  whatsAppHref,
  upiPayment,
  storeName,
}: OrderPlacedSuccessModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('success');
  const [copied, setCopied] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  const [claimingPaid, setClaimingPaid] = useState(false);

  const resolvedTrackingToken = useMemo(() => {
    if (trackingToken?.trim()) return trackingToken.trim();
    if (!trackingUrl) return null;
    const match = trackingUrl.match(/\/track\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [trackingToken, trackingUrl]);

  const upiPayUrl = useMemo(
    () =>
      upiPayment
        ? buildUpiPaymentUrl({
            vpa: upiPayment.vpa,
            payeeName: storeName,
            amount: upiPayment.amount,
            transactionNote: `Order ${upiPayment.orderRef}`,
          })
        : null,
    [upiPayment, storeName]
  );

  const showPaymentFirst = Boolean(upiPayment && upiPayUrl);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setUpiCopied(false);
      setPhase('success');
      return;
    }
    setPhase(showPaymentFirst ? 'payment' : 'success');
  }, [isOpen, showPaymentFirst]);

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

  const handleCopyUpi = useCallback(async () => {
    if (!upiPayment?.vpa) return;
    try {
      await navigator.clipboard.writeText(upiPayment.vpa);
      setUpiCopied(true);
      window.setTimeout(() => setUpiCopied(false), 2200);
    } catch {
      /* ignore */
    }
  }, [upiPayment?.vpa]);

  const openTracking = useCallback(() => {
    if (!trackingUrl) return;
    window.location.assign(trackingUrl);
  }, [trackingUrl]);

  const openWhatsApp = useCallback(() => {
    if (!whatsAppHref) return;
    window.location.href = whatsAppHref;
  }, [whatsAppHref]);

  const openUpiApp = useCallback(() => {
    if (!upiPayUrl) return;
    window.location.href = upiPayUrl;
  }, [upiPayUrl]);

  const handleMarkedPaid = useCallback(async () => {
    if (resolvedTrackingToken) {
      setClaimingPaid(true);
      const res = await claimUpiPaymentByTrackingToken(resolvedTrackingToken);
      setClaimingPaid(false);
      if (!res.ok && res.error) {
        console.warn('Could not record UPI payment claim:', res.error);
      }
    }
    setPhase('success');
  }, [resolvedTrackingToken]);

  const titleId = phase === 'payment' ? 'ops-payment-title' : 'ops-title';

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className={`ops-overlay${phase === 'payment' ? ' ops-overlay--payment' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
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
            className={`ops-card${phase === 'payment' ? ' ops-card--payment' : ''}`}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <AnimatePresence mode="wait">
              {phase === 'payment' && upiPayment && upiPayUrl ? (
                <motion.div
                  key="payment"
                  className="ops-phase ops-phase--payment"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="ops-check ops-check--payment ops-check--compact">
                    <UpiIcon />
                  </div>

                  <h2 id="ops-payment-title" className="ops-title ops-title--compact">
                    {paymentTitle}
                  </h2>
                  <p className="ops-subtitle ops-subtitle--compact">{paymentSubtitle}</p>

                  <div className="ops-upi-block ops-upi-block--compact">
                    <p className="ops-upi-amount ops-upi-amount--compact">
                      <strong>₹{upiPayment.amount.toLocaleString('en-IN')}</strong>
                      <span className="ops-upi-amount-note"> · pre-filled in UPI app</span>
                    </p>

                    <div className="ops-upi-qr-wrap ops-upi-qr-wrap--compact">
                      <UpiQrCode value={upiPayUrl} className="ops-upi-qr" size={108} />
                      <p className="ops-upi-qr-hint">Scan with any UPI app</p>
                    </div>

                    <div className="ops-upi-meta">
                      <div className="ops-upi-id ops-upi-id--compact">{upiPayment.vpa}</div>
                      <p className="ops-upi-ref">Ref {upiPayment.orderRef}</p>
                    </div>

                    <div className="ops-link-actions ops-link-actions--compact">
                      <button type="button" className="ops-btn ops-btn--secondary" onClick={openUpiApp}>
                        Open UPI app
                      </button>
                      <button
                        type="button"
                        className={`ops-btn ops-btn--secondary${upiCopied ? ' ops-btn--copied' : ''}`}
                        onClick={() => void handleCopyUpi()}
                      >
                        {upiCopied ? 'Copied!' : 'Copy UPI ID'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="ops-btn ops-btn--primary ops-btn--paid"
                    onClick={() => void handleMarkedPaid()}
                    disabled={claimingPaid}
                  >
                    {claimingPaid ? 'Saving…' : 'I have Paid'}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  className="ops-phase"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
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
                    <p className="ops-no-link">Your order was saved. The seller will contact you soon.</p>
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
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
