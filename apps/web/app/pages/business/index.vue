<script setup lang="ts">
import { t } from '../../i18n';
import { BRAND_NAME } from '../../modules/auth/constants';
import { siteFooter } from '../../modules/site/footer';

/**
 * The business entry page: where people who run campaigns start. It is separate from the
 * participant sign-in and sign-up pages, which do not mention business accounts. Public and
 * static, so it carries no per-user data.
 */
useHead({ title: t('business.entry.title') });
const footer = siteFooter();
</script>

<template>
  <UiPublicShell
    :brand-name="BRAND_NAME"
    wide
    :footer-tagline="footer.tagline"
    :footer-columns="footer.columns"
    :copyright="footer.copyright"
  >
    <template #nav>
      <UiLink to="/discover">{{ t('nav.discover') }}</UiLink>
      <UiLink to="/business" aria-current="page">{{ t('nav.forBusinesses') }}</UiLink>
    </template>
    <template #actions>
      <UiButton to="/business/signin" variant="secondary">{{
        t('footer.business.signin')
      }}</UiButton>
      <UiButton to="/business/register">{{ t('footer.business.register') }}</UiButton>
    </template>

    <section class="entry" aria-labelledby="business-entry-title">
      <h1 id="business-entry-title" class="ui-text-h1">{{ t('business.entry.title') }}</h1>
      <p class="ui-text-body-l entry__lead">{{ t('business.entry.subtitle') }}</p>
      <div class="entry__actions">
        <UiButton to="/business/register">{{ t('footer.business.register') }}</UiButton>
        <UiButton to="/business/signin" variant="secondary">{{
          t('footer.business.signin')
        }}</UiButton>
      </div>
      <p class="ui-text-caption ui-text-hint">{{ t('business.entry.participantNote') }}</p>
    </section>

    <section class="tiles" :aria-label="t('business.entry.tiles')">
      <UiFeatureTile
        icon="rocket"
        :heading-level="2"
        :title="t('business.entry.tile.campaigns.title')"
        :description="t('business.entry.tile.campaigns.body')"
      />
      <UiFeatureTile
        icon="users"
        :heading-level="2"
        :title="t('business.entry.tile.team.title')"
        :description="t('business.entry.tile.team.body')"
      />
      <UiFeatureTile
        icon="shield-check"
        :heading-level="2"
        :title="t('business.entry.tile.trust.title')"
        :description="t('business.entry.tile.trust.body')"
      />
    </section>
  </UiPublicShell>
</template>

<style scoped>
.entry {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ui-space-4);
  padding-block: var(--ui-space-12) var(--ui-space-8);
  max-inline-size: 48rem;
}
.entry h1,
.entry p {
  margin: 0;
}
.entry__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-3);
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--ui-space-4);
  padding-block-end: var(--ui-space-12);
}
</style>
