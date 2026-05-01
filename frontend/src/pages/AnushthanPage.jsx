import { useEffect, useRef, useState } from 'react'
import './anushthan.css'

/* ─────────────────────────────────────────────
   Razorpay helper
───────────────────────────────────────────── */
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
  const ok = await loadRazorpay()
  if (!ok) {
    alert('Payment gateway लोड नहीं हो सका। कृपया पुनः प्रयास करें।')
    return
  }
  const options = {
    key: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
    amount: 39900,
    currency: 'INR',
    name: 'Kuber Anushthan',
    description: '40 Days Kuber Mantra Jap',
    handler: function () {
      alert('Payment Successful! We will contact you.')
    },
    prefill: {},
    theme: { color: '#d4af37' },
  }
  const rzp = new window.Razorpay(options)
  rzp.open()
}

/* ─────────────────────────────────────────────
   Scroll-fade hook
───────────────────────────────────────────── */
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
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

function FadeSection({ children, className = '' }) {
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

const WHATSAPP_URL =
  'https://wa.me/9055451499?text=Namaste%20Kuber%20Anushthan%20ke%20baare%20mein%20jaankari%20chahiye'

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function AnushthanPage() {
  const [stickyVisible, setStickyVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="an-root">
      {/* ── 1. HERO ─────────────────────────────── */}
      <section className="an-hero">
        <div className="an-hero-inner">
          <div className="an-badge">🔱 विशेष अनुष्ठान – सीमित स्लॉट</div>
          <h1 className="an-hero-h1">
            क्या आपके घर में<br />
            <span className="an-gold">पैसा टिकता नहीं?</span>
          </h1>
          <p className="an-hero-sub">
            40 दिनों का कुबेर मंत्र जाप अनुष्ठान<br />
            <span className="an-gold-light">– अनुभवी सरस्वत ब्राह्मण द्वारा –</span>
          </p>
          <button className="an-btn-primary an-pulse" onClick={handlePayment}>
            अभी बुक करें &nbsp;₹399
          </button>
          <p className="an-hero-trust">🔒 100% सुरक्षित भुगतान &nbsp;|&nbsp; ✅ तुरंत पुष्टि</p>
        </div>
        <div className="an-hero-glow" />
      </section>

      <GoldDivider />

      {/* ── 2. PROBLEM ──────────────────────────── */}
      <section className="an-section">
        <FadeSection>
          <h2 className="an-section-title">क्या आप इन समस्याओं से जूझ रहे हैं?</h2>
          <div className="an-problems">
            {[
              { icon: '💸', text: 'पैसा आता है, लेकिन टिकता नहीं' },
              { icon: '📉', text: 'कर्ज बढ़ता जा रहा है, राहत नहीं मिल रही' },
              { icon: '🚧', text: 'बिज़नेस या नौकरी में लगातार रुकावट' },
            ].map((item) => (
              <div key={item.text} className="an-problem-card">
                <span className="an-problem-icon">{item.icon}</span>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
          <p className="an-problem-note">
            इन सभी समस्याओं का एक आध्यात्मिक समाधान है — <span className="an-gold">कुबेर मंत्र अनुष्ठान।</span>
          </p>
        </FadeSection>
      </section>

      <GoldDivider />

      {/* ── 3. SOLUTION ─────────────────────────── */}
      <section className="an-section an-section-dark">
        <FadeSection>
          <h2 className="an-section-title">40 दिन का अनुष्ठान क्या है?</h2>
          <p className="an-section-para">
            हमारे अनुभवी <strong className="an-gold">सरस्वत ब्राह्मण</strong> 40 दिनों तक प्रतिदिन निश्चित
            समय पर आपकी ओर से कुबेर मंत्र का जाप करते हैं। यह अनुष्ठान वैदिक परंपरा के अनुसार पूर्ण
            विधि-विधान से संपन्न होता है।
          </p>
          <div className="an-benefits">
            {[
              { icon: '🪙', title: 'धन स्थिरता', desc: 'घर में धन का प्रवाह और संचय सुनिश्चित होता है' },
              { icon: '🙏', title: 'कर्ज राहत', desc: 'नकारात्मक वित्तीय ऊर्जा दूर होती है' },
              { icon: '🌟', title: 'नए अवसर', desc: 'व्यापार और करियर में नए द्वार खुलते हैं' },
            ].map((b) => (
              <div key={b.title} className="an-benefit-card">
                <div className="an-benefit-icon">{b.icon}</div>
                <h3 className="an-benefit-title">{b.title}</h3>
                <p className="an-benefit-desc">{b.desc}</p>
              </div>
            ))}
          </div>
        </FadeSection>
      </section>

      <GoldDivider />

      {/* ── 4. TESTIMONIALS ─────────────────────── */}
      <section className="an-section">
        <FadeSection>
          <h2 className="an-section-title">लोगों के अनुभव</h2>
          <div className="an-testimonials">
            {[
              {
                name: 'Ramesh S., Mumbai',
                time: 'आज दोपहर 2:14 बजे',
                msg: 'भाई साहब, 40 दिन पूरे होने के बाद से घर में पैसों की तंगी काफी कम हो गई है। सच में बहुत फर्क पड़ा। 🙏',
              },
              {
                name: 'Sunita D., Jaipur',
                time: 'कल रात 9:03 बजे',
                msg: 'मेरे पति का बिज़नेस 2 साल से ठप था। अनुष्ठान के बाद एक बड़ा ऑर्डर आया। माँ लक्ष्मी की कृपा है। 🪔',
              },
              {
                name: 'Vijay K., Pune',
                time: '3 दिन पहले',
                msg: 'पहले तो मुझे भरोसा नहीं था, लेकिन अब मैं खुद recommend करता हूँ। कर्ज से बहुत राहत मिली। ✅',
              },
            ].map((t) => (
              <div key={t.name} className="an-testimonial-card">
                <div className="an-wa-header">
                  <div className="an-wa-avatar">{t.name[0]}</div>
                  <div>
                    <p className="an-wa-name">{t.name}</p>
                    <p className="an-wa-time">{t.time}</p>
                  </div>
                </div>
                <p className="an-wa-msg">{t.msg}</p>
              </div>
            ))}
          </div>
        </FadeSection>
      </section>

      <GoldDivider />

      {/* ── 5. TRUST ────────────────────────────── */}
      <section className="an-section an-section-dark">
        <FadeSection>
          <h2 className="an-section-title">हम पर भरोसा क्यों करें?</h2>
          <div className="an-trust-grid">
            {[
              { icon: '📿', title: 'अनुभवी सरस्वत ब्राह्मण', desc: 'वैदिक परंपरा में दशकों का अनुभव' },
              { icon: '👥', title: 'सैकड़ों परिवारों का विश्वास', desc: '500+ परिवार अब तक लाभान्वित' },
              { icon: '📸', title: 'पूजा का प्रमाण', desc: 'प्रतिदिन पूजा की फोटो/वीडियो साझा की जाती है' },
            ].map((t) => (
              <div key={t.title} className="an-trust-card">
                <div className="an-trust-icon">{t.icon}</div>
                <h3 className="an-trust-title">{t.title}</h3>
                <p className="an-trust-desc">{t.desc}</p>
              </div>
            ))}
          </div>
        </FadeSection>
      </section>

      <GoldDivider />

      {/* ── 6. PRICING + CTA ────────────────────── */}
      <section className="an-section" id="book">
        <FadeSection>
          <div className="an-pricing-card">
            <div className="an-slot-badge">⚡ सीमित स्लॉट उपलब्ध</div>
            <p className="an-pricing-label">40 दिन कुबेर मंत्र जाप अनुष्ठान</p>
            <div className="an-pricing-price">
              <span className="an-price-strike">₹1,999</span>
              <span className="an-price-main">₹399</span>
            </div>
            <ul className="an-pricing-list">
              <li>✅ 40 दिन नियमित जाप</li>
              <li>✅ प्रतिदिन पूजा फोटो/वीडियो</li>
              <li>✅ वैदिक विधि-विधान</li>
              <li>✅ WhatsApp पर पुष्टि</li>
            </ul>
            <button className="an-btn-primary an-btn-full an-pulse" onClick={handlePayment}>
              अभी बुक करें — ₹399
            </button>
            <p className="an-secure-note">🔒 100% Secure Payment via Razorpay</p>
          </div>
        </FadeSection>
      </section>

      <GoldDivider />

      {/* ── 7. FAQ ──────────────────────────────── */}
      <section className="an-section an-section-dark">
        <FadeSection>
          <h2 className="an-section-title">अक्सर पूछे जाने वाले प्रश्न</h2>
          <FaqList />
        </FadeSection>
      </section>

      {/* ── FOOTER ──────────────────────────────── */}
      <footer className="an-footer">
        <p>© 2026 कुबेर अनुष्ठान सेवा &nbsp;|&nbsp; सभी अधिकार सुरक्षित</p>
      </footer>

      {/* ── FLOATING WHATSAPP ───────────────────── */}
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

      {/* ── STICKY BOTTOM CTA (mobile) ───────────── */}
      <div className={`an-sticky-cta ${stickyVisible ? 'an-sticky-visible' : ''}`}>
        <button className="an-btn-primary an-btn-full" onClick={handlePayment}>
          अभी बुक करें — ₹399 &nbsp;⚡
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   FAQ accordion
───────────────────────────────────────────── */
const FAQS = [
  {
    q: 'क्या यह अनुष्ठान सच में काम करता है?',
    a: 'हाँ। यह वैदिक परंपरा पर आधारित है। 500+ परिवारों ने सकारात्मक परिणाम अनुभव किए हैं। परिणाम आस्था और निरंतरता पर निर्भर करते हैं।',
  },
  {
    q: 'भुगतान के बाद क्या होगा?',
    a: 'भुगतान के 24 घंटे के भीतर हमारे प्रतिनिधि WhatsApp पर संपर्क करेंगे और अनुष्ठान प्रारंभ की तिथि व विवरण देंगे।',
  },
  {
    q: 'क्या Refund मिलेगा?',
    a: 'एक बार अनुष्ठान प्रारंभ होने के बाद refund संभव नहीं है। अनुष्ठान शुरू होने से पहले किसी समस्या के लिए WhatsApp पर संपर्क करें।',
  },
]

function FaqList() {
  const [open, setOpen] = useState(null)
  return (
    <div className="an-faq-list">
      {FAQS.map((faq, i) => (
        <div key={i} className="an-faq-item">
          <button
            className="an-faq-q"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span>{faq.q}</span>
            <span className={`an-faq-arrow ${open === i ? 'an-faq-open' : ''}`}>▼</span>
          </button>
          <div className={`an-faq-a ${open === i ? 'an-faq-a-open' : ''}`}>
            <p>{faq.a}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
