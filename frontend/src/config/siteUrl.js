import { getRuntimeConfig } from './apiBaseUrl'

const normalizeSiteUrl = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  return trimmedValue.replace(/\/+$/, '')
}

export const getSiteUrl = () => {
  const runtimeSiteUrl = normalizeSiteUrl(getRuntimeConfig().siteUrl)
  if (runtimeSiteUrl) {
    return runtimeSiteUrl
  }

  const buildTimeSiteUrl = normalizeSiteUrl(import.meta.env.VITE_SITE_URL)
  if (buildTimeSiteUrl) {
    return buildTimeSiteUrl
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return ''
}

export const withSiteUrl = (pathOrUrl) => {
  if (!pathOrUrl) {
    return ''
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl
  }

  const siteUrl = getSiteUrl()
  if (!siteUrl) {
    return pathOrUrl
  }

  const suffix = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${siteUrl}${suffix}`
}
