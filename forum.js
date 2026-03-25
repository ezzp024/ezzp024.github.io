const sb = window.sb;

const threadForm = document.querySelector('#threadForm');
const threadFeed = document.querySelector('#threadFeed');
const threadNote = document.querySelector('#threadNote');
const threadCount = document.querySelector('#threadCount');
const messageCount = document.querySelector('#messageCount');
const sortTabs = document.querySelectorAll('.sort-tabs .tab');
const feedSearch = document.querySelector('#feedSearch');
const clearSearchBtn = document.querySelector('#clearSearchBtn');
const topicChips = document.querySelectorAll('.chip');

let currentSort = 'hot';
let currentUser = null;
let currentProfile = null;
let activeTopic = 'all';
let allThreads = [];

const setThreadMessage = (message, isError = false) => {
  if (!threadNote) {
    return;
  }

  threadNote.textContent = message;
  threadNote.style.color = isError ? '#ffb7b7' : '#90ffd2';
};

const guardSupabase = () => {
  if (!sb) {
    setThreadMessage(window.__supabaseInitError || 'Supabase not configured.', true);
    return false;
  }
  return true;
};

const escapeHtml = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatTime = (value) => new Date(value).toLocaleString();

const hotScore = (thread) => {
  const ageHours = Math.max((Date.now() - new Date(thread.created_at).getTime()) / 3600000, 1);
  const replyCount = Array.isArray(thread.replies) ? thread.replies.length : 0;
  const upvotes = Number(thread.upvote_count || 0);
  return upvotes * 3 + replyCount * 2 - ageHours * 0.1;
};

const loadSession = async () => {
  const {
    data: { session }
  } = await sb.auth.getSession();
  currentUser = session?.user || null;

  if (!currentUser) {
    currentProfile = null;
    return;
  }

  const { data } = await sb
    .from('profiles')
    .select('id,display_name,email,approved,is_admin')
    .eq('id', currentUser.id)
    .single();
  currentProfile = data || null;
};

const getThreads = async () => {
  const { data: threadRows, error: threadError } = await sb
    .from('threads')
    .select('id,title,body,author_id,author_name,created_at')
    .order('created_at', { ascending: false });

  if (threadError) {
    throw threadError;
  }

  const { data: replyRows, error: replyError } = await sb
    .from('replies')
    .select('id,thread_id,text,author_id,author_name,created_at')
    .order('created_at', { ascending: true });

  if (replyError) {
    throw replyError;
  }

  const { data: upvoteRows, error: upvoteError } = await sb.from('thread_upvotes').select('thread_id,user_id');

  if (upvoteError) {
    throw upvoteError;
  }

  const repliesByThread = new Map();
  replyRows.forEach((reply) => {
    if (!repliesByThread.has(reply.thread_id)) {
      repliesByThread.set(reply.thread_id, []);
    }
    repliesByThread.get(reply.thread_id).push(reply);
  });

  const upvotesByThread = new Map();
  upvoteRows.forEach((vote) => {
    if (!upvotesByThread.has(vote.thread_id)) {
      upvotesByThread.set(vote.thread_id, []);
    }
    upvotesByThread.get(vote.thread_id).push(vote.user_id);
  });

  const combined = threadRows.map((thread) => {
    const upvoters = upvotesByThread.get(thread.id) || [];
    return {
      ...thread,
      replies: repliesByThread.get(thread.id) || [],
      upvote_count: upvoters.length,
      user_upvoted: currentUser ? upvoters.includes(currentUser.id) : false
    };
  });

  if (currentSort === 'new') {
    return combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return combined.sort((a, b) => hotScore(b) - hotScore(a));
};

const renderThreads = async () => {
  if (!threadFeed) {
    return;
  }

  allThreads = await getThreads();
  const keyword = String(feedSearch?.value || '').trim().toLowerCase();
  const threads = allThreads.filter((thread) => {
    const haystack = `${thread.title} ${thread.body} ${thread.author_name}`.toLowerCase();
    const keywordMatch = !keyword || haystack.includes(keyword);
    const topicMatch = activeTopic === 'all' || haystack.includes(activeTopic);
    return keywordMatch && topicMatch;
  });

  threadFeed.innerHTML = '';

  const totalMessages = allThreads.reduce((sum, thread) => sum + 1 + thread.replies.length, 0);
  if (threadCount) {
    threadCount.textContent = String(allThreads.length);
  }
  if (messageCount) {
    messageCount.textContent = String(totalMessages);
  }

  if (threads.length === 0) {
    threadFeed.innerHTML =
      allThreads.length === 0
        ? '<p class="note">No threads yet. Start the first one.</p>'
        : '<p class="note">No threads match your current filters.</p>';
    return;
  }

  threads.forEach((thread) => {
    const repliesHTML = thread.replies
      .map(
        (reply) => `
          <article class="reply">
            <div class="reply-top">
              <strong>${escapeHtml(reply.author_name)}</strong>
              <span>${formatTime(reply.created_at)}</span>
            </div>
            <p>${escapeHtml(reply.text)}</p>
          </article>
        `
      )
      .join('');

    const item = document.createElement('article');
    item.className = 'thread';
    const authorInitial = escapeHtml(String(thread.author_name || 'M').charAt(0).toUpperCase());
    item.innerHTML = `
      <div class="thread-top">
        <div class="thread-author-row">
          <span class="avatar">${authorInitial}</span>
          <div>
          <h3>${escapeHtml(thread.title)}</h3>
          <span class="thread-meta">${escapeHtml(thread.author_name)} | ${formatTime(thread.created_at)}</span>
          </div>
        </div>
        <span class="thread-meta">${thread.replies.length} replies</span>
      </div>
      <p>${escapeHtml(thread.body)}</p>
      <div class="thread-controls">
        <button class="control-btn" data-action="upvote" data-thread-id="${thread.id}">${thread.user_upvoted ? 'Upvoted' : 'Upvote'} (${thread.upvote_count})</button>
        <button class="control-btn" data-action="collapse" data-thread-id="${thread.id}">Collapse</button>
      </div>
      <section class="replies" data-replies-id="${thread.id}">
        ${repliesHTML || '<p class="note">No replies yet.</p>'}
      </section>
      <form class="reply-form" data-thread-id="${thread.id}">
        <input name="reply" maxlength="250" required placeholder="Write a reply..." />
        <button class="btn btn-ghost" type="submit">Reply</button>
      </form>
    `;
    threadFeed.appendChild(item);
  });
};

const requireApprovedUser = () => {
  if (!currentUser || !currentProfile) {
    setThreadMessage('Please login from the Account page first.', true);
    return false;
  }
  if (!currentProfile.approved) {
    setThreadMessage('Your account is pending admin approval.', true);
    return false;
  }
  return true;
};

if (threadForm) {
  threadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!guardSupabase() || !requireApprovedUser()) {
      return;
    }

    const data = new FormData(threadForm);
    const title = String(data.get('title') || '').trim();
    const body = String(data.get('body') || '').trim();

    if (!title || !body) {
      setThreadMessage('Please add title and message.', true);
      return;
    }

    const { error } = await sb.from('threads').insert({
      title,
      body,
      author_id: currentUser.id,
      author_name: currentProfile.display_name
    });

    if (error) {
      setThreadMessage(error.message, true);
      return;
    }

    threadForm.reset();
    await renderThreads();
    setThreadMessage('Thread created.');
  });
}

if (threadFeed) {
  threadFeed.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-action');
    const threadId = Number(button.getAttribute('data-thread-id'));
    if (!action || !threadId) {
      return;
    }

    if (action === 'upvote') {
      if (!guardSupabase() || !requireApprovedUser()) {
        return;
      }

      const { error } = await sb.from('thread_upvotes').insert({
        thread_id: threadId,
        user_id: currentUser.id
      });

      if (error) {
        setThreadMessage(error.message.includes('duplicate') ? 'You already upvoted this thread.' : error.message, true);
        return;
      }

      await renderThreads();
      return;
    }

    if (action === 'collapse') {
      const replies = threadFeed.querySelector(`[data-replies-id="${threadId}"]`);
      if (!replies) {
        return;
      }

      const collapsed = replies.classList.toggle('collapsed');
      button.textContent = collapsed ? 'Expand' : 'Collapse';
    }
  });

  threadFeed.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('reply-form')) {
      return;
    }

    event.preventDefault();
    if (!guardSupabase() || !requireApprovedUser()) {
      return;
    }

    const threadId = Number(form.getAttribute('data-thread-id'));
    const input = form.querySelector('input[name="reply"]');
    if (!threadId || !input) {
      return;
    }

    const text = input.value.trim();
    if (!text) {
      setThreadMessage('Reply cannot be empty.', true);
      return;
    }

    const { error } = await sb.from('replies').insert({
      thread_id: threadId,
      text,
      author_id: currentUser.id,
      author_name: currentProfile.display_name
    });

    if (error) {
      setThreadMessage(error.message, true);
      return;
    }

    await renderThreads();
    setThreadMessage('Reply posted.');
  });
}

if (feedSearch) {
  feedSearch.addEventListener('input', async () => {
    try {
      await renderThreads();
    } catch (error) {
      setThreadMessage(error.message, true);
    }
  });
}

if (clearSearchBtn && feedSearch) {
  clearSearchBtn.addEventListener('click', async () => {
    feedSearch.value = '';
    try {
      await renderThreads();
      feedSearch.focus();
    } catch (error) {
      setThreadMessage(error.message, true);
    }
  });
}

topicChips.forEach((chip) => {
  chip.addEventListener('click', async () => {
    topicChips.forEach((item) => item.classList.remove('active'));
    chip.classList.add('active');
    activeTopic = chip.dataset.topic || 'all';

    try {
      await renderThreads();
    } catch (error) {
      setThreadMessage(error.message, true);
    }
  });
});

sortTabs.forEach((tab) => {
  tab.addEventListener('click', async () => {
    sortTabs.forEach((item) => {
      item.classList.remove('active');
      item.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    currentSort = tab.dataset.sort || 'hot';

    try {
      await renderThreads();
    } catch (error) {
      setThreadMessage(error.message, true);
    }
  });
});

const boot = async () => {
  if (!guardSupabase()) {
    return;
  }

  try {
    await loadSession();
    await renderThreads();
    if (!currentUser) {
      setThreadMessage('Read-only mode. Login to post, reply, and upvote.');
    } else if (currentProfile && !currentProfile.approved) {
      setThreadMessage('Logged in, waiting for admin approval before posting.', true);
    }
  } catch (error) {
    setThreadMessage(error.message, true);
  }
};

boot();
