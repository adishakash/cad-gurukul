import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { store } from './store'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '10px', fontFamily: 'Inter, sans-serif', fontSize: '14px' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#e94560', secondary: '#fff' } },
        }}
      />
    </Provider>
  </React.StrictMode>
)
