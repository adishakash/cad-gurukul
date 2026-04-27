import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { storeReferralCode } from '../../utils/referral'
import Seo from '../../components/SEO/Seo'

export default function ReferralRedirect() {
  const { referralCode } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (referralCode) storeReferralCode(referralCode)
    const target = location.search ? `/${location.search}` : '/'
    navigate(target, { replace: true })
  }, [referralCode, location.search, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
      <Seo
        title="Redirecting | CAD Gurukul"
        description="Routing you to your CAD Gurukul experience."
        noIndex
      />
      Redirecting...
    </div>
  )
}
