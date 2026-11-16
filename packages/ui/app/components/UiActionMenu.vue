<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue';
import type { IconName } from '../icons';
import { nextEnabled } from '../utils/menu';
import UiButton from './UiButton.vue';
import UiIcon from './UiIcon.vue';
import UiLink from './UiLink.vue';

export type ActionItem = {
  id: string;
  label: string;
  icon?: IconName;
  /** A route or URL: the item is a link. Without it the item is an action and reports `select`. */
  to?: string;
  /** `danger` is for an action that deletes or cannot be undone. */
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** A rule above this item, to set apart a destructive action. */
  separatorBefore?: boolean;
};

/**
 * One "more actions" menu for a row of a table or a card, so every list offers its actions the same way.
 * A button with a text name (what the actions are for) opens a menu of links and actions. The menu is
 * drawn in the top layer and positioned from the button, so a table's scroll area never clips it, and it
 * opens upward when there is no room below. Keyboard: Enter, Space or the arrow keys open it; arrows,
 * Home and End move; Enter chooses; Escape closes and returns to the button. A click elsewhere, a scroll
 * or a resize closes it.
 */
defineProps<{
  items: ActionItem[];
  /** What the actions are for, as the button's text name ("Actions for Black Friday Quiz"). */
  label: string;
}>();
const emit = defineEmits<{ select: [id: string] }>();

const menuId = useId();
const open = ref(false);
const panel = ref<HTMLElement | null>(null);
let anchor: HTMLElement | null = null;
const supportsPopover =
  typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

const options = () =>
  Array.from(panel.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
const enabled = () => options().map((el) => el.getAttribute('aria-disabled') !== 'true');

function focusAt(i: number) {
  options()[i]?.focus();
}
function place() {
  const el = panel.value;
  if (!el || !anchor) return;
  const r = anchor.getBoundingClientRect();
  const h = el.offsetHeight;
  const below = r.bottom + 4 + h <= window.innerHeight || r.top < h + 8;
  el.style.insetBlockStart = below ? `${r.bottom + 4}px` : `${r.top - 4 - h}px`;
  el.style.insetInlineEnd = `${Math.max(8, document.documentElement.clientWidth - r.right)}px`;
  el.style.insetInlineStart = 'auto';
  el.style.insetBlockEnd = 'auto';
}

function onOutside(e: Event) {
  const t = e.target as Node;
  if (!panel.value?.contains(t) && !anchor?.contains(t)) close(false);
}
const onViewport = () => close(false);

async function show(focus: 'first' | 'last' | null) {
  open.value = true;
  await nextTick();
  if (supportsPopover) panel.value?.showPopover();
  place();
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('scroll', onViewport, true);
  window.addEventListener('resize', onViewport);
  if (focus) focusAt(nextEnabled(enabled(), -1, focus));
}
function close(returnFocus: boolean) {
  if (!open.value) return;
  open.value = false;
  if (supportsPopover && panel.value?.matches(':popover-open')) panel.value.hidePopover();
  document.removeEventListener('pointerdown', onOutside, true);
  window.removeEventListener('scroll', onViewport, true);
  window.removeEventListener('resize', onViewport);
  if (returnFocus) anchor?.focus();
}
onBeforeUnmount(() => close(false));

function toggle(e: MouseEvent) {
  anchor = e.currentTarget as HTMLElement;
  if (open.value) close(true);
  // A mouse or touch click opens without moving focus; the keyboard (detail 0) lands on the first item.
  else void show(e.detail === 0 ? 'first' : null);
}
function onTriggerKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault();
    close(true);
    return;
  }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  anchor = e.currentTarget as HTMLElement;
  if (!open.value) void show(e.key === 'ArrowDown' ? 'first' : 'last');
}

function onPanelKey(e: KeyboardEvent) {
  const keys: Record<string, 'next' | 'previous' | 'first' | 'last'> = {
    ArrowDown: 'next',
    ArrowUp: 'previous',
    Home: 'first',
    End: 'last',
  };
  if (e.key === 'Escape') {
    e.preventDefault();
    close(true);
  } else if (e.key === 'Tab') {
    close(false);
  } else if (keys[e.key]) {
    e.preventDefault();
    const current = options().indexOf(document.activeElement as HTMLElement);
    focusAt(nextEnabled(enabled(), current, keys[e.key]!));
  }
}

function choose(item: ActionItem) {
  if (item.disabled) return;
  close(true);
  if (!item.to) emit('select', item.id);
}
</script>

<template>
  <span class="ui-menu">
    <UiButton
      variant="tertiary"
      size="xs"
      icon="more-vertical"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      @click="toggle"
      @keydown="onTriggerKey"
    >
      <span class="ui-sr-only">{{ label }}</span>
    </UiButton>
    <div
      :id="menuId"
      ref="panel"
      class="ui-menu__panel"
      role="menu"
      :aria-label="label"
      :popover="supportsPopover ? 'manual' : undefined"
      :data-fallback="supportsPopover ? undefined : ''"
      :data-open="open"
      @keydown="onPanelKey"
    >
      <template v-for="item in items" :key="item.id">
        <hr v-if="item.separatorBefore" class="ui-menu__rule" role="separator" />
        <UiLink
          v-if="item.to"
          :to="item.to"
          bare
          role="menuitem"
          tabindex="-1"
          class="ui-menu__item ui-text-label"
          :data-tone="item.tone"
          :aria-disabled="item.disabled ? 'true' : undefined"
          @click="choose(item)"
        >
          <UiIcon v-if="item.icon" :name="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </UiLink>
        <button
          v-else
          type="button"
          role="menuitem"
          tabindex="-1"
          class="ui-menu__item ui-text-label"
          :data-tone="item.tone"
          :aria-disabled="item.disabled ? 'true' : undefined"
          @click="choose(item)"
        >
          <UiIcon v-if="item.icon" :name="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </button>
      </template>
    </div>
  </span>
</template>

<style scoped>
.ui-menu {
  display: inline-flex;
}
.ui-menu__panel {
  position: fixed;
  z-index: 70;
  inline-size: max-content;
  min-inline-size: calc(var(--ui-space-12) * 3);
  max-inline-size: calc(100vw - var(--ui-space-4));
  margin: 0;
  padding: var(--ui-space-1);
  overflow: auto;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-elevation-2);
}
/* Without the popover API the panel is shown and hidden by its own state. */
.ui-menu__panel[data-fallback][data-open='false'] {
  display: none;
}
.ui-menu__rule {
  margin: var(--ui-space-1) 0;
  border: 0;
  border-block-start: 1px solid var(--ui-color-border);
}
.ui-menu__item {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  inline-size: 100%;
  min-block-size: var(--ui-space-8);
  padding: var(--ui-space-2) var(--ui-space-3);
  color: inherit;
  text-align: start;
  text-decoration: none;
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
}
.ui-menu__item:hover,
.ui-menu__item:focus-visible {
  background: var(--ui-color-surface-hover);
}
.ui-menu__item:focus-visible {
  outline: var(--ui-focus-width) solid var(--ui-color-focus-ring);
  outline-offset: calc(var(--ui-focus-width) * -1);
}
.ui-menu__item[data-tone='danger'] {
  color: var(--ui-color-danger-text);
}
.ui-menu__item[aria-disabled='true'] {
  color: var(--ui-color-text-hint);
  cursor: not-allowed;
}
</style>
