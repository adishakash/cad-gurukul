import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { leadApi } from '../../services/api'
import toast from 'react-hot-toast'

// Persist leadId across sessions so returning visitors are recognised
const storedLeadId = localStorage.getItem('cg_lead_id')
const storedPlan   = localStorage.getItem('cg_selected_plan') || 'free'

export const createOrUpdateLead = createAsyncThunk(
  'lead/createOrUpdate',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await leadApi.create(payload)
      return res.data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.error?.message || 'Failed to save your details')
    }
  }
)

export const fetchMyLead = createAsyncThunk(
  'lead/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const res = await leadApi.getMe()
      return res.data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.error?.message || 'Failed to fetch lead')
    }
  }
)

export const updateMyLead = createAsyncThunk(
  'lead/update',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await leadApi.update(payload)
      return res.data.data
    } catch (err) {
      return rejectWithValue(err.response?.data?.error?.message || 'Failed to update details')
    }
  }
)

const leadSlice = createSlice({
  name: 'lead',
  initialState: {
    leadId:   storedLeadId || null,
    plan:     storedPlan,
    status:   null,
    lead:     null,
    isLoading: false,
    error:    null,
  },
  reducers: {
    setLeadId: (state, action) => {
      state.leadId = action.payload
      localStorage.setItem('cg_lead_id', action.payload)
    },
    setPlan: (state, action) => {
      state.plan = action.payload
      localStorage.setItem('cg_selected_plan', action.payload)
    },
    clearLead: (state) => {
      state.leadId = null
      state.plan   = 'free'
      state.status = null
      state.lead   = null
      localStorage.removeItem('cg_lead_id')
      localStorage.removeItem('cg_selected_plan')
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createOrUpdateLead.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(createOrUpdateLead.fulfilled, (state, action) => {
        state.isLoading = false
        const { leadId, status, selectedPlan } = action.payload || {}
        if (leadId) {
          state.leadId = leadId
          localStorage.setItem('cg_lead_id', leadId)
        }
        if (status)       state.status = status
        if (selectedPlan) {
          state.plan = selectedPlan
          localStorage.setItem('cg_selected_plan', selectedPlan)
        }
        state.lead = action.payload
      })
      .addCase(createOrUpdateLead.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
        toast.error(action.payload)
      })

      .addCase(fetchMyLead.pending, (state) => { state.isLoading = true })
      .addCase(fetchMyLead.fulfilled, (state, action) => {
        state.isLoading = false
        state.lead   = action.payload
        state.status = action.payload?.status || null
        if (action.payload?.id) {
          state.leadId = action.payload.id
          localStorage.setItem('cg_lead_id', action.payload.id)
        }
      })
      .addCase(fetchMyLead.rejected, (state) => { state.isLoading = false })

      .addCase(updateMyLead.fulfilled, (state, action) => {
        state.lead   = action.payload
        state.status = action.payload?.status || state.status
      })
  },
})

export const { setLeadId, setPlan, clearLead } = leadSlice.actions
export const selectLead       = (state) => state.lead.lead
export const selectLeadId     = (state) => state.lead.leadId
export const selectPlan       = (state) => state.lead.plan
export const selectLeadStatus = (state) => state.lead.status
export const selectLeadLoading = (state) => state.lead.isLoading
export default leadSlice.reducer
