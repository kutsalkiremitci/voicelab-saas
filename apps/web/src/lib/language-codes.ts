/**
 * ISO-639-1 language codes supported by the upstream Scribe model.
 * `code: undefined` is treated as "auto-detect" — passed to the API as omitted.
 */
export interface LanguageEntry {
  code: string;
  en: string;
  tr: string;
}

export const TRANSCRIBE_LANGUAGES: ReadonlyArray<LanguageEntry> = [
  { code: "af", en: "Afrikaans", tr: "Afrikanca" },
  { code: "ar", en: "Arabic", tr: "Arapça" },
  { code: "az", en: "Azerbaijani", tr: "Azerice" },
  { code: "be", en: "Belarusian", tr: "Belarusça" },
  { code: "bg", en: "Bulgarian", tr: "Bulgarca" },
  { code: "bn", en: "Bengali", tr: "Bengalce" },
  { code: "bs", en: "Bosnian", tr: "Boşnakça" },
  { code: "ca", en: "Catalan", tr: "Katalanca" },
  { code: "cs", en: "Czech", tr: "Çekçe" },
  { code: "cy", en: "Welsh", tr: "Galce" },
  { code: "da", en: "Danish", tr: "Danca" },
  { code: "de", en: "German", tr: "Almanca" },
  { code: "el", en: "Greek", tr: "Yunanca" },
  { code: "en", en: "English", tr: "İngilizce" },
  { code: "es", en: "Spanish", tr: "İspanyolca" },
  { code: "et", en: "Estonian", tr: "Estonca" },
  { code: "eu", en: "Basque", tr: "Baskça" },
  { code: "fa", en: "Persian", tr: "Farsça" },
  { code: "fi", en: "Finnish", tr: "Fince" },
  { code: "fr", en: "French", tr: "Fransızca" },
  { code: "gl", en: "Galician", tr: "Galiçyaca" },
  { code: "gu", en: "Gujarati", tr: "Gujaratice" },
  { code: "he", en: "Hebrew", tr: "İbranice" },
  { code: "hi", en: "Hindi", tr: "Hintçe" },
  { code: "hr", en: "Croatian", tr: "Hırvatça" },
  { code: "hu", en: "Hungarian", tr: "Macarca" },
  { code: "hy", en: "Armenian", tr: "Ermenice" },
  { code: "id", en: "Indonesian", tr: "Endonezce" },
  { code: "is", en: "Icelandic", tr: "İzlandaca" },
  { code: "it", en: "Italian", tr: "İtalyanca" },
  { code: "ja", en: "Japanese", tr: "Japonca" },
  { code: "jv", en: "Javanese", tr: "Cavaca" },
  { code: "ka", en: "Georgian", tr: "Gürcüce" },
  { code: "kk", en: "Kazakh", tr: "Kazakça" },
  { code: "km", en: "Khmer", tr: "Kmerce" },
  { code: "kn", en: "Kannada", tr: "Kannadaca" },
  { code: "ko", en: "Korean", tr: "Korece" },
  { code: "lo", en: "Lao", tr: "Laoca" },
  { code: "lt", en: "Lithuanian", tr: "Litvanca" },
  { code: "lv", en: "Latvian", tr: "Letonca" },
  { code: "mk", en: "Macedonian", tr: "Makedonca" },
  { code: "ml", en: "Malayalam", tr: "Malayalamca" },
  { code: "mn", en: "Mongolian", tr: "Moğolca" },
  { code: "mr", en: "Marathi", tr: "Marathice" },
  { code: "ms", en: "Malay", tr: "Malayca" },
  { code: "mt", en: "Maltese", tr: "Maltaca" },
  { code: "my", en: "Burmese", tr: "Birmanca" },
  { code: "ne", en: "Nepali", tr: "Nepalce" },
  { code: "nl", en: "Dutch", tr: "Felemenkçe" },
  { code: "no", en: "Norwegian", tr: "Norveççe" },
  { code: "pa", en: "Punjabi", tr: "Pencapça" },
  { code: "pl", en: "Polish", tr: "Lehçe" },
  { code: "ps", en: "Pashto", tr: "Peştuca" },
  { code: "pt", en: "Portuguese", tr: "Portekizce" },
  { code: "ro", en: "Romanian", tr: "Rumence" },
  { code: "ru", en: "Russian", tr: "Rusça" },
  { code: "si", en: "Sinhala", tr: "Sinhalice" },
  { code: "sk", en: "Slovak", tr: "Slovakça" },
  { code: "sl", en: "Slovenian", tr: "Slovence" },
  { code: "sq", en: "Albanian", tr: "Arnavutça" },
  { code: "sr", en: "Serbian", tr: "Sırpça" },
  { code: "sv", en: "Swedish", tr: "İsveççe" },
  { code: "sw", en: "Swahili", tr: "Svahili" },
  { code: "ta", en: "Tamil", tr: "Tamilce" },
  { code: "te", en: "Telugu", tr: "Teluguca" },
  { code: "th", en: "Thai", tr: "Tayca" },
  { code: "tl", en: "Tagalog", tr: "Tagalogca" },
  { code: "tr", en: "Turkish", tr: "Türkçe" },
  { code: "uk", en: "Ukrainian", tr: "Ukraynaca" },
  { code: "ur", en: "Urdu", tr: "Urduca" },
  { code: "uz", en: "Uzbek", tr: "Özbekçe" },
  { code: "vi", en: "Vietnamese", tr: "Vietnamca" },
  { code: "zh", en: "Chinese", tr: "Çince" },
];

export function languageLabel(code: string | undefined, locale: "en" | "tr"): string {
  if (!code) return locale === "tr" ? "Otomatik algıla" : "Detect";
  const entry = TRANSCRIBE_LANGUAGES.find((l) => l.code === code.toLowerCase());
  if (!entry) return code.toUpperCase();
  return entry[locale];
}
