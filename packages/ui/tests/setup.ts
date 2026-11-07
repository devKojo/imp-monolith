import { config } from '@vue/test-utils';

// NuxtLink is provided by Nuxt at runtime; render a plain anchor in isolation.
config.global.components = {
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
};

// jsdom has no <dialog> modal API; the components fall back to the `open` attribute, but give
// them a spy-able implementation so open/close behaviour can be asserted.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}
