'use strict';

const crypto = require('crypto');

const normalizeBaseUrl = (value) => {
  if (!value) {
    throw new Error('SMOKE_API_BASE_URL is required. Example: https://backend.example.com/api/v1');
  }

  return String(value).replace(/\/+$/, '');
};

const apiBaseUrl = normalizeBaseUrl(
  process.env.SMOKE_API_BASE_URL
  || process.env.VITE_API_BASE_URL
  || 'https://backend-vsrii.ondigitalocean.app/api/v1'
);

const frontendOrigin = process.env.SMOKE_FRONTEND_ORIGIN || 'https://frontend-jyvsf.ondigitalocean.app';
const runAuthFlow = process.env.SMOKE_AUTH_FLOW !== 'false';
const smokePassword = process.env.SMOKE_PASSWORD || 'SmokePass1';
const smokeRole = process.env.SMOKE_ROLE || 'STUDENT';

const logStep = (message) => {
  console.log(`[smoke-api] ${message}`);
};

const parseBody = async (response) => {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return { text, json: JSON.parse(text) };
    } catch {
      return { text, json: null };
    }
  }

  return { text, json: null };
};

const request = async (method, path, { headers = {}, body } = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const parsed = await parseBody(response);

  return {
    status: response.status,
    headers: response.headers,
    text: parsed.text,
    json: parsed.json,
  };
};

const assertStatus = (label, actual, expected) => {
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  if (!expectedValues.includes(actual)) {
    throw new Error(`${label} returned ${actual}. Expected ${expectedValues.join(' or ')}.`);
  }
};

const assertTruthy = (label, value) => {
  if (!value) {
    throw new Error(`${label} is missing.`);
  }
};

const main = async () => {
  logStep(`api-base=${apiBaseUrl}`);
  logStep(`frontend-origin=${frontendOrigin}`);
  logStep(`auth-flow=${runAuthFlow}`);

  const health = await request('GET', '/health');
  assertStatus('GET /health', health.status, 200);
  if (!health.json?.success || health.json?.data?.status !== 'ok') {
    throw new Error('GET /health did not return the expected success payload.');
  }
  logStep('health-ok');

  const preflight = await request('OPTIONS', '/auth/register', {
    headers: {
      Origin: frontendOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type,Authorization',
    },
  });
  assertStatus('OPTIONS /auth/register', preflight.status, [200, 204]);
  const allowOrigin = preflight.headers.get('access-control-allow-origin');
  if (allowOrigin !== frontendOrigin && allowOrigin !== '*') {
    throw new Error(`OPTIONS /auth/register returned unexpected access-control-allow-origin: ${allowOrigin || '<missing>'}`);
  }
  logStep('cors-preflight-ok');

  const invalidRegister = await request('POST', '/auth/register', {
    headers: {
      Origin: frontendOrigin,
      'Content-Type': 'application/json',
    },
    body: {},
  });
  assertStatus('POST /auth/register invalid payload', invalidRegister.status, 422);
  logStep('register-validation-ok');

  if (!runAuthFlow) {
    logStep('smoke-ok');
    return;
  }

  const uniqueEmail = process.env.SMOKE_EMAIL || `smoke.${Date.now()}.${crypto.randomBytes(3).toString('hex')}@example.com`;
  const registerPayload = {
    fullName: process.env.SMOKE_FULL_NAME || 'Smoke Test User',
    email: uniqueEmail,
    password: smokePassword,
    role: smokeRole,
  };

  const registerResponse = await request('POST', '/auth/register', {
    headers: {
      Origin: frontendOrigin,
      'Content-Type': 'application/json',
    },
    body: registerPayload,
  });
  assertStatus('POST /auth/register valid payload', registerResponse.status, 201);
  assertTruthy('register accessToken', registerResponse.json?.data?.accessToken);
  assertTruthy('register refreshToken', registerResponse.json?.data?.refreshToken);
  logStep(`register-ok email=${uniqueEmail}`);

  const loginResponse = await request('POST', '/auth/login', {
    headers: {
      Origin: frontendOrigin,
      'Content-Type': 'application/json',
    },
    body: { email: uniqueEmail, password: smokePassword },
  });
  assertStatus('POST /auth/login', loginResponse.status, 200);
  assertTruthy('login accessToken', loginResponse.json?.data?.accessToken);
  assertTruthy('login refreshToken', loginResponse.json?.data?.refreshToken);
  logStep('login-ok');

  const refreshResponse = await request('POST', '/auth/refresh', {
    headers: {
      Origin: frontendOrigin,
      'Content-Type': 'application/json',
    },
    body: { refreshToken: loginResponse.json.data.refreshToken },
  });
  assertStatus('POST /auth/refresh', refreshResponse.status, 200);
  assertTruthy('refresh accessToken', refreshResponse.json?.data?.accessToken);
  assertTruthy('refresh refreshToken', refreshResponse.json?.data?.refreshToken);
  logStep('refresh-ok');

  const logoutResponse = await request('POST', '/auth/logout', {
    headers: {
      Origin: frontendOrigin,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginResponse.json.data.accessToken}`,
    },
    body: { refreshToken: loginResponse.json.data.refreshToken },
  });
  assertStatus('POST /auth/logout', logoutResponse.status, 200);
  logStep('logout-ok');

  logStep('smoke-ok');
};

main().catch((error) => {
  console.error(`[smoke-api] FAILED ${error.message}`);
  process.exit(1);
});