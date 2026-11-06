<script setup lang="ts">
import { useUsers } from '~/modules/users/composables/useUsers';

const { data: users } = await useUsers();
</script>

<template>
  <main>
    <h1>imp-service</h1>
    <ul>
      <li v-for="u in users" :key="u.id">{{ u.name }} ({{ u.email }})</li>
    </ul>
  </main>
</template>
