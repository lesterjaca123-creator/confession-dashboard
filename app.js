// ---------- SUPABASE CONNECTION ----------
// These are safe to expose publicly — this "publishable key" is
// designed to be used in frontend code like this.

const SUPABASE_URL = "https://xruozqhdxjtjsrmeiyul.supabase.co";
const SUPABASE_KEY = "sb_publishable_JN0cZGqPMtV3PaW2fGLw2g_24SlLogf";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- DOM references ----------
const feed = document.getElementById("feed");
const input = document.getElementById("confession-input");
const postBtn = document.getElementById("post-btn");
const charCount = document.getElementById("char-count");
const categorySelect = document.getElementById("category-select");
const categoryFilter = document.getElementById("category-filter");
const sortToggle = document.getElementById("sort-toggle");
const themeToggle = document.getElementById("theme-toggle");
const liveClock = document.getElementById("live-clock");
const cooldownNotice = document.getElementById("cooldown-notice");
const reportModal = document.getElementById("report-modal");
const reportReason = document.getElementById("report-reason");
const reportDetails = document.getElementById("report-details");
const reportCancel = document.getElementById("report-cancel");
const reportSubmit = document.getElementById("report-submit");

let confessions = []; // will be filled from Supabase
let activeFilter = "All";
let sortMode = "newest";
let reportingId = null; // which confession is currently being reported

const POST_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// ---------- Device ID ----------
// Lets someone delete their own confessions without needing an account.
// This ID lives only in their browser — it's not tied to their identity.
function getDeviceId() {
  let id = localStorage.getItem("device-id");
  if (!id) {
    id = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("device-id", id);
  }
  return id;
}
const deviceId = getDeviceId();

// ---------- Theme ----------
function applyTheme(theme) {
  document.body.classList.toggle("light-theme", theme === "light");
  themeToggle.textContent = theme === "light" ? "☀️" : "🌙";
  localStorage.setItem("theme", theme);
}
applyTheme(localStorage.getItem("theme") || "dark");

themeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.contains("light-theme");
  applyTheme(isLight ? "dark" : "light");
});

// ---------- Live clock ----------
function updateClock() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  liveClock.textContent = `${dateStr} · ${timeStr}`;
}
updateClock();
setInterval(updateClock, 1000);

// ---------- Posting cooldown ----------
function getCooldownRemaining() {
  const lastPosted = Number(localStorage.getItem("last-posted-at") || 0);
  const elapsed = Date.now() - lastPosted;
  return Math.max(0, POST_COOLDOWN_MS - elapsed);
}

function formatCooldown(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function updateCooldownUI() {
  const remaining = getCooldownRemaining();

  if (remaining > 0) {
    cooldownNotice.textContent = `You can confess again in ${formatCooldown(remaining)}`;
    cooldownNotice.classList.add("visible");
    postBtn.disabled = true;
    return true;
  }

  cooldownNotice.classList.remove("visible");
  postBtn.disabled = input.value.trim().length === 0;
  return false;
}

updateCooldownUI();
setInterval(updateCooldownUI, 1000);

// ---------- Character counter ----------
input.addEventListener("input", () => {
  const remaining = 500 - input.value.length;
  charCount.textContent = `${remaining} left`;
  if (getCooldownRemaining() === 0) {
    postBtn.disabled = input.value.trim().length === 0;
  }
});

postBtn.disabled = true;

// ---------- Posting a confession ----------
postBtn.addEventListener("click", async () => {
  const text = input.value.trim();
  if (!text) return;

  if (getCooldownRemaining() > 0) return; // safety check, shouldn't normally trigger

  const category = categorySelect.value;

  postBtn.disabled = true;
  postBtn.textContent = "Posting...";

  const { error } = await db
    .from("confessions")
    .insert([{ text, likes: 0, category, device_id: deviceId }]);

  postBtn.textContent = "Confess";

  if (error) {
    console.error("Error posting confession:", error);
    alert("Something went wrong posting your confession. Try again.");
    postBtn.disabled = false;
    return;
  }

  input.value = "";
  charCount.textContent = "500 left";
  localStorage.setItem("last-posted-at", Date.now().toString());
  updateCooldownUI();
  await loadConfessions();
});

// ---------- Loading confessions from Supabase ----------
async function loadConfessions() {
  const { data: confessionRows, error } = await db
    .from("confessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading confessions:", error);
    feed.innerHTML = `<p class="empty-state">Couldn't load confessions. Refresh to try again.</p>`;
    return;
  }

  // Load all comments in one go, then group them by confession_id
  const { data: commentRows, error: commentError } = await db
    .from("comments")
    .select("*")
    .order("created_at", { ascending: true });

  if (commentError) {
    console.error("Error loading comments:", commentError);
  }

  confessions = confessionRows.map((row) => ({
    id: row.id,
    text: row.text,
    likes: row.likes,
    category: row.category || "Random",
    liked: localStorage.getItem(`liked-${row.id}`) === "true",
    comments: (commentRows || []).filter((c) => c.confession_id === row.id),
    time: timeAgo(row.created_at),
    createdAt: row.created_at,
    isMine: row.device_id === deviceId,
    reported: localStorage.getItem(`reported-${row.id}`) === "true"
  }));

  renderFeed();
}

// ---------- Rendering the feed ----------
function renderFeed() {
  feed.innerHTML = "";

  let visible = activeFilter === "All"
    ? [...confessions]
    : confessions.filter((c) => c.category === activeFilter);

  if (sortMode === "liked") {
    visible.sort((a, b) => b.likes - a.likes);
  } else {
    visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  if (visible.length === 0) {
    feed.innerHTML = `<p class="empty-state">No confessions here yet. Be the first.</p>`;
    return;
  }

  visible.forEach((c) => {
    const card = document.createElement("div");
    card.className = "confession-card";

    card.innerHTML = `
      <span class="confession-tag">${escapeHtml(c.category)}</span>
      <p class="confession-text">${escapeHtml(c.text)}</p>
      <div class="card-meta">
        <button class="like-btn ${c.liked ? "liked" : ""}" data-id="${c.id}">
          ${c.liked ? "♥" : "♡"} <span>${c.likes}</span>
        </button>
        <button class="comment-toggle" data-id="${c.id}">
          ${c.comments.length} comment${c.comments.length === 1 ? "" : "s"}
        </button>
        <div class="card-actions-extra">
          <button class="icon-btn report-btn ${c.reported ? "reported" : ""}" data-id="${c.id}" title="${c.reported ? "Reported" : "Report"}">⚑</button>
          ${c.isMine ? `<button class="icon-btn delete-btn" data-id="${c.id}" title="Delete">🗑</button>` : ""}
        </div>
        <span class="timestamp">${c.time}</span>
      </div>
      <div class="comments" id="comments-${c.id}">
        ${c.comments.map(comment => `<p class="comment">${escapeHtml(comment.text)}</p>`).join("")}
        <div class="comment-form">
          <input type="text" placeholder="Add a comment..." maxlength="200" data-id="${c.id}" />
          <button data-id="${c.id}" class="submit-comment">Send</button>
        </div>
      </div>
    `;

    feed.appendChild(card);
  });

  attachCardListeners();
}

// ---------- Category filter ----------
categoryFilter.addEventListener("click", (e) => {
  const pill = e.target.closest(".filter-pill");
  if (!pill) return;

  activeFilter = pill.dataset.category;

  document.querySelectorAll(".filter-pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.category === activeFilter);
  });

  renderFeed();
});

// ---------- Sort toggle ----------
sortToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".sort-btn");
  if (!btn) return;

  sortMode = btn.dataset.sort;

  document.querySelectorAll(".sort-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.sort === sortMode);
  });

  renderFeed();
});

// ---------- Report modal ----------
reportCancel.addEventListener("click", () => {
  reportModal.classList.remove("open");
  reportingId = null;
});

reportModal.addEventListener("click", (e) => {
  if (e.target === reportModal) {
    reportModal.classList.remove("open");
    reportingId = null;
  }
});

reportSubmit.addEventListener("click", async () => {
  if (reportingId === null) return;

  const reason = reportReason.value;
  const details = reportDetails.value.trim();

  reportSubmit.disabled = true;
  reportSubmit.textContent = "Submitting...";

  const { error } = await db
    .from("reports")
    .insert([{ confession_id: reportingId, reason, details }]);

  reportSubmit.disabled = false;
  reportSubmit.textContent = "Submit Report";

  if (error) {
    console.error("Error reporting confession:", error);
    alert("Something went wrong submitting your report.");
    return;
  }

  localStorage.setItem(`reported-${reportingId}`, "true");
  reportModal.classList.remove("open");

  const btn = document.querySelector(`.report-btn[data-id="${reportingId}"]`);
  if (btn) {
    btn.classList.add("reported");
    btn.title = "Reported";
  }

  reportingId = null;
});

// ---------- Like / comment interactions ----------
function attachCardListeners() {
  document.querySelectorAll(".like-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const confession = confessions.find((c) => c.id === id);

      const newLiked = !confession.liked;
      const newLikes = confession.likes + (newLiked ? 1 : -1);

      // Update locally first so it feels instant
      confession.liked = newLiked;
      confession.likes = newLikes;
      localStorage.setItem(`liked-${id}`, newLiked);
      renderFeed();

      const { error } = await db
        .from("confessions")
        .update({ likes: newLikes })
        .eq("id", id);

      if (error) {
        console.error("Error updating like:", error);
      }
    });
  });

  document.querySelectorAll(".comment-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      document.getElementById(`comments-${id}`).classList.toggle("open");
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const confirmed = confirm("Delete this confession? This can't be undone.");
      if (!confirmed) return;

      btn.disabled = true;

      const { error } = await db
        .from("confessions")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting confession:", error);
        alert("Something went wrong deleting your confession.");
        btn.disabled = false;
        return;
      }

      await loadConfessions();
    });
  });

  document.querySelectorAll(".report-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);

      if (localStorage.getItem(`reported-${id}`) === "true") {
        return; // already reported by this device
      }

      reportingId = id;
      reportReason.value = "Spam";
      reportDetails.value = "";
      reportModal.classList.add("open");
    });
  });

  document.querySelectorAll(".submit-comment").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const commentInput = document.querySelector(`input[data-id="${id}"]`);
      const text = commentInput.value.trim();
      if (!text) return;

      btn.disabled = true;

      const { error } = await db
        .from("comments")
        .insert([{ confession_id: id, text }]);

      btn.disabled = false;

      if (error) {
        console.error("Error posting comment:", error);
        alert("Something went wrong posting your comment.");
        return;
      }

      commentInput.value = "";
      await loadConfessions();
      document.getElementById(`comments-${id}`).classList.add("open");
    });
  });
}

// ---------- Helpers ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------- Initial load ----------
loadConfessions();
