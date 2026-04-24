import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'

function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

/**
 * ThemeToggle — a compact dark/light toggle button.
 * Uses useTheme() from ThemeContext. Works anywhere ThemeProvider wraps the tree.
 * Pass className to override padding/margin.
 */
export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme()
  const { t } = useTranslation()

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      className={`p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-200 hover:bg-white/10 ${className}`}
      title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
