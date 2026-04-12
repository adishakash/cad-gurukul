import { useState } from 'react'
import { useForm } from 'react-hook-form'
import api from '../services/api'
import toast from 'react-hot-toast'

const contacts = [
  { icon: '📧', label: 'Email', value: 'support@cadgurukul.com' },
  { icon: '📞', label: 'Phone', value: '+91 98765 43210' },
  { icon: '🕐', label: 'Hours', value: 'Mon–Sat, 9 AM – 7 PM IST' },
]

export default function Contact() {
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors }, reset } = useForm()

  const onSubmit = async (data) => {
    setSubmitting(true)
    try {
      await api.post('/contact', data)
      toast.success('Message sent! We\'ll reply within 24 hours.')
      setSent(true)
      reset()
    } catch {
      toast.error('Failed to send. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-brand-dark text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-extrabold mb-3">Contact Us</h1>
        <p className="text-gray-300 max-w-md mx-auto">Have a question or feedback? We'd love to hear from you.</p>
      </section>

      <section className="py-16 px-4 max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
        {/* Info */}
        <div>
          <h2 className="text-xl font-bold text-brand-dark mb-6">Get in Touch</h2>
          <div className="space-y-4 mb-8">
            {contacts.map((c) => (
              <div key={c.label} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">{c.icon}</div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-widest">{c.label}</div>
                  <div className="font-semibold text-brand-dark">{c.value}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="card bg-orange-50 border border-brand-red/20">
            <h3 className="font-bold text-brand-dark mb-1">For Students & Parents</h3>
            <p className="text-sm text-gray-600">
              If you have a question about your report or assessment, mention your registered email so we can look up your account faster.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="card shadow-xl">
          {sent ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-brand-dark mb-2">Message Received!</h3>
              <p className="text-gray-500 text-sm">We typically reply within 24 hours.</p>
              <button onClick={() => setSent(false)} className="btn-outline mt-6">Send Another</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="input-label">Your Name</label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  className="input-field"
                  placeholder="Rahul Sharma"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="input-label">Email Address</label>
                <input
                  type="email"
                  {...register('email', { required: 'Email is required' })}
                  className="input-field"
                  placeholder="rahul@example.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="input-label">Subject</label>
                <input
                  {...register('subject', { required: 'Subject is required' })}
                  className="input-field"
                  placeholder="Question about my report"
                />
                {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>}
              </div>
              <div>
                <label className="input-label">Message</label>
                <textarea
                  {...register('message', { required: 'Message cannot be empty', minLength: { value: 20, message: 'Please write at least 20 characters' } })}
                  className="input-field"
                  rows={5}
                  placeholder="Tell us how we can help..."
                />
                {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
