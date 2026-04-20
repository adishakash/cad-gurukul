export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-brand-dark text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Privacy Policy</h1>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">
          Last updated: April 2026
        </p>
      </section>

      <section className="py-16 px-4 max-w-3xl mx-auto prose prose-gray">
        <h2>1. Information We Collect</h2>
        <p>
          We collect information you provide directly to us, such as your name, email address, mobile number,
          class standard, stream, city, and pincode when you register or fill out a lead-capture form.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>
          We use the information we collect to provide, maintain, and improve our services, communicate with
          you about career guidance, and send you relevant educational content via email and WhatsApp.
        </p>

        <h2>3. Information Sharing</h2>
        <p>
          We do not sell, trade, or otherwise transfer your personally identifiable information to third parties.
          Your career data and profile answers remain private and are never shared without your consent.
        </p>

        <h2>4. Data Security</h2>
        <p>
          We implement industry-standard security measures including SSL encryption to protect your personal
          information against unauthorised access, alteration, disclosure, or destruction.
        </p>

        <h2>5. Cookies</h2>
        <p>
          Our platform may use cookies to enhance your experience. You can choose to disable cookies through
          your browser settings, though this may affect some functionality of the platform.
        </p>

        <h2>6. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting
          the new policy on this page with an updated date.
        </p>

        <h2>7. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at{' '}
          <a href="mailto:support@cadgurukul.com" className="text-brand-red">support@cadgurukul.com</a>.
        </p>
      </section>
    </div>
  )
}
