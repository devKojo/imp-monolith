/**
 * Automated accessibility sweep (UXA-001): mounts every gallery demo section and runs axe-core on
 * it. jsdom cannot compute layout, so colour contrast is covered by the token test instead; this
 * catches structural problems: missing names and labels, bad ARIA, duplicate ids, heading order of
 * landmarks and so on. Core journeys additionally need Playwright + axe in a real browser.
 */
import { mount } from '@vue/test-utils';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import ActionsDemo from '../app/gallery/demos/ActionsDemo.vue';
import DataDemo from '../app/gallery/demos/DataDemo.vue';
import DomainDemo from '../app/gallery/demos/DomainDemo.vue';
import FeedbackDemo from '../app/gallery/demos/FeedbackDemo.vue';
import FormsDemo from '../app/gallery/demos/FormsDemo.vue';
import FoundationDemo from '../app/gallery/demos/FoundationDemo.vue';
import NavigationDemo from '../app/gallery/demos/NavigationDemo.vue';
import OverlaysDemo from '../app/gallery/demos/OverlaysDemo.vue';
import UiToaster from '../app/components/UiToaster.vue';
import { defineComponent, h } from 'vue';

const demos = {
  Foundation: FoundationDemo,
  Actions: ActionsDemo,
  Forms: FormsDemo,
  Feedback: FeedbackDemo,
  Overlays: OverlaysDemo,
  Data: DataDemo,
  Navigation: NavigationDemo,
  Domain: DomainDemo,
};

// Demos that call useToast need a UiToaster ancestor, exactly as in the gallery frame.
const wrapped = (demo: unknown) =>
  defineComponent({ render: () => h(UiToaster, null, { default: () => h(demo as never) }) });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('axe-core on every gallery demo (UXA-001)', () => {
  it.each(Object.entries(demos))('%s has no critical or serious violations', async (name, demo) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const w = mount(wrapped(demo), { attachTo: host });
    const results = await axe.run(host, {
      // contrast needs real layout; "region" and page-level rules do not apply to isolated fragments
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false },
      },
    });
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    const report = blocking.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join(' | ')}`,
    );
    expect(report, `${name}\n${report.join('\n')}`).toEqual([]);
    w.unmount();
  });
});
