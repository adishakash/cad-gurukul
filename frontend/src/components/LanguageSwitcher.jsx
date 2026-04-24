import { useTranslation } from 'react-i18next'
import { LANGUAGE_OPTIONS, getSupportedLanguage } from '../i18n/languages'

export default function LanguageSwitcher({
  className = '',
  labelClassName = '',
  selectClassName = '',
  showLabel = false,
}) {
  const { t, i18n } = useTranslation()
  const currentLanguage = getSupportedLanguage(i18n.language)

  const handleChange = (event) => {
    i18n.changeLanguage(event.target.value)
  }

  const selectClasses = selectClassName ||
    'text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-red'

  return (
    <label className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className={labelClassName}>{t('language.label')}</span>
      )}
      <select
        aria-label={t('language.switcherAria')}
        className={selectClasses}
        value={currentLanguage}
        onChange={handleChange}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
