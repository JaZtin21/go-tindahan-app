// ============================================================================
// USER-LOCAL TIME FORMATTING
//
// Every visible time on the public booking page is rendered in the CUSTOMER's
// own timezone — wherever they are in the world. The values sent to the
// backend are UTC instants (toISOString), and the backend interprets them
// against the restaurant's own timezone for operating-hours/closure checks.
// So a Manila customer and a Sydney customer see the same slot at the time it
// means *to them*, and the instant stored in the DB is identical for both.
// ============================================================================

/** The customer's IANA timezone, e.g. "Australia/Sydney". */
export const userTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Short tz abbreviation (e.g. "AEST", "PHT") for the given zone at the given instant. */
export const tzAbbrev = (date: Date, tzName?: string) =>
    new Intl.DateTimeFormat('en', { hour: 'numeric', timeZone: tzName, timeZoneName: 'short' })
        .formatToParts(date)
        .find((p) => p.type === 'timeZoneName')?.value ?? '';

/** "7:00 PM" — in the customer's local timezone. */
export const formatTime = (iso: string, tzName?: string) =>
    new Date(iso).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        ...(tzName ? { timeZone: tzName } : {}),
    });

/** "Fri, Aug 7 at 7:00 PM" — in the customer's local timezone (or a given zone). */
export const formatFull = (iso: string, tzName?: string) =>
    new Date(iso).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        ...(tzName ? { timeZone: tzName } : {}),
    });

/** "YYYY-MM-DDTHH:MM" for a <input type="datetime-local"> — local wall-clock. */
export const toLocalInputValue = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
