const SAME_ORIGIN_API_BASE_URL = '/api/v1'

const normalizeApiBaseUrl = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  return trimmedValue.replace(/\/+$/, '')
}

const isLocalHostname = (hostname) => (
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '[::1]'
)

export const getRuntimeConfig = () => {
  if (typeof window === 'undefined') {
    return {}
  }

  return window.__CAD_GURUKUL_RUNTIME_CONFIG__ || {}
}

export const getApiBaseUrl = () => {
  const runtimeApiBaseUrl = normalizeApiBaseUrl(getRuntimeConfig().apiBaseUrl)
  if (runtimeApiBaseUrl) {
    return runtimeApiBaseUrl
  }

  const buildTimeApiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
  if (buildTimeApiBaseUrl) {
    return buildTimeApiBaseUrl
  }

  if (typeof window !== 'undefined' && import.meta.env.PROD && !isLocalHostname(window.location.hostname)) {
    console.warn(
      '[API] Missing API base URL configuration. Falling back to same-origin /api/v1, which only works when the frontend host proxies /api to the backend.'
    )
  }

  return SAME_ORIGIN_API_BASE_URL
}

export const apiBaseUrl = getApiBaseUrl()