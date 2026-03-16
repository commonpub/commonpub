<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const prefs = ref({
  emailLikes: true,
  emailComments: true,
  emailFollows: true,
  emailMentions: true,
  emailDigest: false,
});
</script>

<template>
  <div>
    <h2 class="cpub-section-title-lg">Notification Preferences</h2>

    <div v-for="(val, key) in prefs" :key="key" style="margin-bottom: 12px">
      <label class="cpub-checkbox">
        <input type="checkbox" v-model="prefs[key]" />
        {{ key.replace(/^email/, 'Email on ').replace(/([A-Z])/g, ' $1').toLowerCase() }}
      </label>
    </div>

    <button class="cpub-btn cpub-btn-primary cpub-btn-sm" style="margin-top: 16px">
      Save Preferences
    </button>
  </div>
</template>
