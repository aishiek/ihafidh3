/**
 * Simple Cloudflare Worker for iHafidh push prototype
 * - GET /message -> returns plain text or JSON { text }
 * - POST /register -> registers { userId, token } into KV (PUSH_TOKENS)
 * - POST /notify -> (optional) attempt to send push via FCM legacy API if FCM_SERVER_KEY secret is set
 *
 * Requirements:
 * - Add a KV namespace binding named PUSH_TOKENS in wrangler.toml
 * - Add a secret named FCM_SERVER_KEY (optional) to use /notify for sending pushes
 */

const DEFAULT_MESSAGE = 'Salaam — you have a short update from iHafidh!';

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(req) {
  try {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/message') {
      // Serve the single text message (or JSON if client prefers)
      const userId = url.searchParams.get('userId');
      let text = DEFAULT_MESSAGE;

      if (userId) {
        // If there's a token for this user, show a slightly different message
        try {
          const stored = await PUSH_TOKENS.get(userId);
          if (stored) {
            text = `Hello ${userId} — this message was prepared for you.`;
          } else {
            text = `Hello ${userId} — no registered device found; just a demo message.`;
          }
        } catch (err) {
          // ignore KV errors and fall back
          text = DEFAULT_MESSAGE;
        }
      }

      // Honor ?format=json or Accept header
      if (url.searchParams.get('format') === 'json' || req.headers.get('accept')?.includes('application/json')) {
        return new Response(JSON.stringify({ text }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (req.method === 'POST' && url.pathname === '/register') {
      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Expected application/json body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const payload = await req.json();
      const { userId, token } = payload || {};
      if (!userId || !token) {
        return new Response(JSON.stringify({ error: 'Missing userId or token' }), { status: 422, headers: { 'Content-Type': 'application/json' } });
      }

      // Store the token list for this user (keeps an array of tokens)
      // We keep it rudimentary: read list, append if not present, put back
      try {
        const existingRaw = await PUSH_TOKENS.get(userId);
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        if (!Array.isArray(existing)) {
          // Corrupt - replace
          await PUSH_TOKENS.put(userId, JSON.stringify([token]));
        } else {
          if (!existing.includes(token)) existing.push(token);
          await PUSH_TOKENS.put(userId, JSON.stringify(existing));
        }
        return new Response(JSON.stringify({ success: true, userId, tokens: await PUSH_TOKENS.get(userId) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (kvErr) {
        return new Response(JSON.stringify({ error: 'KV error', details: kvErr?.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (req.method === 'POST' && url.pathname === '/notify') {
      // Optional: this will attempt to send push notifications using FCM legacy API
      // You MUST set the FCM_SERVER_KEY secret (project server key) for this to actually deliver pushes.
      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Expected application/json' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const body = await req.json();
      const { userId, text } = body || {};
      if (!text) return new Response(JSON.stringify({ error: 'Missing "text" in request body' }), { status: 422, headers: { 'Content-Type': 'application/json' } });

      // Collect tokens: if userId provided, fetch that user tokens; otherwise send to all (keys listing could be expensive)
      let tokens = [];
      try {
        if (userId) {
          const raw = await PUSH_TOKENS.get(userId);
          tokens = raw ? JSON.parse(raw) : [];
        } else {
          // WARNING: enumerating all keys may be rate-limited / expensive, use carefully.
          // This will list up to 1000 keys — for large datasets a different strategy is required.
          const list = await PUSH_TOKENS.list({ limit: 1000 });
          for (const item of list.keys) {
            const raw = await PUSH_TOKENS.get(item.name);
            try {
              const arr = raw ? JSON.parse(raw) : [];
              tokens.push(...arr);
            } catch (err) { /* ignore */ }
          }
        }
      } catch (err) {
        // KV failed; continue with no tokens
      }

      // De-duplicate tokens
      tokens = Array.from(new Set(tokens)).filter(Boolean);

      // Prefer FCM HTTP v1 (service account OAuth) if a service account secret is present
      const serviceAccountRaw = typeof SERVICE_ACCOUNT_JSON !== 'undefined' ? SERVICE_ACCOUNT_JSON : null;

      // If no tokens found, short-circuit
      if (tokens.length === 0) {
        return new Response(JSON.stringify({ success: true, delivered: false, tokensFound: tokens.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // If service account JSON is present, use v1; otherwise, fall back to legacy server key
      if (serviceAccountRaw) {
        try {
          const serviceAccount = JSON.parse(serviceAccountRaw);
          const results = await sendUsingFcmV1(serviceAccount, tokens, text);
          return new Response(JSON.stringify({ success: true, delivered: true, results, mode: 'fcm_v1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          // fall back to legacy if parsing fails
          console.warn('FCM v1 path failed, will attempt legacy if key present:', e?.message);
        }
      }

      // fallback to legacy FCM server key behavior
      const serverKey = typeof FCM_SERVER_KEY !== 'undefined' ? FCM_SERVER_KEY : null; // worker secret
      if (!serverKey) {
        return new Response(JSON.stringify({ success: true, delivered: false, tokensFound: tokens.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Try sending using the legacy FCM endpoint
      const fcmUrl = 'https://fcm.googleapis.com/fcm/send';
      // Send in batches (up to 100 tokens per message)
      const results = [];
      const batchSize = 100;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);

        const fcmResp = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `key=${serverKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            registration_ids: batch,
            notification: { title: 'iHafidh', body: text },
            data: { from: 'worker' },
          }),
        });

        const json = await fcmResp.json().catch(() => ({}));
        results.push({ batchSize: batch.length, status: fcmResp.status, response: json });
      }

      return new Response(JSON.stringify({ success: true, delivered: true, results, mode: 'legacy' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Unknown route
    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unhandled error', message: err?.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

/* Helper functions for FCM HTTP v1 using Service Account JSON and JWT/OAuth */

function base64UrlEncode(str) {
  // Encode string (Uint8Array) or string
  if (typeof str === 'string') {
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // Uint8Array -> binary -> base64
  let binary = '';
  const bytes = new Uint8Array(str);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKeyFromPem(pem) {
  // strip header/footer and newlines
  const cleaned = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const raw = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', raw.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

async function signJwt(privateKeyPem, header, payload) {
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const toSign = `${encHeader}.${encPayload}`;
  const key = await importPrivateKeyFromPem(privateKeyPem);
  const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(toSign));
  const encodedSig = base64UrlEncode(new Uint8Array(sig));
  return `${toSign}.${encodedSig}`;
}

async function fetchAccessTokenWithServiceAccount(serviceAccount) {
  // serviceAccount must contain: private_key, client_email, token_uri, project_id
  const { private_key: privateKey, client_email: clientEmail, token_uri: tokenUri } = serviceAccount;
  if (!privateKey || !clientEmail || !tokenUri) throw new Error('Invalid service account JSON');

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1 hour

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: tokenUri,
    iat,
    exp,
  };

  const assertion = await signJwt(privateKey, header, payload);

  const form = new URLSearchParams();
  form.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  form.set('assertion', assertion);

  const tokenRes = await fetch(tokenUri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  if (!tokenRes.ok) throw new Error('Failed to request OAuth token: ' + tokenRes.status);
  const tokenJson = await tokenRes.json();
  return tokenJson; // { access_token, token_type, expires_in }
}

async function getCachedAccessToken(serviceAccount) {
  try {
    const cachedRaw = await PUSH_TOKENS.get('__fcm_v1_token');
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && cached.token && cached.expiresAt && Date.now() < cached.expiresAt - 60 * 1000) {
        return cached.token;
      }
    }
  } catch (err) {
    // kv read failed; continue to requesting a new token
  }

  const tokenJson = await fetchAccessTokenWithServiceAccount(serviceAccount);
  const expiresIn = tokenJson.expires_in || 3600;
  const expiresAt = Date.now() + (expiresIn * 1000);
  try {
    await PUSH_TOKENS.put('__fcm_v1_token', JSON.stringify({ token: tokenJson.access_token, expiresAt }), { expiration: Math.floor(expiresIn) });
  } catch (_) { /* ignore kv write failures */ }
  return tokenJson.access_token;
}

async function sendUsingFcmV1(serviceAccount, tokens, text) {
  const projectId = serviceAccount.project_id;
  if (!projectId) throw new Error('serviceAccount.project_id is required to send FCM v1 messages');
  const accessToken = await getCachedAccessToken(serviceAccount);
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const results = [];

  // Send one request per token (FCM v1 sends 1 token per message)
  for (const token of tokens) {
    const body = { message: { token, notification: { title: 'iHafidh', body: text }, data: { from: 'worker' } } };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await resp.json().catch(() => ({}));
    results.push({ token, status: resp.status, response: json });
  }
  return results;
}
