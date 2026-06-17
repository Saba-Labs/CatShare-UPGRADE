import type { ShipmentTimelineEvent } from '../core/types';
import { OdIcons, OD_COLORS } from './orderDetailUi';

export function ShipmentTrackingTimeline({
  events,
}: {
  events: ShipmentTimelineEvent[];
}) {
  if (!events.length) return null;

  return (
    <div>
      {events.map((event, index) => {
        const isDone = event.status === 'done';
        const isError = event.status === 'error';
        const isLast = index === events.length - 1;
        const isActive = isDone && !isLast && events[index + 1]?.status !== 'done';

        return (
          <div
            key={event.id || `${event.label}-${index}`}
            style={{ display: 'flex', gap: 12, minHeight: isLast ? 'auto' : 40 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDone
                    ? OD_COLORS.greenLight
                    : isError
                      ? OD_COLORS.redLight
                      : '#F2F2F7',
                  border: `2px solid ${
                    isDone
                      ? OD_COLORS.green
                      : isError
                        ? OD_COLORS.red
                        : isActive
                          ? OD_COLORS.blue
                          : '#D1D1D6'
                  }`,
                  color: isDone ? OD_COLORS.green : isError ? OD_COLORS.red : 'transparent',
                  flexShrink: 0,
                  boxShadow: isActive ? `0 0 0 3px ${OD_COLORS.blue}22` : undefined,
                }}
              >
                {isDone ? <OdIcons.Check /> : null}
              </div>
              {!isLast ? (
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 14,
                    background: isDone ? OD_COLORS.greenBorder : OD_COLORS.divider,
                    marginTop: 4,
                    borderRadius: 1,
                  }}
                />
              ) : null}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : 14, flex: 1, paddingTop: 2 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: isDone ? 600 : 500,
                  color: isDone ? OD_COLORS.text : OD_COLORS.muted,
                }}
              >
                {event.label}
              </div>
              {event.at ? (
                <div style={{ fontSize: 11, color: OD_COLORS.subtle, marginTop: 3 }}>
                  {new Date(event.at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </div>
              ) : !isDone ? (
                <div style={{ fontSize: 11, color: OD_COLORS.subtle, marginTop: 3 }}>Pending</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
