import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../services/api'
import toast from 'react-hot-toast'

// Restore user from localStorage on load
const storedUser = localStorage.getItem('cg_user')
const storedToken = localStorage.getItem('cg_access_token')

export const registerUser = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/register', data)
    return res.data.data // { emailSent: true, email } — no tokens
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Registration failed')
  }
})

export const verifyEmailToken = createAsyncThunk('auth/verifyEmail', async (token, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/verify-email', { token })
    return res.data.data // { user, accessToken, refreshToken }
  } catch (err) {
    const code = err.response?.data?.error?.code
    const message = err.response?.data?.error?.message || 'Verification failed'
    return rejectWithValue({ message, code })
  }
})

export const resendVerificationEmail = createAsyncThunk('auth/resendVerification', async (email, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/resend-verification', { email })
    return res.data.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Could not resend verification email')
  }
})

export const loginUser = createAsyncThunk('auth/login', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/login', data)
    const payload = res.data.data

    // Defence-in-depth: even if the backend somehow returns success for a
    // non-user-portal role, reject on the frontend as well.
    const USER_PORTAL_ROLES = ['STUDENT', 'PARENT']
    if (!USER_PORTAL_ROLES.includes(payload?.user?.role)) {
      return rejectWithValue(
        'This account does not have access to the student portal. ' +
        'Please use the Staff Portal or Admin Panel.'
      )
    }

    return payload
  } catch (err) {
    const code = err.response?.data?.error?.code
    const message = err.response?.data?.error?.message || 'Incorrect email or password. Please try again.'
    // Attach code so Login.jsx can detect EMAIL_NOT_VERIFIED
    return rejectWithValue({ message, code })
  }
})

export const logoutUser = createAsyncThunk('auth/logout', async (_, { getState }) => {
  const { refreshToken } = getState().auth
  try {
    await api.post('/auth/logout', { refreshToken })
  } catch (_) {} // Always clear state
})

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedUser ? JSON.parse(storedUser) : null,
    accessToken: storedToken || null,
    refreshToken: localStorage.getItem('cg_refresh_token') || null,
    isLoading: false,
    error: null,
    // Set after register — holds { email } until user clicks verification link
    pendingVerification: null,
  },
  reducers: {
    setCredentials: (state, action) => {
      const { user, accessToken, refreshToken } = action.payload
      state.user = user
      state.accessToken = accessToken
      state.refreshToken = refreshToken
      state.pendingVerification = null
      localStorage.setItem('cg_user', JSON.stringify(user))
      localStorage.setItem('cg_access_token', accessToken)
      if (refreshToken) localStorage.setItem('cg_refresh_token', refreshToken)
    },
    clearCredentials: (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.pendingVerification = null
      localStorage.removeItem('cg_user')
      localStorage.removeItem('cg_access_token')
      localStorage.removeItem('cg_refresh_token')
    },
    clearError: (state) => {
      state.error = null
    },
    clearPendingVerification: (state) => {
      state.pendingVerification = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Register — no tokens returned; show "check your email" state
      .addCase(registerUser.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.pendingVerification = { email: action.payload.email }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
        toast.error(action.payload)
      })
      // Verify email — issues full credentials on success
      .addCase(verifyEmailToken.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(verifyEmailToken.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload.user
        state.accessToken = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
        state.pendingVerification = null
        localStorage.setItem('cg_user', JSON.stringify(action.payload.user))
        localStorage.setItem('cg_access_token', action.payload.accessToken)
        localStorage.setItem('cg_refresh_token', action.payload.refreshToken)
        toast.success('Email verified! Welcome to CAD Gurukul 🎓')
      })
      .addCase(verifyEmailToken.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || action.payload
      })
      // Resend verification
      .addCase(resendVerificationEmail.pending, (state) => { state.isLoading = true })
      .addCase(resendVerificationEmail.fulfilled, (state) => {
        state.isLoading = false
        toast.success('Verification email resent! Check your inbox.')
      })
      .addCase(resendVerificationEmail.rejected, (state, action) => {
        state.isLoading = false
        toast.error(action.payload || 'Could not resend. Try again.')
      })
      // Login
      .addCase(loginUser.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload.user
        state.accessToken = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
        localStorage.setItem('cg_user', JSON.stringify(action.payload.user))
        localStorage.setItem('cg_access_token', action.payload.accessToken)
        localStorage.setItem('cg_refresh_token', action.payload.refreshToken)
        toast.success('Welcome back!')
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false
        // Store the full rejection payload { message, code } so Login.jsx can branch on code
        state.error = action.payload
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        state.pendingVerification = null
        localStorage.removeItem('cg_user')
        localStorage.removeItem('cg_access_token')
        localStorage.removeItem('cg_refresh_token')
      })
  },
})

export const { setCredentials, clearCredentials, clearError, clearPendingVerification } = authSlice.actions
export const selectUser = (state) => state.auth.user
export const selectIsAuthenticated = (state) => !!state.auth.accessToken
export const selectAuthLoading = (state) => state.auth.isLoading
export const selectAuthError = (state) => state.auth.error
export const selectPendingVerification = (state) => state.auth.pendingVerification
export default authSlice.reducer
