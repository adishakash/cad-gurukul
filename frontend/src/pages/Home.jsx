import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LeadCaptureForm from '../components/LeadCaptureForm'

const stats = [
  { label: 'Students Guided', value: '10,000+' },
  { label: 'Careers Mapped', value: '200+' },
  { label: 'AI Accuracy', value: '94%' },
  { label: 'Happy Families', value: '8,500+' },
]

const steps = [
  { step: '01', title: 'Create Free Account', desc: 'Sign up in 30 seconds — no credit card required.', emoji: '✍️' },
  { step: '02', title: 'Complete Your Profile', desc: 'Tell us about your class, board, interests, and academic background.', emoji: '👤' },
  { step: '03', title: 'Take AI Assessment', desc: 'Answer 10-30 adaptive questions tailored to your age and interests.', emoji: '🧠' },
  { step: '04', title: 'Get Your Report', desc: 'Receive a personalized career guidance report with stream and career recommendations.', emoji: '📊' },
]

const careers = ['Engineering', 'Medicine', 'Law', 'Commerce & Finance', 'Design & Arts', 'Civil Services', 'Teaching', 'Entrepreneurship', 'IT & Software', 'Media & Journalism', 'Architecture', 'Psychology']

export default function Home() {
  const navigate = useNavigate()
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [capturePlan, setCapturePlan] = useState('free')

  const openLeadModal = (plan = 'free') => {
    setCapturePlan(plan)
    setShowLeadModal(true)
  }

  return (
    <div className="animate-fade-in">
      {/* ─── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-brand-dark via-brand-navy to-blue-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-brand-light mb-6 backdrop-blur-sm">
              ⚡ 127 students got career clarity today — join them
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Don't Let the Wrong Stream
              <span className="text-brand-red"> Cost You 3 Years</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-4 leading-relaxed max-w-2xl">
              India's AI career test for Class 8–12. Takes 10 minutes. Gives you clarity that counsellors charge ₹5,000+ for.
            </p>
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 mb-6 text-sm text-gray-200 italic">
              "Based on your answers, you are <span className="text-yellow-300 font-semibold not-italic">NOT suited for random stream selection</span>. Find out your exact path before it's too late."
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => navigate('/assessment')} className="btn-primary text-center text-lg px-8 py-4">
                Start Free Career Test 🎯
              </button>
              <Link to="/how-it-works" className="border-2 border-white/40 text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/10 transition-all text-center">
                See How It Works
              </Link>
            </div>
            <p className="text-sm text-gray-400 mt-4">✅ Free — no login needed to start &nbsp;|&nbsp; ⏱ Only 10 minutes &nbsp;|&nbsp; 🔒 Your data is safe</p>
          </div>
        </div>

        {/* Floating cards */}
        <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 space-y-3">
          {[
            { emoji: '🎯', text: 'Stream Selection', color: 'bg-blue-500' },
            { emoji: '🧩', text: 'Aptitude Analysis', color: 'bg-purple-500' },
            { emoji: '📈', text: '3-Year Roadmap', color: 'bg-green-500' },
            { emoji: '🎓', text: 'College Guidance', color: 'bg-orange-500' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 rounded-xl px-5 py-3">
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-sm font-medium">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Stats ────────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-brand-navy">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="section-title">How CAD Gurukul Works</h2>
          <p className="section-subtitle mb-14">From signup to career report in under 30 minutes.</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.step} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-brand-red to-transparent z-0" />
                )}
                <div className="card text-center hover:shadow-lg transition-shadow relative z-10">
                  <div className="text-4xl mb-3">{s.emoji}</div>
                  <div className="text-xs font-bold text-brand-red tracking-widest mb-2">STEP {s.step}</div>
                  <h3 className="font-bold text-brand-dark mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-600">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Careers Explored ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="section-title">200+ Careers Explored</h2>
          <p className="section-subtitle mb-10">Our AI maps your profile to the most relevant careers in India and beyond.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {careers.map((c) => (
              <span key={c} className="bg-primary-50 text-primary-700 border border-primary-200 px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-100 transition-colors cursor-default">
                {c}
              </span>
            ))}
            <span className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm font-medium">+ 188 more...</span>
          </div>
        </div>
      </section>

      {/* ─── Plans CTA ────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-brand-navy to-brand-dark text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start with a Free Report or Get Premium at <span className="text-brand-red">₹499</span>
          </h2>
          <p className="text-gray-300 mb-10 text-lg">
            No hidden charges. One-time payment. Lifetime access to your report.
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10">
            {[
              { plan: 'Free', value: 'free', price: '₹0', features: ['10 Questions', 'Basic Report', 'Stream Recommendation', '3 Career Options'], cta: 'Start Free', outline: true },
              { plan: 'Premium', value: 'paid', price: '₹499', features: ['30 Questions', 'Full AI Report', 'Subject Recommendations', '7 Career Fits', '3-Year Roadmap', 'PDF Download', 'Parent Guidance'], cta: 'Get Premium Report', outline: false },
            ].map((p) => (
              <div key={p.plan} className="bg-white/10 border border-white/20 rounded-2xl p-6 text-left">
                <div className="text-2xl font-bold text-white mb-1">{p.plan}</div>
                <div className="text-3xl font-bold text-brand-red mb-4">{p.price}</div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => openLeadModal(p.value)}
                  className={p.outline ? 'btn-outline w-full text-center block' : 'btn-primary w-full text-center block'}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400">🔒 Secure payment via Razorpay &nbsp;|&nbsp; 💯 Trusted by 8,500+ Indian families</p>
        </div>
      </section>

      {/* ─── Testimonials ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-title text-center">What Students Say</h2>
          <p className="section-subtitle text-center mb-12">Real stories from real students across India.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Priya Sharma', city: 'Delhi', class: 'Class 12 • CBSE', text: 'CAD Gurukul helped me realize that I should pursue Psychology, not Engineering. The report was so detailed and accurate about my personality.', rating: 5 },
              { name: 'Rohan Patel', city: 'Ahmedabad', class: 'Class 10 • CBSE', text: 'The AI questions were so smart! It understood my interest in computers and correctly suggested Computer Science. The roadmap section was incredibly helpful.', rating: 5 },
              { name: 'Ananya Krishnan', city: 'Chennai', class: 'Class 11 • State Board', text: 'My parents were confused about my stream choice. After the paid report, even they were convinced about Commerce for me. Worth every rupee!', rating: 5 },
            ].map((t) => (
              <div key={t.name} className="card">
                <div className="flex text-yellow-400 mb-3">{'★'.repeat(t.rating)}</div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-red to-brand-navy flex items-center justify-center text-white font-bold text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-brand-dark">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.class} • {t.city}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="py-16 bg-brand-red text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">One Wrong Decision Can Cost 3 Years. Get Clarity Now.</h2>
          <p className="text-lg text-red-100 mb-2">Join 10,000+ Indian students who've already found clarity with CAD Gurukul.</p>
          <p className="text-sm text-red-200 mb-8">Takes 10 minutes. Free basic report. No login needed to start.</p>
          <button onClick={() => navigate('/assessment')} className="bg-white text-brand-red px-8 py-4 rounded-lg font-bold text-lg hover:bg-red-50 transition-colors inline-block">
            Start Free Career Test Now 🎯
          </button>
        </div>
      </section>

      {/* ─── Sticky mobile CTA ──────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shadow-xl">
        <div className="flex-1 text-sm">
          <div className="font-bold text-brand-dark">Free AI Career Test 🎯</div>
          <div className="text-xs text-gray-500">10 min · No login needed to start</div>
        </div>
        <button onClick={() => navigate('/assessment')} className="btn-primary text-sm px-5 py-2">
          Start Now →
        </button>
      </div>

      {/* ─── Lead Capture Modal ──────────────────────────────────────────────── */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowLeadModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
              <h2 className="font-bold text-brand-dark text-lg">
                {capturePlan === 'paid' ? 'Start Premium Career Journey' : 'Start Your Free Career Assessment'}
              </h2>
              <button onClick={() => setShowLeadModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <LeadCaptureForm selectedPlan={capturePlan} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
