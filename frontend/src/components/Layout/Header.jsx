import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logoutUser, selectUser, selectIsAuthenticated } from '../../store/slices/authSlice'
import { useTheme } from '../../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../LanguageSwitcher'

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

export default function Header() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const { isDark, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useTranslation()

  const handleLogout = async () => {
    await dispatch(logoutUser())
    navigate('/')
  }

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/about', label: t('nav.about') },
    { to: '/how-it-works', label: t('nav.howItWorks') },
    { to: '/plans', label: t('nav.plansPricing') },
    { to: '/contact', label: t('nav.contact') },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <div>
              <span className="font-bold text-xl text-brand-dark">CAD</span>
              <span className="font-bold text-xl text-brand-red"> Gurukul</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-brand-red dark:hover:text-brand-red transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side: dark mode toggle + auth buttons */}
          <div className="hidden md:flex items-center space-x-3">
            <LanguageSwitcher />
            <button
              onClick={toggleTheme}
              aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>

            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-red dark:hover:text-brand-red transition-colors"
                >
                  {t('auth.dashboard')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="btn-outline text-sm px-4 py-2"
                >
                  {t('auth.logout')}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-red transition-colors">
                  {t('auth.login')}
                </Link>
                <Link to="/register?plan=free" className="btn-primary text-sm px-5 py-2">
                  {t('auth.getStartedFree')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile: Theme toggle + hamburger */}
          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              aria-label={t('theme.toggleTheme')}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-brand-red"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={t('header.toggleMenu')}
            >
              {menuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {menuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-3 shadow-lg animate-fade-in">
          <LanguageSwitcher
            showLabel
            className="justify-between"
            labelClassName="text-xs font-medium text-gray-600 dark:text-gray-300"
            selectClassName="text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-red py-1"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-col space-y-2">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="btn-secondary text-center text-sm" onClick={() => setMenuOpen(false)}>{t('auth.dashboard')}</Link>
                <button onClick={handleLogout} className="btn-outline text-sm">{t('auth.logout')}</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-secondary text-center text-sm" onClick={() => setMenuOpen(false)}>{t('auth.login')}</Link>
                <Link to="/register?plan=free" className="btn-primary text-center text-sm" onClick={() => setMenuOpen(false)}>{t('auth.getStartedFree')}</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
