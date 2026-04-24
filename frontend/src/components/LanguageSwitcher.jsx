import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { LANGUAGE_OPTIONS, getLanguageLabel, getSupportedLanguage } from '../i18n/languages'
import { studentApi } from '../services/api'
import { selectIsAuthenticated, selectUser } from '../store/slices/authSlice'

export default function LanguageSwitcher({
  className = '',
  labelClassName = '',
  selectClassName = '',
  showLabel = false,
}) {
  const { t, i18n } = useTranslation()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const currentLanguage = getSupportedLanguage(i18n.language)
  const canSyncProfile = isAuthenticated && user && ['STUDENT', 'PARENT'].includes(user.role)

  const handleChange = async (event) => {
    const nextLanguage = event.target.value
    i18n.changeLanguage(nextLanguage)
    if (!canSyncProfile) return
    try {
      await studentApi.updateMe({ languagePreference: getLanguageLabel(nextLanguage) })
    } catch (_) {
      // Best-effort update; ignore failures to avoid blocking the UI.
    }
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
