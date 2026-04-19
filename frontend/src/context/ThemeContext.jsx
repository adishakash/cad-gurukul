import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ isDark: false, toggleTheme: () => {} })

const STORAGE_KEY = 'cg_theme'

/**
 * ThemeProvider — wraps the app to provide a persistent dark/light mode.
 * Preference is stored in localStorage (key: cg_theme = 'dark' | 'light').
 * Applies/removes the `dark` class on <html> so Tailwind dark: variants work.
 */
export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'dark'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const html = document.documentElement
    if (isDark) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light')
    } catch {
      // ignore storage errors in sandboxed environments
    }
  }, [isDark])

  const toggleTheme = () => setIsDark(prev => !prev)

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
