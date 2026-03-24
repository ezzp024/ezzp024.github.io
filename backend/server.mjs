import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DATA_PATH = join(__dirname, 'data', 'forum.json');

const json = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
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
          body: 'This backend is shared globally for all users connected to this server.',
          author: 'System',
          createdAt: Date.now(),
          upvotes: 1,
          replies: []
        }
      ]
    };
    await writeFile(DATA_PATH, JSON.stringify(seed, null, 2));
  }
};

const readDB = async () => {
  const raw = await readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  parsed.threads ||= [];
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

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/api/health') {
      json(res, 200, { ok: true, service: 'polly-forum-backend' });
      return;
    }

    if (req.method === 'GET' && path === '/api/threads') {
      const sort = url.searchParams.get('sort') || 'hot';
      const db = await readDB();
      json(res, 200, { threads: sortThreads(db.threads, sort) });
      return;
    }

    if (req.method === 'POST' && path === '/api/threads') {
      const payload = await parseBody(req);
      const title = String(payload.title || '').trim();
      const body = String(payload.body || '').trim();
      const author = String(payload.author || 'Guest Coder').trim() || 'Guest Coder';

      if (!title || !body) {
        json(res, 400, { error: 'Title and body are required' });
        return;
      }

      const db = await readDB();
      const thread = {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        body,
        author,
        createdAt: Date.now(),
        upvotes: 0,
        replies: []
      };
      db.threads.push(thread);
      await writeDB(db);
      json(res, 201, { thread });
      return;
    }

    const replyMatch = path.match(/^\/api\/threads\/([^/]+)\/replies$/);
    if (req.method === 'POST' && replyMatch) {
      const threadId = replyMatch[1];
      const payload = await parseBody(req);
      const text = String(payload.text || '').trim();
      const author = String(payload.author || 'Guest Coder').trim() || 'Guest Coder';

      if (!text) {
        json(res, 400, { error: 'Reply text is required' });
        return;
      }

      const db = await readDB();
      const thread = db.threads.find((item) => item.id === threadId);
      if (!thread) {
        json(res, 404, { error: 'Thread not found' });
        return;
      }

      thread.replies ||= [];
      const reply = {
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        author,
        createdAt: Date.now()
      };
      thread.replies.push(reply);
      await writeDB(db);
      json(res, 201, { reply });
      return;
    }

    const upvoteMatch = path.match(/^\/api\/threads\/([^/]+)\/upvote$/);
    if (req.method === 'POST' && upvoteMatch) {
      const threadId = upvoteMatch[1];
      const db = await readDB();
      const thread = db.threads.find((item) => item.id === threadId);
      if (!thread) {
        json(res, 404, { error: 'Thread not found' });
        return;
      }

      thread.upvotes = Number(thread.upvotes || 0) + 1;
      await writeDB(db);
      json(res, 200, { upvotes: thread.upvotes });
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    json(res, 500, { error: 'Server error', details: error.message });
  }
});

await ensureDataFile();
server.listen(PORT, () => {
  console.log(`Forum backend running on http://localhost:${PORT}`);
});
