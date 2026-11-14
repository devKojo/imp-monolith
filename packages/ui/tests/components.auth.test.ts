/** Behaviour of the components added for the auth, onboarding and discovery screens. */
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { h } from 'vue';
import UiAuthShell from '../app/components/UiAuthShell.vue';
import UiBadge from '../app/components/UiBadge.vue';
import UiButton from '../app/components/UiButton.vue';
import UiCampaignCard from '../app/components/UiCampaignCard.vue';
import UiDivider from '../app/components/UiDivider.vue';
import UiFeatureTile from '../app/components/UiFeatureTile.vue';
import UiFilterChips from '../app/components/UiFilterChips.vue';
import UiFormField from '../app/components/UiFormField.vue';
import UiPasswordField from '../app/components/UiPasswordField.vue';
import UiPublicShell from '../app/components/UiPublicShell.vue';
import UiSearchField from '../app/components/UiSearchField.vue';
import UiTextInput from '../app/components/UiTextInput.vue';
import { icons } from '../app/icons';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('UiButton as a link', () => {
  it('renders an anchor with button styling when `to` is given', () => {
    const w = mount(UiButton, {
      props: { to: '/discover' },
      slots: { default: 'Browse campaigns' },
    });
    const a = w.get('a');
    expect(a.attributes('href')).toBe('/discover');
    expect(a.classes()).toContain('ui-button');
    expect(w.find('button').exists()).toBe(false);
  });

  it('shows a spinner while loading and keeps the loading label', () => {
    const w = mount(UiButton, {
      props: { loading: true, loadingLabel: 'Creating your account...' },
      slots: { default: 'Create account' },
    });
    expect(w.find('.ui-button__spinner').exists()).toBe(true);
    expect(w.text()).toContain('Creating your account...');
  });

  it('supports a trailing icon', () => {
    const w = mount(UiButton, {
      props: { iconTrailing: 'arrow-right' },
      slots: { default: 'Continue' },
    });
    expect(w.findAll('svg')).toHaveLength(1);
  });
});

describe('UiBadge', () => {
  it('exposes tone and shape and renders its icon and text', () => {
    const w = mount(UiBadge, {
      props: { tone: 'success', icon: 'check-circle', shape: 'pill' },
      slots: { default: 'Verified' },
    });
    expect(w.attributes('data-tone')).toBe('success');
    expect(w.attributes('data-shape')).toBe('pill');
    expect(w.text()).toBe('Verified');
    expect(w.find('svg').exists()).toBe(true);
  });
});

describe('UiDivider', () => {
  it('is a separator and shows its word as real text', () => {
    const w = mount(UiDivider, { props: { label: 'or' } });
    expect(w.attributes('role')).toBe('separator');
    expect(w.text()).toBe('or');
    expect(mount(UiDivider).text()).toBe('');
  });
});

describe('UiFormField additions', () => {
  const slot = ({ id }: { id: string }) => h('input', { id });

  it('can hide the label visually while keeping it for assistive tech', () => {
    const w = mount(UiFormField, {
      props: { label: 'Search campaigns', hideLabel: true },
      slots: { default: slot },
    });
    expect(w.get('.ui-field__head').classes()).toContain('ui-sr-only');
    expect(w.get('label').text()).toContain('Search campaigns');
    expect(w.get('label').attributes('for')).toBe(w.get('input').attributes('id'));
  });

  it('renders a link on the label row', () => {
    const w = mount(UiFormField, {
      props: { label: 'Password' },
      slots: { default: slot, labelAside: () => h('a', { href: '/forgot' }, 'Forgot password?') },
    });
    expect(w.get('.ui-field__head a').text()).toBe('Forgot password?');
  });
});

describe('UiTextInput additions', () => {
  it('renders a leading decorative icon and a trailing control', () => {
    const w = mount(UiTextInput, {
      props: { modelValue: '', label: 'Email address', icon: 'mail' },
      slots: { suffix: () => h('button', { type: 'button' }, 'x') },
    });
    expect(w.get('.ui-input').attributes('data-icon')).toBe('true');
    expect(w.get('.ui-input').attributes('data-suffix')).toBe('true');
    expect(w.get('.ui-input__icon').attributes('aria-hidden')).toBe('true');
    expect(w.get('.ui-input__suffix button').exists()).toBe(true);
  });
});

describe('UiPasswordField', () => {
  const rules = (met: boolean[]) => [
    { id: 'len', label: 'At least 12 characters', met: met[0]! },
    { id: 'name', label: 'Does not contain your email name', met: met[1]! },
  ];

  it('toggles visibility with a labelled aria-pressed button', async () => {
    const w = mount(UiPasswordField, { props: { modelValue: 'secret' } });
    const input = () => w.get('input');
    expect(input().attributes('type')).toBe('password');
    const toggle = w.get('button');
    expect(toggle.attributes('aria-pressed')).toBe('false');
    expect(toggle.text()).toBe('Show password');
    await toggle.trigger('click');
    expect(input().attributes('type')).toBe('text');
    expect(toggle.attributes('aria-pressed')).toBe('true');
    expect(toggle.text()).toBe('Hide password');
  });

  it('uses the right autocomplete token', () => {
    expect(
      mount(UiPasswordField, { props: { modelValue: '' } })
        .get('input')
        .attributes('autocomplete'),
    ).toBe('current-password');
    expect(
      mount(UiPasswordField, { props: { modelValue: '', autocomplete: 'new-password' } })
        .get('input')
        .attributes('autocomplete'),
    ).toBe('new-password');
  });

  it('shows each rule with text and a met / not met cue, plus a count', () => {
    const w = mount(UiPasswordField, { props: { modelValue: 'abc', rules: rules([false, true]) } });
    const items = w.findAll('li');
    expect(items).toHaveLength(2);
    expect(items[0]!.text()).toContain('not met');
    expect(items[1]!.text()).toContain('met');
    expect(items[1]!.attributes('data-met')).toBe('true');
    expect(w.text()).toContain('1 of 2 requirements met');
    expect(w.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('50');
  });

  it('announces progress only when the met count changes', async () => {
    const w = mount(UiPasswordField, { props: { modelValue: 'a', rules: rules([false, false]) } });
    const live = () => w.get('[aria-live]').text();
    expect(live()).toBe('');
    await w.setProps({ modelValue: 'ab' }); // typing without changing the count
    expect(live()).toBe('');
    await w.setProps({ modelValue: 'abc', rules: rules([false, true]) });
    expect(live()).toContain('1 of 2 requirements met');
  });

  it('emits updates and passes an error to the field', async () => {
    const w = mount(UiPasswordField, {
      props: { modelValue: '', error: 'Invalid email or password.' },
    });
    await w.get('input').setValue('hunter2hunter2');
    expect(w.emitted('update:modelValue')![0]).toEqual(['hunter2hunter2']);
    expect(w.text()).toContain('Invalid email or password.');
  });
});

describe('UiFilterChips', () => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'quiz', label: 'Quizzes', icon: 'clipboard-list' as const },
  ];

  it('is a named group of toggle buttons that report their state', async () => {
    const w = mount(UiFilterChips, {
      props: { modelValue: 'all', label: 'Campaign type', options },
    });
    expect(w.get('[role="group"]').attributes('aria-label')).toBe('Campaign type');
    const [all, quiz] = w.findAll('button');
    expect(all!.attributes('aria-pressed')).toBe('true');
    expect(quiz!.attributes('aria-pressed')).toBe('false');
    await quiz!.trigger('click');
    expect(w.emitted('update:modelValue')![0]).toEqual(['quiz']);
  });

  it('marks the selected chip with a check, not colour alone', () => {
    const w = mount(UiFilterChips, { props: { modelValue: 'all', label: 'Type', options } });
    expect(w.findAll('button')[0]!.find('svg').exists()).toBe(true);
  });
});

describe('UiSearchField', () => {
  it('is a search landmark with a hidden but present label and a Search button', () => {
    const w = mount(UiSearchField, { props: { modelValue: '', label: 'Search campaigns' } });
    expect(w.get('form').attributes('role')).toBe('search');
    expect(w.get('label').text()).toContain('Search campaigns');
    expect(w.get('input').attributes('type')).toBe('search');
    expect(w.findAll('button').some((b) => b.text() === 'Search')).toBe(true);
  });

  it('submits the current query and clears it', async () => {
    const w = mount(UiSearchField, { props: { modelValue: 'quiz', label: 'Search campaigns' } });
    await w.get('form').trigger('submit');
    expect(w.emitted('search')![0]).toEqual(['quiz']);
    const clear = w.findAll('button').find((b) => b.text() === 'Clear search')!;
    await clear.trigger('click');
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['']);
  });

  it('shows no clear button when empty', () => {
    const w = mount(UiSearchField, { props: { modelValue: '', label: 'Search campaigns' } });
    expect(w.findAll('button').some((b) => b.text() === 'Clear search')).toBe(false);
  });
});

describe('UiCampaignCard', () => {
  const props = {
    title: 'Black Friday Quiz',
    summary: 'Answer five questions.',
    businessName: 'Acme Ltd',
    typeLabel: 'Quiz',
    to: '/c/black-friday',
    timeLeft: '2 days left',
    endsAtIso: '2026-11-30T23:59:00Z',
    endsAtLabel: '30 Nov, 23:59 GMT',
    prizeLabel: 'Prize',
    prizeValue: 'Weekend getaway',
  };

  it('has exactly one link, named after the campaign', () => {
    const w = mount(UiCampaignCard, { props });
    const links = w.findAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]!.attributes('href')).toBe('/c/black-friday');
    expect(links[0]!.text()).toContain('View campaign');
    expect(links[0]!.text()).toContain('Black Friday Quiz');
  });

  it('keeps the absolute end time available for the relative time left', () => {
    const w = mount(UiCampaignCard, { props });
    const time = w.get('time');
    expect(time.attributes('datetime')).toBe('2026-11-30T23:59:00Z');
    expect(time.attributes('title')).toBe('30 Nov, 23:59 GMT');
    expect(time.text()).toContain('2 days left');
    expect(time.text()).toContain('30 Nov, 23:59 GMT');
  });

  it('is a labelled article, shows the business, and omits the prize block when there is none', () => {
    const w = mount(UiCampaignCard, {
      props: { ...props, prizeValue: undefined, prizeLabel: undefined },
    });
    expect(w.get('article').attributes('aria-labelledby')).toBe(w.get('h3').attributes('id'));
    expect(w.text()).toContain('by Acme Ltd');
    expect(w.text()).not.toContain('Weekend getaway');
  });

  it('uses explicit image dimensions, and treats the image as decorative without alt text', () => {
    const w = mount(UiCampaignCard, { props: { ...props, imageSrc: '/x.jpg' } });
    const img = w.get('img');
    expect(img.attributes('width')).toBe('640');
    expect(img.attributes('height')).toBe('360');
    expect(img.attributes('alt')).toBe('');
  });
});

describe('UiAuthShell', () => {
  it('has a skip link, one main landmark, an h1 and an account-routing footer', () => {
    const w = mount(UiAuthShell, {
      props: { brandName: 'Acme', title: 'Welcome back', subtitle: 'Sign in to manage campaigns.' },
      slots: { default: '<p>form</p>', footer: 'No account? Sign up', below: 'Fine print' },
    });
    expect(w.findAll('main')).toHaveLength(1);
    expect(w.get('main').attributes('id')).toBe('main');
    expect(w.get('h1').text()).toBe('Welcome back');
    expect(w.get('a.ui-skip').attributes('href')).toBe('#main');
    expect(w.get('.ui-auth__footer').text()).toContain('No account?');
    expect(w.text()).toContain('Fine print');
  });

  it('shows the aside only in the wide layout', () => {
    const slots = { default: 'x', aside: '<p>benefits</p>' };
    expect(
      mount(UiAuthShell, { props: { brandName: 'A', title: 'T' }, slots })
        .find('aside')
        .exists(),
    ).toBe(false);
    expect(
      mount(UiAuthShell, { props: { brandName: 'A', title: 'T', size: 'wide' }, slots })
        .find('aside')
        .exists(),
    ).toBe(true);
  });
});

describe('UiAuthShell split layout', () => {
  it('renders the aside beside the card and keeps one h1 and one main landmark', () => {
    const w = mount(UiAuthShell, {
      props: { brandName: 'A', title: 'Sign in', layout: 'split' },
      slots: { default: 'x', aside: '<p>panel</p>', badge: '<div>switch</div>' },
    });
    expect(w.find('aside').text()).toContain('panel');
    expect(w.text()).toContain('switch');
    expect(w.findAll('h1')).toHaveLength(1);
    expect(w.findAll('main')).toHaveLength(1);
    expect(w.attributes('data-layout')).toBe('split');
  });
});

describe('UiPublicShell additions', () => {
  it('renders primary navigation and header actions when provided', () => {
    const w = mount(UiPublicShell, {
      props: { brandName: 'Acme' },
      slots: {
        nav: '<a href="/discover">Discover</a>',
        actions: '<a href="/signin">Sign in</a>',
        default: 'content',
      },
    });
    expect(w.get('nav[aria-label="Primary navigation"]').text()).toContain('Discover');
    expect(w.get('.ui-public__actions').text()).toContain('Sign in');
  });

  it('uses the reading column by default and the full width when wide', () => {
    expect(
      mount(UiPublicShell, { props: { brandName: 'A' } })
        .get('main')
        .classes(),
    ).toContain('ui-reading');
    expect(
      mount(UiPublicShell, { props: { brandName: 'A', wide: true } })
        .get('main')
        .classes(),
    ).toContain('ui-public__main--wide');
  });

  it('keeps the footer links on every layout', () => {
    const w = mount(UiPublicShell, { props: { brandName: 'A', wide: true } });
    for (const label of ['Privacy', 'Terms', 'Help', 'Report abuse'])
      expect(w.get('footer').text()).toContain(label);
  });
});

describe('UiFeatureTile', () => {
  it('renders icon, heading and description', () => {
    const w = mount(UiFeatureTile, {
      props: {
        icon: 'shield-check',
        title: 'Fair draws',
        description: 'Every draw publishes its proof.',
      },
    });
    expect(w.get('h3').text()).toBe('Fair draws');
    expect(w.text()).toContain('Every draw publishes its proof.');
    expect(w.find('svg').exists()).toBe(true);
  });
});

describe('icon registry additions', () => {
  it('has every icon the auth and discovery screens use', () => {
    for (const name of [
      'eye',
      'eye-off',
      'mail',
      'building',
      'gift',
      'zap',
      'arrow-right',
      'filter',
      'shield-check',
      'clipboard-list',
      'bar-chart',
      'trophy',
      'log-in',
      'log-out',
      'circle',
      'loader',
    ]) {
      expect(icons, name).toHaveProperty(name);
    }
  });
});
