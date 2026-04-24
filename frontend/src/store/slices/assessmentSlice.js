import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../services/api'
import toast from 'react-hot-toast'
import i18n from '../../i18n'

export const startAssessment = createAsyncThunk('assessment/start', async (accessLevel, { rejectWithValue }) => {
  try {
    const res = await api.post('/assessments/start', { accessLevel })
    return res.data.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to start assessment')
  }
})

export const fetchNextQuestion = createAsyncThunk('assessment/nextQuestion', async (assessmentId, { rejectWithValue }) => {
  try {
    const res = await api.post(`/assessments/${assessmentId}/questions/next`)
    return res.data.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to get question')
  }
})

export const submitAnswer = createAsyncThunk('assessment/submitAnswer', async ({ assessmentId, answerData }, { rejectWithValue }) => {
  try {
    const res = await api.post(`/assessments/${assessmentId}/answers`, answerData)
    return res.data.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to submit answer')
  }
})

export const completeAssessment = createAsyncThunk('assessment/complete', async (assessmentId, { rejectWithValue }) => {
  try {
    const res = await api.post(`/assessments/${assessmentId}/complete`)
    return res.data.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to complete assessment')
  }
})

const assessmentSlice = createSlice({
  name: 'assessment',
  initialState: {
    currentAssessment: null,
    currentQuestion: null,
    answers: [],
    isLoading: false,
    isSubmitting: false,
    error: null,
    isCompleted: false,
    reportId: null,
  },
  reducers: {
    resetAssessment: (state) => {
      state.currentAssessment = null
      state.currentQuestion = null
      state.answers = []
      state.isCompleted = false
      state.reportId = null
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(startAssessment.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(startAssessment.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentAssessment = action.payload
      })
      .addCase(startAssessment.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
        toast.error(action.payload)
      })

      .addCase(fetchNextQuestion.pending, (state) => { state.isLoading = true })
      .addCase(fetchNextQuestion.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentQuestion = action.payload
      })
      .addCase(fetchNextQuestion.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
        toast.error(action.payload)
      })

      .addCase(submitAnswer.pending, (state) => { state.isSubmitting = true })
      .addCase(submitAnswer.fulfilled, (state, action) => {
        state.isSubmitting = false
        state.answers.push(action.payload)
      })
      .addCase(submitAnswer.rejected, (state, action) => {
        state.isSubmitting = false
        toast.error(action.payload)
      })

      .addCase(completeAssessment.pending, (state) => { state.isLoading = true })
      .addCase(completeAssessment.fulfilled, (state, action) => {
        state.isLoading = false
        state.isCompleted = true
        state.reportId = action.payload.reportId
        toast.success(i18n.t('assessment.status.completeToast'))
      })
      .addCase(completeAssessment.rejected, (state, action) => {
        state.isLoading = false
        toast.error(action.payload)
      })
  },
})

export const { resetAssessment } = assessmentSlice.actions
export const selectAssessment = (state) => state.assessment.currentAssessment
export const selectCurrentQuestion = (state) => state.assessment.currentQuestion
export const selectAssessmentLoading = (state) => state.assessment.isLoading
export const selectIsCompleted = (state) => state.assessment.isCompleted
export const selectReportId = (state) => state.assessment.reportId
export default assessmentSlice.reducer
