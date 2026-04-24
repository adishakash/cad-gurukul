import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="bg-brand-dark text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="font-bold text-xl text-white">CAD Gurukul</span>
            </div>
            <p className="text-sm text-gray-400 max-w-md leading-relaxed">
              {t('footer.tagline')}
            </p>
            <p className="text-xs text-gray-500 mt-4">📍 {t('footer.madeWithLove')}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">{t('footer.quickLinks')}</h4>
            <ul className="space-y-2 text-sm">
              {[
                ['/', t('footer.links.home')],
                ['/about', t('footer.links.about')],
                ['/how-it-works', t('footer.links.howItWorks')],
                ['/plans', t('footer.links.pricing')],
                ['/contact', t('footer.links.contact')],
              ].map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-brand-red transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-white mb-4">{t('footer.students')}</h4>
            <ul className="space-y-2 text-sm">
              {[
                ['/register', t('footer.studentsLinks.freeAssessment')],
                ['/plans', t('footer.studentsLinks.premiumReport', { price: '₹499' })],
                ['/login', t('footer.studentsLinks.login')],
                ['/admin/login', t('footer.studentsLinks.adminLogin')],
                ['/staff/login', t('footer.studentsLinks.internalPortal')],
              ].map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-brand-red transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500 gap-3">
          <p>© {new Date().getFullYear()} CAD Gurukul. {t('footer.rights')}</p>
          <div className="flex space-x-4">
            <span className="cursor-pointer hover:text-gray-300">{t('footer.policies.privacy')}</span>
            <span className="cursor-pointer hover:text-gray-300">{t('footer.policies.terms')}</span>
            <span className="cursor-pointer hover:text-gray-300">{t('footer.policies.refund')}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
