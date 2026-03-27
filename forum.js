const sb = window.sb;

const threadForm = document.querySelector('#threadForm');
const threadFeed = document.querySelector('#threadFeed');
const threadNote = document.querySelector('#threadNote');
const composerHint = document.querySelector('#composerHint');
const threadCount = document.querySelector('#threadCount');
const messageCount = document.querySelector('#messageCount');
const sortTabs = document.querySelectorAll('.sort-tabs .tab');
const focusModeBtn = document.querySelector('#focusModeBtn');
const feedSearch = document.querySelector('#feedSearch');
const categoryFilter = document.querySelector('#categoryFilter');
const clearSearchBtn = document.querySelector('#clearSearchBtn');
const categoryStats = document.querySelector('#categoryStats');
const recentMembers = document.querySelector('#recentMembers');
const liveActivity = document.querySelector('#liveActivity');

const initialPrefs = typeof window.getUiPrefs === 'function' ? window.getUiPrefs() : {};
let currentSort = initialPrefs.defaultFeedSort === 'new' ? 'new' : 'hot';
let currentUser = null;
let currentProfile = null;
let activeCategory = 'all';
let allThreads = [];

const threadTitleInput = threadForm?.querySelector('input[name="title"]');
const threadBodyInput = threadForm?.querySelector('textarea[name="body"]');
const threadSubmitBtn = threadForm?.querySelector('button[type="submit"]');

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

const normalizeName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const extractMentionTokens = (text) => {
  const matches = String(text || '').match(/@([a-zA-Z0-9._-]{2,30})/g) || [];
  return [...new Set(matches.map((item) => item.slice(1).toLowerCase()))];
};

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
    .select('id,title,body,category,author_id,author_name,created_at')
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

  const authorIds = [...new Set([...threadRows.map((item) => item.author_id), ...replyRows.map((item) => item.author_id)])];
  const { data: authorProfiles } = authorIds.length
    ? await sb.from('profiles').select('id,display_name,avatar_url,email').in('id', authorIds)
    : { data: [] };

  const profileById = new Map((authorProfiles || []).map((profile) => [profile.id, profile]));

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
    const authorProfile = profileById.get(thread.author_id) || null;
    const replies = (repliesByThread.get(thread.id) || []).map((reply) => {
      const replyProfile = profileById.get(reply.author_id) || null;
      return {
        ...reply,
        author_avatar_url: replyProfile?.avatar_url || ''
      };
    });
    return {
      ...thread,
      replies,
      author_avatar_url: authorProfile?.avatar_url || '',
      author_email: authorProfile?.email || '',
      upvote_count: upvoters.length,
      user_upvoted: currentUser ? upvoters.includes(currentUser.id) : false
    };
  });

  if (currentSort === 'new') {
    return combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return combined.sort((a, b) => hotScore(b) - hotScore(a));
};

const updateSidePanels = async () => {
  if (categoryStats) {
    const counts = new Map();
    allThreads.forEach((thread) => {
      const key = thread.category || 'general';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const categories = ['general', 'debug', 'api', 'frontend', 'automation'];
    categoryStats.innerHTML = categories
      .map((cat) => `<li><span>#</span>${cat} (${counts.get(cat) || 0})</li>`)
      .join('');
  }

  if (recentMembers) {
    const { data } = await sb
      .from('profiles')
      .select('display_name')
      .order('created_at', { ascending: false })
      .limit(6);

    recentMembers.innerHTML =
      !data || data.length === 0
        ? '<li><span>#</span>No members yet</li>'
        : data.map((member) => `<li><span>#</span>${escapeHtml(member.display_name)}</li>`).join('');
  }

  if (liveActivity) {
    const recentThreads = allThreads.slice(0, 4);
    liveActivity.innerHTML =
      recentThreads.length === 0
        ? '<li>No activity yet. Be first to post.</li>'
        : recentThreads
            .map((thread) => `<li><strong>${escapeHtml(thread.author_name)}</strong> posted <a class="author-link" href="forum.html?t=${thread.id}">${escapeHtml(thread.title)}</a></li>`)
            .join('');
  }
};

const renderThreads = async () => {
  if (!threadFeed) {
    return;
  }

  threadFeed.innerHTML = '<p class="note">Loading feed...</p>';
  allThreads = await getThreads();
  const keyword = String(feedSearch?.value || '').trim().toLowerCase();
  const threads = allThreads.filter((thread) => {
    const haystack = `${thread.title} ${thread.body} ${thread.author_name}`.toLowerCase();
    const keywordMatch = !keyword || haystack.includes(keyword);
    const categoryMatch = activeCategory === 'all' || thread.category === activeCategory;
    return keywordMatch && categoryMatch;
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
        ? '<div class="empty-state"><h3>No threads yet</h3><p>Start the first conversation for this category.</p><a class="btn btn-primary" href="account.html">Create your account</a></div>'
        : '<p class="note">No threads match your current filters.</p>';
    await updateSidePanels();
    return;
  }

  threads.forEach((thread) => {
    const repliesHTML = thread.replies
      .map(
        (reply) => `
          <article class="reply">
            <div class="reply-top">
              <strong><a class="author-link" href="user.html?id=${encodeURIComponent(reply.author_id)}">${escapeHtml(reply.author_name)}</a></strong>
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
    const avatarVisual = thread.author_avatar_url
      ? `<img class="avatar" src="${escapeHtml(thread.author_avatar_url)}" alt="${escapeHtml(thread.author_name)}" />`
      : `<span class="avatar">${authorInitial}</span>`;
    item.innerHTML = `
      <div class="thread-top">
        <div class="thread-author-row">
          ${avatarVisual}
          <div>
          <h3>${escapeHtml(thread.title)}</h3>
          <span class="thread-meta"><a class="author-link" href="user.html?id=${encodeURIComponent(thread.author_id)}">${escapeHtml(thread.author_name)}</a> | ${formatTime(thread.created_at)}</span>
          </div>
        </div>
        <span class="thread-meta"><span class="category-pill">${escapeHtml(thread.category || 'general')}</span> ${thread.replies.length} replies</span>
      </div>
      <p>${escapeHtml(thread.body)}</p>
      <div class="thread-controls">
        <button class="control-btn" data-action="upvote" data-thread-id="${thread.id}">${thread.user_upvoted ? 'Upvoted' : 'Upvote'} (${thread.upvote_count})</button>
        <button class="control-btn" data-action="collapse" data-thread-id="${thread.id}">Collapse</button>
        <a class="control-btn" href="account.html?to=${encodeURIComponent(thread.author_email || '')}#messages">Message</a>
        <button class="control-btn" data-action="report" data-thread-id="${thread.id}">Report</button>
      </div>
      <section class="replies" data-replies-id="${thread.id}">
        ${repliesHTML || '<p class="note">No replies yet.</p>'}
      </section>
      <form class="reply-form" data-reply-form-id="${thread.id}" data-thread-id="${thread.id}">
        <input name="reply" maxlength="250" required placeholder="Write a reply..." />
        <button class="btn btn-ghost" type="submit">Reply</button>
      </form>
    `;
    item.id = `thread-${thread.id}`;
    threadFeed.appendChild(item);
  });

  const urlThread = Number(new URLSearchParams(window.location.search).get('t'));
  if (urlThread) {
    const target = document.getElementById(`thread-${urlThread}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('thread-highlight');
      setTimeout(() => target.classList.remove('thread-highlight'), 1800);
    }
  }

  await updateSidePanels();
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

const updateComposerAccess = () => {
  if (!threadForm || !threadTitleInput || !threadBodyInput || !threadSubmitBtn) {
    return;
  }

  if (!currentUser) {
    threadTitleInput.disabled = true;
    threadBodyInput.disabled = true;
    threadSubmitBtn.disabled = true;
    if (composerHint) {
      composerHint.innerHTML = 'Login from <a href="account.html">Account</a> to create threads.';
    }
    return;
  }

  if (currentProfile && !currentProfile.approved) {
    threadTitleInput.disabled = true;
    threadBodyInput.disabled = true;
    threadSubmitBtn.disabled = true;
    if (composerHint) {
      composerHint.textContent = 'Your account is pending admin approval before posting.';
    }
    return;
  }

  threadTitleInput.disabled = false;
  threadBodyInput.disabled = false;
  threadSubmitBtn.disabled = false;
  if (composerHint) {
    composerHint.textContent = 'You can post new threads now.';
  }
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
    const category = String(data.get('category') || 'general').trim().toLowerCase();

    if (!title || !body) {
      setThreadMessage('Please add title and message.', true);
      return;
    }

    const { data: insertedThread, error } = await sb
      .from('threads')
      .insert({
        title,
        body,
        category,
        author_id: currentUser.id,
        author_name: currentProfile.display_name
      })
      .select('id,title')
      .single();

    if (error) {
      setThreadMessage(error.message, true);
      return;
    }

    const tokens = extractMentionTokens(`${title} ${body}`);
    if (tokens.length > 0 && insertedThread) {
      const { data: allProfiles } = await sb.from('profiles').select('id,display_name');
      const mentions = (allProfiles || []).filter((profile) => {
        if (profile.id === currentUser.id) {
          return false;
        }
        return tokens.includes(normalizeName(profile.display_name));
      });

      if (mentions.length > 0) {
        const rows = mentions.map((profile) => ({
          recipient_id: profile.id,
          actor_id: currentUser.id,
          kind: 'mention',
          thread_id: insertedThread.id,
          message: `${currentProfile.display_name} mentioned you in a thread.`
        }));
        await sb.from('notifications').insert(rows);
      }
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
      const replyForm = threadFeed.querySelector(`[data-reply-form-id="${threadId}"]`);
      if (!replies) {
        return;
      }

      const collapsed = replies.classList.toggle('collapsed');
      if (replyForm) {
        replyForm.classList.toggle('collapsed', collapsed);
      }
      button.textContent = collapsed ? 'Expand' : 'Collapse';
      return;
    }

    if (action === 'report') {
      if (!guardSupabase() || !requireApprovedUser()) {
        return;
      }

      const reason = window.prompt('Report reason (spam, abuse, harassment, off-topic):', 'spam');
      if (!reason) {
        return;
      }

      const { error } = await sb.from('reports').insert({
        reporter_id: currentUser.id,
        kind: reason.trim().toLowerCase(),
        target_type: 'thread',
        target_id: threadId,
        reason: reason.trim(),
        status: 'open'
      });

      if (error) {
        setThreadMessage(error.message, true);
        return;
      }

      setThreadMessage('Report submitted to moderation queue.');
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

    const thread = allThreads.find((item) => item.id === threadId);
    if (thread && thread.author_id !== currentUser.id) {
      await sb.from('notifications').insert({
        recipient_id: thread.author_id,
        actor_id: currentUser.id,
        kind: 'reply',
        thread_id: threadId,
        message: `${currentProfile.display_name} replied to your thread: ${thread.title}`
      });
    }

    const tokens = extractMentionTokens(text);
    if (tokens.length > 0) {
      const { data: allProfiles } = await sb.from('profiles').select('id,display_name');
      const mentions = (allProfiles || []).filter((profile) => {
        if (profile.id === currentUser.id) {
          return false;
        }
        return tokens.includes(normalizeName(profile.display_name));
      });

      if (mentions.length > 0) {
        const rows = mentions.map((profile) => ({
          recipient_id: profile.id,
          actor_id: currentUser.id,
          kind: 'mention',
          thread_id: threadId,
          message: `${currentProfile.display_name} mentioned you in a reply.`
        }));
        await sb.from('notifications').insert(rows);
      }
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
    if (categoryFilter) {
      categoryFilter.value = 'all';
      activeCategory = 'all';
    }
    try {
      await renderThreads();
      feedSearch.focus();
    } catch (error) {
      setThreadMessage(error.message, true);
    }
  });
}

if (categoryFilter) {
  categoryFilter.addEventListener('change', async () => {
    activeCategory = categoryFilter.value || 'all';
    try {
      await renderThreads();
    } catch (error) {
      setThreadMessage(error.message, true);
    }
  });
}

sortTabs.forEach((tab) => {
  tab.addEventListener('click', async () => {
    if (tab.id === 'focusModeBtn') {
      return;
    }
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

if (focusModeBtn) {
  const setFocus = (enabled) => {
    document.body.classList.toggle('forum-focus', enabled);
    focusModeBtn.textContent = enabled ? 'Exit Focus' : 'Focus';
  };

  const focusEnabled = Boolean(initialPrefs.forumFocusMode);
  setFocus(focusEnabled);

  focusModeBtn.addEventListener('click', () => {
    const enabled = !document.body.classList.contains('forum-focus');
    setFocus(enabled);

    const prefs = typeof window.getUiPrefs === 'function' ? window.getUiPrefs() : {};
    prefs.forumFocusMode = enabled;
    localStorage.setItem('polly_ui_prefs', JSON.stringify(prefs));
  });
}

const boot = async () => {
  if (!guardSupabase()) {
    return;
  }

  sortTabs.forEach((item) => {
    if (item.id === 'focusModeBtn') {
      return;
    }
    const active = item.dataset.sort === currentSort;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  try {
    await loadSession();
    updateComposerAccess();
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

if (sb?.auth?.onAuthStateChange) {
  sb.auth.onAuthStateChange(async () => {
    try {
      await loadSession();
      updateComposerAccess();
      await renderThreads();
    } catch (error) {
      setThreadMessage(error.message, true);
    }
  });
}

boot();
