import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../services/api'
import toast from 'react-hot-toast'

// Restore user from localStorage on load
const storedUser = localStorage.getItem('cg_user')
const storedToken = localStorage.getItem('cg_access_token')

export const registerUser = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/register', data)
    return res.data.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Registration failed')
  }
})

export const loginUser = createAsyncThunk('auth/login', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/login', data)
    return res.data.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Login failed')
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
  },
  reducers: {
    setCredentials: (state, action) => {
      const { user, accessToken, refreshToken } = action.payload
      state.user = user
      state.accessToken = accessToken
      state.refreshToken = refreshToken
      localStorage.setItem('cg_user', JSON.stringify(user))
      localStorage.setItem('cg_access_token', accessToken)
      if (refreshToken) localStorage.setItem('cg_refresh_token', refreshToken)
    },
    clearCredentials: (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      localStorage.removeItem('cg_user')
      localStorage.removeItem('cg_access_token')
      localStorage.removeItem('cg_refresh_token')
    },
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(registerUser.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload.user
        state.accessToken = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
        localStorage.setItem('cg_user', JSON.stringify(action.payload.user))
        localStorage.setItem('cg_access_token', action.payload.accessToken)
        localStorage.setItem('cg_refresh_token', action.payload.refreshToken)
        toast.success('Account created! Welcome to CAD Gurukul 🎓')
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
        toast.error(action.payload)
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
        state.error = action.payload
        toast.error(action.payload)
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        localStorage.removeItem('cg_user')
        localStorage.removeItem('cg_access_token')
        localStorage.removeItem('cg_refresh_token')
      })
  },
})

export const { setCredentials, clearCredentials } = authSlice.actions
export const selectUser = (state) => state.auth.user
export const selectIsAuthenticated = (state) => !!state.auth.accessToken
export const selectAuthLoading = (state) => state.auth.isLoading
export default authSlice.reducer
