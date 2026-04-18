import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated } from './store/slices/authSlice'

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
import AdminLogin     from './pages/Admin/AdminLogin'
import AdminDashboard from './pages/Admin/AdminDashboard'
import LeadList       from './pages/Admin/LeadList'
import LeadDetail     from './pages/Admin/LeadDetail'
import AdminPartners  from './pages/Admin/AdminPartners'
import AdminPayouts   from './pages/Admin/AdminPayouts'

// Staff pages (Career Counsellor Lead portal)
import StaffLogin       from './pages/Staff/StaffLogin'
import LeadDashboard    from './pages/Staff/LeadDashboard'
import PartnerRegister  from './pages/Staff/PartnerRegister'
import PendingApproval  from './pages/Staff/PendingApproval'

// Counsellor pages (Career Counsellor portal)
import CounsellorDashboard from './pages/Counsellor/CounsellorDashboard'

// Public joining page (no auth required)
import JoinPage from './pages/Public/JoinPage'

// Public test link page (no auth required — candidate payment via CC link)
import TestLinkPage from './pages/Public/TestLinkPage'

// Guards
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

const GuestRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children
}

// Admin guard — checks localStorage directly (admin auth is independent of Redux store)
const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('cg_admin_token')
  return token ? children : <Navigate to="/admin/login" replace />
}

// Staff guard — checks localStorage directly (staff auth is independent of Redux store)
const StaffRoute = ({ children }) => {
  const token = localStorage.getItem('cg_staff_token')
  const staff = JSON.parse(localStorage.getItem('cg_staff') || '{}')
  // Only CCL (and ADMIN via staff token, though rare) can access the staff portal
  if (!token || staff.role === 'CAREER_COUNSELLOR') return <Navigate to="/staff/login" replace />
  return children
}

// Counsellor guard — CC and CCL can both access counsellor routes
const CounsellorRoute = ({ children }) => {
  const token = localStorage.getItem('cg_staff_token')
  return token ? children : <Navigate to="/staff/login" replace />
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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
