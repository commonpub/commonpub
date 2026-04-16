<script setup lang="ts">
const route = useRoute();
const username = route.params.username as string;

useSeoMeta({
  title: `${username} — ${useSiteName()}`,
  ogTitle: `${username} — ${useSiteName()}`,
  ogImage: '/og-default.png',
  ogType: 'profile',
  twitterCard: 'summary',
});

const { explainers: explainersEnabled, learning: learningEnabled, federation: federationEnabled } = useFeatures();
const runtimeConfig = useRuntimeConfig();
const instanceDomain = computed(() => {
  const siteUrl = runtimeConfig.public?.siteUrl as string | undefined;
  if (siteUrl) {
    try { return new URL(siteUrl).hostname; } catch { /* fall through */ }
  }
  return '';
});

import type { Serialized, UserProfile, ContentListItem, PaginatedResponse } from '@commonpub/server';

const { data: profile, pending: profilePending, error: profileError, refresh: refreshProfile } = useLazyFetch<Serialized<UserProfile>>(`/api/users/${username}`);
const { data: content } = useLazyFetch<PaginatedResponse<Serialized<ContentListItem>>>(`/api/users/${username}/content`);
const { data: learningData } = useLazyFetch(`/api/users/${username}/learning`, {
  immediate: learningEnabled.value,
});

const activeTab = ref('projects');

const tabDefs = computed(() => {
  const tabs = [
    { value: 'projects', label: 'Projects', icon: 'fa-solid fa-folder-open' },
    { value: 'articles', label: 'Blog', icon: 'fa-solid fa-pen-nib' },
  ];
  if (explainersEnabled.value) {
    tabs.push({ value: 'explainers', label: 'Explainers', icon: 'fa-solid fa-book-open' });
  }
  if (learningEnabled.value) {
    tabs.push({ value: 'learning', label: 'Learning', icon: 'fa-solid fa-graduation-cap' });
  }
  tabs.push({ value: 'about', label: 'About', icon: 'fa-solid fa-id-card' });
  return tabs;
});

const profileStats = computed(() => {
  if (!profile.value) return [];
  const p = profile.value;
  return [
    { value: p.stats?.projects ?? 0, label: 'Projects' },
    { value: p.followerCount ?? p.stats?.followers ?? 0, label: 'Followers' },
    { value: p.followingCount ?? p.stats?.following ?? 0, label: 'Following' },
    { value: p.stats?.articles ?? 0, label: 'Posts' },
    { value: p.viewCount ?? 0, label: 'Total Views' },
    { value: p.likeCount ?? 0, label: 'Likes' },
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

// Activity heatmap data: count content items published per day (YYYY-MM-DD).
// HeatmapGrid needs Record<string, number> keyed by ISO date; with no data
// all cells render as level-0 (empty) which looks broken.
const activityByDate = computed<Record<string, number>>(() => {
  const items = content.value?.items;
  if (!items?.length) return {};
  const map: Record<string, number> = {};
  for (const item of items) {
    // Prefer publishedAt; fall back to createdAt. Items without either are skipped.
    const ts = item.publishedAt ?? item.createdAt;
    if (!ts) continue;
    const date = String(ts).slice(0, 10);
    map[date] = (map[date] ?? 0) + 1;
  }
  return map;
});

const { isAuthenticated, user } = useAuth();
const toast = useToast();
const isOwnProfile = computed(() => user.value?.username === username);
const following = ref(false);
const followLoading = ref(false);

// Initialize follow state from API response
watch(() => profile.value, (profileData) => {
  if (profileData && typeof (profileData as Record<string, unknown>).isFollowing === 'boolean') {
    following.value = (profileData as Record<string, unknown>).isFollowing as boolean;
  }
}, { immediate: true });

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

async function handleMessage(): Promise<void> {
  if (!isAuthenticated.value) {
    await navigateTo(`/auth/login?redirect=/u/${username}`);
    return;
  }
  if (!profile.value) return;
  try {
    const conv = await $fetch<{ id: string }>('/api/messages', {
      method: 'POST',
      body: { participants: [profile.value.id] },
    });
    await navigateTo(`/messages/${conv.id}`);
  } catch {
    toast.error('Failed to start conversation');
  }
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

async function handleReport(): Promise<void> {
  showMenu.value = false;
  if (!isAuthenticated.value) {
    await navigateTo(`/auth/login?redirect=/u/${username}`);
    return;
  }
  if (!profile.value) return;
  try {
    await $fetch(`/api/content/${profile.value.id}/report`, {
      method: 'POST',
      body: { targetType: 'user', targetId: profile.value.id, reason: 'other' },
    });
    toast.success('Report submitted');
  } catch {
    toast.error('Failed to submit report');
  }
}
</script>

<template>
  <div v-if="profilePending" class="cpub-loading">Loading profile...</div>
  <div v-else-if="profileError" class="cpub-fetch-error">
    <div class="cpub-fetch-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <div class="cpub-fetch-error-msg">Failed to load user profile.</div>
    <button class="cpub-btn cpub-btn-sm" @click="refreshProfile()">Retry</button>
  </div>
  <div v-else-if="p" class="cpub-profile">
    <!-- Hero -->
    <section class="cpub-profile-hero">
      <!-- Banner -->
      <div class="cpub-profile-banner">
        <img v-if="p.bannerUrl" :src="p.bannerUrl" :alt="`${p.displayName || p.username} banner`" class="cpub-profile-banner-img" />
        <div v-else class="cpub-profile-banner-grid" />
      </div>

      <div class="cpub-profile-hero-inner">
        <div class="cpub-profile-hero-top">
          <div class="cpub-profile-avatar-wrap">
            <div class="cpub-profile-avatar">
              <img v-if="p.avatarUrl" :src="p.avatarUrl" :alt="p.displayName || p.username" class="cpub-profile-avatar-img" />
              <span v-else>{{ (p.displayName || p.username || 'U').charAt(0).toUpperCase() }}</span>
            </div>
          </div>
          <div class="cpub-profile-hero-info">
            <h1 class="cpub-profile-name">{{ p.displayName || p.username }}</h1>
            <div class="cpub-profile-handle">@{{ p.username }}<span v-if="federationEnabled && instanceDomain" class="cpub-fedi-addr" title="Fediverse address">@{{ instanceDomain }}</span></div>
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
            <div v-if="p.skills?.length" class="cpub-tag-row" style="margin-bottom: 14px">
              <span v-for="skill in p.skills" :key="skill" class="cpub-tag">{{ skill }}</span>
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
                    <button class="cpub-dropdown-item" @click="handleReport"><i class="fa-solid fa-flag"></i> Report</button>
                  </div>
                </div>
              </div>
              <div v-else class="cpub-profile-actions">
                <NuxtLink to="/settings/profile" class="cpub-btn"><i class="fa-solid fa-pen"></i> Edit Profile</NuxtLink>
              </div>
              <div v-if="p.socialLinks" class="cpub-profile-social">
                <a v-if="p.socialLinks.github" :href="p.socialLinks.github" class="cpub-social-btn" target="_blank" rel="noopener" aria-label="GitHub"><i class="fa-brands fa-github"></i></a>
                <a v-if="p.socialLinks.twitter" :href="p.socialLinks.twitter" class="cpub-social-btn" target="_blank" rel="noopener" aria-label="Twitter"><i class="fa-brands fa-x-twitter"></i></a>
                <a v-if="p.socialLinks.linkedin" :href="p.socialLinks.linkedin" class="cpub-social-btn" target="_blank" rel="noopener" aria-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
                <a v-if="p.socialLinks.youtube" :href="p.socialLinks.youtube" class="cpub-social-btn" target="_blank" rel="noopener" aria-label="YouTube"><i class="fa-brands fa-youtube"></i></a>
                <a v-if="p.socialLinks.mastodon" :href="p.socialLinks.mastodon" class="cpub-social-btn" target="_blank" rel="noopener" aria-label="Mastodon"><i class="fa-brands fa-mastodon"></i></a>
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
      <template v-if="['projects', 'articles', 'explainers'].includes(activeTab)">
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

      <!-- Learning tab — Certificates + In-progress paths -->
      <template v-if="learningEnabled && activeTab === 'learning'">
        <!-- Certificates -->
        <template v-if="learningData?.certificates?.length">
          <div class="cpub-sec-head">
            <h2><i class="fa-solid fa-medal" style="color: var(--yellow); margin-right: 6px"></i>Certificates</h2>
          </div>
          <div class="cpub-cert-list">
            <NuxtLink
              v-for="cert in learningData.certificates"
              :key="cert.id"
              :to="`/cert/${cert.verificationCode}`"
              class="cpub-cert-card-profile"
            >
              <div class="cpub-cert-card-badge"><i class="fa-solid fa-award"></i></div>
              <div class="cpub-cert-card-info">
                <div class="cpub-cert-card-path">{{ cert.path.title }}</div>
                <div class="cpub-cert-card-date">Completed {{ new Date(cert.issuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</div>
              </div>
              <div class="cpub-cert-card-code">{{ cert.verificationCode }}</div>
            </NuxtLink>
          </div>
        </template>

        <!-- In-progress enrollments -->
        <template v-if="learningData?.enrollments?.length">
          <div class="cpub-sec-head" style="margin-top: 24px">
            <h2><i class="fa-solid fa-graduation-cap" style="color: var(--accent); margin-right: 6px"></i>In Progress</h2>
          </div>
          <div class="cpub-enrollment-list">
            <NuxtLink
              v-for="enr in learningData.enrollments"
              :key="enr.id"
              :to="`/learn/${enr.path.slug}`"
              class="cpub-enrollment-card"
            >
              <div class="cpub-enrollment-icon"><i class="fa-solid fa-route"></i></div>
              <div class="cpub-enrollment-info">
                <div class="cpub-enrollment-title">{{ enr.path.title }}</div>
                <div class="cpub-enrollment-progress-row">
                  <div class="cpub-enrollment-bar">
                    <div class="cpub-enrollment-fill" :style="{ width: (enr.progress ?? 0) + '%' }"></div>
                  </div>
                  <span class="cpub-enrollment-pct">{{ Math.round(parseFloat(enr.progress)) }}%</span>
                </div>
              </div>
            </NuxtLink>
          </div>
        </template>

        <div v-if="!learningData?.certificates?.length && !learningData?.enrollments?.length" class="cpub-learning-empty">
          <div class="cpub-empty-icon"><i class="fa-solid fa-graduation-cap"></i></div>
          <p class="cpub-empty-state-title">No learning activity yet</p>
          <p class="cpub-empty-state-sub">Enroll in learning paths to start tracking progress.</p>
        </div>
      </template>

      <!-- About tab — Bio + Skills with sidebar -->
      <template v-if="activeTab === 'about'">
        <div class="cpub-about-grid">
          <div>
            <!-- Bio -->
            <div v-if="p.bio" style="margin-bottom: 32px">
              <div class="cpub-sec-head">
                <h2><i class="fa-solid fa-user" style="color: var(--accent); margin-right: 6px"></i>About</h2>
              </div>
              <p style="font-size: 14px; color: var(--text-dim); line-height: 1.7; max-width: 600px;">{{ p.bio }}</p>
            </div>

            <!-- Info -->
            <div style="margin-bottom: 32px">
              <div class="cpub-sec-head">
                <h2><i class="fa-solid fa-circle-info" style="color: var(--teal); margin-right: 6px"></i>Details</h2>
              </div>
              <div class="cpub-about-details">
                <div v-if="p.location" class="cpub-about-detail"><i class="fa-solid fa-location-dot"></i> {{ p.location }}</div>
                <div v-if="p.website" class="cpub-about-detail"><i class="fa-solid fa-globe"></i> <a :href="p.website" target="_blank" rel="noopener">{{ p.website.replace(/^https?:\/\//, '') }}</a></div>
                <div v-if="p.pronouns" class="cpub-about-detail"><i class="fa-solid fa-comment"></i> {{ p.pronouns }}</div>
                <div class="cpub-about-detail"><i class="fa-solid fa-calendar"></i> Joined {{ new Date(p.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }}</div>
              </div>
            </div>

            <!-- Skills -->
            <div class="cpub-skills-section">
              <div class="cpub-sec-head">
                <h2><i class="fa-solid fa-microchip" style="color: var(--teal); margin-right: 6px"></i>Skills</h2>
              </div>
              <div v-if="p.skills?.length" class="cpub-tag-row" style="flex-wrap: wrap; gap: 6px;">
                <span v-for="skill in p.skills" :key="skill" class="cpub-tag">{{ skill }}</span>
              </div>
              <div v-else class="cpub-empty-state">
                <p class="cpub-empty-state-title">No skills listed yet</p>
              </div>
            </div>

            <!-- Experience -->
            <div v-if="p.experience?.length" class="cpub-experience-section">
              <div class="cpub-sec-head">
                <h2><i class="fa-solid fa-briefcase" style="color: var(--purple); margin-right: 6px"></i>Experience</h2>
              </div>
              <div class="cpub-experience-list">
                <div v-for="(exp, idx) in p.experience" :key="idx" class="cpub-experience-item">
                  <div class="cpub-exp-header">
                    <strong>{{ exp.title }}</strong>
                    <span v-if="exp.company" class="cpub-exp-company">{{ exp.company }}</span>
                  </div>
                  <div v-if="exp.startDate" class="cpub-exp-dates">
                    {{ exp.startDate }}{{ exp.endDate ? ` — ${exp.endDate}` : ' — Present' }}
                  </div>
                  <p v-if="exp.description" class="cpub-exp-desc">{{ exp.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="cpub-about-sidebar">
            <!-- Activity Heatmap -->
            <div class="cpub-sb-card">
              <div class="cpub-sb-title">Activity</div>
              <HeatmapGrid :data="activityByDate" :weeks="20" />
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

.cpub-profile-banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-profile-banner-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.3;
}

/* Profile Hero */
.cpub-profile-hero {
  background: var(--surface2);
  border-bottom: var(--border-width-default) solid var(--border);
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
  overflow: hidden;
}

.cpub-profile-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
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

.cpub-fedi-addr {
  color: var(--text-faint);
  font-size: 0.75rem;
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
  border: var(--border-width-default) solid var(--border);
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
  border-top: var(--border-width-default) solid var(--border);
  margin-top: 16px;
}

.cpub-profile-stat {
  flex: 1;
  padding: 14px 20px;
  border-right: var(--border-width-default) solid var(--border);
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
  border-bottom: var(--border-width-default) solid var(--border);
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

/* About details */
.cpub-about-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cpub-about-detail {
  font-size: 13px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-about-detail i {
  width: 16px;
  text-align: center;
  color: var(--text-faint);
  font-size: 12px;
}

.cpub-about-detail a {
  color: var(--accent);
  text-decoration: none;
}

.cpub-about-detail a:hover {
  text-decoration: underline;
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

/* Experience */
.cpub-experience-section { margin-top: 24px; }
.cpub-experience-list { display: flex; flex-direction: column; gap: 16px; }
.cpub-experience-item {
  padding: 12px 16px;
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface);
}
.cpub-exp-header { display: flex; flex-direction: column; gap: 2px; }
.cpub-exp-header strong { font-size: var(--text-sm); }
.cpub-exp-company { font-size: var(--text-xs); color: var(--text-dim); }
.cpub-exp-dates { font-size: var(--text-xs); color: var(--text-faint); font-family: var(--font-mono); margin-top: 4px; }
.cpub-exp-desc { font-size: var(--text-sm); color: var(--text-dim); margin-top: 8px; line-height: var(--leading-normal); }

/* About grid */
.cpub-about-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 32px;
  align-items: start;
}


.cpub-mini-project {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: var(--border-width-default) solid var(--border2);
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
  border: var(--border-width-default) solid var(--border);
  color: var(--accent);
}

.cpub-learning-empty { text-align: center; padding: 48px 0; }
.cpub-empty-icon { font-size: 32px; color: var(--text-faint); margin-bottom: 12px; }
.cpub-empty-state-sub { font-size: 12px; color: var(--text-dim); margin-top: 4px; }

/* Certificates list */
.cpub-cert-list { display: flex; flex-direction: column; gap: 8px; }
.cpub-cert-card-profile { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border: var(--border-width-default) solid var(--border); background: var(--surface); text-decoration: none; color: var(--text); box-shadow: var(--shadow-md); transition: box-shadow 0.15s, transform 0.15s; }
.cpub-cert-card-profile:hover { box-shadow: var(--shadow-sm); transform: translate(1px, 1px); }
.cpub-cert-card-badge { width: 40px; height: 40px; border-radius: 50%; border: var(--border-width-default) solid var(--yellow); background: var(--yellow-bg); display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--yellow); flex-shrink: 0; }
.cpub-cert-card-info { flex: 1; }
.cpub-cert-card-path { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
.cpub-cert-card-date { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-cert-card-code { font-size: 10px; font-family: var(--font-mono); color: var(--accent); background: var(--accent-bg); padding: 2px 8px; border: var(--border-width-default) solid var(--accent-border); flex-shrink: 0; }

/* Enrollment list */
.cpub-enrollment-list { display: flex; flex-direction: column; gap: 8px; }
.cpub-enrollment-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border: var(--border-width-default) solid var(--border); background: var(--surface); text-decoration: none; color: var(--text); box-shadow: var(--shadow-md); transition: box-shadow 0.15s, transform 0.15s; }
.cpub-enrollment-card:hover { box-shadow: var(--shadow-sm); transform: translate(1px, 1px); }
.cpub-enrollment-icon { width: 40px; height: 40px; border: var(--border-width-default) solid var(--border); background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 16px; color: var(--accent); flex-shrink: 0; }
.cpub-enrollment-info { flex: 1; }
.cpub-enrollment-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.cpub-enrollment-progress-row { display: flex; align-items: center; gap: 8px; }
.cpub-enrollment-bar { flex: 1; height: 4px; background: var(--surface3); border: var(--border-width-default) solid var(--border2); }
.cpub-enrollment-fill { height: 100%; background: var(--accent); }
.cpub-enrollment-pct { font-size: 11px; font-family: var(--font-mono); color: var(--accent); flex-shrink: 0; }

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
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
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
    border-bottom: var(--border-width-default) solid var(--border);
  }
  .cpub-about-grid {
    grid-template-columns: 1fr;
  }
  .cpub-grid-3 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .cpub-profile-tabs-inner { padding: 0 12px; }
  .cpub-profile-main { padding: 16px 12px; }
  .cpub-profile-tab { padding: 10px 10px; font-size: 11px; min-height: 40px; }
  .cpub-profile-stat { min-width: 100%; padding: 10px 16px; }
  .cpub-profile-name { font-size: 18px; }
}
</style>
