import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import { getSiteUrl, withSiteUrl } from '../../config/siteUrl'

const DEFAULT_SITE_NAME = 'CAD Gurukul'
const DEFAULT_OG_IMAGE = '/logo.svg'

const buildRobotsValue = (noIndex, noFollow) => {
  const indexValue = noIndex ? 'noindex' : 'index'
  const followValue = noFollow ? 'nofollow' : 'follow'
  return `${indexValue}, ${followValue}`
}

export default function Seo({
  title,
  description,
  canonicalPath,
  image,
  type = 'website',
  siteName = DEFAULT_SITE_NAME,
  noIndex = false,
  noFollow = false,
  structuredData,
}) {
  const location = useLocation()
  const siteUrl = getSiteUrl()
  const canonical = canonicalPath
    ? withSiteUrl(canonicalPath)
    : (siteUrl ? `${siteUrl}${location.pathname}` : '')
  const ogImage = image
    ? withSiteUrl(image)
    : (siteUrl ? withSiteUrl(DEFAULT_OG_IMAGE) : '')
  const robots = buildRobotsValue(noIndex, noFollow)
  const jsonLd = Array.isArray(structuredData)
    ? structuredData
    : (structuredData ? [structuredData] : [])

  return (
    <Helmet>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      {robots && <meta name="robots" content={robots} />}
      {canonical && <link rel="canonical" href={canonical} />}

      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      {type && <meta property="og:type" content={type} />}
      {siteName && <meta property="og:site_name" content={siteName} />}
      {canonical && <meta property="og:url" content={canonical} />}
      {ogImage && <meta property="og:image" content={ogImage} />}

      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      <meta name="twitter:card" content="summary" />

      {jsonLd.map((data, index) => (
        <script key={`jsonld-${index}`} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  )
}
