<script setup lang="ts">
import SigninForm from '../../modules/auth/components/SigninForm.vue';
definePageMeta({ ssr: true });
</script>

<template>
  <SigninForm portal="business" />
</template>
