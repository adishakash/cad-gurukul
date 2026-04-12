import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import assessmentReducer from './slices/assessmentSlice'
import uiReducer from './slices/uiSlice'
import leadReducer from './slices/leadSlice'
import reportReducer from './slices/reportSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    assessment: assessmentReducer,
    ui: uiReducer,
    lead: leadReducer,
    report: reportReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
})
