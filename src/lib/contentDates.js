const BRAZZAVILLE_OFFSET = '+01:00';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function eventStartTime(event) {
  if (typeof event?.date !== 'string') return null;
  const date = event.date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = typeof event.time === 'string' && /^\d{2}:\d{2}$/.test(event.time)
    ? event.time
    : '23:59';
  const timestamp = new Date(`${date}T${time}:00${BRAZZAVILLE_OFFSET}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isUpcomingEvent(event, now = Date.now()) {
  const startsAt = eventStartTime(event);
  return startsAt !== null && startsAt >= now;
}

export function isCurrentDailyThought(thought, now = Date.now()) {
  const publishedAt = Date.parse(thought?.created_date || '');
  return Number.isFinite(publishedAt) && publishedAt <= now && now - publishedAt < DAY_IN_MS;
}
