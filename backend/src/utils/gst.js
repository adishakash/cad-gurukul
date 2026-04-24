'use strict';

const normalizeRate = (rate) => {
  const parsed = Number(rate);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const normalizePaise = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
};

/**
 * Split GST from a GST-inclusive total.
 * @param {number} totalPaise
 * @param {number} gstRatePct
 * @returns {{ basePaise: number, gstPaise: number, rate: number }}
 */
const splitGstFromInclusive = (totalPaise, gstRatePct) => {
  const rate = normalizeRate(gstRatePct);
  const total = normalizePaise(totalPaise);
  if (!rate || total === 0) {
    return { basePaise: total, gstPaise: 0, rate };
  }

  const basePaise = Math.round((total * 100) / (100 + rate));
  const gstPaise = Math.max(0, total - basePaise);

  return { basePaise, gstPaise, rate };
};

/**
 * Add GST on top of an exclusive subtotal.
 * @param {number} subtotalPaise
 * @param {number} gstRatePct
 * @returns {{ totalPaise: number, gstPaise: number, rate: number }}
 */
const addGstToExclusive = (subtotalPaise, gstRatePct) => {
  const rate = normalizeRate(gstRatePct);
  const subtotal = normalizePaise(subtotalPaise);
  if (!rate || subtotal === 0) {
    return { totalPaise: subtotal, gstPaise: 0, rate };
  }

  const gstPaise = Math.round((subtotal * rate) / 100);
  return { totalPaise: subtotal + gstPaise, gstPaise, rate };
};

module.exports = { splitGstFromInclusive, addGstToExclusive, normalizeRate };
