import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import UiBanner from '../app/components/UiBanner.vue';
import UiButton from '../app/components/UiButton.vue';
import UiChart from '../app/components/UiChart.vue';
import UiConfirmDialog from '../app/components/UiConfirmDialog.vue';
import UiConsentGroup from '../app/components/UiConsentGroup.vue';
import UiCountdown from '../app/components/UiCountdown.vue';
import UiDataTable from '../app/components/UiDataTable.vue';
import UiDateTimeField from '../app/components/UiDateTimeField.vue';
import UiDialog from '../app/components/UiDialog.vue';
import UiFormField from '../app/components/UiFormField.vue';
import UiMaskedValue from '../app/components/UiMaskedValue.vue';
import UiMeter from '../app/components/UiMeter.vue';
import UiOtpInput from '../app/components/UiOtpInput.vue';
import UiPermissionGate from '../app/components/UiPermissionGate.vue';
import UiReorderableList from '../app/components/UiReorderableList.vue';
import UiStatusChip from '../app/components/UiStatusChip.vue';
import UiSystemState from '../app/components/UiSystemState.vue';
import UiTabs from '../app/components/UiTabs.vue';
import UiToaster from '../app/components/UiToaster.vue';
import { useToast } from '../app/composables/useToast';
import { statusVocabularies } from '../app/status-vocabulary';
import { systemStateKinds } from '../app/system-states';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('UiButton', () => {
  it('shows a visible reason when disabled and links it with aria-describedby', () => {
    const w = mount(UiButton, {
      props: { disabled: true, disabledReason: 'Fix 2 issues first.' },
      slots: { default: 'Publish campaign' },
    });
    const btn = w.get('button');
    expect(btn.attributes('disabled')).toBeDefined();
    expect(w.text()).toContain('Fix 2 issues first.');
    expect(btn.attributes('aria-describedby')).toBe(
      w.get('span.ui-button__reason').attributes('id'),
    );
  });

  it('loading keeps the button, sets aria-busy, swaps the label and ignores clicks', async () => {
    const w = mount(UiButton, {
      props: { loading: true, loadingLabel: 'Saving...' },
      slots: { default: 'Save changes' },
    });
    expect(w.get('button').attributes('aria-busy')).toBe('true');
    expect(w.text()).toContain('Saving...');
    expect(w.text()).not.toContain('Save changes');
    await w.get('button').trigger('click');
    expect(w.emitted('click')).toBeUndefined();
  });

  it('emits click when enabled', async () => {
    const w = mount(UiButton, { slots: { default: 'Go' } });
    await w.get('button').trigger('click');
    expect(w.emitted('click')).toHaveLength(1);
  });
});

describe('UiFormField', () => {
  const field = (props: object) =>
    mount(UiFormField, {
      props: { label: 'Name', ...props },
      slots: {
        default: ({ id, describedBy }: { id: string; describedBy?: string }) =>
          h('input', { id, 'aria-describedby': describedBy }),
      },
    });

  it('links the label, states required in text and shows the hint', () => {
    const w = field({ required: true, hint: 'As on your ID.' });
    expect(w.get('label').attributes('for')).toBe(w.get('input').attributes('id'));
    expect(w.get('label').text()).toContain('(required)');
    expect(w.get('input').attributes('aria-describedby')).toBe(
      w.get('.ui-field__hint').attributes('id'),
    );
  });

  it('an error replaces the hint and carries an icon plus text', () => {
    const w = field({ hint: 'As on your ID.', error: 'Enter your name.' });
    expect(w.find('.ui-field__hint').exists()).toBe(false);
    expect(w.get('.ui-field__error').text()).toBe('Enter your name.');
    expect(w.get('.ui-field__error svg').exists()).toBe(true);
    expect(w.get('input').attributes('aria-describedby')).toBe(
      w.get('.ui-field__error').attributes('id'),
    );
  });
});

describe('UiOtpInput (spec 6.3)', () => {
  const otp = (props: object = {}) =>
    mount(UiOtpInput, { props: { modelValue: '', maskedDestination: '024 *** ** 67', ...props } });

  it('uses one-time-code autofill, numeric input mode and shows the masked destination', () => {
    const w = otp();
    const input = w.get('input');
    expect(input.attributes('autocomplete')).toBe('one-time-code');
    expect(input.attributes('inputmode')).toBe('numeric');
    expect(w.text()).toContain('024 *** ** 67');
    expect(w.text()).toContain('expires in 5 minutes');
  });

  it('keeps digits only (paste included) and auto-submits on the 6th while Verify stays available', async () => {
    const w = otp();
    await w.get('input').setValue('12a3-45 678');
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['123456']);
    expect(w.emitted('verify')![0]).toEqual(['123456']);
    expect(w.findAll('button').some((b) => b.text().includes('Verify code'))).toBe(true);
  });

  it.each([
    [
      'wrong',
      { attemptsLeft: 3 },
      "That code isn't right. Check the code and try again. 3 attempts left.",
    ],
    ['expired', {}, 'That code has expired. We can send a new one.'],
    [
      'limit',
      { limitTime: '45 minutes' },
      "You've asked for too many codes. Try again in 45 minutes.",
    ],
    ['cannotSend', {}, "We can't send codes right now. Please try again in a few minutes."],
  ])('shows the specific %s message', (status, extra, text) => {
    const w = otp({ status, ...extra });
    expect(w.text()).toContain(text);
  });

  it('disables resend during the countdown, with visible time, and enables it after', () => {
    const waiting = otp({ resendSeconds: 42 });
    expect(waiting.text()).toContain('Resend code in 0:42');
    const resend = (w: ReturnType<typeof otp>) =>
      w.findAll('button').find((b) => b.text().includes('Send new code'))!;
    expect(resend(waiting).attributes('disabled')).toBeDefined();
    expect(resend(otp({ resendSeconds: 0 })).attributes('disabled')).toBeUndefined();
  });

  it('announces the countdown only on 10 second marks', async () => {
    const w = otp({ resendSeconds: 45 });
    const live = () =>
      w
        .findAll('[aria-live]')
        .map((n) => n.text())
        .join('|');
    await w.setProps({ resendSeconds: 44 });
    expect(live()).not.toContain('0:44');
    await w.setProps({ resendSeconds: 40 });
    expect(live()).toContain('0:40');
  });

  it('exposes Change number and a read-only field while verifying', async () => {
    const w = otp({ status: 'verifying' });
    expect(w.get('input').attributes('readonly')).toBeDefined();
    await w
      .findAll('button')
      .find((b) => b.text().includes('Change number'))!
      .trigger('click');
    expect(w.emitted('changeNumber')).toHaveLength(1);
  });
});

describe('UiStatusChip (UI-DSH-05)', () => {
  it('renders icon, text and tone for every status in every vocabulary', () => {
    for (const [vocab, statuses] of Object.entries(statusVocabularies)) {
      for (const [code, def] of Object.entries(statuses)) {
        const w = mount(UiStatusChip, {
          props: { vocabulary: vocab as keyof typeof statusVocabularies, status: code },
        });
        expect(w.text(), `${vocab}.${code}`).toBe(def.label);
        expect(w.find('svg').exists(), `${vocab}.${code} icon`).toBe(true);
        expect(w.attributes('data-tone')).toBe(def.tone);
      }
    }
  });

  it('keeps "Paused by platform" textually distinct from "Paused"', () => {
    const a = mount(UiStatusChip, { props: { vocabulary: 'campaign', status: 'PAUSED' } });
    const b = mount(UiStatusChip, {
      props: { vocabulary: 'campaign', status: 'PAUSED_BY_PLATFORM' },
    });
    expect(a.text()).not.toBe(b.text());
  });
});

describe('UiSystemState (UXA-006)', () => {
  it.each(systemStateKinds)('renders the %s state with a title and body', (kind) => {
    const w = mount(UiSystemState, {
      props: { kind, params: { time: '0:45', status: 'Paused', when: '30 Nov', date: '1 Dec' } },
    });
    expect(w.text().length).toBeGreaterThan(10);
    expect(w.text()).not.toMatch(/\{\w+\}/); // no unfilled placeholders
  });

  it('fills placeholders and offers a next action', async () => {
    const w = mount(UiSystemState, { props: { kind: 'rateLimited', params: { time: '0:45' } } });
    expect(w.text()).toContain('Try again in 0:45.');
    const f = mount(UiSystemState, { props: { kind: 'forbidden' } });
    await f.get('button').trigger('click');
    expect(f.emitted('action')).toHaveLength(1);
  });

  it('page-level states use an h1, others an h2 or a banner', () => {
    expect(
      mount(UiSystemState, { props: { kind: 'notFound' } })
        .find('h1')
        .exists(),
    ).toBe(true);
    expect(
      mount(UiSystemState, { props: { kind: 'offline' } })
        .find('[role="status"]')
        .exists(),
    ).toBe(true);
  });
});

describe('UiBanner', () => {
  it('uses role=alert for errors and role=status otherwise', () => {
    expect(mount(UiBanner, { props: { tone: 'error' } }).attributes('role')).toBe('alert');
    expect(mount(UiBanner, { props: { tone: 'info' } }).attributes('role')).toBe('status');
  });
});

describe('UiDialog and derived dialogs', () => {
  it('opens as a modal, titles with an h2 and emits close on Escape unless persistent', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const w = mount(UiDialog, {
      attachTo: host,
      props: { open: false, title: 'Share campaign' },
      slots: { default: '<p>Body</p>' },
    });
    await w.setProps({ open: true });
    await nextTick();
    expect(w.get('dialog').attributes('open')).toBeDefined();
    expect(w.get('h2').text()).toBe('Share campaign');
    expect(w.get('dialog').attributes('aria-labelledby')).toBe(w.get('h2').attributes('id'));
    await w.get('dialog').trigger('cancel');
    expect(w.emitted('close')).toHaveLength(1);
    await w.setProps({ persistent: true });
    await w.get('dialog').trigger('cancel');
    expect(w.emitted('close')).toHaveLength(1); // Escape ignored when closing could lose work
    w.unmount();
  });

  it('a destructive confirm needs the typed phrase before the button enables', async () => {
    const w = mount(UiConfirmDialog, {
      attachTo: document.body,
      props: {
        open: true,
        variant: 'destructive',
        title: 'Delete campaign?',
        consequence: 'This cannot be undone.',
        confirmLabel: 'Delete campaign',
        typedPhrase: 'Black Friday Quiz',
      },
    });
    await nextTick();
    const confirm = () => w.findAll('button').find((b) => b.text().includes('Delete campaign'))!;
    expect(confirm().attributes('disabled')).toBeDefined();
    await w.get('input').setValue('black friday');
    expect(confirm().attributes('disabled')).toBeDefined();
    await w.get('input').setValue('Black Friday Quiz');
    expect(confirm().attributes('disabled')).toBeUndefined();
    await confirm().trigger('click');
    expect(w.emitted('confirm')).toHaveLength(1);
    w.unmount();
  });
});

describe('UiMaskedValue (UXA-012)', () => {
  beforeEach(() => vi.useFakeTimers());

  it('reveals through the permitted callback and re-masks after the timeout', async () => {
    const reveal = vi.fn().mockResolvedValue('024 123 4567');
    const w = mount(UiMaskedValue, {
      props: { masked: '024 *** ** 67', what: 'phone number', reveal, autoMaskMs: 30_000 },
    });
    expect(w.text()).toContain('024 *** ** 67');
    await w.findAll('button')[0]!.trigger('click');
    await flushPromises();
    expect(reveal).toHaveBeenCalledOnce();
    expect(w.text()).toContain('024 123 4567');
    expect(w.text()).toContain('Revealing contact details is logged');
    await vi.advanceTimersByTimeAsync(29_000);
    expect(w.text()).toContain('024 123 4567');
    await vi.advanceTimersByTimeAsync(1_500);
    expect(w.text()).toContain('024 *** ** 67');
    expect(w.text()).not.toContain('024 123 4567');
    expect(w.emitted('masked')).toHaveLength(1);
  });

  it('shows no reveal control without permission (hidden, not disabled)', () => {
    const w = mount(UiMaskedValue, { props: { masked: 'k***@mail.com', what: 'email' } });
    expect(w.find('button').exists()).toBe(false);
  });
});

describe('UiToaster and useToast', () => {
  it('shows a toast, announces politely, and auto-dismisses after the duration', async () => {
    vi.useFakeTimers();
    const Trigger = defineComponent({
      setup() {
        const t = useToast();
        return () => h('button', { onClick: () => t.push('Campaign saved.') }, 'go');
      },
    });
    const w = mount(UiToaster, { props: { duration: 6000 }, slots: { default: () => h(Trigger) } });
    await w.get('button').trigger('click');
    expect(w.get('[aria-live="polite"]').text()).toContain('Campaign saved.');
    await vi.advanceTimersByTimeAsync(5900);
    expect(w.text()).toContain('Campaign saved.');
    await vi.advanceTimersByTimeAsync(200);
    expect(w.text()).not.toContain('Campaign saved.');
  });

  it('pauses on hover and resumes on leave', async () => {
    vi.useFakeTimers();
    const Trigger = defineComponent({
      setup() {
        const t = useToast();
        return () => h('button', { onClick: () => t.push('Hi there.') }, 'go');
      },
    });
    const w = mount(UiToaster, { props: { duration: 6000 }, slots: { default: () => h(Trigger) } });
    await w.get('button').trigger('click');
    await w.get('.ui-toast').trigger('mouseenter');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(w.text()).toContain('Hi there.');
    await w.get('.ui-toast').trigger('mouseleave');
    await vi.advanceTimersByTimeAsync(6100);
    expect(w.text()).not.toContain('Hi there.');
  });

  it('refuses to be used outside a toaster', () => {
    const Lonely = defineComponent({
      setup() {
        useToast();
        return () => null;
      },
    });
    expect(() => mount(Lonely)).toThrow(/UiToaster/);
  });
});

describe('UiTabs', () => {
  it('moves selection and focus with arrow keys, Home and End', async () => {
    const w = mount(UiTabs, {
      attachTo: document.body,
      props: {
        modelValue: 'a',
        label: 'Sections',
        tabs: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
      },
      slots: { 'panel-a': 'one', 'panel-b': 'two', 'panel-c': 'three' },
    });
    const tabs = w.findAll('[role="tab"]');
    expect(tabs[0]!.attributes('tabindex')).toBe('0');
    expect(tabs[1]!.attributes('tabindex')).toBe('-1');
    await tabs[0]!.trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['b']);
    await tabs[0]!.trigger('keydown', { key: 'ArrowLeft' });
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['c']);
    await tabs[1]!.trigger('keydown', { key: 'End' });
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['c']);
    w.unmount();
  });
});

describe('UiReorderableList (UI-A11Y-08)', () => {
  it('reorders with real, item-named buttons and disables the ends', async () => {
    const w = mount(UiReorderableList, {
      props: {
        label: 'Questions',
        removable: true,
        items: [
          { id: '1', label: 'First' },
          { id: '2', label: 'Second' },
        ],
      },
    });
    const names = w.findAll('button').map((b) => b.text());
    expect(names).toContain('Move First up');
    expect(names).toContain('Move Second down');
    const buttons = w.findAll('button');
    expect(buttons[0]!.attributes('disabled')).toBeDefined(); // first item cannot move up
    await buttons[1]!.trigger('click'); // First down
    expect(w.emitted('move')![0]).toEqual([{ id: '1', from: 0, to: 1 }]);
    await w
      .findAll('button')
      .find((b) => b.text() === 'Remove Second')!
      .trigger('click');
    expect(w.emitted('remove')![0]).toEqual(['2']);
  });
});

describe('UiDataTable (UI-DSH-04/06)', () => {
  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'n', label: 'Entries', priority: 'low' as const },
  ];
  const rows = [
    { id: '1', name: 'Quiz', n: 5 },
    { id: '2', name: 'Poll', n: 7 },
  ];

  it('exposes a focusable named scroll region, aria-sort and a sticky header', () => {
    const w = mount(UiDataTable, {
      props: {
        name: 'Campaigns',
        columns,
        rows,
        rowKey: 'id',
        sort: { key: 'name', direction: 'asc' },
      },
    });
    const region = w.get('[role="region"]');
    expect(region.attributes('tabindex')).toBe('0');
    expect(region.attributes('aria-label')).toContain('Campaigns');
    expect(w.get('th').attributes('aria-sort')).toBe('ascending');
    expect(w.findAll('td')[0]!.attributes('data-label')).toBe('Name'); // for the stacked mobile layout
  });

  it('emits sort changes and load-more', async () => {
    const w = mount(UiDataTable, {
      props: {
        name: 'Campaigns',
        columns,
        rows,
        rowKey: 'id',
        hasMore: true,
        total: 41,
        sort: { key: 'name', direction: 'asc' },
      },
    });
    await w.get('th button').trigger('click');
    expect(w.emitted('update:sort')![0]).toEqual([{ key: 'name', direction: 'desc' }]);
    expect(w.text()).toContain('Showing 2 of 41');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Load more')!
      .trigger('click');
    expect(w.emitted('loadMore')).toHaveLength(1);
  });

  it('shows a skeleton while loading and an empty state with no rows', () => {
    expect(
      mount(UiDataTable, { props: { name: 'x', columns, rows: [], rowKey: 'id', loading: true } })
        .find('[aria-busy="true"]')
        .exists(),
    ).toBe(true);
    expect(
      mount(UiDataTable, { props: { name: 'x', columns, rows: [], rowKey: 'id' } }).text(),
    ).toContain('Nothing here yet');
  });
});

describe('UiCountdown (UI-A11Y-07)', () => {
  it('announces only at 50%, 20% and 10%, never every second', async () => {
    const w = mount(UiCountdown, {
      props: { secondsRemaining: 60, totalSeconds: 60, label: 'Question timer' },
    });
    const live = () => w.get('[aria-live]').text();
    expect(live()).toBe('');
    await w.setProps({ secondsRemaining: 45 });
    expect(live()).toBe('');
    await w.setProps({ secondsRemaining: 30 });
    expect(live()).toContain('0:30 remaining');
    await w.setProps({ secondsRemaining: 29 });
    expect(live()).toContain('0:30 remaining'); // unchanged: no per-second chatter
    await w.setProps({ secondsRemaining: 12 });
    expect(live()).toContain('0:12 remaining');
  });

  it('offers an extension that needs no reason', async () => {
    const w = mount(UiCountdown, {
      props: { secondsRemaining: 20, totalSeconds: 60, label: 'Timer', extendable: true },
    });
    await w.get('button').trigger('click');
    expect(w.emitted('extend')).toHaveLength(1);
  });
});

describe('UiPermissionGate (spec 7.3)', () => {
  const gate = (rule: 'allowed' | 'never' | 'state' | 'role' | 'elevation', extra: object = {}) =>
    mount(UiPermissionGate, {
      props: { rule, ...extra },
      slots: {
        default: ({ disabled }: { disabled: boolean }) =>
          h('button', { disabled }, 'Publish campaign'),
      },
    });

  it('hides the control when the role can never do it', () => {
    expect(gate('never').find('button').exists()).toBe(false);
  });
  it('disables with a visible reason when state prevents it', () => {
    const w = gate('state', { reason: 'Add a prize description first.' });
    expect(w.get('button').attributes('disabled')).toBeDefined();
    expect(w.text()).toContain('Add a prize description first.');
  });
  it('says who to ask when another role is needed', () => {
    const w = gate('role');
    expect(w.get('button').attributes('disabled')).toBeDefined();
    expect(w.text()).toContain('Ask a Campaign Manager');
  });
  it('shows a lock that activates step-up', async () => {
    const w = gate('elevation', { reason: 'Export (step-up)' });
    await w.get('.ui-gate__lock').trigger('click');
    expect(w.emitted('activate')).toHaveLength(1);
  });
  it('leaves allowed actions untouched', () => {
    expect(gate('allowed').get('button').attributes('disabled')).toBeUndefined();
  });
});

describe('UiConsentGroup (UI-PUB-10)', () => {
  it('keeps optional purposes unticked and independent of the required terms', async () => {
    const value = { accepted: false, optional: {} };
    const w = mount(UiConsentGroup, {
      props: {
        modelValue: value,
        legend: 'Terms and consent',
        terms: { label: 'I accept the terms', version: '3', href: '/terms' },
        optional: [
          { id: 'email', label: 'Email me', description: 'Monthly.', version: '2', href: '/p' },
        ],
      },
    });
    const boxes = w.findAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect(boxes.every((b) => !(b.element as HTMLInputElement).checked)).toBe(true);
    await boxes[1]!.setValue(true);
    expect(w.emitted('update:modelValue')![0]![0]).toEqual({
      accepted: false,
      optional: { email: true },
    });
    expect(w.text()).toContain('version 3');
    expect(w.text()).toContain('version 2');
  });
});

describe('UiDateTimeField', () => {
  it('previews what participants see, with the zone abbreviation', () => {
    const w = mount(UiDateTimeField, {
      props: {
        legend: 'End',
        modelValue: { date: '2026-11-30', time: '23:59', zone: 'Africa/Accra' },
      },
    });
    expect(w.text()).toMatch(/Participants see: 30 Nov.*23:59.*GMT/);
  });
  it('also shows the visitor time when the zones differ', () => {
    const w = mount(UiDateTimeField, {
      props: {
        legend: 'End',
        visitorZone: 'America/New_York',
        modelValue: { date: '2026-11-30', time: '23:59', zone: 'Africa/Accra' },
      },
    });
    expect(w.text()).toMatch(/18:59/);
  });
  it('emits an updated value when a part changes', async () => {
    const w = mount(UiDateTimeField, {
      props: {
        legend: 'End',
        modelValue: { date: '2026-11-30', time: '23:59', zone: 'Africa/Accra' },
      },
    });
    await w.get('input[type="time"]').setValue('10:00');
    expect(w.emitted('update:modelValue')![0]![0]).toEqual({
      date: '2026-11-30',
      time: '10:00',
      zone: 'Africa/Accra',
    });
  });
});

describe('UiMeter (UI-DSH-12)', () => {
  it.each([
    [50, 'ok'],
    [80, 'near'],
    [100, 'full'],
  ])('at %s%% uses the %s treatment with text, not colour alone', (pct, level) => {
    const w = mount(UiMeter, { props: { label: 'Participants', used: pct, limit: 100 } });
    expect(w.attributes('data-level')).toBe(level);
    expect(w.text()).toContain(`${pct}%`);
    if (level !== 'ok') expect(w.find('.ui-meter__note').text().length).toBeGreaterThan(0);
  });
});

describe('UiChart (UI-A11Y-10)', () => {
  const series = [
    {
      name: 'Entries',
      points: [
        { label: 'Mon', value: 120 },
        { label: 'Tue', value: 340 },
      ],
    },
    {
      name: 'Verified',
      points: [
        { label: 'Mon', value: 90 },
        { label: 'Tue', value: 210 },
      ],
    },
  ];

  it('always has a text summary, a labelled graphic and a data table alternative', async () => {
    const w = mount(UiChart, {
      props: {
        type: 'line',
        title: 'Entries per day',
        series,
        summary: 'Entries doubled.',
        approx: true,
        status: 'provisional',
      },
    });
    expect(w.text()).toContain('Entries doubled.');
    expect(w.text()).toContain('approx.');
    expect(w.text()).toContain('Provisional');
    expect(w.get('svg').attributes('role')).toBe('img');
    expect(w.get('svg').attributes('aria-label')).toContain('Entries doubled.');
    await w.get('figcaption button').trigger('click');
    expect(w.get('table').isVisible()).toBe(true);
    expect(w.findAll('tbody tr')).toHaveLength(2);
    expect(w.get('tbody').text()).toContain('340');
  });

  it('distinguishes series by dash pattern and direct label, not colour alone', () => {
    const w = mount(UiChart, { props: { type: 'line', title: 'T', series, summary: 's' } });
    const paths = w.findAll('svg > g > g > path[stroke-dasharray], svg path[stroke-dasharray]');
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(w.findAll('text.ui-chart__label').map((t) => t.text())).toEqual(['Entries', 'Verified']);
  });
});
