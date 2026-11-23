<script setup lang="ts">
import { clearError, type NuxtError } from '#app';
import { computed, onMounted } from 'vue';
import { provideHomeRoute } from '@imp/ui/app/composables/useHomeRoute';
import { useAuth } from './modules/auth/composables/useAuth';
import { useHomeLink } from './modules/auth/composables/useHomeLink';

/**
 * Last-resort screen for unknown routes and unhandled errors. It sits outside <NuxtPage>, so it
 * provides the home route itself: a signed-in person goes back to their dashboard, a visitor to the
 * campaign list (there is no start page).
 */
const props = defineProps<{ error: NuxtError }>();
const home = useHomeLink();
provideHomeRoute(home);
const { ensure } = useAuth();
onMounted(() => ensure().catch(() => null));

const kind = computed(() => (props.error.statusCode === 404 ? 'notFound' : 'generic'));
const exit = () => clearError({ redirect: home.value ?? '/discover' });
// The dashboard link is a plain navigation, so drop the error once it lands.
useRouter().afterEach(() => clearError());
</script>

<template>
  <main class="error-page">
    <UiSystemState :kind="kind" @action="exit" />
  </main>
</template>

<style scoped>
.error-page {
  padding-block: var(--ui-space-10);
  padding-inline: var(--ui-space-4);
  max-inline-size: 40rem;
  margin-inline: auto;
}
</style>
