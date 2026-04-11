import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logoutUser, selectUser, selectIsAuthenticated } from '../../store/slices/authSlice'
import { toggleMobileMenu, closeMobileMenu } from '../../store/slices/uiSlice'

export default function Header() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await dispatch(logoutUser())
    navigate('/')
  }

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/how-it-works', label: 'How It Works' },
    { to: '/plans', label: 'Plans & Pricing' },
    { to: '/contact', label: 'Contact' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
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
                className="text-sm font-medium text-gray-600 hover:text-brand-red transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-gray-700 hover:text-brand-red transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="btn-outline text-sm px-4 py-2"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-brand-red transition-colors">
                  Login
                </Link>
                <Link to="/register" className="btn-primary text-sm px-5 py-2">
                  Get Started Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-brand-red"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 shadow-lg animate-fade-in">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="block text-sm font-medium text-gray-700 hover:text-brand-red py-1"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-gray-100 flex flex-col space-y-2">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="btn-secondary text-center text-sm" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <button onClick={handleLogout} className="btn-outline text-sm">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-secondary text-center text-sm" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link to="/register" className="btn-primary text-center text-sm" onClick={() => setMenuOpen(false)}>Get Started Free</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
