<script setup lang="ts">
const route = useRoute();
const slug = route.params.slug as string;

const { data: contest } = await useFetch(`/api/contests/${slug}`);

useSeoMeta({ title: () => `${contest.value?.title || 'Contest'} — CommonPub` });

// Fetch entries from API
const { data: apiEntries } = await useFetch(`/api/contests/${slug}/entries`);

interface ContestData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  entryCount: number;
  rules: string | null;
  prizes: unknown | null;
  judgingCriteria: unknown | null;
}

const c = computed(() => contest.value as ContestData | null);

// Countdown timer
const countdown = ref({ days: '00', hours: '00', mins: '00', secs: '00' });
let countdownInterval: ReturnType<typeof setInterval> | null = null;

function pad(n: number): string { return String(n).padStart(2, '0'); }

function updateCountdown(): void {
  const target = c.value?.endDate ? new Date(c.value.endDate) : new Date();
  const now = new Date();
  let diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const days = Math.floor(diff / 86400); diff %= 86400;
  const hours = Math.floor(diff / 3600); diff %= 3600;
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  countdown.value = { days: pad(days), hours: pad(hours), mins: pad(mins), secs: pad(secs) };
}

onMounted(() => {
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval);
});

// FAQ accordion
const openFaq = ref<number>(0);
function toggleFaq(i: number): void {
  openFaq.value = openFaq.value === i ? -1 : i;
}

// Vote state
const votedEntries = ref<Set<string>>(new Set());
async function toggleVote(entryId: string): Promise<void> {
  try {
    await $fetch('/api/social/like', {
      method: 'POST',
      body: { targetId: entryId, targetType: 'contestEntry' },
    });
    if (votedEntries.value.has(entryId)) votedEntries.value.delete(entryId);
    else votedEntries.value.add(entryId);
  } catch {
    // silent — user may not be authenticated
  }
}

// Display entries — API returns sparse ContestEntryItem, so use static display data
// with API overlay when available
const displayEntries = [
  { id: '1', title: 'RP2040 Wake-Word Engine in 64KB', author: 'marcela_v', initials: 'MV', avBg: 'var(--accent-bg)', avColor: 'var(--accent)', tag: 'TinyML', tagClass: 'cpub-tag-accent', iconClass: 'fa-solid fa-microchip', iconColor: 'var(--accent)', rank: 1, votes: 342, comments: 87, views: '2.1k' },
  { id: '2', title: 'FarmSense: FPGA Crop Disease Detector', author: 'hw_hacker', initials: 'HH', avBg: 'var(--green-bg)', avColor: 'var(--green)', tag: 'FPGA', tagClass: 'cpub-tag-purple', iconClass: 'fa-solid fa-leaf', iconColor: 'var(--green)', rank: 2, votes: 298, comments: 64, views: '1.8k' },
  { id: '3', title: 'Ultra-Low-Power Sign Language on nRF52', author: 'accessibility_ai', initials: 'AA', avBg: 'var(--purple-bg)', avColor: 'var(--purple)', tag: 'TinyML', tagClass: 'cpub-tag-accent', iconClass: 'fa-solid fa-hand', iconColor: 'var(--purple)', rank: 3, votes: 276, comments: 52, views: '1.5k' },
  { id: '4', title: 'Thermal Anomaly Mesh for Wildfire', author: 'pyro_detect', initials: 'PD', avBg: 'var(--red-bg)', avColor: 'var(--red)', tag: 'Vision', tagClass: 'cpub-tag-yellow', iconClass: 'fa-solid fa-fire', iconColor: 'var(--red)', rank: undefined, votes: 189, comments: 41, views: '1.2k' },
  { id: '5', title: 'ESP32 Audio Scene Classifier', author: 'sound_ml', initials: 'SM', avBg: 'var(--teal-bg)', avColor: 'var(--teal)', tag: 'Audio', tagClass: 'cpub-tag-teal', iconClass: 'fa-solid fa-music', iconColor: 'var(--teal)', rank: undefined, votes: 156, comments: 33, views: '980' },
  { id: '6', title: 'Jetson Nano Real-Time Pothole Mapper', author: 'road_ai', initials: 'RA', avBg: 'var(--yellow-bg)', avColor: 'var(--yellow)', tag: 'Vision', tagClass: 'cpub-tag-yellow', iconClass: 'fa-solid fa-road', iconColor: 'var(--yellow)', rank: undefined, votes: 134, comments: 28, views: '870' },
];

const entries = computed(() => {
  const apiItems = apiEntries.value as Array<{ id: string }> | null;
  if (apiItems && apiItems.length > 0) return apiItems;
  return displayEntries;
});

const judges = [
  { initials: 'PE', name: 'Dr. Priya Elango', title: 'Principal Researcher, Machine Learning Systems', org: 'Arm Research', bg: 'var(--accent-bg)', color: 'var(--accent)' },
  { initials: 'JM', name: 'James Moreau', title: 'Staff Engineer, TensorFlow Lite Micro', org: 'Google', bg: 'var(--green-bg)', color: 'var(--green)' },
  { initials: 'NW', name: 'Ngozi Williams', title: 'Co-founder, CTO', org: 'Zindi Africa', bg: 'var(--yellow-bg)', color: 'var(--yellow)' },
  { initials: 'TK', name: 'Prof. Takuya Kishida', title: 'Director, Embedded AI Lab', org: 'Waseda University', bg: 'var(--purple-bg)', color: 'var(--purple)' },
  { initials: 'SR', name: 'Sara Raza', title: 'FPGA Architect', org: 'Xilinx / AMD', bg: 'var(--teal-bg)', color: 'var(--teal)' },
  { initials: 'FB', name: 'Florian Beck', title: 'Senior Engineer, Edge Runtime', org: 'Hackster.io', bg: 'var(--red-bg)', color: 'var(--red)' },
];

const timeline = [
  { icon: 'fa fa-check', status: 'done', name: 'Submissions Open', date: 'Jan 15 — Mar 15, 2026', badge: 'Done' },
  { icon: 'fa fa-circle-dot', status: 'active', name: 'Review Period', date: 'Mar 15 — Mar 20, 2026', badge: 'Active' },
  { icon: 'fa fa-clock', status: 'upcoming', name: 'Expert Judging', date: 'Mar 20 — Apr 1, 2026', badge: '' },
  { icon: 'fa fa-trophy', status: 'upcoming', name: 'Winners Announced', date: 'April 3, 2026 · 18:00 UTC', badge: '' },
  { icon: 'fa fa-video', status: 'upcoming', name: 'Live Ceremony Stream', date: 'April 3, 2026 · 19:00 UTC', badge: '' },
];

const sponsors = [
  { name: 'Arm', tier: 'Diamond', icon: 'fa-solid fa-gem', color: 'var(--accent)' },
  { name: 'Hackster.io', tier: 'Gold', icon: 'fa-solid fa-star', color: 'var(--yellow)' },
  { name: 'Arduino', tier: 'Silver', icon: 'fa-solid fa-medal', color: 'var(--silver)' },
  { name: 'Digilent', tier: 'Silver', icon: 'fa-solid fa-medal', color: 'var(--silver)' },
  { name: 'SEGGER', tier: 'Bronze', icon: 'fa-solid fa-award', color: 'var(--bronze)' },
  { name: 'IAR Systems', tier: 'Bronze', icon: 'fa-solid fa-award', color: 'var(--bronze)' },
  { name: 'Edge Impulse', tier: 'Community', icon: 'fa-solid fa-heart', color: 'var(--pink)' },
  { name: 'Zindi', tier: 'Community', icon: 'fa-solid fa-heart', color: 'var(--pink)' },
];

const faqs = [
  { q: 'Can I enter as a team?', a: 'Yes. Teams of up to 4 people are allowed. All members must have CommonPub accounts. The team lead submits the entry and is responsible for prize distribution.' },
  { q: 'What hardware is eligible?', a: 'Any embedded hardware: MCUs (RP2040, STM32, nRF52, ESP32, etc.), FPGAs (Artix-7, Cyclone V, ECP5, etc.), SBCs (Raspberry Pi, Jetson Nano, OrangePi), or custom silicon. Cloud or laptop inference is not eligible.' },
  { q: 'Does the project need to be new?', a: 'Projects must have been created or substantially updated after January 1, 2026. Older projects are allowed if at least 50% of the work was done within the contest window, which you must document.' },
  { q: 'How are winners selected?', a: 'Community votes determine the shortlist (top 20 entries). Judges then score each shortlisted entry on Technical Innovation (30%), Real-World Impact (25%), Documentation (25%), and Hardware Efficiency (20%). The People\'s Choice Award is decided purely by community vote.' },
  { q: 'How are prizes paid?', a: 'Cash prizes are transferred via Wise within 14 days of winner confirmation. If Wise is unavailable in your country, we\'ll arrange an alternative (bank wire or hardware equivalent). Tax obligations are the winner\'s responsibility.' },
  { q: 'Can I submit to multiple categories?', a: 'Each team may submit one entry total. Category tags (TinyML, FPGA, Vision, Audio, etc.) are for filtering only — your entry is automatically considered for all relevant special prizes.' },
];

const entryFilter = ref('All');
const filters = ['All (134)', 'Top Voted', 'Newest', 'FPGA', 'TinyML', 'Computer Vision'];
</script>

<template>
  <div class="cpub-contest">

    <!-- HERO -->
    <div class="cpub-hero">
      <div class="cpub-hero-pattern">
        <div class="cpub-hero-dots"></div>
        <div class="cpub-hero-lines"></div>
      </div>

      <div class="cpub-hero-inner">
        <div class="cpub-hero-eyebrow">
          <span class="cpub-contest-badge"><i class="fa fa-trophy" style="margin-right:5px;font-size:8px;"></i>Contest</span>
          <span class="cpub-hero-host">
            Hosted by
            <span class="cpub-av cpub-av-sm" style="background:var(--accent-bg);border-color:var(--accent);color:var(--accent);">CP</span>
            <strong style="color:var(--hero-text);">CommonPub</strong>
            <span style="color:var(--hero-border);">·</span>
            In partnership with <strong style="color:var(--hero-text);">Arm Research &amp; Hackster.io</strong>
          </span>
        </div>

        <div class="cpub-hero-title">{{ c?.title || 'Contest' }}</div>
        <div class="cpub-hero-tagline">
          {{ c?.description || 'No description available.' }}
        </div>

        <div class="cpub-hero-meta">
          <span class="cpub-hero-meta-item"><i class="fa fa-calendar"></i> Jan 15 — Mar 31, 2026</span>
          <span class="cpub-hero-meta-sep">|</span>
          <span class="cpub-hero-meta-item"><i class="fa fa-users"></i> 847 participants</span>
          <span class="cpub-hero-meta-sep">|</span>
          <span class="cpub-hero-meta-item"><i class="fa fa-folder-open"></i> {{ c?.entryCount || entries.length }} entries</span>
          <span class="cpub-hero-meta-sep">|</span>
          <span class="cpub-hero-meta-item" style="color:var(--yellow);"><i class="fa fa-trophy"></i> $8,500 total prizes</span>
        </div>

        <!-- COUNTDOWN -->
        <div class="cpub-countdown-section">
          <div class="cpub-countdown-label"><i class="fa fa-clock" style="margin-right:4px;color:var(--accent);"></i>Judging period ends in</div>
          <div class="cpub-countdown-row">
            <div class="cpub-countdown-block">
              <div class="cpub-countdown-val">{{ countdown.days }}</div>
              <div class="cpub-countdown-unit">Days</div>
            </div>
            <div class="cpub-countdown-sep">:</div>
            <div class="cpub-countdown-block">
              <div class="cpub-countdown-val">{{ countdown.hours }}</div>
              <div class="cpub-countdown-unit">Hours</div>
            </div>
            <div class="cpub-countdown-sep">:</div>
            <div class="cpub-countdown-block">
              <div class="cpub-countdown-val">{{ countdown.mins }}</div>
              <div class="cpub-countdown-unit">Minutes</div>
            </div>
            <div class="cpub-countdown-sep">:</div>
            <div class="cpub-countdown-block">
              <div class="cpub-countdown-val">{{ countdown.secs }}</div>
              <div class="cpub-countdown-unit">Seconds</div>
            </div>
          </div>
        </div>

        <div class="cpub-hero-cta">
          <button class="cpub-btn cpub-btn-primary cpub-btn-lg"><i class="fa fa-upload"></i> Submit Entry</button>
          <button class="cpub-btn cpub-btn-lg cpub-btn-dark"><i class="fa fa-file-lines"></i> View Rules</button>
          <button class="cpub-btn cpub-btn-sm cpub-btn-dark" style="margin-left:4px;"><i class="fa fa-bell"></i> Notify Me</button>
          <div class="cpub-total-prize"><strong>$8,500</strong> in prizes</div>
        </div>

        <div class="cpub-hero-stats">
          <div class="cpub-hero-stat">
            <div class="cpub-hero-stat-val">847</div>
            <div class="cpub-hero-stat-label">Participants</div>
          </div>
          <div class="cpub-hero-stat">
            <div class="cpub-hero-stat-val">134</div>
            <div class="cpub-hero-stat-label">Entries</div>
          </div>
          <div class="cpub-hero-stat">
            <div class="cpub-hero-stat-val">6</div>
            <div class="cpub-hero-stat-label">Judges</div>
          </div>
          <div class="cpub-hero-stat">
            <div class="cpub-hero-stat-val">8</div>
            <div class="cpub-hero-stat-label">Sponsors</div>
          </div>
          <div class="cpub-hero-stat">
            <div class="cpub-hero-stat-val" style="color:var(--yellow);">$8.5k</div>
            <div class="cpub-hero-stat-label">Prize Pool</div>
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="cpub-contest-main">
      <div class="cpub-contest-layout">

        <!-- MAIN COLUMN -->
        <div>

          <!-- ABOUT -->
          <div style="margin-bottom:20px;">
            <div class="cpub-sec-head">
              <h2><i class="fa fa-circle-info" style="color:var(--accent);margin-right:6px;"></i>About This Contest</h2>
            </div>
            <div class="cpub-about-card">
              <div class="cpub-about-body">
                <p>The Edge AI Challenge 2026 is CommonPub's flagship hardware competition — a showcase for builders, researchers, and tinkerers who believe that powerful AI doesn't need to live in the cloud. This year's theme is <strong style="color:var(--text);">Real-World Deployability</strong>: we want to see projects that run on physical hardware, solve a problem someone actually has, and could plausibly be shipped as a product.</p>
                <p>Entries are judged across four dimensions: <strong style="color:var(--text);">Technical Innovation</strong> (how clever or novel is the approach?), <strong style="color:var(--text);">Real-World Impact</strong> (does it solve a genuine problem?), <strong style="color:var(--text);">Documentation Quality</strong> (could someone reproduce it?), and <strong style="color:var(--text);">Hardware Efficiency</strong> (does it make good use of the target platform's constraints?).</p>
                <div class="cpub-highlight-box">
                  <strong>Submission deadline has passed.</strong> The contest is now in the <strong>Review Period</strong> — all 134 entries are under community review and public voting. Judging begins March 20. Winners announced April 3, 2026.
                </div>
                <p>Eligible hardware includes any microcontroller, FPGA, custom ASIC, embedded SoC, or edge accelerator. Software inference on a laptop or cloud instance is not eligible. Projects must include hardware build instructions, source code, and a working demonstration video.</p>
              </div>
            </div>
          </div>

          <!-- PRIZES -->
          <div style="margin-bottom:20px;">
            <div class="cpub-sec-head">
              <h2><i class="fa fa-trophy" style="color:var(--yellow);margin-right:6px;"></i>Prizes</h2>
              <span class="cpub-sec-sub">Total pool: $8,500</span>
            </div>
            <div class="cpub-prize-grid">
              <!-- 1st -->
              <div class="cpub-prize-card cpub-prize-gold">
                <div class="cpub-prize-rank cpub-prize-rank-gold">1st Place</div>
                <div class="cpub-prize-icon cpub-prize-icon-gold"><i class="fa-solid fa-trophy"></i></div>
                <div class="cpub-prize-amount cpub-prize-amount-gold">$5,000</div>
                <div class="cpub-prize-label">Cash Prize</div>
                <div class="cpub-prize-perks">
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> $5,000 USD wire transfer</div>
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> Arm DevBoard kit ($800 value)</div>
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> Feature on CommonPub homepage</div>
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> Arm Research internship interview</div>
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> 1-year CommonPub Pro</div>
                </div>
              </div>
              <!-- 2nd -->
              <div class="cpub-prize-card cpub-prize-silver">
                <div class="cpub-prize-rank cpub-prize-rank-silver">2nd Place</div>
                <div class="cpub-prize-icon cpub-prize-icon-silver"><i class="fa-solid fa-medal"></i></div>
                <div class="cpub-prize-amount cpub-prize-amount-silver">$2,500</div>
                <div class="cpub-prize-label">Cash Prize</div>
                <div class="cpub-prize-perks">
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> $2,500 USD wire transfer</div>
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> Raspberry Pi CM4 dev kit</div>
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> Profile featured in newsletter</div>
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> 1-year CommonPub Pro</div>
                </div>
              </div>
              <!-- 3rd -->
              <div class="cpub-prize-card cpub-prize-bronze">
                <div class="cpub-prize-rank cpub-prize-rank-bronze">3rd Place</div>
                <div class="cpub-prize-icon cpub-prize-icon-bronze"><i class="fa-solid fa-award"></i></div>
                <div class="cpub-prize-amount cpub-prize-amount-bronze">$1,000</div>
                <div class="cpub-prize-label">Cash Prize</div>
                <div class="cpub-prize-perks">
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> $1,000 USD wire transfer</div>
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> Arduino Pro hardware bundle</div>
                  <div class="cpub-prize-perk"><i class="fa fa-check"></i> 6-month CommonPub Pro</div>
                </div>
              </div>
            </div>
            <!-- Additional prizes -->
            <div class="cpub-prize-additional">
              <div class="cpub-prize-extra">
                <div class="cpub-prize-extra-title"><i class="fa-solid fa-square-poll-vertical" style="margin-right:4px;color:var(--teal);"></i>People's Choice</div>
                <div class="cpub-prize-extra-val">$500</div>
                <div class="cpub-prize-extra-label">Highest community votes</div>
              </div>
              <div class="cpub-prize-extra">
                <div class="cpub-prize-extra-title"><i class="fa-solid fa-sparkles" style="margin-right:4px;color:var(--accent);"></i>Best First Entry</div>
                <div class="cpub-prize-extra-val">$300</div>
                <div class="cpub-prize-extra-label">First-time participant</div>
              </div>
              <div class="cpub-prize-extra">
                <div class="cpub-prize-extra-title"><i class="fa-solid fa-globe" style="margin-right:4px;color:var(--green);"></i>Africa Region</div>
                <div class="cpub-prize-extra-val">$200</div>
                <div class="cpub-prize-extra-label">Top Africa entry</div>
              </div>
              <div class="cpub-prize-extra">
                <div class="cpub-prize-extra-title"><i class="fa-solid fa-graduation-cap" style="margin-right:4px;color:var(--purple);"></i>Student Category</div>
                <div class="cpub-prize-extra-val">$200</div>
                <div class="cpub-prize-extra-label">Top student submission</div>
              </div>
            </div>
          </div>

          <!-- RULES -->
          <div style="margin-bottom:20px;">
            <div class="cpub-sec-head">
              <h2><i class="fa fa-file-lines" style="color:var(--purple);margin-right:6px;"></i>Rules &amp; Eligibility</h2>
            </div>
            <div class="cpub-rules-card">
              <div class="cpub-rule-item">
                <i class="cpub-rule-icon fa fa-microchip"></i>
                <span><strong style="color:var(--text);">Hardware required.</strong> All inference must run on physical edge hardware. CPU or GPU inference on a laptop, desktop, or cloud VM is not eligible. FPGA simulation counts if a physical FPGA is also demonstrated.</span>
              </div>
              <div class="cpub-rule-item">
                <i class="cpub-rule-icon fa fa-user"></i>
                <span><strong style="color:var(--text);">Open to individuals and teams.</strong> Teams of up to 4 people are allowed. All team members must have CommonPub accounts. Prize money is distributed to the team lead and split at their discretion.</span>
              </div>
              <div class="cpub-rule-item">
                <i class="cpub-rule-icon fa fa-code-branch"></i>
                <span><strong style="color:var(--text);">Open source preferred.</strong> Entries with a public GitHub repository or equivalent receive a 5-point scoring bonus. Entries with proprietary code must submit a binary demo and a complete methodology writeup.</span>
              </div>
              <div class="cpub-rule-item">
                <i class="cpub-rule-icon fa fa-video"></i>
                <span><strong style="color:var(--text);">Demo video required.</strong> Entries must include a 2–5 minute video showing the hardware running in real time. Videos must be publicly accessible on YouTube, Vimeo, or similar. Screen recordings are not accepted.</span>
              </div>
              <div class="cpub-rule-item">
                <i class="cpub-rule-icon fa fa-calendar-xmark"></i>
                <span><strong style="color:var(--text);">Submission deadline was March 15, 2026 at 23:59 UTC.</strong> Late submissions are not accepted. Projects must have been created or substantially updated after January 1, 2026.</span>
              </div>
              <div class="cpub-rule-item">
                <i class="cpub-rule-icon fa fa-globe"></i>
                <span><strong style="color:var(--text);">Global eligibility.</strong> Open to participants worldwide. Cash prizes are delivered via wire transfer or Wise. Participants in sanctioned jurisdictions may receive equivalent hardware prizes instead.</span>
              </div>
              <div class="cpub-rule-item">
                <i class="cpub-rule-icon fa fa-award"></i>
                <span><strong style="color:var(--text);">One entry per team.</strong> Teams may not submit multiple entries. Judges' decisions are final. Winners will be contacted by email within 72 hours of announcement.</span>
              </div>
            </div>
          </div>

          <!-- ENTRIES -->
          <div style="margin-bottom:20px;">
            <div class="cpub-sec-head">
              <h2><i class="fa fa-box-open" style="color:var(--teal);margin-right:6px;"></i>Submitted Entries</h2>
              <span class="cpub-sec-sub">{{ c?.entryCount || entries.length }} entries · Voting open</span>
            </div>
            <div class="cpub-entries-filter">
              <span
                v-for="f in filters"
                :key="f"
                class="cpub-tag"
                :class="{ 'cpub-tag-accent': f === filters[0] }"
              >{{ f }}</span>
            </div>
            <div class="cpub-entry-grid">
              <div
                v-for="(entry, i) in entries"
                :key="entry.id"
                class="cpub-entry-card"
              >
                <div class="cpub-entry-thumb" :class="i % 2 === 0 ? 'cpub-entry-bg-light' : 'cpub-entry-bg-dark'">
                  <div class="cpub-entry-grid-pat"></div>
                  <div v-if="entry.iconColor" class="cpub-entry-icon" :style="{ color: entry.iconColor }"><i :class="entry.iconClass"></i></div>
                  <div
                    v-if="entry.rank"
                    class="cpub-entry-rank"
                    :class="`cpub-rank-${entry.rank}`"
                  >#{{ entry.rank }} VOTED</div>
                </div>
                <div class="cpub-entry-body">
                  <div class="cpub-entry-title">{{ entry.title || 'Untitled Entry' }}</div>
                  <div class="cpub-entry-author">
                    <span v-if="entry.initials" class="cpub-av cpub-av-sm" :style="{ background: entry.avBg, color: entry.avColor }">{{ entry.initials }}</span>
                    {{ entry.author || 'Anonymous' }} · <span v-if="entry.tag" class="cpub-tag" :class="entry.tagClass" style="font-size:9px;">{{ entry.tag }}</span>
                  </div>
                  <div class="cpub-entry-footer">
                    <button
                      class="cpub-vote-btn"
                      :class="{ 'cpub-voted': votedEntries.has(entry.id) }"
                      @click="toggleVote(entry.id)"
                    ><i class="fa fa-arrow-up"></i> {{ (entry.votes || 0) + (votedEntries.has(entry.id) ? 1 : 0) }}</button>
                    <button class="cpub-vote-btn"><i class="fa fa-comment"></i> {{ entry.comments || 0 }}</button>
                    <span class="cpub-entry-views"><i class="fa fa-eye"></i> {{ entry.views || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div style="text-align:center;">
              <button class="cpub-btn"><i class="fa fa-arrow-down"></i> Load 128 more entries</button>
            </div>
          </div>

          <!-- JUDGES -->
          <div>
            <div class="cpub-sec-head">
              <h2><i class="fa fa-gavel" style="color:var(--purple);margin-right:6px;"></i>Judges</h2>
              <span class="cpub-sec-sub">6 expert judges</span>
            </div>
            <div class="cpub-judges-grid">
              <div v-for="j in judges" :key="j.initials" class="cpub-judge-card">
                <div class="cpub-judge-av" :style="{ background: j.bg, color: j.color, borderColor: j.color }">{{ j.initials }}</div>
                <div class="cpub-judge-name">{{ j.name }}</div>
                <div class="cpub-judge-title">{{ j.title }}</div>
                <div class="cpub-judge-org">{{ j.org }}</div>
              </div>
            </div>
          </div>

        </div>

        <!-- SIDEBAR -->
        <div>

          <!-- TIMELINE -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title"><i class="fa-solid fa-calendar-days" style="margin-right:5px;"></i>Contest Timeline</div>
            <div
              v-for="(t, i) in timeline"
              :key="i"
              class="cpub-tl-item"
              :class="{ 'cpub-tl-last': i === timeline.length - 1 }"
            >
              <div class="cpub-tl-icon" :class="`cpub-tl-${t.status}`"><i :class="t.icon"></i></div>
              <div class="cpub-tl-info">
                <div class="cpub-tl-name" :class="`cpub-tl-name-${t.status}`">
                  {{ t.name }}
                  <span v-if="t.badge" class="cpub-tl-status" :class="`cpub-status-${t.status}`">{{ t.badge }}</span>
                </div>
                <div class="cpub-tl-date">{{ t.date }}</div>
              </div>
            </div>
          </div>

          <!-- SPONSORS -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title"><i class="fa-solid fa-handshake" style="margin-right:5px;"></i>Sponsors</div>
            <div class="cpub-sponsor-grid">
              <div v-for="s in sponsors" :key="s.name" class="cpub-sponsor-card">
                <div class="cpub-sponsor-icon"><i :class="s.icon" :style="{ color: s.color }"></i></div>
                <div class="cpub-sponsor-name">{{ s.name }}</div>
                <div class="cpub-sponsor-tier">{{ s.tier }}</div>
              </div>
            </div>
            <div style="margin-top:10px;text-align:center;">
              <a href="#" class="cpub-sponsor-link">Become a sponsor <i class="fa fa-arrow-right" style="font-size:9px;"></i></a>
            </div>
          </div>

          <!-- FAQ -->
          <div class="cpub-sb-card cpub-faq-wrap">
            <div class="cpub-sb-title" style="padding:16px 12px 8px;border-bottom:none;margin-bottom:0;"><i class="fa-solid fa-circle-question" style="margin-right:5px;"></i>FAQ</div>
            <div
              v-for="(f, i) in faqs"
              :key="i"
              class="cpub-faq-item"
              :class="{ 'cpub-faq-open': openFaq === i }"
            >
              <div class="cpub-faq-q" @click="toggleFaq(i)">
                {{ f.q }} <i class="fa fa-chevron-down"></i>
              </div>
              <div class="cpub-faq-a">{{ f.a }}</div>
            </div>
          </div>

          <!-- SHARE -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title"><i class="fa-solid fa-share-nodes" style="margin-right:5px;"></i>Share This Contest</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="cpub-btn cpub-btn-sm" style="flex:1;justify-content:center;"><i class="fa-brands fa-x-twitter"></i> Twitter</button>
              <button class="cpub-btn cpub-btn-sm" style="flex:1;justify-content:center;"><i class="fa-brands fa-linkedin"></i> LinkedIn</button>
              <button class="cpub-btn cpub-btn-sm" style="flex:1;justify-content:center;"><i class="fa fa-link"></i> Copy Link</button>
            </div>
          </div>

        </div>

      </div>
    </div>

  </div>
</template>

<style scoped>
/* Hero uses a dark context — local custom properties for dark-bg values */
.cpub-hero {
  --hero-bg: var(--text);
  --hero-text: var(--color-text-inverse);
  --hero-text-dim: var(--text-faint);
  --hero-border: rgba(255, 255, 255, 0.15);
  --hero-surface: rgba(255, 255, 255, 0.06);
}

/* Metallic prize colors — no token equivalents */
.cpub-contest {
  --silver: var(--text-faint);
  --bronze: #a0724a;
}

/* HERO */
.cpub-hero { position: relative; overflow: hidden; background: var(--hero-bg); padding: 56px 0 48px; }
.cpub-hero-pattern { position: absolute; inset: 0; }
.cpub-hero-dots { position: absolute; inset: 0; background-image: radial-gradient(var(--accent-border) 1.5px, transparent 1.5px); background-size: 28px 28px; opacity: .3; }
.cpub-hero-lines { position: absolute; inset: 0; background-image: linear-gradient(var(--accent-bg) 1px, transparent 1px), linear-gradient(90deg, var(--accent-bg) 1px, transparent 1px); background-size: 56px 56px; }
.cpub-hero-inner { max-width: 1100px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 1; }
.cpub-hero-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.cpub-contest-badge { font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; font-family: var(--font-mono); color: var(--accent); background: var(--accent-bg); border: 2px solid var(--accent); padding: 3px 10px; border-radius: var(--radius); }
.cpub-hero-host { font-size: 11px; color: var(--hero-text-dim); font-family: var(--font-mono); display: flex; align-items: center; gap: 6px; }
.cpub-hero-title { font-size: 36px; font-weight: 800; letter-spacing: -.03em; line-height: 1.1; margin-bottom: 10px; color: var(--hero-text); }
.cpub-hero-highlight { color: var(--accent); }
.cpub-hero-tagline { font-size: 14px; color: var(--hero-text-dim); line-height: 1.55; max-width: 580px; margin-bottom: 28px; }
.cpub-hero-meta { display: flex; align-items: center; gap: 20px; font-size: 11px; color: var(--hero-text-dim); font-family: var(--font-mono); margin-bottom: 28px; }
.cpub-hero-meta-item { display: flex; align-items: center; gap: 5px; }
.cpub-hero-meta-sep { color: var(--hero-border); }

/* COUNTDOWN */
.cpub-countdown-section { margin-bottom: 28px; }
.cpub-countdown-label { font-size: 10px; font-family: var(--font-mono); color: var(--hero-text-dim); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 10px; }
.cpub-countdown-row { display: flex; align-items: center; gap: 8px; }
.cpub-countdown-block { display: flex; flex-direction: column; align-items: center; background: var(--hero-surface); border: 2px solid var(--hero-border); border-radius: var(--radius); padding: 10px 16px; min-width: 60px; box-shadow: 4px 4px 0 var(--hero-surface); }
.cpub-countdown-val { font-size: 26px; font-weight: 700; font-family: var(--font-mono); color: var(--hero-text); line-height: 1; margin-bottom: 4px; }
.cpub-countdown-unit { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: var(--hero-text-dim); font-family: var(--font-mono); }
.cpub-countdown-sep { font-size: 20px; font-weight: 700; color: var(--hero-border); margin-top: -8px; font-family: var(--font-mono); }

/* HERO CTA & STATS */
.cpub-hero-cta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cpub-total-prize { font-size: 12px; color: var(--hero-text-dim); font-family: var(--font-mono); display: flex; align-items: center; gap: 6px; padding-left: 10px; border-left: 2px solid var(--hero-border); }
.cpub-total-prize strong { color: var(--yellow); font-size: 15px; }
.cpub-hero-stats { display: flex; gap: 24px; margin-top: 28px; padding-top: 24px; border-top: 2px solid var(--hero-border); }
.cpub-hero-stat { display: flex; flex-direction: column; }
.cpub-hero-stat-val { font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--hero-text); }
.cpub-hero-stat-label { font-size: 10px; color: var(--hero-text-dim); text-transform: uppercase; letter-spacing: .1em; font-family: var(--font-mono); }

/* BUTTONS */
.cpub-btn { font-family: var(--font-sans); font-size: 12px; padding: 6px 14px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap; }
.cpub-btn:hover { background: var(--surface2); }
.cpub-btn-primary { background: var(--accent); border-color: var(--border); color: var(--color-text-inverse); box-shadow: 4px 4px 0 var(--border); }
.cpub-btn-primary:hover { background: var(--color-primary-hover); }
.cpub-btn-lg { padding: 10px 22px; font-size: 13px; }
.cpub-btn-sm { padding: 4px 10px; font-size: 11px; }
.cpub-btn-dark { background: var(--hero-surface); color: var(--hero-text); border-color: var(--hero-border); }
.cpub-btn-dark:hover { background: var(--hero-surface); }

/* AVATARS */
.cpub-av { display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 600; font-family: var(--font-mono); flex-shrink: 0; background: var(--surface3); border: 2px solid var(--border); color: var(--text-dim); }
.cpub-av-sm { width: 24px; height: 24px; font-size: 9px; }

/* TAGS */
.cpub-tag { display: inline-flex; align-items: center; font-size: 10px; font-family: var(--font-mono); padding: 2px 8px; border-radius: var(--radius); border: 1px solid var(--border2); color: var(--text-dim); background: var(--surface2); }
.cpub-tag-accent { border-color: var(--accent-border); color: var(--accent); background: var(--accent-bg); }
.cpub-tag-purple { border-color: var(--purple-border); color: var(--purple); background: var(--purple-bg); }
.cpub-tag-teal { border-color: var(--teal-border); color: var(--teal); background: var(--teal-bg); }
.cpub-tag-yellow { border-color: var(--yellow-border); color: var(--yellow); background: var(--yellow-bg); }

/* LAYOUT */
.cpub-contest-main { max-width: 1100px; margin: 0 auto; padding: 32px; }
.cpub-contest-layout { display: grid; grid-template-columns: 1fr 300px; gap: 28px; align-items: start; }

/* SECTION HEADERS */
.cpub-sec-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid var(--border); }
.cpub-sec-head h2 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .09em; font-family: var(--font-mono); color: var(--text); }
.cpub-sec-sub { font-size: 11px; color: var(--text-faint); margin-left: auto; font-family: var(--font-mono); }

/* ABOUT */
.cpub-about-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; box-shadow: 4px 4px 0 var(--border); }
.cpub-about-body { font-size: 12px; color: var(--text-dim); line-height: 1.7; }
.cpub-about-body p { margin-bottom: 10px; }
.cpub-about-body p:last-child { margin-bottom: 0; }
.cpub-highlight-box { background: var(--accent-bg); border: 2px solid var(--accent); border-radius: var(--radius); padding: 12px 14px; margin: 12px 0; font-size: 11px; color: var(--text-dim); }
.cpub-highlight-box strong { color: var(--accent); }

/* PRIZES */
.cpub-prize-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.cpub-prize-card { border-radius: var(--radius); padding: 20px; position: relative; overflow: hidden; text-align: center; background: var(--surface); border: 2px solid var(--border); }
.cpub-prize-gold { box-shadow: 4px 4px 0 var(--accent); }
.cpub-prize-silver { box-shadow: 4px 4px 0 var(--border); }
.cpub-prize-bronze { box-shadow: 4px 4px 0 var(--border); }
.cpub-prize-rank { font-size: 11px; font-family: var(--font-mono); font-weight: 600; letter-spacing: .08em; margin-bottom: 8px; position: relative; z-index: 1; }
.cpub-prize-rank-gold { color: var(--yellow); }
.cpub-prize-rank-silver { color: var(--silver); }
.cpub-prize-rank-bronze { color: var(--bronze); }
.cpub-prize-icon { font-size: 28px; margin-bottom: 8px; position: relative; z-index: 1; }
.cpub-prize-icon-gold { color: var(--yellow); }
.cpub-prize-icon-silver { color: var(--silver); }
.cpub-prize-icon-bronze { color: var(--bronze); }
.cpub-prize-amount { font-size: 24px; font-weight: 800; font-family: var(--font-mono); margin-bottom: 4px; position: relative; z-index: 1; }
.cpub-prize-amount-gold { color: var(--yellow); }
.cpub-prize-amount-silver { color: var(--silver); }
.cpub-prize-amount-bronze { color: var(--bronze); }
.cpub-prize-label { font-size: 10px; color: var(--text-faint); margin-bottom: 10px; font-family: var(--font-mono); position: relative; z-index: 1; }
.cpub-prize-perks { text-align: left; position: relative; z-index: 1; }
.cpub-prize-perk { font-size: 10px; color: var(--text-dim); display: flex; align-items: center; gap: 5px; margin-bottom: 3px; font-family: var(--font-mono); }
.cpub-prize-perk i { font-size: 8px; color: var(--green); }
.cpub-prize-additional { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.cpub-prize-extra { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 12px; text-align: center; box-shadow: 4px 4px 0 var(--border); }
.cpub-prize-extra-title { font-size: 11px; font-weight: 600; margin-bottom: 2px; }
.cpub-prize-extra-val { font-size: 14px; font-weight: 700; font-family: var(--font-mono); color: var(--teal); }
.cpub-prize-extra-label { font-size: 9px; color: var(--text-faint); font-family: var(--font-mono); }

/* RULES */
.cpub-rules-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; box-shadow: 4px 4px 0 var(--border); }
.cpub-rule-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 12px; color: var(--text-dim); line-height: 1.55; }
.cpub-rule-item:last-child { margin-bottom: 0; }
.cpub-rule-icon { font-size: 11px; color: var(--accent); margin-top: 2px; flex-shrink: 0; width: 14px; }

/* ENTRIES */
.cpub-entries-filter { display: flex; gap: 6px; margin-bottom: 14px; }
.cpub-entry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.cpub-entry-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); overflow: hidden; cursor: pointer; box-shadow: 4px 4px 0 var(--border); }
.cpub-entry-card:hover { box-shadow: 4px 4px 0 var(--accent); }
.cpub-entry-thumb { height: 110px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.cpub-entry-bg-light { background: var(--surface2); }
.cpub-entry-bg-dark { background: var(--surface3); }
.cpub-entry-grid-pat { position: absolute; inset: 0; background-image: linear-gradient(var(--border2) 1px, transparent 1px), linear-gradient(90deg, var(--border2) 1px, transparent 1px); background-size: 20px 20px; opacity: .3; }
.cpub-entry-icon { position: relative; z-index: 1; font-size: 22px; opacity: .65; }
.cpub-entry-rank { position: absolute; top: 8px; left: 8px; z-index: 2; font-size: 10px; font-family: var(--font-mono); font-weight: 700; padding: 2px 7px; border-radius: var(--radius); }
.cpub-rank-1 { background: var(--yellow-bg); color: var(--yellow); border: 2px solid var(--yellow); }
.cpub-rank-2 { background: var(--surface2); color: var(--silver); border: 2px solid var(--silver); }
.cpub-rank-3 { background: var(--surface2); color: var(--bronze); border: 2px solid var(--bronze); }
.cpub-entry-body { padding: 10px 12px; }
.cpub-entry-title { font-size: 12px; font-weight: 600; margin-bottom: 3px; line-height: 1.3; }
.cpub-entry-author { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }
.cpub-entry-footer { display: flex; align-items: center; gap: 6px; }
.cpub-vote-btn { display: flex; align-items: center; gap: 4px; font-size: 10px; font-family: var(--font-mono); padding: 3px 8px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; }
.cpub-vote-btn:hover { background: var(--surface2); }
.cpub-vote-btn i { font-size: 9px; }
.cpub-voted { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
.cpub-entry-views { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); margin-left: auto; display: flex; align-items: center; gap: 3px; }

/* JUDGES */
.cpub-judges-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
.cpub-judge-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 14px; text-align: center; box-shadow: 4px 4px 0 var(--border); }
.cpub-judge-av { width: 44px; height: 44px; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; font-family: var(--font-mono); border: 2px solid var(--border); }
.cpub-judge-name { font-size: 11px; font-weight: 600; margin-bottom: 2px; }
.cpub-judge-title { font-size: 10px; color: var(--text-dim); line-height: 1.35; font-family: var(--font-mono); }
.cpub-judge-org { font-size: 10px; color: var(--accent); font-family: var(--font-mono); margin-top: 2px; }

/* SIDEBAR CARDS */
.cpub-sb-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; box-shadow: 4px 4px 0 var(--border); }
.cpub-sb-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; color: var(--text); font-family: var(--font-mono); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--border); }

/* TIMELINE */
.cpub-tl-item { display: flex; gap: 12px; margin-bottom: 14px; position: relative; }
.cpub-tl-item:not(.cpub-tl-last)::before { content: ''; position: absolute; left: 10px; top: 20px; bottom: -14px; width: 2px; background: var(--border); }
.cpub-tl-last { margin-bottom: 0; }
.cpub-tl-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 8px; margin-top: 1px; }
.cpub-tl-done { background: var(--green-bg); border: 2px solid var(--green); color: var(--green); }
.cpub-tl-active { background: var(--accent-bg); border: 2px solid var(--accent); color: var(--accent); }
.cpub-tl-upcoming { background: var(--surface2); border: 2px solid var(--border2); color: var(--text-faint); }
.cpub-tl-info { flex: 1; padding-top: 1px; }
.cpub-tl-name { font-size: 11px; font-weight: 600; margin-bottom: 1px; }
.cpub-tl-name-done { color: var(--green); }
.cpub-tl-name-active { color: var(--text); }
.cpub-tl-name-upcoming { color: var(--text-faint); }
.cpub-tl-date { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-tl-status { font-size: 9px; font-family: var(--font-mono); padding: 1px 5px; border-radius: var(--radius); }
.cpub-status-done { color: var(--green); background: var(--green-bg); border: 1px solid var(--green); }
.cpub-status-active { color: var(--accent); background: var(--accent-bg); border: 1px solid var(--accent); }

/* SPONSORS */
.cpub-sponsor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cpub-sponsor-card { background: var(--surface2); border: 2px solid var(--border); border-radius: var(--radius); padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.cpub-sponsor-icon { font-size: 16px; margin-bottom: 2px; color: var(--text-dim); }
.cpub-sponsor-name { font-size: 10px; font-weight: 600; font-family: var(--font-mono); color: var(--text); }
.cpub-sponsor-tier { font-size: 8px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-sponsor-link { font-size: 11px; color: var(--accent); text-decoration: none; font-family: var(--font-mono); }
.cpub-sponsor-link:hover { text-decoration: underline; }

/* FAQ */
.cpub-faq-wrap { box-shadow: none; padding: 0; border: none; background: transparent; }
.cpub-faq-item { border: 2px solid var(--border); margin-bottom: -2px; overflow: hidden; }
.cpub-faq-item:first-of-type { border-top: 2px solid var(--border); }
.cpub-faq-q { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; cursor: pointer; font-size: 11px; font-weight: 500; gap: 8px; background: var(--surface); }
.cpub-faq-q:hover { background: var(--surface2); color: var(--accent); }
.cpub-faq-q i { font-size: 10px; color: var(--text-faint); flex-shrink: 0; transition: transform .15s; }
.cpub-faq-open .cpub-faq-q i { transform: rotate(180deg); }
.cpub-faq-open .cpub-faq-q { background: var(--surface2); border-bottom: 1px solid var(--border2); }
.cpub-faq-a { font-size: 11px; color: var(--text-dim); line-height: 1.55; padding: 10px 12px; display: none; background: var(--surface); }
.cpub-faq-open .cpub-faq-a { display: block; }
</style>
