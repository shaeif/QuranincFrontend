/**
 * Static metadata for the 114 surahs (Tanzil numbering and revelation places).
 * Kept in the app so the surah list works instantly and offline.
 */
export type Revelation = 'Meccan' | 'Medinan';

export interface Surah {
  number: number;
  name: string;
  arabic: string;
  meaning: string;
  ayahs: number;
  revelation: Revelation;
}

type Row = [string, string, string, number, 'M' | 'D'];

const ROWS: Row[] = [
  ['Al-Fatihah', 'الفاتحة', 'The Opening', 7, 'M'],
  ['Al-Baqarah', 'البقرة', 'The Cow', 286, 'D'],
  ["Ali 'Imran", 'آل عمران', 'Family of Imran', 200, 'D'],
  ['An-Nisa', 'النساء', 'The Women', 176, 'D'],
  ["Al-Ma'idah", 'المائدة', 'The Table Spread', 120, 'D'],
  ["Al-An'am", 'الأنعام', 'The Cattle', 165, 'M'],
  ["Al-A'raf", 'الأعراف', 'The Heights', 206, 'M'],
  ['Al-Anfal', 'الأنفال', 'The Spoils of War', 75, 'D'],
  ['At-Tawbah', 'التوبة', 'The Repentance', 129, 'D'],
  ['Yunus', 'يونس', 'Jonah', 109, 'M'],
  ['Hud', 'هود', 'Hud', 123, 'M'],
  ['Yusuf', 'يوسف', 'Joseph', 111, 'M'],
  ["Ar-Ra'd", 'الرعد', 'The Thunder', 43, 'D'],
  ['Ibrahim', 'إبراهيم', 'Abraham', 52, 'M'],
  ['Al-Hijr', 'الحجر', 'The Rocky Tract', 99, 'M'],
  ['An-Nahl', 'النحل', 'The Bee', 128, 'M'],
  ['Al-Isra', 'الإسراء', 'The Night Journey', 111, 'M'],
  ['Al-Kahf', 'الكهف', 'The Cave', 110, 'M'],
  ['Maryam', 'مريم', 'Mary', 98, 'M'],
  ['Ta-Ha', 'طه', 'Ta-Ha', 135, 'M'],
  ['Al-Anbiya', 'الأنبياء', 'The Prophets', 112, 'M'],
  ['Al-Hajj', 'الحج', 'The Pilgrimage', 78, 'D'],
  ["Al-Mu'minun", 'المؤمنون', 'The Believers', 118, 'M'],
  ['An-Nur', 'النور', 'The Light', 64, 'D'],
  ['Al-Furqan', 'الفرقان', 'The Criterion', 77, 'M'],
  ["Ash-Shu'ara", 'الشعراء', 'The Poets', 227, 'M'],
  ['An-Naml', 'النمل', 'The Ant', 93, 'M'],
  ['Al-Qasas', 'القصص', 'The Stories', 88, 'M'],
  ["Al-'Ankabut", 'العنكبوت', 'The Spider', 69, 'M'],
  ['Ar-Rum', 'الروم', 'The Romans', 60, 'M'],
  ['Luqman', 'لقمان', 'Luqman', 34, 'M'],
  ['As-Sajdah', 'السجدة', 'The Prostration', 30, 'M'],
  ['Al-Ahzab', 'الأحزاب', 'The Combined Forces', 73, 'D'],
  ['Saba', 'سبإ', 'Sheba', 54, 'M'],
  ['Fatir', 'فاطر', 'Originator', 45, 'M'],
  ['Ya-Sin', 'يس', 'Ya Sin', 83, 'M'],
  ['As-Saffat', 'الصافات', 'Those Who Set the Ranks', 182, 'M'],
  ['Sad', 'ص', 'The Letter Sad', 88, 'M'],
  ['Az-Zumar', 'الزمر', 'The Troops', 75, 'M'],
  ['Ghafir', 'غافر', 'The Forgiver', 85, 'M'],
  ['Fussilat', 'فصلت', 'Explained in Detail', 54, 'M'],
  ['Ash-Shura', 'الشورى', 'The Consultation', 53, 'M'],
  ['Az-Zukhruf', 'الزخرف', 'The Ornaments of Gold', 89, 'M'],
  ['Ad-Dukhan', 'الدخان', 'The Smoke', 59, 'M'],
  ['Al-Jathiyah', 'الجاثية', 'The Crouching', 37, 'M'],
  ['Al-Ahqaf', 'الأحقاف', 'The Wind-Curved Sandhills', 35, 'M'],
  ['Muhammad', 'محمد', 'Muhammad', 38, 'D'],
  ['Al-Fath', 'الفتح', 'The Victory', 29, 'D'],
  ['Al-Hujurat', 'الحجرات', 'The Rooms', 18, 'D'],
  ['Qaf', 'ق', 'The Letter Qaf', 45, 'M'],
  ['Adh-Dhariyat', 'الذاريات', 'The Winnowing Winds', 60, 'M'],
  ['At-Tur', 'الطور', 'The Mount', 49, 'M'],
  ['An-Najm', 'النجم', 'The Star', 62, 'M'],
  ['Al-Qamar', 'القمر', 'The Moon', 55, 'M'],
  ['Ar-Rahman', 'الرحمن', 'The Most Merciful', 78, 'D'],
  ["Al-Waqi'ah", 'الواقعة', 'The Inevitable', 96, 'M'],
  ['Al-Hadid', 'الحديد', 'The Iron', 29, 'D'],
  ['Al-Mujadilah', 'المجادلة', 'The Pleading Woman', 22, 'D'],
  ['Al-Hashr', 'الحشر', 'The Exile', 24, 'D'],
  ['Al-Mumtahanah', 'الممتحنة', 'She That Is to Be Examined', 13, 'D'],
  ['As-Saff', 'الصف', 'The Ranks', 14, 'D'],
  ["Al-Jumu'ah", 'الجمعة', 'Friday', 11, 'D'],
  ['Al-Munafiqun', 'المنافقون', 'The Hypocrites', 11, 'D'],
  ['At-Taghabun', 'التغابن', 'Mutual Disillusion', 18, 'D'],
  ['At-Talaq', 'الطلاق', 'Divorce', 12, 'D'],
  ['At-Tahrim', 'التحريم', 'The Prohibition', 12, 'D'],
  ['Al-Mulk', 'الملك', 'The Sovereignty', 30, 'M'],
  ['Al-Qalam', 'القلم', 'The Pen', 52, 'M'],
  ['Al-Haqqah', 'الحاقة', 'The Reality', 52, 'M'],
  ["Al-Ma'arij", 'المعارج', 'The Ascending Stairways', 44, 'M'],
  ['Nuh', 'نوح', 'Noah', 28, 'M'],
  ['Al-Jinn', 'الجن', 'The Jinn', 28, 'M'],
  ['Al-Muzzammil', 'المزمل', 'The Enshrouded One', 20, 'M'],
  ['Al-Muddaththir', 'المدثر', 'The Cloaked One', 56, 'M'],
  ['Al-Qiyamah', 'القيامة', 'The Resurrection', 40, 'M'],
  ['Al-Insan', 'الإنسان', 'Man', 31, 'D'],
  ['Al-Mursalat', 'المرسلات', 'Those Sent Forth', 50, 'M'],
  ['An-Naba', 'النبإ', 'The Tidings', 40, 'M'],
  ["An-Nazi'at", 'النازعات', 'Those Who Drag Forth', 46, 'M'],
  ["'Abasa", 'عبس', 'He Frowned', 42, 'M'],
  ['At-Takwir', 'التكوير', 'The Overthrowing', 29, 'M'],
  ['Al-Infitar', 'الإنفطار', 'The Cleaving', 19, 'M'],
  ['Al-Mutaffifin', 'المطففين', 'The Defrauding', 36, 'M'],
  ['Al-Inshiqaq', 'الإنشقاق', 'The Splitting Open', 25, 'M'],
  ['Al-Buruj', 'البروج', 'The Mansions of the Stars', 22, 'M'],
  ['At-Tariq', 'الطارق', 'The Nightcomer', 17, 'M'],
  ["Al-A'la", 'الأعلى', 'The Most High', 19, 'M'],
  ['Al-Ghashiyah', 'الغاشية', 'The Overwhelming', 26, 'M'],
  ['Al-Fajr', 'الفجر', 'The Dawn', 30, 'M'],
  ['Al-Balad', 'البلد', 'The City', 20, 'M'],
  ['Ash-Shams', 'الشمس', 'The Sun', 15, 'M'],
  ['Al-Layl', 'الليل', 'The Night', 21, 'M'],
  ['Ad-Duha', 'الضحى', 'The Morning Hours', 11, 'M'],
  ['Ash-Sharh', 'الشرح', 'The Relief', 8, 'M'],
  ['At-Tin', 'التين', 'The Fig', 8, 'M'],
  ["Al-'Alaq", 'العلق', 'The Clot', 19, 'M'],
  ['Al-Qadr', 'القدر', 'The Power', 5, 'M'],
  ['Al-Bayyinah', 'البينة', 'The Clear Proof', 8, 'D'],
  ['Az-Zalzalah', 'الزلزلة', 'The Earthquake', 8, 'D'],
  ["Al-'Adiyat", 'العاديات', 'The Coursers', 11, 'M'],
  ["Al-Qari'ah", 'القارعة', 'The Calamity', 11, 'M'],
  ['At-Takathur', 'التكاثر', 'The Rivalry in World Increase', 8, 'M'],
  ["Al-'Asr", 'العصر', 'The Declining Day', 3, 'M'],
  ['Al-Humazah', 'الهمزة', 'The Traducer', 9, 'M'],
  ['Al-Fil', 'الفيل', 'The Elephant', 5, 'M'],
  ['Quraysh', 'قريش', 'Quraysh', 4, 'M'],
  ["Al-Ma'un", 'الماعون', 'The Small Kindnesses', 7, 'M'],
  ['Al-Kawthar', 'الكوثر', 'The Abundance', 3, 'M'],
  ['Al-Kafirun', 'الكافرون', 'The Disbelievers', 6, 'M'],
  ['An-Nasr', 'النصر', 'The Divine Support', 3, 'D'],
  ['Al-Masad', 'المسد', 'The Palm Fiber', 5, 'M'],
  ['Al-Ikhlas', 'الإخلاص', 'The Sincerity', 4, 'M'],
  ['Al-Falaq', 'الفلق', 'The Daybreak', 5, 'M'],
  ['An-Nas', 'الناس', 'Mankind', 6, 'M'],
];

export const SURAHS: readonly Surah[] = ROWS.map(([name, arabic, meaning, ayahs, place], i) => ({
  number: i + 1,
  name,
  arabic,
  meaning,
  ayahs,
  revelation: place === 'M' ? 'Meccan' : 'Medinan',
}));

export const TOTAL_AYAHS = 6236;

export function getSurah(number: number): Surah | undefined {
  return Number.isInteger(number) ? SURAHS[number - 1] : undefined;
}

/** "Ash-Sharh 94:6" style reference. */
export function verseRef(surah: number, ayah: number): string {
  const s = getSurah(surah);
  return s ? `${s.name} ${surah}:${ayah}` : `${surah}:${ayah}`;
}
