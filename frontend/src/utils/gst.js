export const normalizeGstRate = (rate) => {
  const parsed = Number(rate)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export const splitGstFromInclusive = (totalPaise, gstRate) => {
  const rate = normalizeGstRate(gstRate)
  const total = Math.max(0, Math.round(Number(totalPaise) || 0))
  if (!rate || total === 0) {
    return { basePaise: total, gstPaise: 0, rate }
  }

  const basePaise = Math.round((total * 100) / (100 + rate))
  const gstPaise = Math.max(0, total - basePaise)

  return { basePaise, gstPaise, rate }
}
