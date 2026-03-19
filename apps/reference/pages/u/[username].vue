<script setup lang="ts">
const route = useRoute();
const username = route.params.username as string;

useSeoMeta({
  title: `${username} — CommonPub`,
});

import type { Serialized, UserProfile } from '@commonpub/server';

const { data: profile } = await useFetch<Serialized<UserProfile>>(`/api/users/${username}`);
const { data: content } = await useFetch(`/api/users/${username}/content`);

const activeTab = ref('projects');

const tabDefs = [
  { value: 'projects', label: 'Projects', icon: 'fa-solid fa-folder-open' },
  { value: 'articles', label: 'Articles', icon: 'fa-solid fa-newspaper' },
  { value: 'explainers', label: 'Explainers', icon: 'fa-solid fa-book-open' },
  { value: 'videos', label: 'Videos', icon: 'fa-solid fa-play' },
  { value: 'about', label: 'About', icon: 'fa-solid fa-id-card' },
];

const profileStats = computed(() => {
  if (!profile.value) return [];
  return [
    { value: content.value?.items?.filter((i) => i.type === 'project').length ?? 0, label: 'Projects' },
    { value: profile.value.followerCount ?? 0, label: 'Followers' },
    { value: profile.value.followingCount ?? 0, label: 'Following' },
    { value: content.value?.items?.filter((i) => i.type === 'article').length ?? 0, label: 'Articles' },
    { value: profile.value.viewCount ?? 0, label: 'Total Views' },
    { value: profile.value.likeCount ?? 0, label: 'Likes' },
  ];
});

const filteredContent = computed(() => {
  if (!content.value?.items) return [];
  const typeMap: Record<string, string[]> = {
    projects: ['project'],
    articles: ['article', 'blog'],
    explainers: ['explainer'],
    videos: ['video'],
    about: ['project'], // About tab sidebar shows featured projects
  };
  const types = typeMap[activeTab.value];
  if (!types) return [];
  return content.value.items.filter((i) => types.includes(i.type));
});

const p = computed(() => profile.value);

const { isAuthenticated, user } = useAuth();
const toast = useToast();
const isOwnProfile = computed(() => user.value?.username === username);
const following = ref(false);
const followLoading = ref(false);

async function toggleFollow(): Promise<void> {
  if (!isAuthenticated.value) {
    await navigateTo(`/auth/login?redirect=/u/${username}`);
    return;
  }
  followLoading.value = true;
  try {
    if (following.value) {
      await $fetch(`/api/users/${username}/follow`, { method: 'DELETE' });
      following.value = false;
      toast.success('Unfollowed');
    } else {
      await $fetch(`/api/users/${username}/follow`, { method: 'POST' });
      following.value = true;
      toast.success('Following!');
    }
  } catch {
    toast.error('Failed to update follow');
  } finally {
    followLoading.value = false;
  }
}

function handleMessage(): void {
  navigateTo('/messages');
}

async function handleShare(): Promise<void> {
  const url = `${window.location.origin}/u/${username}`;
  if (navigator.share) {
    await navigator.share({ title: p.value?.displayName || username, url }).catch(() => {});
  } else {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  }
}

const showMenu = ref(false);
function toggleMenu(): void {
  showMenu.value = !showMenu.value;
}
</script>

<template>
  <div v-if="p" class="cpub-profile">
    <!-- Hero -->
    <section class="cpub-profile-hero">
      <!-- Banner -->
      <div class="cpub-profile-banner">
        <div class="cpub-profile-banner-grid" />
      </div>

      <div class="cpub-profile-hero-inner">
        <div class="cpub-profile-hero-top">
          <div class="cpub-profile-avatar-wrap">
            <div class="cpub-profile-avatar">
              {{ (p.displayName || p.username || 'U').charAt(0).toUpperCase() }}
            </div>
            <div v-if="p.verified" class="cpub-verified-badge" aria-label="Verified">
              <i class="fa-solid fa-check"></i>
            </div>
          </div>
          <div class="cpub-profile-hero-info">
            <h1 class="cpub-profile-name">{{ p.displayName || p.username }}</h1>
            <div class="cpub-profile-handle">@{{ p.username }}</div>
            <p v-if="p.headline" class="cpub-profile-headline">{{ p.headline }}</p>
            <p v-if="p.bio" class="cpub-profile-bio">{{ p.bio }}</p>
            <div class="cpub-profile-meta">
              <span v-if="p.location" class="cpub-profile-meta-item">
                <i class="fa-solid fa-location-dot"></i> {{ p.location }}
              </span>
              <span v-if="p.website" class="cpub-profile-meta-item">
                <i class="fa-solid fa-globe"></i>
                <a :href="p.website" target="_blank" rel="noopener">{{ p.website.replace(/^https?:\/\//, '') }}</a>
              </span>
              <span class="cpub-profile-meta-item">
                <i class="fa-solid fa-calendar"></i> Joined {{ new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }}
              </span>
            </div>
            <div v-if="p.tags?.length" class="cpub-tag-row" style="margin-bottom: 14px">
              <span v-for="tag in p.tags" :key="tag" class="cpub-tag">{{ tag }}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 16px">
              <div v-if="!isOwnProfile" class="cpub-profile-actions">
                <button
                  :class="['cpub-btn', following ? '' : 'cpub-btn-primary']"
                  :disabled="followLoading"
                  @click="toggleFollow"
                >
                  <i :class="following ? 'fa-solid fa-user-check' : 'fa-solid fa-user-plus'"></i>
                  {{ following ? 'Following' : 'Follow' }}
                </button>
                <button class="cpub-btn" @click="handleMessage"><i class="fa-solid fa-envelope"></i> Message</button>
                <button class="cpub-btn cpub-btn-sm" aria-label="Share profile" @click="handleShare"><i class="fa-solid fa-share-nodes"></i></button>
                <div style="position: relative; display: inline-block;">
                  <button class="cpub-btn cpub-btn-sm" aria-label="More options" @click="toggleMenu"><i class="fa-solid fa-ellipsis"></i></button>
                  <div v-if="showMenu" class="cpub-dropdown" @click="showMenu = false">
                    <button class="cpub-dropdown-item"><i class="fa-solid fa-flag"></i> Report</button>
                    <button class="cpub-dropdown-item"><i class="fa-solid fa-ban"></i> Block</button>
                  </div>
                </div>
              </div>
              <div v-else class="cpub-profile-actions">
                <NuxtLink to="/settings/profile" class="cpub-btn"><i class="fa-solid fa-pen"></i> Edit Profile</NuxtLink>
              </div>
              <div class="cpub-profile-social">
                <a v-if="p.github" :href="`https://github.com/${p.github}`" class="cpub-social-btn" target="_blank" rel="noopener" aria-label="GitHub"><i class="fa-brands fa-github"></i></a>
                <a v-if="p.twitter" :href="`https://twitter.com/${p.twitter}`" class="cpub-social-btn" target="_blank" rel="noopener" aria-label="Twitter"><i class="fa-brands fa-x-twitter"></i></a>
                <a v-if="p.linkedin" :href="`https://linkedin.com/in/${p.linkedin}`" class="cpub-social-btn" target="_blank" rel="noopener" aria-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
                <a v-if="p.youtube" :href="`https://youtube.com/${p.youtube}`" class="cpub-social-btn" target="_blank" rel="noopener" aria-label="YouTube"><i class="fa-brands fa-youtube"></i></a>
                <a v-if="p.mastodon" :href="p.mastodon" class="cpub-social-btn" target="_blank" rel="noopener" aria-label="Mastodon"><i class="fa-brands fa-mastodon"></i></a>
              </div>
            </div>
          </div>
        </div>
        <!-- Stats -->
        <StatBar :stats="profileStats" />
      </div>
    </section>

    <!-- Tabs -->
    <div class="cpub-profile-tabs">
      <div class="cpub-profile-tabs-inner">
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

    <!-- Content -->
    <div class="cpub-profile-main">
      <!-- Projects / Articles / Explainers / Videos tabs -->
      <template v-if="['projects', 'articles', 'explainers', 'videos'].includes(activeTab)">
        <!-- Section header -->
        <div class="cpub-sec-head">
          <h2>
            <i :class="tabDefs.find(t => t.value === activeTab)?.icon" style="color: var(--accent); margin-right: 6px"></i>
            {{ tabDefs.find(t => t.value === activeTab)?.label }}
          </h2>
        </div>

        <div v-if="filteredContent.length" class="cpub-grid-3">
          <ContentCard v-for="item in filteredContent" :key="item.id" :item="item" />
        </div>
        <div v-else class="cpub-empty-state">
          <p class="cpub-empty-state-title">No {{ activeTab }} yet</p>
        </div>
      </template>

      <!-- About tab — Experience + Awards + Skills with sidebar -->
      <template v-if="activeTab === 'about'">
        <div class="cpub-about-grid">
          <div>
            <!-- Experience -->
            <div style="margin-bottom: 32px">
              <div class="cpub-sec-head">
                <h2><i class="fa-solid fa-briefcase" style="color: var(--accent); margin-right: 6px"></i>Experience</h2>
              </div>
              <div class="cpub-profile-timeline">
                <TimelineItem
                  v-for="(exp, i) in (p.experience || [])"
                  :key="i"
                  :role="exp.role"
                  :company="exp.company"
                  :period="exp.period"
                  :description="exp.description"
                  :current="i === 0"
                />
                <div v-if="!p.experience?.length" class="cpub-empty-state">
                  <p class="cpub-empty-state-title">No experience entries yet</p>
                </div>
              </div>
            </div>

            <!-- Awards -->
            <div style="margin-bottom: 32px">
              <div class="cpub-sec-head">
                <h2><i class="fa-solid fa-trophy" style="color: var(--yellow); margin-right: 6px"></i>Awards &amp; Recognition</h2>
              </div>
              <div class="cpub-awards-grid">
                <div v-for="(award, i) in (p.awards || [])" :key="i" class="cpub-award-card">
                  <div class="cpub-award-icon"><i class="fa-solid fa-medal"></i></div>
                  <div class="cpub-award-title">{{ award.title }}</div>
                  <div class="cpub-award-org">{{ award.organization }}</div>
                  <div class="cpub-award-year">{{ award.year }}</div>
                </div>
              </div>
              <div v-if="!p.awards?.length" class="cpub-empty-state">
                <p class="cpub-empty-state-title">No awards yet</p>
              </div>
            </div>

            <!-- Skills -->
            <div class="cpub-skills-section">
              <div class="cpub-sec-head">
                <h2><i class="fa-solid fa-microchip" style="color: var(--teal); margin-right: 6px"></i>Skills</h2>
              </div>
              <div v-for="(group, i) in (p.skillGroups || [])" :key="i" class="cpub-skills-group">
                <div class="cpub-skills-group-label">{{ group.label }}</div>
                <SkillBar
                  v-for="skill in group.skills"
                  :key="skill.name"
                  :name="skill.name"
                  :percentage="skill.percentage"
                  :color="skill.color ? `var(--${skill.color})` : undefined"
                />
              </div>
              <div v-if="!p.skillGroups?.length" class="cpub-empty-state">
                <p class="cpub-empty-state-title">No skills listed yet</p>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="cpub-about-sidebar">
            <!-- Activity Heatmap -->
            <div class="cpub-sb-card">
              <div class="cpub-sb-title">Activity</div>
              <HeatmapGrid :weeks="20" />
            </div>

            <!-- Featured Projects -->
            <div class="cpub-sb-card">
              <div class="cpub-sb-title">Featured Projects</div>
              <div v-for="item in filteredContent.slice(0, 3)" :key="item.id" class="cpub-mini-project">
                <div class="cpub-mini-thumb"><i class="fa-solid fa-microchip"></i></div>
                <div>
                  <div class="cpub-mini-title">{{ item.title }}</div>
                  <div class="cpub-mini-meta">{{ item.viewCount ?? 0 }} views</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <div v-else class="cpub-empty-state">
    <p class="cpub-empty-state-title">User not found</p>
  </div>
</template>

<style scoped>
/* Profile Banner */
.cpub-profile-banner {
  height: 180px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--purple) 50%, var(--teal) 100%);
  position: relative;
  overflow: hidden;
}

.cpub-profile-banner-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.3;
}

/* Profile Hero */
.cpub-profile-hero {
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
  padding: 0;
}

.cpub-profile-hero-inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 32px;
  margin-top: -48px;
  position: relative;
  z-index: 1;
}

.cpub-profile-hero-top {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 24px;
  padding-top: 16px;
}

.cpub-profile-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.cpub-profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--surface);
  border: 4px solid var(--surface);
  box-shadow: 0 0 0 2px var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  font-weight: 700;
  color: var(--accent);
  font-family: var(--font-mono);
}

.cpub-verified-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: var(--color-text-inverse);
}

.cpub-profile-hero-info {
  flex: 1;
  min-width: 0;
}

.cpub-profile-name {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 2px;
}

.cpub-profile-handle {
  font-size: 13px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  margin-bottom: 6px;
}

.cpub-profile-headline {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 10px;
}

.cpub-profile-bio {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.6;
  max-width: 560px;
  margin-bottom: 12px;
}

.cpub-profile-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 11px;
  color: var(--text-dim);
  margin-bottom: 12px;
  font-family: var(--font-mono);
}

.cpub-profile-meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.cpub-profile-meta-item a {
  color: var(--accent);
  text-decoration: none;
}

.cpub-profile-meta-item a:hover {
  text-decoration: underline;
}

.cpub-profile-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.cpub-profile-social {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}

.cpub-social-btn {
  width: 28px;
  height: 28px;
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  text-decoration: none;
}

.cpub-social-btn:hover {
  background: var(--surface2);
  color: var(--text);
}

/* Profile Stats */
.cpub-profile-stats {
  display: flex;
  gap: 0;
  border-top: 2px solid var(--border);
  margin-top: 16px;
}

.cpub-profile-stat {
  flex: 1;
  padding: 14px 20px;
  border-right: 2px solid var(--border);
  cursor: pointer;
}

.cpub-profile-stat:last-child {
  border-right: none;
}

.cpub-profile-stat:hover {
  background: var(--surface2);
}

.cpub-profile-stat-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  font-family: var(--font-mono);
  margin-bottom: 2px;
  display: block;
}

.cpub-profile-stat-label {
  font-size: 10px;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-family: var(--font-mono);
}

/* Profile Tabs */
.cpub-profile-tabs {
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  position: sticky;
  top: 48px;
  z-index: 90;
}

.cpub-profile-tabs-inner {
  max-width: 1080px;
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
  font-family: system-ui, -apple-system, sans-serif;
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  top: 2px;
}

.cpub-tab-btn:hover { color: var(--text); }

.cpub-tab-btn.active {
  color: var(--text);
  border-bottom-color: var(--accent);
}

/* Main Content */
.cpub-profile-main {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px;
}

/* Timeline */
.cpub-profile-timeline {
  position: relative;
  padding-left: 20px;
}

.cpub-profile-timeline::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--border2);
}

/* Awards */
.cpub-awards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.cpub-award-card {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 12px;
  box-shadow: var(--shadow-md);
}

.cpub-award-icon {
  font-size: 18px;
  margin-bottom: 6px;
  color: var(--accent);
}

.cpub-award-title {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 2px;
}

.cpub-award-org {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.cpub-award-year {
  font-size: 9px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  margin-top: 4px;
}

/* Skills */
.cpub-skills-group {
  margin-bottom: 16px;
}

.cpub-skills-group-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  font-family: var(--font-mono);
  margin-bottom: 8px;
}

/* About grid */
.cpub-about-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 32px;
  align-items: start;
}

/* Timeline */
.cpub-tl-item {
  position: relative;
  margin-bottom: 24px;
}

.cpub-tl-item:last-child { margin-bottom: 0; }

.cpub-tl-dot {
  position: absolute;
  left: -17px;
  top: 4px;
  width: 7px;
  height: 7px;
  background: var(--border2);
  border: 1px solid var(--border);
}

.cpub-tl-dot.active {
  background: var(--accent);
  border-color: var(--accent);
}

.cpub-tl-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.cpub-tl-role { font-size: 13px; font-weight: 600; }
.cpub-tl-period { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); white-space: nowrap; margin-top: 2px; }
.cpub-tl-company { font-size: 11px; color: var(--accent); font-family: var(--font-mono); margin-bottom: 4px; }
.cpub-tl-desc { font-size: 11px; color: var(--text-dim); line-height: 1.55; }

/* Skill bars */
.cpub-skill-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.cpub-skill-name {
  font-size: 11px;
  color: var(--text-dim);
  width: 130px;
  flex-shrink: 0;
  font-family: var(--font-mono);
}

.cpub-skill-bar {
  flex: 1;
  height: 4px;
  background: var(--surface3);
  overflow: hidden;
  border: 1px solid var(--border2);
}

.cpub-skill-fill { height: 100%; background: var(--accent); }

.cpub-skill-pct {
  font-size: 9px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  width: 28px;
  text-align: right;
}

.cpub-mini-project {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border2);
}

.cpub-mini-project:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }

.cpub-mini-thumb {
  width: 44px;
  height: 36px;
  background: var(--surface2);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border: 2px solid var(--border);
  color: var(--accent);
}

.cpub-mini-title { font-size: 11px; font-weight: 500; margin-bottom: 2px; line-height: 1.3; }
.cpub-mini-meta { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }

/* Grid */
.cpub-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.cpub-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: 4px 4px 0 var(--border);
  z-index: 100;
  min-width: 140px;
}

.cpub-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.cpub-dropdown-item:hover {
  background: var(--surface2);
  color: var(--text);
}

@media (max-width: 768px) {
  .cpub-profile-hero-top {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .cpub-profile-meta {
    justify-content: center;
    flex-wrap: wrap;
  }
  .cpub-profile-actions {
    justify-content: center;
  }
  .cpub-profile-stats {
    flex-wrap: wrap;
  }
  .cpub-profile-stat {
    min-width: 50%;
    border-bottom: 2px solid var(--border);
  }
  .cpub-awards-grid {
    grid-template-columns: 1fr;
  }
  .cpub-about-grid {
    grid-template-columns: 1fr;
  }
  .cpub-grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
