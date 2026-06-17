export function IntegrationDemoBanner({
  providerName,
}: {
  providerName: string;
}) {
  return (
    <div className="int-demo-banner" role="status">
      <strong>Demo mode — not linked to {providerName}</strong>
      <p>
        Connect only saves sample data in CatShare so you can preview the UI. It does not
        sign in to your {providerName} account or create real shipments yet.
      </p>
      <p className="int-demo-banner-sub">
        Real integration needs your Shiprocket API user (Settings → API in the Shiprocket
        panel). That flow is planned for a future release.
      </p>
    </div>
  );
}
