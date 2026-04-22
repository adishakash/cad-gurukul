import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated, selectUser } from './store/slices/authSlice'

// Roles that belong to the student portal (mirrored from backend USER_PORTAL_ROLES)
const USER_PORTAL_ROLES = ['STUDENT', 'PARENT']

// Layout
import Header from './components/Layout/Header'
import Footer from './components/Layout/Footer'

// Public pages
import Home from './pages/Home'
import About from './pages/About'
import HowItWorks from './pages/HowItWorks'
import Login from './pages/Login'
import Register from './pages/Register'
import Contact from './pages/Contact'
import PlanSelection from './pages/PlanSelection'

// Protected pages
import Dashboard from './pages/Dashboard'
import Onboarding from './pages/Onboarding'
import Assessment from './pages/Assessment'
import Payment from './pages/Payment'
import Report from './pages/Report'

// Admin pages
import AdminLogin       from './pages/Admin/AdminLogin'
import AdminDashboard   from './pages/Admin/AdminDashboard'
import LeadList         from './pages/Admin/LeadList'
import LeadDetail       from './pages/Admin/LeadDetail'
import AdminPartners    from './pages/Admin/AdminPartners'
import AdminPayouts     from './pages/Admin/AdminPayouts'
import StaffManagement  from './pages/Admin/StaffManagement'
import AdminConsultations from './pages/Admin/AdminConsultations'

// Staff pages (Career Counsellor Lead portal)
import StaffLogin       from './pages/Staff/StaffLogin'
import LeadDashboard    from './pages/Staff/LeadDashboard'
import PartnerRegister  from './pages/Staff/PartnerRegister'
import PendingApproval  from './pages/Staff/PendingApproval'

// Counsellor pages (Career Counsellor portal)
import CounsellorDashboard from './pages/Counsellor/CounsellorDashboard'

// Public joining page (no auth required)
import JoinPage from './pages/Public/JoinPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import RefundPolicy from './pages/RefundPolicy'

// Public consultation slot-selection page (no auth required — link from email)
import ConsultationSlotPage from './pages/Public/ConsultationSlotPage'

// Public test link page (no auth required — candidate payment via CC link)
import TestLinkPage from './pages/Public/TestLinkPage'

// Guards
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // Reject staff/admin accounts that somehow ended up in the user portal store.
  if (!USER_PORTAL_ROLES.includes(user?.role)) return <Navigate to="/login" replace />
  return children
}

const GuestRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  // Only redirect to dashboard if the token belongs to a user-portal account.
  // Staff/admin tokens must NOT be treated as "logged in" for this portal.
  if (isAuthenticated && USER_PORTAL_ROLES.includes(user?.role)) return <Navigate to="/dashboard" replace />
  return children
}

// Admin guard — checks localStorage directly (admin auth is independent of Redux store)
const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('cg_admin_token')
  const admin = (() => { try { return JSON.parse(localStorage.getItem('cg_admin') || '{}') } catch { return {} } })()
  // Verify both token presence AND that the stored role is ADMIN.
  if (!token || admin.role !== 'ADMIN') return <Navigate to="/admin/login" replace />
  return children
}

// Staff guard — CCL-only portal. Strict role check; ADMIN must NOT pass through.
const StaffRoute = ({ children }) => {
  const token = localStorage.getItem('cg_staff_token')
  const staff = (() => { try { return JSON.parse(localStorage.getItem('cg_staff') || '{}') } catch { return {} } })()
  // Only CAREER_COUNSELLOR_LEAD may access the staff portal.
  if (!token || staff.role !== 'CAREER_COUNSELLOR_LEAD') return <Navigate to="/staff/login" replace />
  return children
}

// Counsellor guard — CC and CCL can both access counsellor routes. ADMIN must NOT pass through.
const CounsellorRoute = ({ children }) => {
  const token = localStorage.getItem('cg_staff_token')
  const staff = (() => { try { return JSON.parse(localStorage.getItem('cg_staff') || '{}') } catch { return {} } })()
  const COUNSELLOR_ROLES = ['CAREER_COUNSELLOR', 'CAREER_COUNSELLOR_LEAD']
  if (!token || !COUNSELLOR_ROLES.includes(staff.role)) return <Navigate to="/staff/login" replace />
  return children
}

const PublicLayout = ({ children }) => (
  <>
    <Header />
    <main className="min-h-screen">{children}</main>
    <Footer />
  </>
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
        <Route path="/how-it-works" element={<PublicLayout><HowItWorks /></PublicLayout>} />
        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
        <Route path="/plans" element={<PublicLayout><PlanSelection /></PublicLayout>} />

        {/* Guest-only routes */}
        <Route path="/login" element={<GuestRoute><PublicLayout><Login /></PublicLayout></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><PublicLayout><Register /></PublicLayout></GuestRoute>} />

        {/* Protected student routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        {/* Assessment is public — guest mode (3 questions preview) handled inside the component */}
        <Route path="/assessment" element={<PublicLayout><Assessment /></PublicLayout>} />
        <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
        <Route path="/reports/:id" element={<ProtectedRoute><Report /></ProtectedRoute>} />

        {/* Public joining page (no login required — candidate enrolment via CCL link) */}
        <Route path="/join" element={<JoinPage />} />

        {/* Public consultation slot-selection page (no login required — link from email) */}
        <Route path="/consultation/select-slot" element={<ConsultationSlotPage />} />

        {/* Public test link page (no login required — candidate assessment via CC link) */}
        <Route path="/testlink" element={<TestLinkPage />} />

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/leads" element={<AdminRoute><LeadList /></AdminRoute>} />
        <Route path="/admin/leads/:id" element={<AdminRoute><LeadDetail /></AdminRoute>} />
        <Route path="/admin/partners" element={<AdminRoute><AdminPartners /></AdminRoute>} />
        <Route path="/admin/payouts" element={<AdminRoute><AdminPayouts /></AdminRoute>} />
        <Route path="/admin/consultations" element={<AdminRoute><AdminConsultations /></AdminRoute>} />
        <Route path="/admin/staff" element={<AdminRoute><StaffManagement /></AdminRoute>} />

        {/* Partner registration (public) */}
        <Route path="/partner/register" element={<PartnerRegister />} />
        <Route path="/partner/pending-approval" element={<PendingApproval />} />

        {/* Staff (Career Counsellor Lead) routes */}
        <Route path="/staff/login" element={<StaffLogin />} />
        <Route path="/staff"           element={<StaffRoute><LeadDashboard /></StaffRoute>} />
        <Route path="/staff/dashboard" element={<StaffRoute><LeadDashboard /></StaffRoute>} />

        {/* Counsellor (Career Counsellor) routes */}
        <Route path="/counsellor"           element={<CounsellorRoute><CounsellorDashboard /></CounsellorRoute>} />
        <Route path="/counsellor/dashboard" element={<CounsellorRoute><CounsellorDashboard /></CounsellorRoute>} />

        {/* Policy pages */}
        <Route path="/privacy" element={<PublicLayout><PrivacyPolicy /></PublicLayout>} />
        <Route path="/terms" element={<PublicLayout><TermsOfService /></PublicLayout>} />
        <Route path="/refund" element={<PublicLayout><RefundPolicy /></PublicLayout>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
