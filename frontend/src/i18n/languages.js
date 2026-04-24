export const LANGUAGE_STORAGE_KEY = 'cg_lang'
export const DEFAULT_LANGUAGE = 'en'

export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'ur', label: 'Urdu' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'or', label: 'Odia' },
  { code: 'pa', label: 'Punjabi' },
]

export const SUPPORTED_LANGUAGES = LANGUAGE_OPTIONS.map((option) => option.code)

export const RTL_LANGUAGES = ['ur']

export const normalizeLanguageCode = (language) => {
  if (!language || typeof language !== 'string') return ''
  return language.toLowerCase().split('-')[0].split('_')[0]
}

export const isSupportedLanguage = (language) => {
  const normalized = normalizeLanguageCode(language)
  return SUPPORTED_LANGUAGES.includes(normalized)
}

export const getSupportedLanguage = (language) => {
  const normalized = normalizeLanguageCode(language)
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : DEFAULT_LANGUAGE
}

export const getLanguageLabel = (code) => {
  const match = LANGUAGE_OPTIONS.find((option) => option.code === code)
  return match ? match.label : LANGUAGE_OPTIONS[0].label
}

export const getLanguageCodeFromLabel = (label) => {
  const normalizedLabel = String(label || '').toLowerCase()
  const match = LANGUAGE_OPTIONS.find((option) => option.label.toLowerCase() === normalizedLabel)
  return match ? match.code : DEFAULT_LANGUAGE
}
