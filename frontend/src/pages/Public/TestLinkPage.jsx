import Seo from '../../components/SEO/Seo'

export default function TestLinkPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Seo
        title="Test Links Retired | CAD Gurukul"
        description="Test links are no longer supported on CAD Gurukul."
        noIndex
      />
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Test Links Retired</h1>
        <p className="text-gray-500">
          Test links are no longer supported. Please use the counsellor referral link to start the assessment
          and purchase plans.
        </p>
      </div>
    </div>
  )
}
