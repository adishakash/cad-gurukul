import { Link } from 'react-router-dom'

export default function Footer() {
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
              AI-powered career guidance platform helping Indian students in Class 10, 11, and 12 
              discover their ideal career path, stream, and subjects through adaptive assessment.
            </p>
            <p className="text-xs text-gray-500 mt-4">📍 Made with ❤️ for Indian Students</p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {[['/', 'Home'], ['/about', 'About Us'], ['/how-it-works', 'How It Works'], ['/plans', 'Pricing'], ['/contact', 'Contact']].map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-brand-red transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-white mb-4">Students</h4>
            <ul className="space-y-2 text-sm">
              {[['/register', 'Free Assessment'], ['/plans', 'Premium Report ₹499'], ['/login', 'Login'], ['/admin/login', 'Admin Login'], ['/staff/login', 'Internal Portal']].map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-brand-red transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500 gap-3">
          <p>© {new Date().getFullYear()} CAD Gurukul. All rights reserved.</p>
          <div className="flex space-x-4">
            <span className="cursor-pointer hover:text-gray-300">Privacy Policy</span>
            <span className="cursor-pointer hover:text-gray-300">Terms of Service</span>
            <span className="cursor-pointer hover:text-gray-300">Refund Policy</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
