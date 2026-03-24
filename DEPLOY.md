# Polly Tunnels: Final Production Setup

Your frontend is already live on GitHub Pages.

To finish production auth/email/admin, do these in order.

## 1) Deploy backend (Render)

1. Create a free Render account.
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repo: `ezzp024/ezzp024.github.io`.
4. Render will detect `render.yaml` and create the backend service.

When it finishes, copy your backend URL, for example:
`https://polly-tunnels-backend.onrender.com`

## 2) Set backend URL in frontend

Open `config.js` and set:

```js
window.FORUM_API_BASE = 'https://YOUR-BACKEND-URL/api';
```

Commit and push.

## 3) Google login setup

1. In Google Cloud Console, create OAuth 2.0 Web Client.
2. Add authorized JavaScript origins:
   - `https://ezzp024.github.io`
3. Copy the Google Client ID.
4. Set it in two places:
   - Render env var: `GOOGLE_CLIENT_ID`
   - `config.js`: `window.GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';`

## 4) Email verification setup (Resend)

1. Create Resend account.
2. Create API key.
3. Set Render env vars:
   - `RESEND_API_KEY`
   - `EMAIL_FROM` (sender email/domain allowed by Resend)

Note: if `EMAIL_FROM` is not set, backend defaults to `onboarding@resend.dev` for test mode.

## 5) Admin approvals

- Admin is restricted to: `ezzp024@gmail.com`
- Login as admin at `account.html`, then open `admin.html`.
- Approve pending users.

## 6) Final test checklist

1. Register new user -> receive code in email.
2. Verify code -> user shows as pending.
3. Admin approves user.
4. User logs in and can post/reply/upvote.
5. Google login works.
