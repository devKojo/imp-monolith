import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composition } from '../app/gallery/composition.generated';
import { categories, registry } from '../app/gallery/registry';
import { runScript, uiRoot } from './helpers';

const componentFiles = readdirSync(`${uiRoot}app/components`)
  .filter((f) => f.endsWith('.vue'))
  .map((f) => f.replace('.vue', ''));
const demoSource = readdirSync(`${uiRoot}app/gallery/demos`)
  .map((f) => readFileSync(`${uiRoot}app/gallery/demos/${f}`, 'utf8'))
  .join('\n');

describe('component workbench rule (UI-GOV-02)', () => {
  it('every component file has a registry entry and every entry a file', () => {
    expect(registry.map((e) => e.name).sort()).toEqual([...componentFiles].sort());
  });

  it('every component has a gallery demo block', () => {
    const missing = registry
      .filter((e) => !demoSource.includes(`<GalleryBlock name="${e.name}"`))
      .map((e) => e.name);
    expect(missing).toEqual([]);
  });

  it('every entry documents states, accessibility and spec references', () => {
    for (const e of registry) {
      expect(e.states.length, e.name).toBeGreaterThan(0);
      expect(e.a11y.length, e.name).toBeGreaterThan(10);
      expect(e.specRefs.length, e.name).toBeGreaterThan(0);
      expect(categories, e.name).toContain(e.category);
    }
  });

  it('the generated catalogue and composition are up to date', () => {
    const r = runScript('build-catalogue.ts', '--check');
    expect(r.ok, r.output).toBe(true);
  });
});

describe('reuse over duplication', () => {
  it('shared building blocks are actually reused', () => {
    const used = (n: string) => composition[n]!.usedBy.length;
    expect(used('UiFormField')).toBeGreaterThanOrEqual(3); // text, select, phone, otp
    expect(used('UiButton')).toBeGreaterThanOrEqual(10);
    expect(used('UiDialog')).toBeGreaterThanOrEqual(3); // confirm, conflict, step-up
    expect(used('UiProgress')).toBeGreaterThanOrEqual(3); // stepper, uploader, countdown, meter
    expect(used('UiIcon')).toBeGreaterThanOrEqual(10);
  });

  it('raw <button> and <input> live only in the components that own that pattern', () => {
    // One owner per native control, so styling and accessibility fixes happen in one place.
    const rawButtonOwners = new Set([
      'UiFilterChips',
      'UiButton',
      'UiSwitch',
      'UiTabs',
      'UiAccordion',
      'UiStepper',
      'UiDataTable',
      'UiPermissionGate',
    ]);
    const rawInputOwners = new Set([
      'UiTextInput',
      'UiCheckbox',
      'UiChoiceGroup',
      'UiPhoneInput',
      'UiOtpInput',
      'UiDateTimeField',
      'UiMediaUploader',
    ]);
    const offenders: string[] = [];
    for (const name of componentFiles) {
      const tpl = readFileSync(`${uiRoot}app/components/${name}.vue`, 'utf8').split('<style')[0]!;
      if (/<button\b/.test(tpl) && !rawButtonOwners.has(name))
        offenders.push(`${name} uses a raw <button>; use UiButton`);
      if (/<input\b/.test(tpl) && !rawInputOwners.has(name))
        offenders.push(`${name} uses a raw <input>; use UiTextInput or a field component`);
    }
    expect(offenders).toEqual([]);
  });
});
