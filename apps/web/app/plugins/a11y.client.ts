/**
 * Route changes move focus to the page heading (UI-A11Y-06). The route announcer reads the new
 * page title; focusing the h1 puts keyboard and screen-reader users at the start of the new content.
 * The first load is skipped so the page does not steal focus when it opens.
 */
export default defineNuxtPlugin((nuxtApp) => {
  let first = true;
  nuxtApp.hook('page:finish', () => {
    if (first) {
      first = false;
      return;
    }
    const heading = document.querySelector<HTMLElement>('h1');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  });
});
