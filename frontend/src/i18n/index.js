import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './resources/en.json'
import hi from './resources/hi.json'
import bn from './resources/bn.json'
import te from './resources/te.json'
import mr from './resources/mr.json'
import ta from './resources/ta.json'
import ur from './resources/ur.json'
import gu from './resources/gu.json'
import kn from './resources/kn.json'
import ml from './resources/ml.json'
import or from './resources/or.json'
import pa from './resources/pa.json'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  RTL_LANGUAGES,
  SUPPORTED_LANGUAGES,
  getSupportedLanguage,
  isSupportedLanguage,
  normalizeLanguageCode,
} from './languages'

const isBrowser = typeof window !== 'undefined'

const resolveInitialLanguage = () => {
  if (isBrowser) {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (isSupportedLanguage(stored)) {
      return normalizeLanguageCode(stored)
    }

    const navigatorLanguages = Array.isArray(window.navigator.languages) && window.navigator.languages.length > 0
      ? window.navigator.languages
      : [window.navigator.language]

    for (const candidate of navigatorLanguages) {
      if (isSupportedLanguage(candidate)) {
        return normalizeLanguageCode(candidate)
      }
    }
  }

  return DEFAULT_LANGUAGE
}

const setDocumentLanguage = (language) => {
  if (!isBrowser) return
  const normalized = getSupportedLanguage(language)
  document.documentElement.lang = normalized
  document.documentElement.dir = RTL_LANGUAGES.includes(normalized) ? 'rtl' : 'ltr'
}

const initialLanguage = resolveInitialLanguage()

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      bn: { translation: bn },
      te: { translation: te },
      mr: { translation: mr },
      ta: { translation: ta },
      ur: { translation: ur },
      gu: { translation: gu },
      kn: { translation: kn },
      ml: { translation: ml },
      or: { translation: or },
      pa: { translation: pa },
    },
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
  })

setDocumentLanguage(initialLanguage)

i18n.on('languageChanged', (language) => {
  const normalized = getSupportedLanguage(language)
  if (isBrowser) {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized)
  }
  setDocumentLanguage(normalized)
})

export default i18n
