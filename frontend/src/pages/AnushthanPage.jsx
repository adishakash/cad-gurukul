import { useCallback, useEffect, useMemo, useState } from 'react'

const WHATSAPP_LINK =
  'https://wa.me/919055451499?text=Namaste%20mujhe%20Kuber%20Anushthan%20ke%20baare%20mein%20jaankari%20chahiye'

const PRICE_RUPEES = 399
const PRICE_PAISE = 39900

const testimonials = [
  {
    name: 'Rohit Sharma (Jaipur)',
    time: '10:24 AM',
    text: 'Namaste ji 🙏\nमैंने अनुष्ठान करवाया था\nअब पैसा थोड़ा रुकने लगा है\nधन्यवाद',
  },
  {
    name: 'Pooja Verma (Delhi)',
    time: '7:42 PM',
    text: 'प्रक्रिया बहुत स्पष्ट थी,\nपूजा की फोटो भी मिली,\nमन को संतोष मिला।',
  },
  {
    name: 'Vivek Kumar (Mumbai)',
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
  const [isTypingSimulation, setIsTypingSimulation] = useState(false)
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
    let revealId
    const id = window.setInterval(() => {
      setIsTypingSimulation(true)
      revealId = window.setTimeout(() => {
        setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
        setIsTypingSimulation(false)
      }, 500)
    }, 6000)

    return () => {
      window.clearInterval(id)
      if (revealId) window.clearTimeout(revealId)
    }
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
          margin-bottom: 8px;
        }

        .hero-social-proof {
          color: #ffe39a;
          font-size: 14px;
          font-weight: 700;
          margin: 0 0 8px;
        }

        .hero-extra-pain {
          color: #dbe6ff;
          font-size: 16px;
          margin: 0 0 16px;
        }

        .trust-line {
          border-left: 3px solid var(--gold);
          padding-left: 12px;
          color: #fff;
          opacity: 0.95;
          margin-bottom: 24px;
        }

        .micro-prompt {
          font-size: 15px;
          font-weight: 700;
          color: var(--gold);
          margin-bottom: 10px;
          letter-spacing: 0.2px;
        }

        .process-line {
          color: rgba(255, 255, 255, 0.72);
          font-size: 13px;
          margin-top: 10px;
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

        /* ── Human Intro ── */
        .intro-section {
          padding: 40px 0 0;
        }

        .intro-card {
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: linear-gradient(135deg, rgba(212,175,55,0.06), rgba(255,255,255,0.01)), var(--card);
          border: 1px solid rgba(212,175,55,0.22);
          border-radius: 20px;
          padding: 24px;
        }

        .intro-photo-wrap {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .intro-photo {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          object-fit: cover;
          object-position: top;
          border: 3px solid var(--gold);
          box-shadow: 0 0 24px rgba(212,175,55,0.35);
        }

        .intro-name {
          font-weight: 700;
          font-size: 17px;
          color: var(--gold);
          text-align: center;
        }

        .intro-title {
          font-size: 13px;
          color: var(--muted);
          text-align: center;
          margin-top: -6px;
        }

        .intro-body {
          flex: 1;
        }

        .intro-body h2 {
          font-size: clamp(20px, 5vw, 26px);
          margin: 0 0 10px;
          color: #fff;
        }

        .intro-quote {
          border-left: 3px solid var(--gold);
          padding-left: 12px;
          color: #dbe6ff;
          line-height: 1.75;
          font-size: 15px;
          margin: 0 0 14px;
        }

        .intro-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .intro-chip {
          font-size: 13px;
          background: rgba(212,175,55,0.1);
          border: 1px solid rgba(212,175,55,0.28);
          color: #ffe7a8;
          padding: 5px 10px;
          border-radius: 999px;
        }

        @media (min-width: 560px) {
          .intro-card {
            flex-direction: row;
            align-items: flex-start;
          }

          .intro-photo {
            width: 130px;
            height: 130px;
          }
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

        .chat-bubble.show {
          animation: bubbleFade 240ms ease;
        }

        @keyframes bubbleFade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .chat-typing {
          min-height: 104px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
        }

        .chat-meta {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          font-size: 12px;
        }

        .chat-ticks {
          color: #40a9ff;
          font-weight: 800;
          letter-spacing: -1px;
        }

        .chat-seen {
          color: #8ab9e0;
          text-transform: lowercase;
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

        .live-feeling {
          margin-top: 12px;
          font-size: 14px;
          color: #c9f7d8;
          background: rgba(37, 211, 102, 0.08);
          border: 1px solid rgba(37, 211, 102, 0.26);
          border-radius: 10px;
          padding: 9px 12px;
          text-align: center;
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

        .scarcity-anchor {
          margin: -6px 0 14px;
          color: #ffd77a;
          font-size: 14px;
          font-weight: 600;
        }

        .risk-reversal {
          margin-top: 16px;
          font-size: 14px;
          color: #a8c4a2;
          border: 1px solid rgba(100, 200, 120, 0.2);
          background: rgba(100, 200, 120, 0.05);
          border-radius: 10px;
          padding: 10px 14px;
          text-align: center;
          line-height: 1.6;
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

        .floating-wa-icon {
          width: 30px;
          height: 30px;
          fill: #ffffff;
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
        <p className="hero-social-proof" data-animate>500+ लोगों ने पिछले कुछ वर्षों में करवाया</p>
        <p className="hero-extra-pain" data-animate>बार-बार कोशिश के बाद भी पैसा नहीं टिकता?</p>
        <p className="trust-line" data-animate>
          आपकी समस्या के अनुसार 40 दिनों का कुबेर अनुष्ठान किया जाता है
        </p>
        <p className="trust-line" data-animate>
          हर व्यक्ति के लिए अलग विधि से अनुष्ठान किया जाता है
        </p>
        <p className="micro-prompt" data-animate>
          👇 अपनी समस्या WhatsApp पर लिखें
        </p>
        <div className="cta-row" data-animate>
          <a className="btn btn-main" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
            WhatsApp पर अपनी समस्या बताकर सलाह लें
          </a>
          <button className="btn btn-ghost" onClick={scrollToNext}>
            नीचे देखें
          </button>
        </div>
        <p className="process-line" data-animate>(पूरी प्रक्रिया WhatsApp पर समझाई जाएगी)</p>
      </section>

      <section className="intro-section wrap">
        <div className="intro-card" data-animate>
          <div className="intro-photo-wrap">
            <img
              src="/assets/anushthan/pandit-ji.png"
              alt="Pandit Ji"
              className="intro-photo"
              loading="lazy"
            />
            <p className="intro-name">पं. राजेश शर्मा</p>
            <p className="intro-title">सरस्वत ब्राह्मण | 18+ वर्ष अनुभव</p>
          </div>
          <div className="intro-body">
            <h2>मैं कौन हूँ और यह क्यों करता हूँ</h2>
            <p className="intro-quote">
              "मेरे खुद के परिवार में एक समय आर्थिक संकट आया था। तब मेरे गुरु जी ने मुझे कुबेर साधना की विधि सिखाई।
              उसके बाद से मैंने सैकड़ों परिवारों के लिए यह अनुष्ठान किया है।
              <br /><br />
              मेरा उद्देश्य सिर्फ पैसा कमाना नहीं — मेरा काम आपकी समस्या को समझकर सही विधि से अनुष्ठान करना है।"
            </p>
            <div className="intro-chips">
              <span className="intro-chip">18+ वर्ष अनुभव</span>
              <span className="intro-chip">सैकड़ों परिवारों की मदद</span>
              <span className="intro-chip">व्यक्तिगत संकल्प</span>
              <span className="intro-chip">पारदर्शी प्रक्रिया</span>
            </div>
          </div>
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
            <br />
             आपकी समस्या के अनुसार अनुष्ठान की विधि अलग हो सकती है
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
              WhatsApp पर अपनी समस्या बताकर सलाह लें
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
                src="/assets/anushthan/Pandit-Ji.jpg"
                alt="Pandit placeholder"
                loading="lazy"
              />
              <img
                src="/assets/anushthan/4.png"
                alt="Puja placeholder"
                loading="lazy"
              />
            </div>
            <div className="trust-tags">
              <span className="tag">18+ वर्ष वैदिक अनुभव</span>
              <span className="tag">500+ परिवारों का अनुष्ठान किया</span>
              <span className="tag">हर दिन पूजा की फोटो WhatsApp पर</span>
              <span className="tag">नाम + गोत्र से व्यक्तिगत संकल्प</span>
              {/* <span className="tag">किसी ने भी बीच में नहीं छोड़ा</span> */}
            </div>
          </div>

          <div className="card" data-animate>
            <h2>अनुभव साझा</h2>
            <div className="chat-wrap">
              <article className="chat-card">
                <div className="chat-head">
                  <span>{testimonials[activeTestimonial].name}</span>
                  <span>{testimonials[activeTestimonial].time}</span>
                </div>
                {isTypingSimulation ? (
                  <div className="chat-typing">Typing...</div>
                ) : (
                  <>
                    <div className="chat-bubble show">{testimonials[activeTestimonial].text}</div>
                    <div className="chat-meta">
                      <span className="chat-ticks">✔✔</span>
                      <span className="chat-seen">seen</span>
                    </div>
                  </>
                )}
              </article>
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
            <div className="carousel-dots" aria-label="testimonial indicators">
              <img src='/assets/anushthan/5.png' alt='testimonial placeholder' style={{ width: '100%', borderRadius: 12, marginTop: 10 }} loading="lazy" />
            </div>
            <p className="live-feeling">हर दिन नए लोगों के लिए अनुष्ठान किया जाता है</p>
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
          <div className="urgency">हर दिन सीमित लोगों के लिए ही किया जाता है</div>
          <p className="scarcity-anchor">आज के लिए सीमित स्लॉट उपलब्ध</p>
          <div className="cta-row" style={{ justifyContent: 'center' }}>
            <a className="btn btn-main" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
              WhatsApp पर अपनी समस्या बताकर सलाह लें
            </a>
          </div>
          <p className="risk-reversal">
            🛡️ अगर प्रक्रिया समझ में न आए तो आगे बढ़ने की कोई बाध्यता नहीं है
          </p>
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
              WhatsApp पर अपनी समस्या बताकर सलाह लें
            </a>
            <button className="btn btn-ghost" onClick={handlePayment} disabled={razorpayLoading}>
              ₹399 में अनुष्ठान शुरू करें
            </button>
          </div>
        </div>
      </section>

      <a className="floating-wa" href={WHATSAPP_LINK} target="_blank" rel="noreferrer" aria-label="WhatsApp">
        <svg viewBox="0 0 32 32" className="floating-wa-icon" aria-hidden="true">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 2.827.737 5.48 2.027 7.786L0 32l8.43-2.008A15.93 15.93 0 0 0 16 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm0 29.333a13.28 13.28 0 0 1-6.77-1.853l-.486-.288-5.003 1.193 1.214-4.868-.317-.499A13.267 13.267 0 0 1 2.667 16C2.667 8.636 8.636 2.667 16 2.667S29.333 8.636 29.333 16 23.364 29.333 16 29.333zm7.27-9.878c-.399-.2-2.36-1.164-2.726-1.297-.366-.133-.632-.2-.899.2-.267.4-1.031 1.297-1.264 1.563-.233.267-.466.3-.865.1-.4-.2-1.688-.622-3.215-1.984-1.188-1.06-1.99-2.369-2.223-2.769-.233-.4-.025-.616.175-.815.18-.179.4-.466.6-.699.2-.233.267-.4.4-.666.133-.267.067-.5-.033-.699-.1-.2-.9-2.169-1.232-2.969-.325-.779-.655-.674-.9-.686l-.765-.013c-.267 0-.699.1-1.065.5s-1.398 1.365-1.398 3.33 1.431 3.863 1.631 4.13c.2.266 2.816 4.3 6.824 6.031.954.412 1.698.658 2.279.842.957.305 1.828.262 2.517.159.768-.114 2.36-.966 2.693-1.898.333-.933.333-1.733.233-1.9-.1-.166-.366-.266-.765-.466z" />
        </svg>
      </a>

      <div className="sticky-bar">
        <a className="btn btn-main" href={WHATSAPP_LINK} target="_blank" rel="noreferrer" style={{ gridColumn: 'span 2' }}>
          WhatsApp पर अपनी समस्या बताकर सलाह लें
        </a>
      </div>
      <div style={{ textAlign: 'center', paddingBottom: '6px', background: 'rgba(6,9,15,0.94)' }}>
        <button
          onClick={handlePayment}
          disabled={razorpayLoading}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.38)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', padding: '4px 0 10px' }}
        >
          {razorpayLoading ? 'लोड हो रहा है...' : '(यदि आप पहले से आश्वस्त हैं)'}
        </button>
      </div>
    </div>
  )
}

export default AnushthanPage
