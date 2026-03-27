import React from "react";
import { MdClose, MdStar } from "react-icons/md";
import {
  FREE_MAX_CATALOGUES,
  FREE_MAX_PDF_PER_DAY,
  FREE_MAX_PRODUCTS,
  FREE_MAX_SHARE_LINK_PER_DAY,
  TRIAL_DAYS_UI_FALLBACK,
} from "../config/freeTierLimits";

export default function ProModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const proFeatures = [
    { name: "Bulk Editor", description: "Edit multiple products at once with batch operations" },
    { name: "Watermark customization", description: "Choose watermark text and placement (Free plan uses a fixed default)" },
    {
      name: "Catalogues & products",
      description: `Unlimited catalogues and products (Free plan: up to ${FREE_MAX_PRODUCTS} products and ${FREE_MAX_CATALOGUES} catalogues)`,
    },
    {
      name: "PDFs & order links",
      description: `Unlimited PDF exports and shareable order links (Free plan: ${FREE_MAX_PDF_PER_DAY} PDF and ${FREE_MAX_SHARE_LINK_PER_DAY} share link per calendar day)`,
    },
    { name: "Stock Control", description: "Toggle wholesale and resell stock IN/OUT status" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white w-full rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <MdStar className="text-yellow-500 text-2xl" />
            <div>
              <h2 className="text-xl font-bold text-gray-800">CatShare Pro</h2>
              <p className="text-xs text-gray-600 font-medium">
                New accounts get a {TRIAL_DAYS_UI_FALLBACK}-day full Pro trial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <MdClose size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Current Status */}
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-300 shadow-sm">
            <p className="text-sm text-green-900 mb-2">
              <span className="font-semibold">Pro trial:</span> full Pro features for {TRIAL_DAYS_UI_FALLBACK} days
            </p>
            <p className="text-xs text-green-800 leading-relaxed">
              After the trial, you can subscribe to keep Pro, or continue on the Free plan with the limits shown below.
            </p>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-semibold text-blue-900 mb-2">Free vs Pro</p>
            <p className="text-xs text-blue-800">
              On the Free plan, product, catalogue, PDF, and share-link limits apply. Pro removes those caps and unlocks full
              watermark customization.
            </p>
          </div>

          {/* Pro Features */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <MdStar className="text-yellow-500" />
              Pro Features (Available Now - Free!)
            </h3>
            <div className="space-y-2">
              {proFeatures.map((feature, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-800">{feature.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Why Upgrade to Pro?</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Edit bulk products at once to save time</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Custom watermark text and placement</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Unlimited catalogues and products</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Advanced inventory management with stock control</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white">
            <p className="text-sm font-semibold mb-2">Upgrade or continue on Free</p>
            <p className="text-xs mb-3 opacity-90">
              See the Pro &amp; billing page for current pricing and to manage your subscription after your trial.
            </p>
            <button
              onClick={onClose}
              className="w-full px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg transition font-medium"
            >
              Got it, thanks!
            </button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-center text-gray-500">
            Trial length and Free-tier limits match what you see on the Pro &amp; billing page.
          </p>
        </div>
      </div>
    </div>
  );
}
