import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import api, { leadApi } from '../services/api'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 0, title: 'Personal Info', icon: '👤' },
  { id: 1, title: 'Academic Details', icon: '📚' },
  { id: 2, title: 'Interests & Hobbies', icon: '🎯' },
  { id: 3, title: 'Preferences', icon: '⚙️' },
  { id: 4, title: 'Parent Details', icon: '👨‍👩‍👧' },
]

const CLASSES = ['CLASS_8', 'CLASS_9', 'CLASS_10', 'CLASS_11', 'CLASS_12']
const BOARDS = ['CBSE', 'ICSE', 'STATE_BOARD', 'IGCSE', 'IB', 'OTHER']
const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics', 'Commerce', 'Computer Science', 'English', 'Hindi', 'Psychology', 'Sociology', 'Political Science', 'Physical Education', 'Fine Arts', 'Music']
const HOBBIES = ['Reading', 'Sports', 'Coding', 'Painting', 'Music', 'Dance', 'Cooking', 'Gaming', 'Photography', 'Writing', 'Gardening', 'Travelling', 'Volunteering', 'Robotics', 'Debate', 'Theatre']
const INTERESTS = ['Science & Technology', 'Medicine & Healthcare', 'Business & Finance', 'Law & Justice', 'Arts & Design', 'Education & Teaching', 'Government & Public Service', 'Sports & Fitness', 'Media & Entertainment', 'Environment & Nature', 'Social Work', 'Research & Academia']
const INDIAN_STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal']

const ProgressBar = ({ currentStep, totalSteps }) => (
  <div className="mb-8">
    <div className="flex justify-between mb-2">
      <span className="text-xs font-medium text-gray-600">Step {currentStep + 1} of {totalSteps}</span>
      <span className="text-xs font-medium text-brand-red">{Math.round(((currentStep + 1) / totalSteps) * 100)}% Complete</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className="bg-brand-red h-2.5 rounded-full transition-all duration-500"
        style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
      />
    </div>
    <div className="flex justify-between mt-3">
      {STEPS.map((s, i) => (
        <div
          key={s.id}
          className={`flex flex-col items-center gap-1 ${i <= currentStep ? 'text-brand-red' : 'text-gray-400'}`}
        >
          <span className="text-lg">{s.icon}</span>
          <span className="text-xs hidden sm:block">{s.title}</span>
        </div>
      ))}
    </div>
  </div>
)

const TagSelector = ({ options, selected, onChange, max = 8 }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const isSelected = selected.includes(opt)
      return (
        <button
          key={opt}
          type="button"
          onClick={() => {
            if (isSelected) {
              onChange(selected.filter((s) => s !== opt))
            } else if (selected.length < max) {
              onChange([...selected, opt])
            } else {
              toast.error(`Max ${max} selections allowed`)
            }
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            isSelected
              ? 'bg-brand-red text-white border-brand-red'
              : 'bg-white text-gray-600 border-gray-300 hover:border-brand-red hover:text-brand-red'
          }`}
        >
          {opt}
        </button>
      )
    })}
  </div>
)

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [selectedHobbies, setSelectedHobbies] = useState([])
  const [selectedInterests, setSelectedInterests] = useState([])
  const [selectedLocationPref, setSelectedLocationPref] = useState([])
  const navigate = useNavigate()

  const { register, handleSubmit, getValues, formState: { errors }, trigger } = useForm({ mode: 'onBlur' })

  useEffect(() => {
    leadApi.update({ status: 'onboarding_started' }).catch(() => {})
  }, [])

  const nextStep = async () => {
    const fieldsPerStep = [
      ['fullName', 'age', 'city', 'state'],
      ['classStandard', 'board'],
      [],
      ['budgetPreference'],
      [],
    ]
    const valid = await trigger(fieldsPerStep[step])
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const prevStep = () => setStep((s) => Math.max(s - 1, 0))

  const onSubmit = async (data) => {
    setIsLoading(true)
    try {
      await api.post('/students/me/onboarding', {
        ...data,
        age: parseInt(data.age, 10),
        preferredSubjects: selectedSubjects,
        hobbies: selectedHobbies,
        interests: selectedInterests,
        locationPreference: selectedLocationPref,
      })
      // Advance lead funnel status — fire-and-forget
      leadApi.update({ status: 'onboarding_started' }).catch(() => {})
      toast.success('Profile saved! Now start your assessment.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save profile')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand-dark">Complete Your Profile</h1>
          <p className="text-gray-500 mt-1 text-sm">The more you tell us, the better your career report will be.</p>
        </div>

        <ProgressBar currentStep={step} totalSteps={STEPS.length} />

        <div className="card shadow-xl animate-slide-up">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 0: Personal Info */}
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-brand-dark mb-4">👤 Personal Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Full Name *</label>
                    <input {...register('fullName', { required: 'Required' })} className="input-field" placeholder="Your full name" />
                    {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
                  </div>
                  <div>
                    <label className="input-label">Age *</label>
                    <input {...register('age', { required: 'Required', min: { value: 13, message: 'Min 13' }, max: { value: 20, message: 'Max 20' } })} type="number" className="input-field" placeholder="e.g. 16" />
                    {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="input-label">School Name</label>
                  <input {...register('schoolName')} className="input-field" placeholder="Your school name" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">City *</label>
                    <input {...register('city', { required: 'Required' })} className="input-field" placeholder="Your city" />
                    {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
                  </div>
                  <div>
                    <label className="input-label">State *</label>
                    <select {...register('state', { required: 'Required' })} className="input-field">
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Mobile Number</label>
                    <input {...register('mobileNumber', { pattern: { value: /^[6-9]\d{9}$/, message: 'Invalid Indian mobile number' } })} className="input-field" placeholder="10-digit mobile number" />
                    {errors.mobileNumber && <p className="text-red-500 text-xs mt-1">{errors.mobileNumber.message}</p>}
                  </div>
                  <div>
                    <label className="input-label">Pin Code</label>
                    <input {...register('pinCode', { pattern: { value: /^\d{6}$/, message: '6-digit pin code' } })} className="input-field" placeholder="6-digit pin code" />
                    {errors.pinCode && <p className="text-red-500 text-xs mt-1">{errors.pinCode.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="input-label">Language Preference</label>
                  <select {...register('languagePreference')} className="input-field">
                    {['English', 'Hindi', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Gujarati', 'Kannada'].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 1: Academic */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-brand-dark mb-4">📚 Academic Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Class / Standard *</label>
                    <select {...register('classStandard', { required: 'Required' })} className="input-field">
                      <option value="">Select Class</option>
                      {CLASSES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                    </select>
                    {errors.classStandard && <p className="text-red-500 text-xs mt-1">{errors.classStandard.message}</p>}
                  </div>
                  <div>
                    <label className="input-label">Board *</label>
                    <select {...register('board', { required: 'Required' })} className="input-field">
                      <option value="">Select Board</option>
                      {BOARDS.map((b) => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}
                    </select>
                    {errors.board && <p className="text-red-500 text-xs mt-1">{errors.board.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="input-label mb-3">Preferred Subjects (Select up to 6)</label>
                  <TagSelector options={SUBJECTS} selected={selectedSubjects} onChange={setSelectedSubjects} max={6} />
                </div>
                <div>
                  <label className="input-label">Career Aspirations (if any)</label>
                  <textarea {...register('careerAspirations')} className="input-field" rows={3} placeholder="e.g. I want to become a doctor, or I'm interested in technology startups..." />
                </div>
                <div>
                  <label className="input-label">Special Notes (optional)</label>
                  <textarea {...register('specialNotes')} className="input-field" rows={2} placeholder="Anything else you want us to know..." />
                </div>
              </div>
            )}

            {/* Step 2: Interests */}
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-brand-dark mb-4">🎯 Interests & Hobbies</h2>
                <div>
                  <label className="input-label mb-3">Your Hobbies (Select up to 8)</label>
                  <TagSelector options={HOBBIES} selected={selectedHobbies} onChange={setSelectedHobbies} max={8} />
                </div>
                <div>
                  <label className="input-label mb-3">Fields of Interest (Select up to 6)</label>
                  <TagSelector options={INTERESTS} selected={selectedInterests} onChange={setSelectedInterests} max={6} />
                </div>
              </div>
            )}

            {/* Step 3: Preferences */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-brand-dark mb-4">⚙️ Higher Education Preferences</h2>
                <div>
                  <label className="input-label">Budget for Higher Education *</label>
                  <select {...register('budgetPreference', { required: 'Required' })} className="input-field">
                    <option value="">Select budget range</option>
                    <option value="under-5L">Under ₹5 Lakh per year</option>
                    <option value="5-10L">₹5 – ₹10 Lakh per year</option>
                    <option value="10-20L">₹10 – ₹20 Lakh per year</option>
                    <option value="20L+">Above ₹20 Lakh per year</option>
                    <option value="not-sure">Not sure yet</option>
                  </select>
                  {errors.budgetPreference && <p className="text-red-500 text-xs mt-1">{errors.budgetPreference.message}</p>}
                </div>
                <div>
                  <label className="input-label mb-3">Location for Study (Select all that apply)</label>
                  <TagSelector
                    options={['local', 'state', 'national', 'abroad']}
                    selected={selectedLocationPref}
                    onChange={setSelectedLocationPref}
                    max={4}
                  />
                  <p className="text-xs text-gray-400 mt-2">local = same city, state = within state, national = anywhere in India</p>
                </div>
              </div>
            )}

            {/* Step 4: Parent Details */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-brand-dark mb-2">👨‍👩‍👧 Parent / Guardian Details</h2>
                <p className="text-sm text-gray-500 mb-4">Optional – helps personalize the parent guidance section of your report.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Parent Name</label>
                    <input {...register('parentName')} className="input-field" placeholder="Parent's full name" />
                  </div>
                  <div>
                    <label className="input-label">Contact Number</label>
                    <input {...register('parentContact', { pattern: { value: /^[6-9]\d{9}$/, message: 'Invalid number' } })} className="input-field" placeholder="10-digit mobile" />
                    {errors.parentContact && <p className="text-red-500 text-xs mt-1">{errors.parentContact.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Parent Email</label>
                    <input {...register('parentEmail')} type="email" className="input-field" placeholder="parent@email.com" />
                  </div>
                  <div>
                    <label className="input-label">Occupation</label>
                    <input {...register('parentOccupation')} className="input-field" placeholder="e.g. Teacher, Engineer" />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
              {step > 0 ? (
                <button type="button" onClick={prevStep} className="btn-outline px-6 py-2 text-sm">
                  ← Back
                </button>
              ) : <div />}

              {step < STEPS.length - 1 ? (
                <button type="button" onClick={nextStep} className="btn-primary px-6 py-2 text-sm">
                  Continue →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary px-8 py-2 text-sm flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Saving...
                    </>
                  ) : '✓ Save Profile & Continue'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
