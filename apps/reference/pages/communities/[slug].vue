<script setup lang="ts">
const route = useRoute();
const slug = computed(() => route.params.slug as string);

interface CommunityData {
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
  projectCount: number;
  discussionCount: number;
  currentUserRole: string | null;
  verified: boolean;
  tags: string[];
  rules: string[];
  relatedCommunities: Array<{ slug: string; name: string; memberCount: number }>;
}

interface CommunityPost {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  content: string | null;
  createdAt: string;
  voteCount: number;
  likeCount: number;
  replyCount: number;
  author: { displayName: string | null; username: string } | null;
}

interface CommunityMember {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
}

interface Discussion {
  id: string;
  title: string;
  createdAt: string;
  voteCount: number;
  replyCount: number;
  solved: boolean;
  author: { displayName: string | null; username: string } | null;
}

const { data: community } = await useFetch<CommunityData>(() => `/api/communities/${slug.value}`);
const { data: posts } = await useFetch<CommunityPost[]>(() => `/api/communities/${slug.value}/posts`);
const { data: discussions } = await useFetch<Discussion[]>(() => `/api/communities/${slug.value}/discussions`);
const { data: members } = await useFetch<CommunityMember[]>(() => `/api/communities/${slug.value}/members`);

useSeoMeta({
  title: () => community.value ? `${community.value.name} — CommonPub` : 'Community — CommonPub',
  description: () => community.value?.description || '',
});

const { isAuthenticated } = useAuth();
const activeTab = ref('feed');
const newPostContent = ref('');
const posting = ref(false);
const postError = ref('');
const feedFilter = ref('all');

const c = computed(() => community.value);

const tabDefs = [
  { value: 'feed', label: 'Feed', icon: 'fa-solid fa-rss' },
  { value: 'projects', label: 'Projects', icon: 'fa-solid fa-folder-open' },
  { value: 'discussions', label: 'Discussions', icon: 'fa-solid fa-comments' },
  { value: 'learn', label: 'Learn', icon: 'fa-solid fa-graduation-cap' },
  { value: 'events', label: 'Events', icon: 'fa-solid fa-calendar' },
  { value: 'members', label: 'Members', icon: 'fa-solid fa-users' },
];

const feedFilters = [
  { value: 'all', label: 'All Posts' },
  { value: 'question', label: 'Questions' },
  { value: 'discussion', label: 'Discussions' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'announcement', label: 'Announcements' },
];

const moderators = computed(() => {
  if (!members.value) return [];
  return members.value.filter(
    (m) => m.role === 'owner' || m.role === 'moderator'
  );
});

const filteredPosts = computed(() => {
  if (!posts.value) return [];
  if (feedFilter.value === 'all') return posts.value;
  return posts.value.filter((p) => p.type === feedFilter.value);
});

async function handlePost(): Promise<void> {
  if (!newPostContent.value.trim()) return;
  posting.value = true;
  try {
    await $fetch(`/api/communities/${slug.value}/posts`, {
      method: 'POST',
      body: { content: newPostContent.value, type: 'discussion' },
    });
    newPostContent.value = '';
    postError.value = '';
    refreshNuxtData();
  } catch (e) {
    postError.value = e instanceof Error ? e.message : 'Failed to create post';
  } finally {
    posting.value = false;
  }
}

async function handleJoin(): Promise<void> {
  try {
    await $fetch(`/api/communities/${slug.value}/join`, { method: 'POST' });
    refreshNuxtData();
  } catch {
    /* silent */
  }
}
</script>

<template>
  <div v-if="c" class="cpub-community">
    <!-- ═══ HUB HERO ═══ -->
    <div class="cpub-hub-hero">
      <div class="cpub-hub-banner">
        <div class="cpub-hub-banner-pattern"></div>
        <div class="cpub-hub-banner-dots"></div>
      </div>
      <div class="cpub-hub-meta-bar">
        <div class="cpub-hub-meta-inner">
          <div class="cpub-hub-icon">
            <i class="fa-solid fa-wrench"></i>
          </div>
          <div class="cpub-hub-info">
            <div class="cpub-hub-top-row">
              <div>
                <h1 class="cpub-hub-name">{{ c.name }}</h1>
                <p v-if="c.description" class="cpub-hub-desc">{{ c.description }}</p>
                <div class="cpub-hub-stats">
                  <span class="cpub-hub-stat"><i class="fa-solid fa-users"></i> <span class="cpub-hub-stat-val">{{ c.memberCount ?? 0 }}</span> Members</span>
                  <span class="cpub-hub-stat"><i class="fa-solid fa-folder-open"></i> <span class="cpub-hub-stat-val">{{ c.projectCount ?? 0 }}</span> Projects</span>
                  <span class="cpub-hub-stat"><i class="fa-solid fa-comments"></i> <span class="cpub-hub-stat-val">{{ c.discussionCount ?? 0 }}</span> Discussions</span>
                  <span class="cpub-hub-stat"><i class="fa-solid fa-fire"></i> <span class="cpub-hub-stat-val">Active</span> this week</span>
                </div>
                <div class="cpub-hub-actions">
                  <button v-if="isAuthenticated && !c.currentUserRole" class="cpub-btn cpub-btn-primary" @click="handleJoin">
                    <i class="fa-solid fa-plus"></i> Join Community
                  </button>
                  <span v-else-if="c.currentUserRole" class="cpub-member-badge">
                    <i class="fa-solid fa-check"></i> Member
                  </span>
                  <button class="cpub-btn"><i class="fa-solid fa-bell"></i> Subscribe</button>
                  <button class="cpub-btn cpub-btn-sm"><i class="fa-solid fa-share-nodes"></i></button>
                </div>
              </div>
              <div class="cpub-hub-badges">
                <span v-if="c.verified" class="cpub-tag cpub-tag-accent"><i class="fa-solid fa-shield-halved" style="margin-right: 3px"></i>Verified</span>
                <span class="cpub-tag cpub-tag-green">Open to All</span>
              </div>
            </div>
            <div v-if="c.tags?.length" class="cpub-hub-tags">
              <div class="cpub-tag-row">
                <span v-for="tag in c.tags" :key="tag" class="cpub-tag">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ TABS ═══ -->
    <div class="cpub-hub-tabs">
      <div class="cpub-tabs-inner">
        <button
          v-for="tab in tabDefs"
          :key="tab.value"
          class="cpub-tab-btn"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          <i :class="tab.icon" style="font-size: 10px"></i>
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- ═══ MAIN CONTENT ═══ -->
    <div class="cpub-hub-main">
      <div class="cpub-hub-layout">

        <!-- MAIN COLUMN -->
        <main>
          <!-- Feed tab -->
          <template v-if="activeTab === 'feed'">
            <!-- Compose bar -->
            <div v-if="isAuthenticated" class="cpub-compose-bar">
              <input
                v-model="newPostContent"
                class="cpub-compose-input"
                type="text"
                placeholder="Share a project, ask a question, or start a discussion..."
              />
              <button class="cpub-btn cpub-btn-sm"><i class="fa-solid fa-image"></i></button>
              <button class="cpub-btn cpub-btn-sm"><i class="fa-solid fa-link"></i></button>
              <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="posting" @click="handlePost">
                <i class="fa-solid fa-paper-plane"></i> Post
              </button>
            </div>

            <!-- Feed filter -->
            <div class="cpub-tag-row" style="margin-bottom: 14px">
              <FilterChip
                v-for="f in feedFilters"
                :key="f.value"
                :label="f.label"
                :active="feedFilter === f.value"
                @toggle="feedFilter = f.value"
              />
            </div>

            <!-- Feed posts -->
            <div v-if="postError" class="cpub-post-error">{{ postError }}</div>
            <div v-if="filteredPosts.length" class="cpub-feed-list">
              <FeedItem
                v-for="post in filteredPosts"
                :key="post.id"
                :type="(post.type as 'discussion' | 'question' | 'showcase' | 'announcement') || 'discussion'"
                :title="post.title || ''"
                :author="post.author?.displayName || post.author?.username || 'Unknown'"
                :body="post.body || post.content || ''"
                :created-at="new Date(post.createdAt)"
                :reply-count="post.replyCount ?? 0"
                :vote-count="post.voteCount ?? post.likeCount ?? 0"
              />
            </div>
            <div v-else class="cpub-empty-state">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-message"></i></div>
              <p class="cpub-empty-state-title">No posts yet</p>
              <p class="cpub-empty-state-desc">Be the first to start a discussion!</p>
            </div>
          </template>

          <!-- Discussions tab -->
          <template v-else-if="activeTab === 'discussions'">
            <div v-if="discussions?.length" class="cpub-disc-list">
              <DiscussionItem
                v-for="disc in discussions"
                :key="disc.id"
                :title="disc.title"
                :author="disc.author?.displayName || disc.author?.username || 'Unknown'"
                :reply-count="disc.replyCount ?? 0"
                :vote-count="disc.voteCount ?? 0"
                :solved="disc.solved"
              />
            </div>
            <div v-else class="cpub-empty-state">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-comments"></i></div>
              <p class="cpub-empty-state-title">No discussions yet</p>
            </div>
          </template>

          <!-- Members tab -->
          <template v-else-if="activeTab === 'members'">
            <div v-if="members?.length" class="cpub-members-grid">
              <MemberCard
                v-for="member in members"
                :key="member.id"
                :username="member.username"
                :display-name="member.displayName || member.username"
                :role="(member.role as 'owner' | 'moderator' | 'member') || 'member'"
                :joined-at="new Date()"
              />
            </div>
            <div v-else class="cpub-empty-state">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-users"></i></div>
              <p class="cpub-empty-state-title">No members yet</p>
            </div>
          </template>

          <!-- Generic empty for other tabs -->
          <template v-else>
            <div class="cpub-empty-state">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-folder-open"></i></div>
              <p class="cpub-empty-state-title">Coming soon</p>
            </div>
          </template>
        </main>

        <!-- SIDEBAR -->
        <aside class="cpub-hub-sidebar">
          <!-- Moderators -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title">Moderators</div>
            <div v-for="mod in moderators" :key="mod.id" class="cpub-mod-item">
              <div class="cpub-mod-avatar">{{ (mod.displayName || mod.username || 'U').charAt(0).toUpperCase() }}</div>
              <div class="cpub-mod-info">
                <div class="cpub-mod-name">{{ mod.displayName || mod.username }}</div>
                <div class="cpub-mod-role">{{ mod.role }}</div>
              </div>
            </div>
            <p v-if="!moderators.length" class="cpub-sidebar-empty">No moderators listed.</p>
          </div>

          <!-- Rules -->
          <div v-if="c.rules?.length" class="cpub-sb-card">
            <div class="cpub-sb-title">Community Rules</div>
            <div v-for="(rule, i) in c.rules" :key="i" class="cpub-rule-item">
              <span class="cpub-rule-num">{{ i + 1 }}</span>
              <span>{{ rule }}</span>
            </div>
          </div>

          <!-- Related Communities -->
          <div v-if="c.relatedCommunities?.length" class="cpub-sb-card">
            <div class="cpub-sb-title">Related Communities</div>
            <div v-for="rel in c.relatedCommunities" :key="rel.slug" class="cpub-related-hub">
              <div class="cpub-hub-mini-icon"><i class="fa-solid fa-users"></i></div>
              <div class="cpub-hub-mini-info">
                <NuxtLink :to="`/communities/${rel.slug}`" class="cpub-hub-mini-name">{{ rel.name }}</NuxtLink>
                <div class="cpub-hub-mini-count">{{ rel.memberCount ?? 0 }} members</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
  <div v-else class="cpub-empty-state" style="padding: 64px 24px">
    <p class="cpub-empty-state-title">Community not found</p>
  </div>
</template>

<style scoped>
/* ─── HUB HERO ─── */
.cpub-hub-hero { position: relative; overflow: hidden; }

.cpub-hub-banner {
  height: 160px;
  background: var(--accent-bg);
  position: relative;
  overflow: hidden;
  border-bottom: 2px solid var(--border);
}

.cpub-hub-banner-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.5;
}

.cpub-hub-banner-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--accent) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.08;
}

.cpub-hub-meta-bar {
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  padding: 16px 0;
}

.cpub-hub-meta-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.cpub-hub-icon {
  width: 64px;
  height: 64px;
  background: var(--accent-bg);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
  margin-top: -32px;
  position: relative;
  z-index: 1;
  box-shadow: 4px 4px 0 var(--border);
  color: var(--accent);
}

.cpub-hub-info { flex: 1; min-width: 0; }

.cpub-hub-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.cpub-hub-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.cpub-hub-desc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
  max-width: 600px;
  margin-bottom: 10px;
}

.cpub-hub-stats {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  margin-bottom: 12px;
}

.cpub-hub-stat {
  display: flex;
  align-items: center;
  gap: 5px;
}

.cpub-hub-stat-val {
  color: var(--text);
  font-weight: 600;
}

.cpub-hub-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-hub-badges {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.cpub-hub-tags { margin-top: 10px; }

.cpub-member-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--green);
  background: var(--green-bg);
  padding: 4px 12px;
  border: 1px solid var(--green-border);
}

/* ─── TABS ─── */
.cpub-hub-tabs {
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  position: sticky;
  top: 48px;
  z-index: 90;
}

.cpub-tabs-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  gap: 2px;
}

.cpub-tab-btn {
  font-size: 12px;
  color: var(--text-dim);
  padding: 10px 14px;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  top: 2px;
}

.cpub-tab-btn:hover { color: var(--text); }
.cpub-tab-btn.active { color: var(--text); border-bottom-color: var(--accent); font-weight: 600; }

/* ─── LAYOUT ─── */
.cpub-hub-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px;
}

.cpub-hub-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
  align-items: start;
}

/* ─── TAGS ─── */
.cpub-tag-row { display: flex; gap: 6px; flex-wrap: wrap; }
.cpub-tag {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border: 1px solid var(--border2);
  color: var(--text-dim);
  background: var(--surface2);
}

.cpub-tag-accent { border-color: var(--accent-border); color: var(--accent); background: var(--accent-bg); }
.cpub-tag-green { border-color: var(--green-border); color: var(--green); background: var(--green-bg); }

/* ─── BUTTONS ─── */
.cpub-btn {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 6px 14px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  white-space: nowrap;
}

.cpub-btn:hover { background: var(--surface2); }
.cpub-btn-primary { background: var(--accent); color: var(--color-text-inverse); box-shadow: 4px 4px 0 var(--border); }
.cpub-btn-primary:hover { background: var(--color-primary-hover); }
.cpub-btn-sm { padding: 4px 10px; font-size: 11px; }

/* ─── COMPOSE BAR ─── */
.cpub-compose-bar {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 12px 14px;
  margin-bottom: 16px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.cpub-compose-input {
  flex: 1;
  background: var(--surface2);
  border: 2px solid var(--border);
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-faint);
  cursor: pointer;
}

/* ─── FEED CARDS ─── */
.cpub-feed-list { display: flex; flex-direction: column; gap: 12px; }

.cpub-feed-card {
  background: var(--surface);
  border: 2px solid var(--border);
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.cpub-feed-card:hover { box-shadow: 4px 4px 0 var(--border); }

.cpub-announce-band {
  background: var(--yellow-bg);
  border-left: 4px solid var(--yellow);
}

.cpub-feed-header {
  padding: 14px 16px 10px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.cpub-feed-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text-dim);
  flex-shrink: 0;
}

.cpub-feed-content { flex: 1; min-width: 0; }

.cpub-feed-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.cpub-feed-author { font-size: 12px; font-weight: 600; }
.cpub-feed-time { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-feed-dot { width: 2px; height: 2px; border-radius: 50%; background: var(--text-faint); }

.cpub-feed-type-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  padding: 1px 6px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

.cpub-badge-question { background: var(--accent-bg); color: var(--accent); border: 1px solid var(--accent-border); }
.cpub-badge-discussion { background: var(--purple-bg); color: var(--purple); border: 1px solid var(--purple-border); }
.cpub-badge-showcase { background: var(--teal-bg); color: var(--teal); border: 1px solid var(--teal-border); }
.cpub-badge-announcement { background: var(--yellow-bg); color: var(--yellow); border: 1px solid var(--yellow-border); }

.cpub-feed-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; line-height: 1.4; }
.cpub-feed-body { font-size: 12px; color: var(--text-dim); line-height: 1.55; margin-bottom: 10px; }

.cpub-feed-footer {
  padding: 8px 16px;
  border-top: 2px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface2);
}

.cpub-feed-action {
  font-size: 11px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 3px 6px;
  border: none;
  background: none;
  font-family: var(--font-mono);
}

.cpub-feed-action:hover { color: var(--text); background: var(--surface3); }
.cpub-feed-action i { font-size: 10px; }

.cpub-feed-actions-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ─── DISCUSSIONS ─── */
.cpub-disc-list { display: flex; flex-direction: column; gap: 8px; }

.cpub-disc-item {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 12px 14px;
  cursor: pointer;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  transition: box-shadow 0.15s;
}

.cpub-disc-item:hover { box-shadow: 4px 4px 0 var(--border); }

.cpub-disc-votes {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  min-width: 28px;
}

.cpub-disc-vote-count { font-size: 13px; font-weight: 700; font-family: var(--font-mono); color: var(--text); }
.cpub-disc-vote-label { font-size: 8px; color: var(--text-faint); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; }

.cpub-disc-info { flex: 1; min-width: 0; }
.cpub-disc-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; line-height: 1.35; }
.cpub-disc-meta { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); display: flex; align-items: center; gap: 8px; }

.cpub-disc-replies { display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; min-width: 28px; }
.cpub-disc-reply-count { font-size: 12px; font-weight: 600; font-family: var(--font-mono); color: var(--text-dim); }
.cpub-disc-reply-label { font-size: 8px; color: var(--text-faint); font-family: var(--font-mono); }

/* ─── MEMBERS ─── */
.cpub-members-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.cpub-member-card {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 16px;
  text-align: center;
}

.cpub-member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text-dim);
  margin: 0 auto 8px;
}

.cpub-member-name { font-size: 12px; font-weight: 600; margin-bottom: 2px; }
.cpub-member-handle { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-member-role { font-size: 9px; color: var(--accent); font-family: var(--font-mono); text-transform: uppercase; margin-top: 4px; }

/* ─── SIDEBAR ─── */
.cpub-hub-sidebar { min-width: 0; }

.cpub-sb-card {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 16px;
  margin-bottom: 12px;
}

.cpub-sb-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  font-family: var(--font-mono);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border2);
}

.cpub-mod-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.cpub-mod-item:last-child { margin-bottom: 0; }

.cpub-mod-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text-dim);
  flex-shrink: 0;
}

.cpub-mod-info { flex: 1; }
.cpub-mod-name { font-size: 11px; font-weight: 500; }
.cpub-mod-role { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }

.cpub-rule-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--text-dim);
}

.cpub-rule-num {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  width: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

.cpub-related-hub { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer; }
.cpub-related-hub:last-child { margin-bottom: 0; }

.cpub-hub-mini-icon {
  width: 28px;
  height: 28px;
  background: var(--surface2);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.cpub-hub-mini-info { flex: 1; }
.cpub-hub-mini-name { font-size: 11px; font-weight: 500; color: var(--text); text-decoration: none; }
.cpub-hub-mini-name:hover { color: var(--accent); }
.cpub-hub-mini-count { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }

.cpub-sidebar-empty { font-size: 11px; color: var(--text-faint); }

/* ─── POST ERROR ─── */
.cpub-post-error { font-size: 11px; color: var(--red); background: var(--red-bg); border: 1px solid var(--red-border); padding: 8px 12px; margin-bottom: 12px; font-family: var(--font-mono); }

/* ─── EMPTY STATE ─── */
.cpub-empty-state { text-align: center; padding: 32px 16px; }
.cpub-empty-state-icon { font-size: 28px; color: var(--text-faint); margin-bottom: 10px; }
.cpub-empty-state-title { font-size: 13px; color: var(--text-dim); margin-bottom: 4px; }
.cpub-empty-state-desc { font-size: 11px; color: var(--text-faint); }

/* ─── RESPONSIVE ─── */
@media (max-width: 1024px) {
  .cpub-hub-layout { grid-template-columns: 1fr; }
  .cpub-hub-top-row { flex-direction: column; }
  .cpub-members-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .cpub-hub-meta-inner { flex-direction: column; }
  .cpub-hub-icon { margin-top: 0; }
  .cpub-hub-main { padding: 16px; }
  .cpub-members-grid { grid-template-columns: 1fr; }
}
</style>
