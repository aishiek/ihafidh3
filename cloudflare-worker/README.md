# iHafidh Cloudflare Worker (push demo)

This Cloudflare Worker is a small helper to prototype push workflows and a single text endpoint for the mobile app.

Endpoints
- GET /message -> returns plain text or JSON { text } (e.g. used by app's `fetchAndDisplayWorkerMessage`)
  - optional query: ?userId=your_id
  - optional query: ?format=json
- POST /register -> registers a device token: body = { userId, token }
  - Stores tokens in KV namespace 'PUSH_TOKENS'
- POST /notify -> (optional) attempts to send messages to registered tokens using the FCM 'server key'.
  - Provide body { text } and optional { userId }
  - Requires a worker secret named `FCM_SERVER_KEY` for actual delivery

Quick setup and deploy (wrangler)
1. Install Wrangler v2: https://developers.cloudflare.com/workers/cli-wrangler/install

2. Login and initialize (if needed):

```bash
npx wrangler login
# or
wrangler login
```

3. Create a KV Namespace for tokens (and note the id):

```bash
npx wrangler kv:namespace create "PUSH_TOKENS" --preview-name "PUSH_TOKENS"
```

This outputs an id in the terminal you must add into `wrangler.toml` under `kv_namespaces` binding.

4. (Optional) Add your FCM Server key for sending pushes through /notify (if you want the worker to call FCM directly):

```bash
npx wrangler secret put FCM_SERVER_KEY
# paste your FCM legacy server key when prompted
```

5. Publish the Worker:

Example — using your chosen worker name `ihafdih-notify` and KV namespace `PUSH_TOKENS`:

```bash
# 1) Log in interactively to Cloudflare (opens browser for auth)
npx wrangler login

# 2) Create a KV namespace and capture the id printed by wrangler
npx wrangler kv:namespace create "PUSH_TOKENS" --preview-name "PUSH_TOKENS"

# 3) Copy the example and add the namespace id (edit the id in the file)
cp cloudflare-worker/wrangler.toml.example cloudflare-worker/wrangler.toml
# edit cloudflare-worker/wrangler.toml and replace your_kv_namespace_id_here with the id

# 4) (Optional) Add your FCM legacy server key so /notify can send pushes (you can add later)
npx wrangler secret put FCM_SERVER_KEY

# 5) Publish the worker using the selected name
npx wrangler publish ./cloudflare-worker/worker.js --name ihafdih-notify
```

Testing
- Register a token (simulate from app):

```bash
curl -X POST "https://<your-worker>.workers.dev/register" \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user_abc","token":"fake_token_123"}'
```

- Fetch message (app will show local notification when it fetches):

```bash
curl "https://<your-worker>.workers.dev/message"
# OR JSON
curl "https://<your-worker>.workers.dev/message?format=json"
```

- Trigger notify (if you added FCM_SERVER_KEY and there are tokens):

```bash
curl -X POST "https://<your-worker>.workers.dev/notify" \
  -H 'Content-Type: application/json' \
  -d '{"text":"A test push from the worker","userId":"user_abc"}'
```

Security notes
- The `register` endpoint is intentionally simple for prototyping. In production you should:
  - Add authentication (tokens, signed requests)
  - Rate-limit and validate inputs
  - Use FCM HTTP v1 with proper OAuth credentials instead of legacy server key

How the mobile app integrates
1. Set `WORKER_URL` in `services/PushNotificationService.ts` to your worker URL.
2. The mobile app's `registerToken` automatically POSTs to `/register` when the FCM token is created.
3. `fetchAndDisplayWorkerMessage('/message')` will GET the message URL and show it as a Notifee local notification.

That's it — this worker is a small, safe place to prototype sending and fetching short text messages for the app. If you'd like, I can also:
- Add structured authentication (API key check)
- Add a scheduled push sender (using Cron Triggers) to send daily messages to users who need reminders
- Switch to FCM v1 using JWT service account flow

---

Getting an FCM key (two options)

- Option A — Legacy server key (quick & simple):
  1. In the Firebase Console open Project Settings → Cloud Messaging.
  2. Look for "Project credentials" → "Server key" or "Legacy server key" and copy it.
  3. Add it to the Worker as a wrangler secret: `npx wrangler secret put FCM_SERVER_KEY`.

- Option B — Recommended: use FCM HTTP v1 + service account (secure):
  1. In Firebase Console → Project settings → Service accounts → Generate new private key.
  3. Save the JSON key locally — it contains a private_key, client_email and project_id.
  4. Add the service account JSON to your Worker using Wrangler so the Worker can mint short-lived OAuth tokens and call FCM HTTP v1:

```bash
npx wrangler secret put SERVICE_ACCOUNT_JSON
# paste the entire service-account .json when prompted
```

The worker will prefer the `SERVICE_ACCOUNT_JSON` secret and use FCM HTTP v1 (the modern, recommended API). It will cache an OAuth access token in the `PUSH_TOKENS` KV under the key `__fcm_v1_token` to avoid requesting a new token for every message.

If you'd like I can also help modify the worker to read the service-account secret from another secret store (or implement an alternative secure flow) — v1/service-account is the recommended production approach.

