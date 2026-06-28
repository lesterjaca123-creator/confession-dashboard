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

let confessions = []; // will be filled from Supabase
let activeFilter = "All";

// ---------- Character counter ----------
input.addEventListener("input", () => {
  const remaining = 500 - input.value.length;
  charCount.textContent = `${remaining} left`;
  postBtn.disabled = input.value.trim().length === 0;
});

postBtn.disabled = true;

// ---------- Posting a confession ----------
postBtn.addEventListener("click", async () => {
  const text = input.value.trim();
  if (!text) return;

  const category = categorySelect.value;

  postBtn.disabled = true;
  postBtn.textContent = "Posting...";

  const { error } = await db
    .from("confessions")
    .insert([{ text, likes: 0, category }]);

  postBtn.textContent = "Confess";

  if (error) {
    console.error("Error posting confession:", error);
    alert("Something went wrong posting your confession. Try again.");
    postBtn.disabled = false;
    return;
  }

  input.value = "";
  charCount.textContent = "500 left";
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
    time: timeAgo(row.created_at)
  }));

  renderFeed();
}

// ---------- Rendering the feed ----------
function renderFeed() {
  feed.innerHTML = "";

  const visible = activeFilter === "All"
    ? confessions
    : confessions.filter((c) => c.category === activeFilter);

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
