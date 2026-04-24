import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import api, { leadApi } from '../services/api'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { LANGUAGE_OPTIONS, getLanguageCodeFromLabel, getLanguageLabel, getSupportedLanguage } from '../i18n/languages'

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

// Ordered funnel statuses — used to guard against status regression.
const LEAD_STATUS_ORDER = [
  'new_lead', 'onboarding_started', 'plan_selected',
  'assessment_started', 'assessment_in_progress', 'assessment_completed',
  'free_report_ready', 'payment_pending', 'paid',
  'premium_report_generating', 'premium_report_ready',
  'counselling_interested', 'closed',
]

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
  const [leadStatus, setLeadStatus] = useState(null)
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const defaultLanguageLabel = getLanguageLabel(getSupportedLanguage(i18n.language))

  const { register, handleSubmit, getValues, setError, setFocus, getFieldState, reset, formState: { errors }, trigger } = useForm({
    mode: 'onBlur',
    reValidateMode: 'onChange', // clear errors in real-time as user corrects fields
    defaultValues: {
      languagePreference: defaultLanguageLabel,
    },
  })

  useEffect(() => {
    // On mount: load existing profile + lead so we can:
    //   • Pre-populate the form (prevents erasing existing data on re-edit)
    //   • Know the current lead status before touching it
    const loadData = async () => {
      try {
        const [profileRes, leadRes] = await Promise.all([
          api.get('/students/me').catch(() => ({ data: { data: null } })),
          leadApi.getMe().catch(() => ({ data: { data: null } })),
        ])
        const profile = profileRes.data.data
        const lead    = leadRes.data.data

        if (lead?.status) setLeadStatus(lead.status)

        if (profile) {
          // Restore all RHF-controlled fields so the user sees their existing data.
          reset({
            fullName:           profile.fullName            || '',
            age:                profile.age                 || '',
            schoolName:         profile.schoolName          || '',
            city:               profile.city                || '',
            state:              profile.state               || '',
            mobileNumber:       profile.mobileNumber        || '',
            pinCode:            profile.pinCode             || '',
            languagePreference: profile.languagePreference  || defaultLanguageLabel,
            classStandard:      profile.classStandard       || '',
            board:              profile.board               || '',
            careerAspirations:  profile.careerAspirations   || '',
            specialNotes:       profile.specialNotes        || '',
            budgetPreference:   profile.budgetPreference    || '',
            parentName:         profile.parentDetail?.parentName    || '',
            parentContact:      profile.parentDetail?.contactNumber || '',
            parentEmail:        profile.parentDetail?.email         || '',
            parentOccupation:   profile.parentDetail?.occupation    || '',
          })
          // Restore tag-selector state (not RHF-controlled).
          setSelectedSubjects(profile.preferredSubjects   || [])
          setSelectedHobbies(profile.hobbies              || [])
          setSelectedInterests(profile.interests          || [])
          setSelectedLocationPref(profile.locationPreference || [])
        }

        // Only advance lead status to 'onboarding_started' if not already past it.
        // This prevents a paid/assessed user from being silently downgraded just by
        // visiting the Edit Profile page.
        const currentIdx = LEAD_STATUS_ORDER.indexOf(lead?.status)
        const targetIdx  = LEAD_STATUS_ORDER.indexOf('onboarding_started')
        if (currentIdx <= targetIdx) {
          leadApi.update({ status: 'onboarding_started' }).catch(() => {})
        }
      } catch {
        // Non-fatal — form stays empty; first-time onboarding still works.
      }
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Maps each step index to the RHF field names that have validation rules on that step.
  // Only these fields are checked when the user clicks "Continue".
  const FIELDS_PER_STEP = [
    ['fullName', 'age', 'city', 'state', 'schoolName', 'mobileNumber', 'pinCode'], // Step 0
    ['classStandard', 'board', 'careerAspirations', 'specialNotes'],               // Step 1
    [],                                                                             // Step 2 – tag selectors, no RHF fields
    ['budgetPreference'],                                                           // Step 3
    ['parentName', 'parentContact', 'parentEmail', 'parentOccupation'],            // Step 4 – all fields with length/format rules
  ]

  // Maps RHF field names to the step they live on — used to navigate back on backend errors.
  const FIELD_TO_STEP = {
    fullName: 0, age: 0, city: 0, state: 0, schoolName: 0, mobileNumber: 0, pinCode: 0,
    classStandard: 1, board: 1, careerAspirations: 1, specialNotes: 1,
    budgetPreference: 3,
    parentName: 4, parentContact: 4, parentEmail: 4, parentOccupation: 4,
  }

  const nextStep = async () => {
    const valid = await trigger(FIELDS_PER_STEP[step])
    if (valid) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
    } else {
      // Focus the first invalid field so the user sees exactly what needs fixing.
      const firstError = FIELDS_PER_STEP[step].find((name) => getFieldState(name).invalid)
      if (firstError) setFocus(firstError)
    }
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
      // Advance lead status only if not already past onboarding_started — prevents downgrade.
      const currentIdx = LEAD_STATUS_ORDER.indexOf(leadStatus)
      const targetIdx  = LEAD_STATUS_ORDER.indexOf('onboarding_started')
      if (currentIdx <= targetIdx) {
        leadApi.update({ status: 'onboarding_started' }).catch(() => {})
      }
      toast.success('Profile saved! Now start your assessment.')
      navigate('/dashboard')
    } catch (err) {
      const errData = err.response?.data?.error
      if (errData?.code === 'VALIDATION_ERROR' && Array.isArray(errData.details) && errData.details.length > 0) {
        // Apply each backend field error to the RHF field and jump to the first affected step.
        let firstAffectedStep = null
        errData.details.forEach(({ field, message }) => {
          if (field) {
            setError(field, { type: 'server', message })
            const fieldStep = FIELD_TO_STEP[field]
            if (fieldStep !== undefined && (firstAffectedStep === null || fieldStep < firstAffectedStep)) {
              firstAffectedStep = fieldStep
            }
          }
        })
        if (firstAffectedStep !== null) setStep(firstAffectedStep)
        toast.error(errData.details[0]?.message || 'Please correct the highlighted fields and try again.')
      } else {
        toast.error(errData?.message || 'Failed to save profile. Please try again.')
      }
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
                    <input {...register('fullName', {
                      required: 'Please fill this mandatory field.',
                      minLength: { value: 2, message: 'Please enter at least 2 characters.' },
                      maxLength: { value: 100, message: 'Only 100 characters are allowed.' },
                    })} className="input-field" placeholder="Your full name" />
                    {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
                  </div>
                  <div>
                    <label className="input-label">Age *</label>
                    <input {...register('age', {
                      required: 'Please fill this mandatory field.',
                      min: { value: 13, message: 'Age must be at least 13.' },
                      max: { value: 20, message: 'Age must be 20 or under.' },
                    })} type="number" className="input-field" placeholder="e.g. 16" />
                    {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="input-label">School Name</label>
                  <input {...register('schoolName', {
                    maxLength: { value: 200, message: 'Only 200 characters are allowed.' },
                  })} className="input-field" placeholder="Your school name" />
                  {errors.schoolName && <p className="text-red-500 text-xs mt-1">{errors.schoolName.message}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">City *</label>
                    <input {...register('city', {
                      required: 'Please fill this mandatory field.',
                      maxLength: { value: 100, message: 'Only 100 characters are allowed.' },
                    })} className="input-field" placeholder="Your city" />
                    {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
                  </div>
                  <div>
                    <label className="input-label">State *</label>
                    <select {...register('state', { required: 'Please select an option.' })} className="input-field">
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Mobile Number</label>
                    <input {...register('mobileNumber', {
                      pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit Indian mobile number (starting with 6–9).' },
                    })} className="input-field" placeholder="10-digit mobile number" />
                    {errors.mobileNumber && <p className="text-red-500 text-xs mt-1">{errors.mobileNumber.message}</p>}
                  </div>
                  <div>
                    <label className="input-label">Pin Code</label>
                    <input {...register('pinCode', {
                      pattern: { value: /^\d{6}$/, message: 'Pin code must be exactly 6 digits.' },
                    })} className="input-field" placeholder="6-digit pin code" />
                    {errors.pinCode && <p className="text-red-500 text-xs mt-1">{errors.pinCode.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="input-label">Language Preference</label>
                  <select
                    {...register('languagePreference', {
                      onChange: (event) => {
                        const languageCode = getLanguageCodeFromLabel(event.target.value)
                        i18n.changeLanguage(languageCode)
                      },
                    })}
                    className="input-field"
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.code} value={option.label}>{option.label}</option>
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
                    <select {...register('classStandard', { required: 'Please select an option.' })} className="input-field">
                      <option value="">Select Class</option>
                      {CLASSES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                    </select>
                    {errors.classStandard && <p className="text-red-500 text-xs mt-1">{errors.classStandard.message}</p>}
                  </div>
                  <div>
                    <label className="input-label">Board *</label>
                    <select {...register('board', { required: 'Please select an option.' })} className="input-field">
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
                  <textarea {...register('careerAspirations', {
                    maxLength: { value: 500, message: 'Only 500 characters are allowed.' },
                  })} className="input-field" rows={3} placeholder="e.g. I want to become a doctor, or I'm interested in technology startups..." />
                  {errors.careerAspirations && <p className="text-red-500 text-xs mt-1">{errors.careerAspirations.message}</p>}
                </div>
                <div>
                  <label className="input-label">Special Notes (optional)</label>
                  <textarea {...register('specialNotes', {
                    maxLength: { value: 1000, message: 'Only 1000 characters are allowed.' },
                  })} className="input-field" rows={2} placeholder="Anything else you want us to know..." />
                  {errors.specialNotes && <p className="text-red-500 text-xs mt-1">{errors.specialNotes.message}</p>}
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
                  <select {...register('budgetPreference', { required: 'Please select an option.' })} className="input-field">
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
                    <input {...register('parentName', {
                      maxLength: { value: 100, message: 'Only 100 characters are allowed.' },
                    })} className="input-field" placeholder="Parent's full name" />
                    {errors.parentName && <p className="text-red-500 text-xs mt-1">{errors.parentName.message}</p>}
                  </div>
                  <div>
                    <label className="input-label">Contact Number</label>
                    <input {...register('parentContact', {
                      pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit Indian mobile number (starting with 6–9).' },
                    })} className="input-field" placeholder="10-digit mobile" />
                    {errors.parentContact && <p className="text-red-500 text-xs mt-1">{errors.parentContact.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Parent Email</label>
                    <input {...register('parentEmail', {
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
                    })} type="email" className="input-field" placeholder="parent@email.com" />
                    {errors.parentEmail && <p className="text-red-500 text-xs mt-1">{errors.parentEmail.message}</p>}
                  </div>
                  <div>
                    <label className="input-label">Occupation</label>
                    <input {...register('parentOccupation', {
                      maxLength: { value: 100, message: 'Only 100 characters are allowed.' },
                    })} className="input-field" placeholder="e.g. Teacher, Engineer" />
                    {errors.parentOccupation && <p className="text-red-500 text-xs mt-1">{errors.parentOccupation.message}</p>}
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
