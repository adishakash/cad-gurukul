export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-brand-dark text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Terms of Service</h1>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">
          Last updated: April 2026
        </p>
      </section>

      <section className="py-16 px-4 max-w-3xl mx-auto prose prose-gray">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using CAD Gurukul, you agree to be bound by these Terms of Service. If you do not
          agree to these terms, please do not use our platform.
        </p>

        <h2>2. Use of the Platform</h2>
        <p>
          CAD Gurukul provides AI-assisted career counselling for students in Classes 8–12. You agree to use
          the platform only for lawful purposes and in a manner that does not infringe upon the rights of others.
        </p>

        <h2>3. Account Registration</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for all
          activities that occur under your account. Notify us immediately of any unauthorised use of your account.
        </p>

        <h2>4. Intellectual Property</h2>
        <p>
          All content, assessments, reports, and materials on CAD Gurukul are the intellectual property of
          CAD Gurukul and may not be reproduced, distributed, or used without prior written permission.
        </p>

        <h2>5. Disclaimer of Warranties</h2>
        <p>
          The platform is provided "as is" without warranties of any kind. Career guidance provided is
          informational in nature and does not constitute professional academic or legal advice.
        </p>

        <h2>6. Limitation of Liability</h2>
        <p>
          CAD Gurukul shall not be liable for any indirect, incidental, special, or consequential damages
          arising from your use of the platform or reliance on any information provided.
        </p>

        <h2>7. Modifications</h2>
        <p>
          We reserve the right to modify these terms at any time. Continued use of the platform after changes
          constitutes acceptance of the updated terms.
        </p>

        <h2>8. Contact Us</h2>
        <p>
          For questions regarding these Terms of Service, contact us at{' '}
          <a href="mailto:support@cadgurukul.com" className="text-brand-red">support@cadgurukul.com</a>.
        </p>
      </section>
    </div>
  )
}
