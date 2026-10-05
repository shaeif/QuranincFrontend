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

const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabiʻ I',
  'Rabiʻ II',
  'Jumada I',
  'Jumada II',
  'Rajab',
  'Shaʻban',
  'Ramadan',
  'Shawwal',
  'Dhuʻl-Qiʻdah',
  'Dhuʻl-Hijjah',
];

/**
 * "22 Rabiʻ II 1448 AH" (Umm al-Qura calendar), or '' if the browser can't work it out.
 * Only the numbers come from the browser: some (Android Chrome and Brave) lack the Islamic
 * calendar's names and print Gregorian ones instead, such as "BC" for the era.
 */
export function hijriDate(date = new Date(), format?: Intl.DateTimeFormat): string {
  try {
    const fmt = format ?? new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    if (!fmt.resolvedOptions().calendar.startsWith('islamic')) return '';
    const part = (type: string) => Number.parseInt(fmt.formatToParts(date).find((p) => p.type === type)?.value ?? '', 10);
    const [day, month, year] = [part('day'), part('month'), part('year')];
    if (!(day >= 1 && day <= 30 && month >= 1 && month <= 12 && year >= 1300 && year <= 1700)) return '';
    return `${day} ${HIJRI_MONTHS[month - 1]} ${year} AH`;
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

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Sanitized HTML from the API (reflection text) → plain text, keeping line and paragraph breaks. */
export function plainText(html: string): string {
  if (!/[<&]/.test(html)) return html;
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? whole;
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
