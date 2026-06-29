import type { ShipmentTimelineEvent } from '../core/types';

export function ShipmentTrackingTimeline({
  events,
}: {
  events: ShipmentTimelineEvent[];
}) {
  if (!events.length) return null;

  return (
    <div className="od-ship-timeline">
      {events.map((event, index) => {
        const isDone = event.status === 'done';
        const isError = event.status === 'error';
        const isLast = index === events.length - 1;
        const isActive = isDone && !isLast && events[index + 1]?.status !== 'done';

        return (
          <div
            key={event.id || `${event.label}-${index}`}
            className={`od-ship-timeline-item${isLast ? ' od-ship-timeline-item--last' : ''}`}
          >
            <div className="od-ship-timeline-rail">
              <div
                className={[
                  'od-ship-timeline-dot',
                  isDone ? 'od-ship-timeline-dot--done' : '',
                  isError ? 'od-ship-timeline-dot--error' : '',
                  isActive ? 'od-ship-timeline-dot--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {isDone ? (
                  <svg viewBox="0 0 14 11" fill="none" aria-hidden>
                    <path
                      d="M1 5.5L5 9.5L13 1"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </div>
              {!isLast ? (
                <div
                  className={`od-ship-timeline-line${isDone ? ' od-ship-timeline-line--done' : ''}`}
                />
              ) : null}
            </div>
            <div className="od-ship-timeline-body">
              <div
                className={[
                  'od-ship-timeline-title',
                  isDone ? 'od-ship-timeline-title--done' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {event.label}
              </div>
              {event.at ? (
                <div className="od-ship-timeline-time">
                  {new Date(event.at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </div>
              ) : !isDone ? (
                <div className="od-ship-timeline-time od-ship-timeline-time--pending">Upcoming</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
