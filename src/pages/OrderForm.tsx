import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchShareLinkForCustomer, type ShareLinkItem } from '../services/shareLinks';

type QtyMap = Record<string, number>;

export default function OrderForm() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerWhatsapp, setSellerWhatsapp] = useState<string>('');
  const [items, setItems] = useState<ShareLinkItem[]>([]);
  const [qty, setQty] = useState<QtyMap>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!token) {
          setError('Invalid link');
          return;
        }
        const data = await fetchShareLinkForCustomer(token);
        if (cancelled) return;
        if (!data) {
          setError('This link is invalid or expired.');
          return;
        }
        setSellerWhatsapp(data.sellerWhatsapp);
        setItems(data.items || []);
        const initial: QtyMap = {};
        (data.items || []).forEach((i) => {
          initial[i.productId] = 1;
        });
        setQty(initial);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load order form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedLines = useMemo(() => {
    return items
      .map((i) => ({ item: i, q: Math.max(0, Number(qty[i.productId] ?? 0)) }))
      .filter((x) => x.q > 0);
  }, [items, qty]);

  const message = useMemo(() => {
    const lines: string[] = [];
    lines.push('New order from CatShare link:');
    selectedLines.forEach(({ item, q }) => {
      lines.push(`- ${item.name} x ${q}`);
    });
    if (selectedLines.length === 0) lines.push('- (No items selected)');
    return lines.join('\n');
  }, [selectedLines]);

  const openWhatsApp = () => {
    const to = (sellerWhatsapp || '').replace(/[^\d]/g, '');
    if (!to) {
      alert('Seller WhatsApp number is not configured.');
      return;
    }
    const url = `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
    window.location.href = url;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md">
          <div className="text-slate-900 font-bold text-lg">Loading order form…</div>
          <div className="text-slate-500 text-sm mt-2">Please wait.</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md">
          <div className="text-slate-900 font-bold text-lg">Order form</div>
          <div className="text-red-600 text-sm mt-2">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-slate-900 font-black text-xl">Order Form</div>
              <div className="text-slate-500 text-sm mt-1">Adjust quantities and confirm in WhatsApp.</div>
            </div>
            <button
              onClick={openWhatsApp}
              className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm"
            >
              Confirm order
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {items.map((i) => (
              <div key={i.productId} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
                {i.imageUrl ? (
                  <img
                    src={i.imageUrl}
                    alt={i.name}
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">{i.name}</div>
                  {(i.price !== undefined && i.price !== null && i.price !== '') && (
                    <div className="text-xs text-slate-500">
                      Price: {String(i.price)} {i.priceUnit || ''}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  value={qty[i.productId] ?? 1}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setQty((prev) => ({ ...prev, [i.productId]: Number.isFinite(val) ? val : 0 }));
                  }}
                  className="w-20 px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-semibold"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 text-xs text-slate-400">
            This link can expire. If WhatsApp doesn’t open, copy the message manually.
          </div>
        </div>
      </div>
    </div>
  );
}

