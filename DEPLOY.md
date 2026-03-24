# Polly Tunnels - Free Production Setup (Supabase)

This path keeps your site free and avoids paid backend hosting.

## 1) Create Supabase project (free)

1. Go to https://supabase.com/dashboard
2. Create a new project
3. Open **SQL Editor** and run `SUPABASE_SETUP.sql`

## 2) Configure auth providers

In Supabase dashboard:

- **Authentication -> Providers -> Google**
  - enable Google
  - add your Google OAuth credentials
- **Authentication -> URL Configuration**
  - Site URL: `https://ezzp024.github.io`
  - Redirect URL: `https://ezzp024.github.io/account.html`

## 3) Add project keys to frontend

Open `config.js` and set:

```js
window.SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
window.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
window.ADMIN_EMAIL = 'ezzp024@gmail.com';
```

Commit and push.

## 4) Use admin approvals

1. Register/login as `ezzp024@gmail.com`
2. Open `admin.html`
3. Approve pending users

Only approved users can create threads/replies/upvote.
