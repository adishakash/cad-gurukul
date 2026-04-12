'use strict';

const puppeteer = require('puppeteer');

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) {
    throw new Error('A frontend base URL is required for the smoke test.');
  }

  return String(baseUrl).replace(/\/$/, '');
};

const expectText = async (page, text, timeoutMs) => {
  await page.waitForFunction(
    (target) => document.body && document.body.innerText.includes(target),
    { timeout: timeoutMs },
    text
  );
};

const clickByText = async (page, text) => {
  const clicked = await page.evaluate((target) => {
    const nodes = [...document.querySelectorAll('button, a')];
    const match = nodes.find((node) => node.textContent && node.textContent.includes(target));

    if (!match) return false;

    match.click();
    return true;
  }, text);

  if (!clicked) {
    throw new Error(`Could not find clickable text: ${text}`);
  }
};

const checkAuthLink = async (page, url, linkText, timeoutMs) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

  return page.evaluate((targetText) => {
    const link = [...document.querySelectorAll('a')]
      .find((node) => node.textContent && node.textContent.includes(targetText));

    return link ? link.getAttribute('href') : null;
  }, linkText);
};

const runFrontendSmoke = async ({ baseUrl, timeoutMs = 15000, label = 'frontend-smoke' }) => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(timeoutMs);
    page.setDefaultTimeout(timeoutMs);

    console.log(`target=${normalizedBaseUrl}`);
    console.log(`label=${label}`);

    await page.goto(`${normalizedBaseUrl}/`, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await expectText(page, 'Start Free Career Test', timeoutMs);
    console.log('home-ok');

    await clickByText(page, 'Start Free Career Test');
    await page.waitForFunction(() => location.pathname === '/assessment', { timeout: timeoutMs });
    await expectText(page, 'AI Career Assessment', timeoutMs);
    console.log('assessment-route-ok');

    const answers = [
      'Solving problems or puzzles',
      'Being a top professional',
      'Maths or Science',
    ];

    for (const answer of answers.slice(0, 2)) {
      await clickByText(page, answer);
      await clickByText(page, 'Next Question');
    }

    await clickByText(page, answers[2]);
    await clickByText(page, 'See My Results');
    await expectText(page, 'enter your details to unlock your personalised career report', timeoutMs);
    await expectText(page, 'Continue & Unlock My Report', timeoutMs);
    console.log('guest-funnel-ok');

    const query = 'plan=free&next=assessment&intent=paid&leadId=test-lead';
    const registerLoginHref = await checkAuthLink(page, `${normalizedBaseUrl}/register?${query}`, 'Sign In', timeoutMs);
    const loginRegisterHref = await checkAuthLink(page, `${normalizedBaseUrl}/login?${query}`, 'Create a free account', timeoutMs);

    console.log(`register-login-href=${registerLoginHref}`);
    console.log(`login-register-href=${loginRegisterHref}`);

    if (registerLoginHref !== `/login?${query}`) {
      throw new Error(`Register page did not preserve handoff query. Got: ${registerLoginHref}`);
    }

    if (loginRegisterHref !== `/register?${query}`) {
      throw new Error(`Login page did not preserve handoff query. Got: ${loginRegisterHref}`);
    }

    console.log('auth-handoff-ok');
    console.log('smoke-ok');
  } finally {
    await browser.close();
  }
};

module.exports = { runFrontendSmoke };