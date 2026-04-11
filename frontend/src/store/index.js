import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import assessmentReducer from './slices/assessmentSlice'
import uiReducer from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    assessment: assessmentReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
})
