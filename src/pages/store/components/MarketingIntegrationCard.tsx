import type { MarketingIntegrationDefinition } from '../config/marketingIntegrations';

export default function MarketingIntegrationCard({
  integration,
}: {
  integration: MarketingIntegrationDefinition;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm opacity-90">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold"
          style={{
            backgroundColor: integration.logo.background,
            color: integration.logo.color,
          }}
          aria-hidden
        >
          {integration.logo.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {integration.name}
            </h3>
            <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
              Coming Soon
            </span>
          </div>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">{integration.description}</p>
        </div>
      </div>
      <button
        type="button"
        disabled
        className="mt-4 inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-400 dark:text-gray-500 cursor-not-allowed"
      >
        Connect — Coming Soon
      </button>
    </article>
  );
}
