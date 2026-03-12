<script setup lang="ts">
definePageMeta({ layout: 'admin' });

useSeoMeta({ title: 'Users — Admin — CommonPub' });

const search = ref('');
const { data: users, refresh } = await useFetch('/api/admin/users', {
  query: computed(() => ({ search: search.value || undefined })),
});
</script>

<template>
  <div class="admin-users">
    <h1 class="admin-page-title">Users</h1>

    <input v-model="search" type="search" class="admin-search" placeholder="Search users..." aria-label="Search users" />

    <table class="admin-table" v-if="users?.length">
      <thead>
        <tr>
          <th>Username</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Joined</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>
            <NuxtLink :to="`/u/${u.username}`">{{ u.username }}</NuxtLink>
          </td>
          <td>{{ u.email }}</td>
          <td class="admin-role">{{ u.role }}</td>
          <td>{{ u.status }}</td>
          <td>{{ new Date(u.createdAt).toLocaleDateString() }}</td>
        </tr>
      </tbody>
    </table>
    <p class="admin-empty" v-else>No users found.</p>
  </div>
</template>

<style scoped>
.admin-page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-4);
}

.admin-search {
  width: 100%;
  max-width: 400px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  margin-bottom: var(--space-4);
}

.admin-search:focus {
  outline: none;
  border-color: var(--accent);
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.admin-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid var(--border);
  font-weight: var(--font-weight-semibold);
  color: var(--text-dim);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.admin-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
}

.admin-table a {
  color: var(--accent);
  text-decoration: none;
}

.admin-table a:hover {
  text-decoration: underline;
}

.admin-role {
  text-transform: capitalize;
}

.admin-empty {
  color: var(--text-faint);
  text-align: center;
  padding: var(--space-8) 0;
}
</style>
