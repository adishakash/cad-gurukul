const steps = [
  {
    number: '01',
    icon: '📝',
    title: 'Create Your Profile',
    desc: 'Register and complete a quick 5-step onboarding wizard. Tell us your class, board, interests, subjects, and goals. It takes less than 5 minutes.',
    detail: 'We collect academic details, hobby tags, preferred learning style, and parental background to give the AI strong context before your assessment even starts.',
  },
  {
    number: '02',
    icon: '🤖',
    title: 'Take the AI Assessment',
    desc: 'Answer 10–30 adaptive AI-generated questions tailored to your profile. Questions span aptitude, personality, interest, logic, and creativity.',
    detail: 'Our AI adapts based on your previous answers — if you show strong logical reasoning, it digs deeper. Questions are generated fresh for every student.',
  },
  {
    number: '03',
    icon: '📊',
    title: 'AI Analyses Your Results',
    desc: 'Once you submit, our AI evaluates all answers across 9 dimensions including STEM vs Non-STEM, Social Orientation, Creative Inclination, and more.',
    detail: 'We use Google Gemini 1.5 Pro for evaluation and score computation, and GPT-4o for premium report writing — giving you the best of both AI worlds.',
  },
  {
    number: '04',
    icon: '🗺️',
    title: 'Receive Your Career Report',
    desc: 'Get matched to 3–15+ careers with fit scores. See recommended stream, subjects, exam pathways, and step-by-step roadmaps for each career.',
    detail: 'Premium users also get parent guidance, college recommendations, entrance exam timelines, and a beautifully formatted downloadable PDF.',
  },
]

const faqs = [
  { q: 'Is this for Class 8, 9, 10, 11, or 12 students?', a: 'Yes — all five. We tailor the report to your stage. Class 8 & 9 students get early interest and aptitude mapping; Class 10 students get stream selection guidance; Class 11/12 get subject and career deepening.' },
  { q: 'How is this different from generic career tests?', a: 'Most tests give you a fixed list of careers without reasoning. CAD Gurukul uses live AI that understands your specific answers and generates a personalised, contextual report — not a template.' },
  { q: 'What does the free report include?', a: 'Top 3 career matches, a stream recommendation, and a personality overview. It\'s genuinely useful — not a teaser.' },
  { q: 'What does the premium report include?', a: '15+ careers, full scoring across 9 aptitude categories, roadmap for each career, parent guidance, college suggestions, entrance exam timeline, and a PDF to share.' },
  { q: 'How long does the assessment take?', a: 'Free: 8–12 minutes. Premium: 20–30 minutes. You can pause and resume.' },
  { q: 'Can parents use this too?', a: 'Yes — you can register as a parent and start an assessment on behalf of your child. The onboarding collects child details.' },
]

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-brand-dark text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">How CAD Gurukul Works</h1>
        <p className="text-lg text-gray-300 max-w-xl mx-auto">
          From signup to your personalised career report — here's exactly what happens at each step.
        </p>
      </section>

      {/* Steps */}
      <section className="py-16 px-4 max-w-4xl mx-auto">
        <div className="space-y-12">
          {steps.map((step, i) => (
            <div key={step.number} className={`flex gap-6 ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
              <div className="shrink-0 w-16 h-16 rounded-2xl bg-brand-red text-white flex flex-col items-center justify-center font-extrabold text-xs md:w-20 md:h-20">
                <span className="text-2xl">{step.icon}</span>
                <span className="opacity-70">{step.number}</span>
              </div>
              <div className="card flex-1 hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-extrabold text-brand-dark mb-2">{step.title}</h3>
                <p className="text-gray-700 mb-3">{step.desc}</p>
                <p className="text-sm text-gray-500 border-t pt-3">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-extrabold text-brand-dark text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.q} className="card group cursor-pointer">
                <summary className="font-semibold text-brand-dark flex items-center justify-between list-none">
                  {faq.q}
                  <span className="text-brand-red group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <p className="text-gray-600 text-sm mt-3 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
