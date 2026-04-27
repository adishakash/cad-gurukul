import Seo from '../components/SEO/Seo'

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <Seo
        title="Refund Policy | CAD Gurukul"
        description="Understand refund eligibility and timelines for CAD Gurukul's paid plans."
      />
      <section className="bg-brand-dark text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Refund Policy</h1>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">
          Last updated: April 2026
        </p>
      </section>

      <section className="py-16 px-4 max-w-3xl mx-auto prose prose-gray">
        <h2>1. Free Plan</h2>
        <p>
          The free plan is available at no cost. No payment is required, and therefore no refund is applicable
          for free plan users.
        </p>

        <h2>2. Paid Plan — Refund Eligibility</h2>
        <p>
          If you are not satisfied with our paid career counselling service, you may request a full refund
          within <strong>7 days</strong> of your payment date, provided you have not accessed your detailed
          career report.
        </p>

        <h2>3. Non-Refundable Cases</h2>
        <ul>
          <li>Refund requests made more than 7 days after payment.</li>
          <li>Accounts where the detailed career report has already been accessed or downloaded.</li>
          <li>Payments made for consultation sessions that have already been conducted.</li>
        </ul>

        <h2>4. How to Request a Refund</h2>
        <p>
          To request a refund, email us at{' '}
          <a href="mailto:support@cadgurukul.com" className="text-brand-red">support@cadgurukul.com</a>{' '}
          with your registered email address, payment reference number, and reason for the refund request.
        </p>

        <h2>5. Processing Time</h2>
        <p>
          Approved refunds will be processed within <strong>5–7 business days</strong> and credited back to
          the original payment method.
        </p>

        <h2>6. Contact Us</h2>
        <p>
          For any queries related to refunds, please contact us at{' '}
          <a href="mailto:support@cadgurukul.com" className="text-brand-red">support@cadgurukul.com</a>.
        </p>
      </section>
    </div>
  )
}
