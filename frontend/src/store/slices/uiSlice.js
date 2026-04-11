import { createSlice } from '@reduxjs/toolkit'

const uiSlice = createSlice({
  name: 'ui',
  initialState: { isMobileMenuOpen: false, isPageLoading: false },
  reducers: {
    toggleMobileMenu: (state) => { state.isMobileMenuOpen = !state.isMobileMenuOpen },
    closeMobileMenu: (state) => { state.isMobileMenuOpen = false },
    setPageLoading: (state, action) => { state.isPageLoading = action.payload },
  },
})

export const { toggleMobileMenu, closeMobileMenu, setPageLoading } = uiSlice.actions
export default uiSlice.reducer
