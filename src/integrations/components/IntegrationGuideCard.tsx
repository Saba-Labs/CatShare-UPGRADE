import type { IntegrationGuideStep, IntegrationSecurityNote } from '../core/types';

export function IntegrationGuideCard({
  title,
  steps,
  securityNote,
}: {
  title: string;
  steps: IntegrationGuideStep[];
  securityNote?: IntegrationSecurityNote;
}) {
  return (
    <div className="int-card">
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{title}</h2>
      {steps.map((step) => (
        <div key={step.step} className="int-guide-step">
          <span className="int-step-num">{step.step}</span>
          <span>{step.title}</span>
        </div>
      ))}
      {securityNote ? (
        <div className="int-security-note">
          <strong>{securityNote.title}</strong>
          <ul>
            {securityNote.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
