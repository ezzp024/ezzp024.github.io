import { createServer } from 'node:http';
import { createHash, createHmac, randomInt } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DATA_PATH = join(__dirname, 'data', 'forum.json');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'ezzp024@gmail.com').toLowerCase();
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

const json = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(payload));
};

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });

const hashPassword = (value) => createHash('sha256').update(value).digest('hex');

const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
};

const verifyToken = (token) => {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) {
    return null;
  }

  const expected = createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (expected !== signature) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const getBearerToken = (req) => {
  const raw = req.headers.authorization || '';
  if (!raw.startsWith('Bearer ')) {
    return '';
  }
  return raw.slice(7);
};

const ensureDataFile = async () => {
  await mkdir(join(__dirname, 'data'), { recursive: true });
  try {
    await readFile(DATA_PATH, 'utf8');
  } catch {
    const seed = {
      threads: [
        {
          id: `t-${Date.now()}-seed`,
          title: 'Welcome to Polly Tunnels Forum',
          body: 'This backend stores shared posts for all users.',
          author: 'System',
          authorEmail: 'system@local',
          createdAt: Date.now(),
          upvotes: 1,
          upvoters: [],
          replies: []
        }
      ],
      users: [
        {
          id: `u-admin-${Date.now()}`,
          name: 'Admin',
          email: ADMIN_EMAIL,
          passwordHash: hashPassword('admin-temp-password'),
          emailVerified: true,
          approved: true,
          isAdmin: true,
          createdAt: Date.now()
        }
      ],
      pendingRegistrations: []
    };
    await writeFile(DATA_PATH, JSON.stringify(seed, null, 2));
  }
};

const readDB = async () => {
  const raw = await readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  parsed.threads ||= [];
  parsed.users ||= [];
  parsed.pendingRegistrations ||= [];
  return parsed;
};

const writeDB = async (db) => {
  await writeFile(DATA_PATH, JSON.stringify(db, null, 2));
};

const hotScore = (thread) => {
  const ageHours = Math.max((Date.now() - Number(thread.createdAt || Date.now())) / 3600000, 1);
  const replies = Array.isArray(thread.replies) ? thread.replies.length : 0;
  const upvotes = Number(thread.upvotes || 0);
  return upvotes * 3 + replies * 2 - ageHours * 0.1;
};

const sortThreads = (threads, mode) => {
  const list = [...threads];
  if (mode === 'new') {
    return list.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }
  return list.sort((a, b) => hotScore(b) - hotScore(a));
};

const sendVerificationEmail = async (to, code) => {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    throw new Error('Email service not configured on server');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject: 'Your Polly Tunnels verification code',
      html: `<p>Your verification code is <strong>${code}</strong>.</p><p>Code expires in 10 minutes.</p>`
    })
  });

  if (!response.ok) {
    throw new Error('Failed to send verification email');
  }
};

const getAuthUser = async (req, db) => {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload?.email) {
    return null;
  }

  const email = String(payload.email).toLowerCase();
  return db.users.find((user) => user.email === email) || null;
};

const createSession = (user) =>
  signToken({
    email: user.email,
    name: user.name,
    isAdmin: Boolean(user.isAdmin),
    iat: Date.now()
  });

const getGoogleProfile = async (credential) => {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Invalid Google credential');
  }

  const data = await response.json();
  if (!data.email || data.email_verified !== 'true') {
    throw new Error('Google email not verified');
  }

  if (GOOGLE_CLIENT_ID && data.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Google client ID mismatch');
  }

  return {
    name: data.name || 'Google User',
    email: String(data.email).toLowerCase()
  };
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/api/health') {
      json(res, 200, {
        ok: true,
        service: 'polly-forum-backend',
        emailConfigured: Boolean(RESEND_API_KEY && EMAIL_FROM),
        googleConfigured: Boolean(GOOGLE_CLIENT_ID)
      });
      return;
    }

    if (req.method === 'POST' && path === '/api/auth/register/start') {
      const payload = await parseBody(req);
      const name = String(payload.name || '').trim();
      const email = String(payload.email || '').trim().toLowerCase();
      const password = String(payload.password || '');

      if (!name || !email || password.length < 6) {
        json(res, 400, { error: 'Name, email, and password are required' });
        return;
      }

      const db = await readDB();
      if (db.users.some((user) => user.email === email)) {
        json(res, 409, { error: 'Email already registered' });
        return;
      }

      const code = String(randomInt(100000, 1000000));
      const codeExpiresAt = Date.now() + 10 * 60 * 1000;

      db.pendingRegistrations = db.pendingRegistrations.filter((item) => item.email !== email);
      db.pendingRegistrations.push({
        name,
        email,
        passwordHash: hashPassword(password),
        code,
        codeExpiresAt,
        createdAt: Date.now()
      });
      await writeDB(db);

      await sendVerificationEmail(email, code);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && path === '/api/auth/register/verify') {
      const payload = await parseBody(req);
      const email = String(payload.email || '').trim().toLowerCase();
      const code = String(payload.code || '').trim();

      if (!email || !code) {
        json(res, 400, { error: 'Email and code are required' });
        return;
      }

      const db = await readDB();
      const pending = db.pendingRegistrations.find((item) => item.email === email);
      if (!pending) {
        json(res, 404, { error: 'No pending registration for this email' });
        return;
      }

      if (pending.code !== code || Number(pending.codeExpiresAt) < Date.now()) {
        json(res, 400, { error: 'Invalid or expired verification code' });
        return;
      }

      db.pendingRegistrations = db.pendingRegistrations.filter((item) => item.email !== email);
      const isAdmin = email === ADMIN_EMAIL;
      db.users.push({
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: pending.name,
        email,
        passwordHash: pending.passwordHash,
        emailVerified: true,
        approved: isAdmin,
        isAdmin,
        createdAt: Date.now()
      });
      await writeDB(db);

      json(res, 200, { ok: true, pendingApproval: !isAdmin });
      return;
    }

    if (req.method === 'POST' && path === '/api/auth/login') {
      const payload = await parseBody(req);
      const email = String(payload.email || '').trim().toLowerCase();
      const password = String(payload.password || '');

      const db = await readDB();
      const user = db.users.find((item) => item.email === email);
      if (!user || user.passwordHash !== hashPassword(password)) {
        json(res, 401, { error: 'Invalid email or password' });
        return;
      }

      if (!user.approved) {
        json(res, 403, { error: 'Account pending admin approval' });
        return;
      }

      const token = createSession(user);
      json(res, 200, {
        token,
        user: {
          name: user.name,
          email: user.email,
          isAdmin: Boolean(user.isAdmin)
        }
      });
      return;
    }

    if (req.method === 'POST' && path === '/api/auth/google') {
      const payload = await parseBody(req);
      const credential = String(payload.credential || '');
      if (!credential) {
        json(res, 400, { error: 'Google credential is required' });
        return;
      }

      if (!GOOGLE_CLIENT_ID) {
        json(res, 503, { error: 'Google login is not configured on server' });
        return;
      }

      const profile = await getGoogleProfile(credential);
      const db = await readDB();
      let user = db.users.find((item) => item.email === profile.email);
      if (!user) {
        user = {
          id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: profile.name,
          email: profile.email,
          passwordHash: '',
          emailVerified: true,
          approved: true,
          isAdmin: profile.email === ADMIN_EMAIL,
          createdAt: Date.now()
        };
        db.users.push(user);
        await writeDB(db);
      }

      if (!user.approved) {
        json(res, 403, { error: 'Account pending admin approval' });
        return;
      }

      const token = createSession(user);
      json(res, 200, {
        token,
        user: {
          name: user.name,
          email: user.email,
          isAdmin: Boolean(user.isAdmin)
        }
      });
      return;
    }

    if (req.method === 'GET' && path === '/api/auth/me') {
      const db = await readDB();
      const user = await getAuthUser(req, db);
      if (!user) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }

      json(res, 200, {
        user: {
          name: user.name,
          email: user.email,
          isAdmin: Boolean(user.isAdmin),
          approved: Boolean(user.approved)
        }
      });
      return;
    }

    if (req.method === 'GET' && path === '/api/admin/pending-users') {
      const db = await readDB();
      const user = await getAuthUser(req, db);
      if (!user || !user.isAdmin) {
        json(res, 403, { error: 'Admin only' });
        return;
      }

      const pendingUsers = db.users
        .filter((item) => item.emailVerified && !item.approved)
        .map((item) => ({ name: item.name, email: item.email, createdAt: item.createdAt }));

      json(res, 200, { pendingUsers });
      return;
    }

    if (req.method === 'POST' && path === '/api/admin/approve') {
      const db = await readDB();
      const admin = await getAuthUser(req, db);
      if (!admin || !admin.isAdmin) {
        json(res, 403, { error: 'Admin only' });
        return;
      }

      const payload = await parseBody(req);
      const email = String(payload.email || '').trim().toLowerCase();
      const user = db.users.find((item) => item.email === email);
      if (!user) {
        json(res, 404, { error: 'User not found' });
        return;
      }

      user.approved = true;
      await writeDB(db);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && path === '/api/threads') {
      const sort = url.searchParams.get('sort') || 'hot';
      const db = await readDB();
      json(res, 200, { threads: sortThreads(db.threads, sort) });
      return;
    }

    if (req.method === 'POST' && path === '/api/threads') {
      const db = await readDB();
      const user = await getAuthUser(req, db);
      if (!user || !user.approved) {
        json(res, 401, { error: 'Login required to create thread' });
        return;
      }

      const payload = await parseBody(req);
      const title = String(payload.title || '').trim();
      const body = String(payload.body || '').trim();
      if (!title || !body) {
        json(res, 400, { error: 'Title and body are required' });
        return;
      }

      const thread = {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        body,
        author: user.name,
        authorEmail: user.email,
        createdAt: Date.now(),
        upvotes: 0,
        upvoters: [],
        replies: []
      };
      db.threads.push(thread);
      await writeDB(db);
      json(res, 201, { thread });
      return;
    }

    const replyMatch = path.match(/^\/api\/threads\/([^/]+)\/replies$/);
    if (req.method === 'POST' && replyMatch) {
      const db = await readDB();
      const user = await getAuthUser(req, db);
      if (!user || !user.approved) {
        json(res, 401, { error: 'Login required to reply' });
        return;
      }

      const threadId = replyMatch[1];
      const payload = await parseBody(req);
      const text = String(payload.text || '').trim();
      if (!text) {
        json(res, 400, { error: 'Reply text is required' });
        return;
      }

      const thread = db.threads.find((item) => item.id === threadId);
      if (!thread) {
        json(res, 404, { error: 'Thread not found' });
        return;
      }

      thread.replies ||= [];
      thread.replies.push({
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        author: user.name,
        authorEmail: user.email,
        createdAt: Date.now()
      });
      await writeDB(db);
      json(res, 201, { ok: true });
      return;
    }

    const upvoteMatch = path.match(/^\/api\/threads\/([^/]+)\/upvote$/);
    if (req.method === 'POST' && upvoteMatch) {
      const db = await readDB();
      const user = await getAuthUser(req, db);
      if (!user || !user.approved) {
        json(res, 401, { error: 'Login required to upvote' });
        return;
      }

      const threadId = upvoteMatch[1];
      const thread = db.threads.find((item) => item.id === threadId);
      if (!thread) {
        json(res, 404, { error: 'Thread not found' });
        return;
      }

      thread.upvoters ||= [];
      if (thread.upvoters.includes(user.email)) {
        json(res, 409, { error: 'You already upvoted this thread' });
        return;
      }

      thread.upvoters.push(user.email);
      thread.upvotes = Number(thread.upvotes || 0) + 1;
      await writeDB(db);
      json(res, 200, { upvotes: thread.upvotes });
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    json(res, 500, { error: error.message || 'Server error' });
  }
});

await ensureDataFile();
server.listen(PORT, () => {
  console.log(`Forum backend running on http://localhost:${PORT}`);
});
