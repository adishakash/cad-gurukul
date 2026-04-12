import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { reportApi } from '../../services/api'

export const fetchMyReports = createAsyncThunk(
  'report/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await reportApi.getMyReports()
      return res.data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch reports')
    }
  }
)

export const fetchReport = createAsyncThunk(
  'report/fetchOne',
  async (reportId, { rejectWithValue }) => {
    try {
      const res = await reportApi.getReport(reportId)
      return res.data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch report')
    }
  }
)

export const pollReportStatus = createAsyncThunk(
  'report/pollStatus',
  async (reportId, { rejectWithValue }) => {
    try {
      const res = await reportApi.getReportStatus(reportId)
      return res.data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.error?.message || 'Status check failed')
    }
  }
)

const reportSlice = createSlice({
  name: 'report',
  initialState: {
    reports:       [],
    currentReport: null,
    isLoading:     false,
    isPolling:     false,
    error:         null,
  },
  reducers: {
    clearCurrentReport: (state) => { state.currentReport = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyReports.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(fetchMyReports.fulfilled, (state, action) => {
        state.isLoading = false
        state.reports = action.payload || []
      })
      .addCase(fetchMyReports.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      .addCase(fetchReport.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(fetchReport.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentReport = action.payload
      })
      .addCase(fetchReport.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      .addCase(pollReportStatus.pending, (state) => { state.isPolling = true })
      .addCase(pollReportStatus.fulfilled, (state, action) => {
        state.isPolling = false
        // If polling result is for the current report, update it
        if (state.currentReport?.id === action.payload?.id) {
          state.currentReport = { ...state.currentReport, ...action.payload }
        }
        // Update in list too
        state.reports = state.reports.map((r) =>
          r.id === action.payload?.id ? { ...r, ...action.payload } : r
        )
      })
      .addCase(pollReportStatus.rejected, (state) => { state.isPolling = false })
  },
})

export const { clearCurrentReport } = reportSlice.actions
export const selectReports       = (state) => state.report.reports
export const selectCurrentReport = (state) => state.report.currentReport
export const selectReportLoading = (state) => state.report.isLoading
export const selectReportPolling = (state) => state.report.isPolling
export default reportSlice.reducer
