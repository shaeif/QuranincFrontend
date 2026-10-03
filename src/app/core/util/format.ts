const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** 94 → "٩٤" */
export function toArabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "2 hr. ago", "yesterday", "just now" */
export function timeAgo(ms: number | undefined, now = Date.now()): string {
  if (!ms) return '';
  const seconds = Math.round((ms - now) / 1000);
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

/** "Rabiʻ II 22, 1448 AH" (Umm al-Qura calendar), or '' if the browser lacks it. */
export function hijriDate(date = new Date()): string {
  try {
    const text = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    if (!/\d{4}/.test(text)) return '';
    return /AH$/.test(text) ? text : `${text} AH`;
  } catch {
    return '';
  }
}

/** "Good morning" etc., for the home greeting. */
export function partOfDay(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Peaceful night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
