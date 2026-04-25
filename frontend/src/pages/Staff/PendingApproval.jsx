import { Link } from 'react-router-dom'

export default function PendingApproval() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-md text-center space-y-6">
        <div className="text-5xl">⏳</div>
        <h2 className="text-2xl font-bold text-gray-900">Application Under Review</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Thank you for applying to the CAD Gurukul partner program. Our team will review your application
          and get back to you within <strong>2 business days</strong>. You will receive an email and
          WhatsApp notification once a decision is made.
        </p>
        <div className="bg-blue-50 rounded-lg p-4 text-left space-y-2 text-sm text-blue-800">
          <p className="font-semibold">What happens next?</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Admin reviews your application</li>
            <li>You receive an approval/rejection notification</li>
            <li>On approval, log in and set up your bank account</li>
            <li>Start sharing your referral link and earn commissions</li>
          </ul>
        </div>
        <Link to="/staff/login" className="inline-block text-sm text-blue-600 hover:underline">
          Go to Login
        </Link>
      </div>
    </div>
  )
}
