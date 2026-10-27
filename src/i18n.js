/**
 * English and Turkish interface strings with a tiny lookup: {placeholders} are filled from parameters and
 * an entry can have a singular and a plural form, picked by the `count` parameter.
 * Pure module: no DOM and no storage access.
 */

/** @typedef {'en' | 'tr'} Language */
/** @typedef {(key: string, params?: Record<string, string | number>) => string} Translate */

/** Supported languages; the first one is the default. */
export const LANGUAGES = Object.freeze(['en', 'tr']);

/** Every interface string, by language. */
export const MESSAGES = Object.freeze({
  en: Object.freeze({
    appTitle: 'Focus Timer',
    langButton: 'TR',
    langButtonLabel: 'TR – switch to Turkish',
    settings: 'Settings',
    timerHeading: 'Timer',
    modeGroupLabel: 'Session type',
    modeFocus: 'Focus',
    modeShort: 'Short break',
    modeLong: 'Long break',
    switchTitle: 'Switch to {mode}?',
    switchFocusBody: 'The focus session in progress ends here and its time is not counted.',
    switchBreakBody: 'The break in progress ends here.',
    switchConfirm: 'Switch',
    statusReady: 'Ready',
    statusPaused: 'Paused',
    statusFinished: "Time's up",
    upNext: 'Up next: {mode}',
    dialHint: 'Tap the ring to start or pause',
    cycleLabel: '{done} of {total} focus sessions done before the long break',
    workingOn: 'Working on',
    noTasks: 'Add a task to track your sessions',
    allTasksDone: 'All tasks done – nice work!',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    startBreak: 'Start break',
    startFocus: 'Start focus',
    skip: 'Skip',
    skipTitle: 'Skip to the next session (S)',
    reset: 'Reset',
    resetTitle: 'Reset the session (R)',
    keySpace: 'Space',
    hintToggle: 'start / pause',
    hintSkip: 'skip',
    hintReset: 'reset',
    tasksHeading: 'Tasks',
    openCount: '{count} open',
    taskPlaceholder: 'What are you working on?',
    taskTitleLabel: 'Task title',
    estimateShort: 'Est.',
    estimateTitle: 'Estimated focus sessions',
    addTask: 'Add',
    tasksEmpty: 'No tasks yet. Add one and its focus sessions are counted here.',
    doneLabel: 'Done: {title}',
    activeTask: 'Active task – completed focus sessions count here',
    selectTask: 'Work on this task',
    sessionsProgress: '{spent} of {estimate} focus sessions done',
    editTask: 'Edit task: {title}',
    deleteTask: 'Delete task: {title}',
    save: 'Save',
    cancel: 'Cancel',
    statsHeading: 'Last 7 days',
    statsCaption: 'Focus minutes per day',
    today: 'Today',
    week: '7 days',
    sessions: Object.freeze({ one: '{count} session', other: '{count} sessions' }),
    minutes: '{minutes} min',
    hours: '{hours} h',
    hoursMinutes: '{hours} h {minutes} min',
    chartLabel: 'Focus minutes per day for the last 7 days',
    barTitle: '{day}: {time}, {sessions}',
    weekday0: 'Sun',
    weekday1: 'Mon',
    weekday2: 'Tue',
    weekday3: 'Wed',
    weekday4: 'Thu',
    weekday5: 'Fri',
    weekday6: 'Sat',
    settingsTitle: 'Settings',
    lengthsLegend: 'Session lengths (minutes)',
    focusLength: 'Focus',
    shortLength: 'Short break',
    longLength: 'Long break',
    intervalLabel: 'Long break every',
    intervalUnit: 'focus sessions',
    behaviourLegend: 'Automation and alerts',
    autoStartBreaks: 'Start breaks automatically',
    autoStartFocus: 'Start focus sessions automatically',
    soundSetting: 'Chime when a session ends',
    notifySetting: 'Notification when a session ends',
    notifyBlocked: 'Notifications are blocked for this site. Allow them in your browser settings first.',
    notifyUnsupported: 'This browser does not support notifications.',
    settingsNote: 'A session that has already started keeps its length; new lengths apply from the next session.',
    endFocusTitle: 'Focus session complete',
    endBreakTitle: 'Break is over',
    nextShortBody: 'Time for a short break.',
    nextLongBody: 'Time for a long break.',
    nextFocusBody: 'Ready to focus again?',
    footerLicense: 'MIT',
    sourceLink: 'Source on GitHub',
    pageTitle: '{time} · {status} – {app}',
    demoTask1: 'Write the weekly report',
    demoTask2: 'Review pull requests',
    demoTask3: 'Plan tomorrow',
  }),
  tr: Object.freeze({
    appTitle: 'Odak Zamanlayıcısı',
    langButton: 'EN',
    langButtonLabel: 'EN – İngilizceye geç',
    settings: 'Ayarlar',
    timerHeading: 'Zamanlayıcı',
    modeGroupLabel: 'Oturum türü',
    modeFocus: 'Odak',
    modeShort: 'Kısa mola',
    modeLong: 'Uzun mola',
    switchTitle: '{mode} oturumuna geçilsin mi?',
    switchFocusBody: 'Süren odak oturumu burada biter ve süresi sayılmaz.',
    switchBreakBody: 'Süren mola burada biter.',
    switchConfirm: 'Geçiş yap',
    statusReady: 'Hazır',
    statusPaused: 'Duraklatıldı',
    statusFinished: 'Süre doldu',
    upNext: 'Sırada: {mode}',
    dialHint: 'Başlatmak ya da duraklatmak için halkaya dokun',
    cycleLabel: 'Uzun moladan önceki {total} odak oturumundan {done} tanesi tamamlandı',
    workingOn: 'Şu an',
    noTasks: 'Oturumlarını izlemek için bir görev ekle',
    allTasksDone: 'Tüm görevler bitti, harika iş!',
    start: 'Başlat',
    pause: 'Duraklat',
    resume: 'Sürdür',
    startBreak: 'Mola ver',
    startFocus: 'Odaklan',
    skip: 'Atla',
    skipTitle: 'Sonraki oturuma geç (S)',
    reset: 'Sıfırla',
    resetTitle: 'Oturumu sıfırla (R)',
    keySpace: 'Boşluk',
    hintToggle: 'başlat / duraklat',
    hintSkip: 'atla',
    hintReset: 'sıfırla',
    tasksHeading: 'Görevler',
    openCount: '{count} açık',
    taskPlaceholder: 'Ne üzerinde çalışıyorsun?',
    taskTitleLabel: 'Görev adı',
    estimateShort: 'Tahmin',
    estimateTitle: 'Tahmini odak oturumu sayısı',
    addTask: 'Ekle',
    tasksEmpty: 'Henüz görev yok. Bir görev ekle, odak oturumları burada sayılsın.',
    doneLabel: 'Tamamlandı: {title}',
    activeTask: 'Aktif görev – tamamlanan odak oturumları buna sayılır',
    selectTask: 'Bu görev üzerinde çalış',
    sessionsProgress: '{estimate} odak oturumundan {spent} tanesi tamamlandı',
    editTask: 'Görevi düzenle: {title}',
    deleteTask: 'Görevi sil: {title}',
    save: 'Kaydet',
    cancel: 'Vazgeç',
    statsHeading: 'Son 7 gün',
    statsCaption: 'Günlük odak dakikası',
    today: 'Bugün',
    week: '7 gün',
    sessions: '{count} oturum',
    minutes: '{minutes} dk',
    hours: '{hours} sa',
    hoursMinutes: '{hours} sa {minutes} dk',
    chartLabel: 'Son 7 günün günlük odak dakikaları',
    barTitle: '{day}: {time}, {sessions}',
    weekday0: 'Paz',
    weekday1: 'Pzt',
    weekday2: 'Sal',
    weekday3: 'Çar',
    weekday4: 'Per',
    weekday5: 'Cum',
    weekday6: 'Cmt',
    settingsTitle: 'Ayarlar',
    lengthsLegend: 'Oturum süreleri (dakika)',
    focusLength: 'Odak',
    shortLength: 'Kısa mola',
    longLength: 'Uzun mola',
    intervalLabel: 'Uzun mola sıklığı',
    intervalUnit: 'oturumda bir',
    behaviourLegend: 'Otomatik başlatma ve uyarılar',
    autoStartBreaks: 'Molaları otomatik başlat',
    autoStartFocus: 'Odak oturumlarını otomatik başlat',
    soundSetting: 'Oturum bitince zil çal',
    notifySetting: 'Oturum bitince bildirim göster',
    notifyBlocked: 'Bu site için bildirimler engellenmiş. Önce tarayıcı ayarlarından izin ver.',
    notifyUnsupported: 'Bu tarayıcı bildirimleri desteklemiyor.',
    settingsNote: 'Başlamış bir oturum kendi süresini korur; yeni süreler bir sonraki oturumdan itibaren geçerli olur.',
    endFocusTitle: 'Odak oturumu tamamlandı',
    endBreakTitle: 'Mola bitti',
    nextShortBody: 'Kısa mola zamanı.',
    nextLongBody: 'Uzun mola zamanı.',
    nextFocusBody: 'Yeniden odaklanmaya hazır mısın?',
    footerLicense: 'MIT',
    sourceLink: "GitHub'da kaynak kod",
    pageTitle: '{time} · {status} – {app}',
    demoTask1: 'Haftalık raporu yaz',
    demoTask2: 'Kod incelemelerini bitir',
    demoTask3: 'Yarını planla',
  }),
});

const pluralRules = new Map();

/**
 * A supported language for any input; anything unknown gives the default language.
 * @param {unknown} value
 * @returns {Language}
 */
export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? /** @type {Language} */ (value) : LANGUAGES[0];
}

/**
 * The language the toggle button switches to.
 * @param {Language} language
 * @returns {Language}
 */
export function otherLanguage(language) {
  return normalizeLanguage(language) === 'en' ? 'tr' : 'en';
}

/**
 * Looks up a string and fills in its {placeholders}. A missing key falls back to English, then to the key
 * itself; a placeholder without a parameter is left as it is.
 * @param {Language} language
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function translate(language, key, params = {}) {
  const lang = normalizeLanguage(language);
  const entry = MESSAGES[lang][key] ?? MESSAGES.en[key];
  if (entry === undefined) return key;
  const template = typeof entry === 'string' ? entry : entry[pluralForm(lang, params.count)];
  return template.replace(/\{(\w+)\}/g, (placeholder, name) => (name in params ? String(params[name]) : placeholder));
}

/**
 * A translate function bound to one language.
 * @param {Language} language
 * @returns {Translate}
 */
export function createTranslator(language) {
  const lang = normalizeLanguage(language);
  return (key, params) => translate(lang, key, params);
}

/**
 * A number of minutes as a short duration: "50 min", "2 h", "14 h 35 min".
 * @param {Translate} t
 * @param {number} totalMinutes
 * @returns {string}
 */
export function formatMinutes(t, totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return t('minutes', { minutes });
  return minutes === 0 ? t('hours', { hours }) : t('hoursMinutes', { hours, minutes });
}

function pluralForm(language, count) {
  if (!pluralRules.has(language)) pluralRules.set(language, new Intl.PluralRules(language));
  return pluralRules.get(language).select(Number(count)) === 'one' ? 'one' : 'other';
}
