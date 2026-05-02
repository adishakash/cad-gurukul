import { useCallback, useEffect, useMemo, useState } from 'react'

const WHATSAPP_LINK =
  'https://wa.me/919055451499?text=Namaste%20mujhe%20Kuber%20Anushthan%20ke%20baare%20mein%20jaankari%20chahiye'

const PRICE_RUPEES = 399
const PRICE_PAISE = 39900

const testimonials = [
  {
    name: 'Rohit S.',
    time: '10:24 AM',
    text: 'Namaste ji 🙏\nमैंने अनुष्ठान करवाया था\nअब पैसा थोड़ा रुकने लगा है\nधन्यवाद',
  },
  {
    name: 'Pooja M.',
    time: '7:42 PM',
    text: 'प्रक्रिया बहुत स्पष्ट थी,\nपूजा की फोटो भी मिली,\nमन को संतोष मिला।',
  },
  {
    name: 'Vivek K.',
    time: '9:11 AM',
    text: 'धीरे-धीरे आर्थिक स्थिति में फर्क दिख रहा है,\nनियमित अपडेट के लिए धन्यवाद।',
  },
]

const problemPoints = [
  'पैसा आते ही खत्म हो जाता है',
  'कर्ज कम नहीं हो रहा',
  'मेहनत के बाद भी पैसा नहीं रुकता',
  'व्यापार/नौकरी में रुकावट',
]

const solutionPoints = ['व्यक्तिगत संकल्प', 'नियमित मंत्र जाप', 'पूरी विधि']

const benefitPoints = ['पैसा धीरे-धीरे रुकने लगता है', 'आर्थिक स्थिति में सुधार', 'मन में शांति']

function AnushthanPage() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [razorpayLoading, setRazorpayLoading] = useState(false)

  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID

  const observerOptions = useMemo(
    () => ({
      threshold: 0.12,
      root: null,
      rootMargin: '0px 0px -40px 0px',
    }),
    []
  )

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    const nodes = document.querySelectorAll('[data-animate]')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show')
          observer.unobserve(entry.target)
        }
      })
    }, observerOptions)

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [observerOptions])

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 3200)
    return () => window.clearInterval(id)
  }, [])

  const scrollToPricing = useCallback(() => {
    const pricing = document.getElementById('pricing-section')
    if (pricing) {
      pricing.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const scrollToNext = useCallback(() => {
    const problem = document.getElementById('problem-section')
    if (problem) {
      problem.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true)
        return
      }

      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')
      if (existing) {
        existing.addEventListener('load', () => resolve(true), { once: true })
        existing.addEventListener('error', () => resolve(false), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }, [])

  const handlePayment = useCallback(async () => {
    if (!razorpayKey) {
      alert('Payment setup incomplete. Please contact support on WhatsApp.')
      return
    }

    setRazorpayLoading(true)
    const loaded = await loadRazorpayScript()
    setRazorpayLoading(false)

    if (!loaded || !window.Razorpay) {
      alert('Payment service is temporarily unavailable. Please continue on WhatsApp.')
      return
    }

    const options = {
      key: razorpayKey,
      amount: PRICE_PAISE,
      currency: 'INR',
      name: 'Kuber Anushthan',
      description: '40 Days Anushthan Booking',
      handler: function () {
        alert('Payment Successful! We will contact you.')
      },
      theme: {
        color: '#d4af37',
      },
      modal: {
        ondismiss: function () {},
      },
    }

    const paymentObject = new window.Razorpay(options)
    paymentObject.open()
  }, [loadRazorpayScript, razorpayKey])

  return (
    <div className="anushthan-page">
      <style>{`
        :root {
          --bg: #0b0f1a;
          --card: #12192b;
          --gold: #d4af37;
          --text: #ffffff;
          --muted: #b8c2d9;
          --line: rgba(212, 175, 55, 0.25);
        }

        .anushthan-page {
          background:
            radial-gradient(1200px 500px at 0% -10%, rgba(212,175,55,0.12), transparent 60%),
            radial-gradient(900px 500px at 100% 10%, rgba(212,175,55,0.08), transparent 55%),
            var(--bg);
          color: var(--text);
          min-height: 100vh;
          font-family: "Noto Sans Devanagari", "Hind", "Mukta", sans-serif;
          scroll-behavior: smooth;
          padding-bottom: 96px;
        }

        .wrap {
          width: min(980px, 92%);
          margin: 0 auto;
        }

        .section {
          padding: 48px 0;
        }

        .hero {
          padding: 72px 0 48px;
          text-align: left;
        }

        .kicker {
          display: inline-block;
          border: 1px solid var(--line);
          color: var(--gold);
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 13px;
          background: rgba(212,175,55,0.08);
          margin-bottom: 16px;
        }

        h1 {
          font-size: clamp(30px, 8vw, 52px);
          line-height: 1.15;
          margin: 0 0 14px;
          letter-spacing: 0.2px;
        }

        .sub {
          color: var(--muted);
          font-size: clamp(16px, 4.5vw, 21px);
          margin-bottom: 16px;
        }

        .trust-line {
          border-left: 3px solid var(--gold);
          padding-left: 12px;
          color: #fff;
          opacity: 0.95;
          margin-bottom: 24px;
        }

        .cta-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .btn {
          border: 0;
          text-decoration: none;
          cursor: pointer;
          border-radius: 14px;
          padding: 14px 18px;
          font-size: 16px;
          font-weight: 700;
          transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn-main {
          background: linear-gradient(180deg, #e4c15f, #d4af37);
          color: #111;
          box-shadow: 0 8px 24px rgba(212, 175, 55, 0.28);
          min-width: 220px;
        }

        .btn-main:hover {
          box-shadow: 0 10px 28px rgba(212, 175, 55, 0.38);
        }

        .btn-ghost {
          background: rgba(255, 255, 255, 0.04);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.16);
          min-width: 150px;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .card {
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)), var(--card);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 18px;
        }

        .card h2 {
          margin: 0 0 14px;
          font-size: clamp(23px, 5.8vw, 34px);
        }

        .points {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 10px;
        }

        .point {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          color: #eef3ff;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 9px;
          background: var(--gold);
          box-shadow: 0 0 10px rgba(212,175,55,0.7);
          flex: 0 0 auto;
        }

        .note {
          margin-top: 12px;
          color: #ffe7a8;
          font-weight: 600;
        }

        .trust-media {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
        }

        .trust-media img {
          width: 100%;
          height: 140px;
          object-fit: cover;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.12);
        }

        .trust-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag {
          font-size: 14px;
          border: 1px solid var(--line);
          color: #f7e3a3;
          background: rgba(212,175,55,0.08);
          padding: 7px 10px;
          border-radius: 999px;
        }

        .chat-wrap {
          display: grid;
          gap: 12px;
          margin-top: 12px;
        }

        .chat-card {
          background: #0f1f1a;
          border: 1px solid rgba(31, 168, 85, 0.32);
          border-radius: 14px;
          padding: 12px;
        }

        .chat-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: #b8efca;
          margin-bottom: 8px;
        }

        .chat-bubble {
          background: #1a3327;
          border: 1px solid rgba(127, 237, 170, 0.24);
          border-radius: 10px;
          padding: 10px 12px;
          white-space: pre-line;
          line-height: 1.5;
          font-size: 15px;
          color: #f2fff7;
        }

        .carousel-dots {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }

        .carousel-dots button {
          width: 9px;
          height: 9px;
          border-radius: 99px;
          border: none;
          cursor: pointer;
          background: rgba(255,255,255,0.22);
        }

        .carousel-dots button.active {
          width: 24px;
          background: var(--gold);
        }

        .price-box {
          text-align: center;
          border: 1px solid var(--line);
          background: linear-gradient(180deg, rgba(212,175,55,0.08), rgba(255,255,255,0.02));
          border-radius: 16px;
          padding: 22px 16px;
        }

        .price {
          font-size: clamp(34px, 8vw, 52px);
          color: var(--gold);
          font-weight: 800;
          margin: 8px 0 6px;
        }

        .urgency {
          color: #ffe39a;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .sticky-bar {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          background: rgba(6, 9, 15, 0.94);
          border-top: 1px solid rgba(255,255,255,0.14);
          padding: 10px;
          z-index: 60;
          backdrop-filter: blur(6px);
        }

        .sticky-bar .btn {
          width: 100%;
          min-width: 0;
          font-size: 14px;
        }

        .floating-wa {
          position: fixed;
          right: 14px;
          bottom: 82px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #25d366;
          color: #081b10;
          font-weight: 800;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(37,211,102,0.35);
          z-index: 70;
          transition: transform 0.22s ease;
        }

        .floating-wa:hover {
          transform: scale(1.05);
        }

        [data-animate] {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.55s ease, transform 0.55s ease;
        }

        [data-animate].show {
          opacity: 1;
          transform: translateY(0);
        }

        @media (min-width: 760px) {
          .section {
            padding: 64px 0;
          }

          .hero {
            padding: 92px 0 54px;
          }

          .grid-2 {
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }

          .trust-media img {
            height: 180px;
          }

          .sticky-bar {
            max-width: 620px;
            margin: 0 auto;
            left: 50%;
            transform: translateX(-50%);
            border-radius: 12px 12px 0 0;
          }

          .floating-wa {
            bottom: 94px;
          }
        }
      `}</style>

      <section className="hero wrap">
        <div className="kicker" data-animate>
          40 दिनों का कुबेर अनुष्ठान
        </div>
        <h1 data-animate>क्या आपके घर में पैसा टिकता नहीं?</h1>
        <p className="sub" data-animate>
          कर्ज बढ़ता जा रहा है या आमदनी रुक गई है?
        </p>
        <p className="trust-line" data-animate>
          आपकी समस्या के अनुसार 40 दिनों का कुबेर अनुष्ठान किया जाता है
        </p>
        <div className="cta-row" data-animate>
          <a className="btn btn-main" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
            WhatsApp पर जानकारी लें
          </a>
          <button className="btn btn-ghost" onClick={scrollToNext}>
            नीचे देखें
          </button>
        </div>
      </section>

      <section id="problem-section" className="section wrap">
        <div className="card" data-animate>
          <h2>क्या यह आपकी स्थिति है?</h2>
          <ul className="points">
            {problemPoints.map((point) => (
              <li className="point" key={point}>
                <span className="dot" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="note">अगर यह आपकी समस्या है, तो यह आपके लिए है</p>
        </div>
      </section>

      <section className="section wrap">
        <div className="card" data-animate>
          <h2>समाधान</h2>
          <p style={{ color: '#dbe6ff', lineHeight: 1.7, marginTop: 0 }}>
            यह 40 दिनों का कुबेर मंत्र जाप अनुष्ठान है
            <br />
            जो अनुभवी सरस्वत ब्राह्मण द्वारा विधि-विधान से किया जाता है
          </p>
          <ul className="points" style={{ marginTop: 10 }}>
            {solutionPoints.map((point) => (
              <li className="point" key={point}>
                <span className="dot" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="cta-row" style={{ marginTop: 18 }}>
            <a className="btn btn-main" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
              WhatsApp पर बात शुरू करें
            </a>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <div className="grid-2">
          <div className="card" data-animate>
            <h2>विश्वास</h2>
            <div className="trust-media">
              <img
                src="./assets/pandit-ji.png"
                alt="Pandit placeholder"
                loading="lazy"
              />
              <img
                src="./assets/4.png"
                alt="Puja placeholder"
                loading="lazy"
              />
            </div>
            <div className="trust-tags">
              <span className="tag">अनुभवी ब्राह्मण</span>
              <span className="tag">सैकड़ों लोगों ने करवाया</span>
              <span className="tag">पूजा की फोटो/वीडियो साझा की जाती है</span>
            </div>
          </div>

          <div className="card" data-animate>
            <h2>अनुभव साझा</h2>
            <div className="chat-wrap">
              {testimonials.map((item, index) => {
                const active = index === activeTestimonial
                return (
                  <article
                    key={item.name + item.time}
                    className="chat-card"
                    style={{
                      opacity: active ? 1 : 0.6,
                      transform: active ? 'scale(1)' : 'scale(0.99)',
                      transition: 'all 250ms ease',
                    }}
                  >
                    <div className="chat-head">
                      <span>{item.name}</span>
                      <span>{item.time}</span>
                    </div>
                    <div className="chat-bubble">{item.text}</div>
                  </article>
                )
              })}
            </div>
            <div className="carousel-dots" aria-label="testimonial indicators">
              {testimonials.map((item, idx) => (
                <button
                  key={item.name}
                  className={idx === activeTestimonial ? 'active' : ''}
                  onClick={() => setActiveTestimonial(idx)}
                  aria-label={`Show testimonial ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <div className="card" data-animate>
          <h2>लाभ</h2>
          <ul className="points">
            {benefitPoints.map((point) => (
              <li className="point" key={point}>
                <span className="dot" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing-section" className="section wrap">
        <div className="price-box" data-animate>
          <h2 style={{ margin: '0 0 6px' }}>इस अनुष्ठान का शुल्क</h2>
          <div className="price">₹{PRICE_RUPEES}</div>
          <div className="urgency">सीमित लोगों के लिए</div>
          <div className="cta-row" style={{ justifyContent: 'center' }}>
            <a className="btn btn-main" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
              WhatsApp पर बात करें
            </a>
            <button className="btn btn-ghost" onClick={handlePayment} disabled={razorpayLoading}>
              {razorpayLoading ? 'लोड हो रहा है...' : '₹399 में अनुष्ठान शुरू करें'}
            </button>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <div className="card" data-animate>
          <h2>अगला कदम</h2>
          <p style={{ color: '#dbe6ff', lineHeight: 1.7 }}>
            पहले WhatsApp पर अपनी स्थिति बताएं। आपकी समस्या समझकर प्रक्रिया बताई जाएगी। उसके बाद ही ₹399 में अनुष्ठान
            शुरू किया जाएगा।
          </p>
          <div className="cta-row" style={{ marginTop: 14 }}>
            <a className="btn btn-main" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
              WhatsApp पर बात करें
            </a>
            <button className="btn btn-ghost" onClick={handlePayment} disabled={razorpayLoading}>
              ₹399 में अनुष्ठान शुरू करें
            </button>
          </div>
        </div>
      </section>

      <a className="floating-wa" href={WHATSAPP_LINK} target="_blank" rel="noreferrer" aria-label="WhatsApp">
        WA
      </a>

      <div className="sticky-bar">
        <a className="btn btn-main" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
          WhatsApp करें
        </a>
        <button className="btn btn-ghost" onClick={handlePayment} disabled={razorpayLoading}>
          ₹399 में बुक करें
        </button>
      </div>
    </div>
  )
}

export default AnushthanPage
