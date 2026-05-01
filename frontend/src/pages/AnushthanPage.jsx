import { useEffect, useRef, useState } from 'react'
import './anushthan.css'

const WHATSAPP_NUMBER = import.meta.env.VITE_ANUSHTHAN_WHATSAPP_NUMBER || '919055451499'
const WHATSAPP_TEXT = 'Namaste mujhe Kuber Anushthan ke baare mein jaankari chahiye'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`

const PROBLEMS = [
  'पैसा आता है, लेकिन महीने के बीच में खत्म हो जाता है',
  'कर्ज कम होने की जगह हर महीने बढ़ रहा है',
  'कमाई के मौके बनते हैं, लेकिन आखिरी समय में रुक जाते हैं',
]

const TRUST_BADGES = [
  'अनुभवी ब्राह्मण',
  'सैकड़ों लोगों ने करवाया',
  'पूजा की फोटो/वीडियो साझा की जाती है',
]

const BENEFITS = [
  {
    title: 'धन प्रबंधन में स्थिरता',
    desc: 'आमदनी आती रहे और घर से अनावश्यक खर्च कम हो, इसी लक्ष्य से विधि की जाती है।',
  },
  {
    title: 'कर्ज के दबाव में राहत',
    desc: 'नियमित साधना से निर्णय स्पष्ट होते हैं और वित्तीय अनुशासन में मदद मिलती है।',
  },
  {
    title: 'काम और बिज़नेस में गति',
    desc: 'रुके हुए कार्य पूरे करने और नए अवसर पकड़ने में मानसिक स्थिरता मिलती है।',
  },
]

const TESTIMONIALS = [
  {
    name: 'Rakesh G., Indore',
    time: 'आज 10:42 AM',
    text: '2 महीने से EMI लेट हो रही थी। अनुष्ठान के बाद काम में स्थिरता आई और लगातार पेमेंट क्लियर होने लगी।',
  },
  {
    name: 'Pooja T., Jaipur',
    time: 'कल 8:10 PM',
    text: 'हमने पहले WhatsApp पर पूरी जानकारी ली, फिर बुक किया। हर दिन पूजा की फोटो मिली, भरोसा बना रहा।',
  },
  {
    name: 'Nitin S., Pune',
    time: '3 दिन पहले',
    text: 'कर्ज का दबाव बहुत था। 40 दिनों में सबसे बड़ा फर्क यह हुआ कि खर्च नियंत्रण में आया और आय टिकने लगी।',
  },
]

const FAQS = [
  {
    q: 'क्या पहले WhatsApp पर बात करके समझ सकते हैं?',
    a: 'हाँ, यही बेहतर है। आपकी स्थिति समझकर ही बुकिंग की सलाह दी जाती है।',
  },
  {
    q: 'भुगतान के बाद आगे क्या होता है?',
    a: 'टीम WhatsApp पर संपर्क करके नाम, गोत्र (यदि उपलब्ध) और आरंभ तिथि कन्फर्म करती है।',
  },
  {
    q: 'क्या पूजा का प्रमाण मिलता है?',
    a: 'हाँ, पूजा की फोटो/वीडियो साझा की जाती है ताकि प्रक्रिया पारदर्शी रहे।',
  },
]

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

async function handlePayment() {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID || ''
  if (!key) {
    alert('भुगतान अस्थायी रूप से उपलब्ध नहीं है। पहले WhatsApp पर जानकारी लें।')
    return
  }

  const loaded = await loadRazorpay()
  if (!loaded) {
    alert('Payment gateway लोड नहीं हो पाया। कृपया WhatsApp पर संपर्क करें।')
    return
  }

  const options = {
    key,
    amount: 39900,
    currency: 'INR',
    name: 'Kuber Anushthan',
    description: '40 Days Kuber Anushthan Booking',
    handler: () => {
      alert('Payment Successful! हमारी टीम WhatsApp पर संपर्क करेगी।')
    },
    prefill: {},
    notes: { source: 'anushthan_landing' },
    theme: { color: '#D5A028' },
  }

  const rzp = new window.Razorpay(options)
  rzp.open()
}

function useFadeIn() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('an-visible')
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}

function FadeSection({ className = '', children }) {
  const ref = useFadeIn()
  return (
    <div ref={ref} className={`an-fade ${className}`}>
      {children}
    </div>
  )
}

function GoldDivider() {
  return <div className="an-divider" />
}

function HeroSection() {
  return (
    <section className="an-hero">
      <div className="an-hero-inner">
        <p className="an-top-urgency">हर दिन सीमित लोगों के लिए</p>
        <h1 className="an-hero-h1">क्या आपके घर में पैसा टिकता नहीं?</h1>
        <p className="an-hero-sub">कर्ज बढ़ता जा रहा है या आमदनी रुक गई है?</p>
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="an-btn-primary an-pulse">
          WhatsApp पर जानकारी लें
        </a>
        <p className="an-hero-caption">पहले बात करें, फिर निर्णय लें</p>
      </div>
      <div className="an-hero-glow" />
    </section>
  )
}

function ProblemSection() {
  return (
    <section className="an-section">
      <FadeSection>
        <h2 className="an-section-title">अगर ये बातें आपकी जिंदगी में हैं...</h2>
        <ul className="an-problems">
          {PROBLEMS.map((item) => (
            <li key={item} className="an-problem-card">
              <span className="an-problem-dot" aria-hidden>
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </FadeSection>
    </section>
  )
}

function SolutionSection() {
  return (
    <section className="an-section an-section-dark">
      <FadeSection>
        <h2 className="an-section-title">कुबेर अनुष्ठान कैसे मदद करता है?</h2>
        <p className="an-section-para">
          यह 40 दिनों की अनुशासित वैदिक प्रक्रिया है, जिसमें अनुभवी ब्राह्मण आपके नाम से मंत्र जाप और पूजन करते
          हैं। इसका उद्देश्य घर की आर्थिक अस्थिरता, बढ़ते कर्ज और रुकी हुई आमदनी के चक्र को तोड़ना है।
        </p>
      </FadeSection>
    </section>
  )
}

function TrustSection() {
  return (
    <section className="an-section">
      <FadeSection>
        <h2 className="an-section-title">पहले भरोसा, फिर बुकिंग</h2>
        <div className="an-trust-badges">
          {TRUST_BADGES.map((badge) => (
            <span key={badge} className="an-trust-chip">
              {badge}
            </span>
          ))}
        </div>
        <div className="an-puja-proof">
          <div className="an-puja-image">
            <img
              src="/assets/anushthan/pandit-ji.png"
              alt="Pandit Ji performing puja"
              className="an-puja-photo"
              loading="lazy"
            />
            <div className="an-puja-overlay">
              <p>Pandit Ji Performing Puja</p>
              <small>Live puja setup image</small>
            </div>
          </div>
          <div className="an-puja-copy">
            <h3>पूजा प्रक्रिया पारदर्शी रहती है</h3>
            <p>पूजा शुरू होने के बाद टीम WhatsApp पर अपडेट देती है और फोटो/वीडियो साझा किए जाते हैं।</p>
          </div>
        </div>
      </FadeSection>
    </section>
  )
}

function TestimonialSection() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % TESTIMONIALS.length)
    }, 4500)
    return () => window.clearInterval(timer)
  }, [])

  const t = TESTIMONIALS[active]

  return (
    <section className="an-section an-section-dark">
      <FadeSection>
        <h2 className="an-section-title">लोग क्या कह रहे हैं</h2>
        <div className="an-testimonial-card" aria-live="polite">
          <div className="an-wa-header">
            <div className="an-wa-avatar">{t.name[0]}</div>
            <div>
              <p className="an-wa-name">{t.name}</p>
              <p className="an-wa-time">{t.time}</p>
            </div>
          </div>
          <p className="an-wa-msg">{t.text}</p>
          <div className="an-carousel-dots" role="tablist" aria-label="Testimonials carousel">
            {TESTIMONIALS.map((item, index) => (
              <button
                key={item.name}
                className={`an-dot ${index === active ? 'an-dot-active' : ''}`}
                onClick={() => setActive(index)}
                aria-label={`Testimonial ${index + 1}`}
                aria-pressed={index === active}
              />
            ))}
          </div>
        </div>
      </FadeSection>
    </section>
  )
}

function BenefitsSection() {
  return (
    <section className="an-section">
      <FadeSection>
        <h2 className="an-section-title">इस अनुष्ठान से आपको क्या मिलेगा</h2>
        <div className="an-benefits">
          {BENEFITS.map((item) => (
            <article key={item.title} className="an-benefit-card">
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </FadeSection>
    </section>
  )
}

function PricingSection() {
  return (
    <section className="an-section an-section-dark" id="book">
      <FadeSection>
        <div className="an-pricing-card">
          <p className="an-slot-badge">हर दिन सीमित लोगों के लिए</p>
          <h2 className="an-pricing-title">40 दिन कुबेर अनुष्ठान</h2>
          <div className="an-pricing-price">₹399</div>
          <p className="an-pricing-sub">एक बार बुकिंग, पूरी प्रक्रिया टीम के मार्गदर्शन में</p>
          <button className="an-btn-secondary an-btn-full" onClick={handlePayment}>
            ₹399 में बुक करें
          </button>
          <p className="an-secure-note">भुगतान सुरक्षित है (Razorpay)</p>
        </div>
      </FadeSection>
    </section>
  )
}

function CtaSection() {
  return (
    <section className="an-section">
      <FadeSection className="an-cta-wrap">
        <h2 className="an-section-title">आज ही बुक करें</h2>
        <p className="an-section-para">पहले WhatsApp पर अपनी स्थिति बताएं, फिर सही विकल्प के साथ आगे बढ़ें।</p>
        <div className="an-cta-actions">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="an-btn-primary an-btn-full">
            WhatsApp करें
          </a>
          <button className="an-btn-secondary an-btn-full" onClick={handlePayment}>
            ₹399 में बुक करें
          </button>
        </div>
      </FadeSection>
    </section>
  )
}

function FAQSection() {
  const [open, setOpen] = useState(null)

  return (
    <section className="an-section an-section-dark">
      <FadeSection>
        <h2 className="an-section-title">अक्सर पूछे जाने वाले सवाल</h2>
        <div className="an-faq-list">
          {FAQS.map((faq, index) => (
            <div key={faq.q} className="an-faq-item">
              <button
                className="an-faq-q"
                onClick={() => setOpen(open === index ? null : index)}
                aria-expanded={open === index}
              >
                <span>{faq.q}</span>
                <span className={`an-faq-arrow ${open === index ? 'an-faq-open' : ''}`}>▼</span>
              </button>
              <div className={`an-faq-a ${open === index ? 'an-faq-a-open' : ''}`}>
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </FadeSection>
    </section>
  )
}

function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="an-wa-float"
      aria-label="WhatsApp पर संपर्क करें"
    >
      <svg viewBox="0 0 32 32" fill="currentColor" className="an-wa-icon">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 2.827.737 5.48 2.027 7.786L0 32l8.43-2.008A15.93 15.93 0 0 0 16 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm0 29.333a13.28 13.28 0 0 1-6.77-1.853l-.486-.288-5.003 1.193 1.214-4.868-.317-.499A13.267 13.267 0 0 1 2.667 16C2.667 8.636 8.636 2.667 16 2.667S29.333 8.636 29.333 16 23.364 29.333 16 29.333zm7.27-9.878c-.399-.2-2.36-1.164-2.726-1.297-.366-.133-.632-.2-.899.2-.267.4-1.031 1.297-1.264 1.563-.233.267-.466.3-.865.1-.4-.2-1.688-.622-3.215-1.984-1.188-1.06-1.99-2.369-2.223-2.769-.233-.4-.025-.616.175-.815.18-.179.4-.466.6-.699.2-.233.267-.4.4-.666.133-.267.067-.5-.033-.699-.1-.2-.9-2.169-1.232-2.969-.325-.779-.655-.674-.9-.686l-.765-.013c-.267 0-.699.1-1.065.5s-1.398 1.365-1.398 3.33 1.431 3.863 1.631 4.13c.2.266 2.816 4.3 6.824 6.031.954.412 1.698.658 2.279.842.957.305 1.828.262 2.517.159.768-.114 2.36-.966 2.693-1.898.333-.933.333-1.733.233-1.9-.1-.166-.366-.266-.765-.466z" />
      </svg>
    </a>
  )
}

function StickyCTA({ visible }) {
  return (
    <div className={`an-sticky-cta ${visible ? 'an-sticky-visible' : ''}`}>
      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="an-btn-primary an-sticky-btn">
        WhatsApp करें
      </a>
      <button className="an-btn-secondary an-sticky-btn" onClick={handlePayment}>
        ₹399 में बुक करें
      </button>
    </div>
  )
}

export default function AnushthanPage() {
  const [stickyVisible, setStickyVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 950)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="an-root">
      <HeroSection />
      <GoldDivider />
      <ProblemSection />
      <GoldDivider />
      <SolutionSection />
      <GoldDivider />
      <TrustSection />
      <GoldDivider />
      <TestimonialSection />
      <GoldDivider />
      <BenefitsSection />
      <GoldDivider />
      <PricingSection />
      <GoldDivider />
      <CtaSection />
      <GoldDivider />
      <FAQSection />

      <footer className="an-footer">
        <p>© 2026 कुबेर अनुष्ठान सेवा | सभी अधिकार सुरक्षित</p>
      </footer>

      <WhatsAppButton />
      <StickyCTA visible={stickyVisible} />
    </div>
  )
}
