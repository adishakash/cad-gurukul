const team = [
  { name: 'Akash Sharma', role: 'Founder & Career Counsellor', emoji: '🎓' },
  { name: 'Priya Rajan', role: 'AI & Education Lead', emoji: '🤖' },
  { name: 'Rohan Mehta', role: 'Platform Engineer', emoji: '💻' },
]

const values = [
  { icon: '🎯', title: 'Student-First', desc: 'Every feature is built around what a student in Class 10–12 actually needs, not what looks impressive.' },
  { icon: '🤖', title: 'AI with Intent', desc: 'We use AI not to replace human guidance, but to make personalised guidance accessible to every student across India.' },
  { icon: '🌍', title: 'Made for Bharat', desc: 'Designed for Indian boards, Indian careers, Indian family dynamics. No generic Western templates.' },
  { icon: '🔐', title: 'Privacy by Default', desc: 'Your answers and profile are never shared. Your career data is yours — always.' },
]

export default function About() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-brand-dark text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">About CAD Gurukul</h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
          We believe every Class 8–12 student in India deserves clarity about their future — not confusion, not peer pressure.
        </p>
      </section>

      {/* Mission */}
      <section className="py-16 px-4 max-w-3xl mx-auto text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-red">Our Mission</span>
        <h2 className="text-3xl font-extrabold text-brand-dark mt-2 mb-4">
          Turning "What should I do after 10th?" into a confident answer.
        </h2>
        <p className="text-gray-600 text-lg leading-relaxed">
          CAD Gurukul uses advanced AI assessments to analyse a student's aptitude, personality, interests, and learning style — 
          and matches them to careers that truly fit. We pair AI intelligence with deep knowledge of Indian education 
          systems so students and parents get guidance that actually makes sense.
        </p>
      </section>

      {/* Values */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold text-brand-dark">What We Stand For</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {values.map((v) => (
              <div key={v.title} className="card flex gap-4">
                <div className="text-4xl shrink-0">{v.icon}</div>
                <div>
                  <h3 className="font-bold text-brand-dark mb-1">{v.title}</h3>
                  <p className="text-gray-600 text-sm">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-14 px-4 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-extrabold text-brand-dark">The Team</h2>
          <p className="text-gray-500 mt-2 text-sm">Educators, engineers, and AI researchers — united by one goal.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {team.map((m) => (
            <div key={m.name} className="card text-center">
              <div className="text-5xl mb-3">{m.emoji}</div>
              <div className="font-bold text-brand-dark">{m.name}</div>
              <div className="text-sm text-gray-500 mt-1">{m.role}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
