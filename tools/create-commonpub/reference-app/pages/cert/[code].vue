<script setup lang="ts">
const route = useRoute();
const code = route.params.code as string;

const { data: certData } = useLazyFetch(`/api/cert/${code}`);

useSeoMeta({
  title: () => certData.value ? `Certificate — ${certData.value.path.title} — CommonPub` : 'Certificate — CommonPub',
  description: () => certData.value ? `Certificate of completion for ${certData.value.path.title}` : '',
});
</script>

<template>
  <div class="cert-page">
    <div v-if="certData" class="cert-card">
      <!-- Certificate Badge -->
      <div class="cert-badge-wrap">
        <div class="cert-badge">
          <i class="fa-solid fa-award"></i>
        </div>
      </div>

      <div class="cert-eyebrow">Certificate of Completion</div>
      <h1 class="cert-title">{{ certData.path.title }}</h1>

      <div class="cert-recipient">
        <div class="cert-recipient-label">Awarded to</div>
        <NuxtLink :to="`/u/${certData.user.username}`" class="cert-recipient-name">
          {{ certData.user.displayName || certData.user.username }}
        </NuxtLink>
      </div>

      <div class="cert-details">
        <div class="cert-detail">
          <span class="cert-detail-label">Completed</span>
          <span class="cert-detail-value">
            {{ new Date(certData.certificate.issuedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }}
          </span>
        </div>
        <div class="cert-detail">
          <span class="cert-detail-label">Verification Code</span>
          <span class="cert-detail-value cert-code">{{ certData.certificate.verificationCode }}</span>
        </div>
      </div>

      <div class="cert-footer">
        <NuxtLink :to="`/learn/${certData.path.slug}`" class="cert-path-link">
          <i class="fa-solid fa-graduation-cap"></i> View Learning Path
        </NuxtLink>
      </div>

      <!-- Verified stamp -->
      <div class="cert-verified">
        <i class="fa-solid fa-circle-check"></i> Verified
      </div>
    </div>

    <div v-else class="cert-not-found">
      <div class="cert-not-found-icon"><i class="fa-solid fa-circle-xmark"></i></div>
      <h1>Certificate Not Found</h1>
      <p>The verification code could not be found. Please check the code and try again.</p>
    </div>
  </div>
</template>

<style scoped>
.cert-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 48px 24px;
}

.cert-card {
  border: 2px solid var(--border);
  background: var(--surface);
  padding: 40px;
  text-align: center;
  position: relative;
  box-shadow: var(--shadow-xl);
}

.cert-badge-wrap { margin-bottom: 20px; }

.cert-badge {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--yellow-bg);
  border: 3px solid var(--yellow);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: var(--yellow);
}

.cert-eyebrow {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: 12px;
}

.cert-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 24px;
  line-height: 1.2;
}

.cert-recipient { margin-bottom: 24px; padding: 16px 0; border-top: 2px solid var(--border); border-bottom: 2px solid var(--border); }
.cert-recipient-label { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
.cert-recipient-name { font-size: 20px; font-weight: 700; color: var(--accent); text-decoration: none; }
.cert-recipient-name:hover { text-decoration: underline; }

.cert-details { display: flex; gap: 24px; justify-content: center; margin-bottom: 24px; }
.cert-detail { display: flex; flex-direction: column; gap: 4px; }
.cert-detail-label { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.08em; }
.cert-detail-value { font-size: 13px; color: var(--text); }
.cert-code { font-family: var(--font-mono); font-weight: 600; color: var(--accent); background: var(--accent-bg); padding: 2px 8px; border: 2px solid var(--accent-border); }

.cert-footer { margin-top: 8px; }
.cert-path-link { font-size: 12px; color: var(--accent); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
.cert-path-link:hover { text-decoration: underline; }

.cert-verified {
  position: absolute;
  top: 16px;
  right: 16px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--green);
  display: flex;
  align-items: center;
  gap: 4px;
}

.cert-not-found { text-align: center; padding: 64px 0; color: var(--text-dim); }
.cert-not-found-icon { font-size: 40px; color: var(--red); margin-bottom: 16px; }
.cert-not-found h1 { font-size: 20px; margin-bottom: 8px; }
.cert-not-found p { font-size: 13px; }
</style>
