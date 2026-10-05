function parseIsoDate(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Invalid ISO date.');
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function parseLocalTime(value: string): [number, number] {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Invalid local time.');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('Invalid local time.');
  return [hour, minute];
}

function zonedParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second')),
  };
}

export function localDateInTimezone(timezone: string, now = new Date()): string {
  const parts = zonedParts(now, timezone);
  return [parts.year, String(parts.month).padStart(2, '0'), String(parts.day).padStart(2, '0')].join(
    '-',
  );
}

export function addDaysToIsoDate(value: string, days: number): string {
  const [year, month, day] = parseIsoDate(value);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function zonedDateTimeToUtc(date: string, time: string, timezone: string): Date {
  const [year, month, day] = parseIsoDate(date);
  const [hour, minute] = parseLocalTime(time);
  const desiredLocalEpoch = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = new Date(desiredLocalEpoch);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = zonedParts(guess, timezone);
    const observedLocalEpoch = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    guess = new Date(guess.getTime() + desiredLocalEpoch - observedLocalEpoch);
  }

  return guess;
}

export function buildDailyOpportunityWindow(input: {
  date: string;
  timezone: string;
  localTargetTime: string;
  availableOffsetMinutes: number;
  opportunityEndOffsetMinutes: number;
}) {
  const targetAt = zonedDateTimeToUtc(input.date, input.localTargetTime, input.timezone);
  return {
    targetAt,
    availableFrom: new Date(targetAt.getTime() + input.availableOffsetMinutes * 60_000),
    opportunityEndsAt: new Date(
      targetAt.getTime() + input.opportunityEndOffsetMinutes * 60_000,
    ),
  };
}

export function initialDailyActiveDate(input: {
  now: Date;
  timezone: string;
  localTargetTime: string;
  availableOffsetMinutes: number;
}): string {
  const today = localDateInTimezone(input.timezone, input.now);
  const { availableFrom } = buildDailyOpportunityWindow({
    date: today,
    timezone: input.timezone,
    localTargetTime: input.localTargetTime,
    availableOffsetMinutes: input.availableOffsetMinutes,
    opportunityEndOffsetMinutes: 0,
  });
  return input.now < availableFrom ? today : addDaysToIsoDate(today, 1);
}

export function localDayBoundsUtc(date: string, timezone: string) {
  const start = zonedDateTimeToUtc(date, '00:00', timezone);
  const end = zonedDateTimeToUtc(addDaysToIsoDate(date, 1), '00:00', timezone);
  return { start, end };
}
