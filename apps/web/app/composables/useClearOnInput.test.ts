// @vitest-environment node
import { nextTick, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useClearOnInput } from './useClearOnInput';

describe('useClearOnInput', () => {
  it('clears only the edited field error, and leaves other errors alone', async () => {
    const email = ref('a@b.co');
    const password = ref('x');
    const errors = ref<Partial<Record<'email' | 'password', string>>>({
      email: 'Enter an email address like name@company.com.',
      password: 'Meet all the password requirements below.',
    });
    useClearOnInput(errors, { email, password });

    password.value = 'xy';
    await nextTick();
    expect(errors.value).toEqual({ email: 'Enter an email address like name@company.com.' });

    email.value = 'b@c.co';
    await nextTick();
    expect(errors.value).toEqual({});
  });

  it('replaces the errors object so dependants update', async () => {
    const name = ref('');
    const errors = ref<Partial<Record<'name', string>>>({ name: 'Enter your full name.' });
    const before = errors.value;
    useClearOnInput(errors, { name });
    name.value = 'Ada';
    await nextTick();
    expect(errors.value).not.toBe(before);
    expect(before.name).toBe('Enter your full name.'); // not mutated in place
  });

  it('does nothing when there is no error for the field', async () => {
    const name = ref('');
    const errors = ref<Partial<Record<'name', string>>>({});
    const before = errors.value;
    useClearOnInput(errors, { name });
    name.value = 'Ada';
    await nextTick();
    expect(errors.value).toBe(before);
  });
});
