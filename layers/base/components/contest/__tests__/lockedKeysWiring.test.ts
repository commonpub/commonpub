/**
 * WIRING guard for the field-key lock.
 *
 * The lock exists because a machine `key` is what every stored answer, private
 * field and agreement acceptance hangs off, so a label edit must not regenerate
 * it. The pure op honours a `lockedKeys` set — but a prop that is declared and
 * never passed is indistinguishable from a working fix, and that is exactly what
 * happened: the first attempt wired only the registration builder, leaving every
 * per-stage submission template still rekeying on a label edit. A round-2 audit
 * caught it.
 *
 * These assertions are deliberately source-level. A rendering test would pass
 * with the prop defaulted to `[]`, which is the broken state.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string): string => readFileSync(resolve(__dirname, '..', rel), 'utf8');

describe('lockedKeys is threaded to BOTH form builders', () => {
  it('the registration builder receives the persisted registration keys', () => {
    expect(read('ContestEditor.vue')).toMatch(/:locked-keys="persistedRegistrationKeys"/);
  });

  it('the stages editor receives the per-stage key map', () => {
    expect(read('ContestEditor.vue')).toMatch(/:locked-keys-by-stage="persistedStageTemplateKeys"/);
  });

  it('the stages editor forwards this stage’s keys to its card', () => {
    expect(read('ContestStagesEditor.vue')).toMatch(/:locked-keys="props\.lockedKeysByStage\?\.\[stage\.id\]/);
  });

  it('the stage card forwards them to the shared FormTemplateEditor', () => {
    const card = read('ContestStageCard.vue');
    expect(card).toMatch(/lockedKeys\?: string\[\]/);
    expect(card).toMatch(/:locked-keys="lockedKeys \?\? \[\]"/);
  });

  it('the shared builder actually consults the set when a label changes', () => {
    const fte = read('FormTemplateEditor.vue');
    expect(fte).toMatch(/const lockedKeySet = computed\(\(\) => new Set\(props\.lockedKeys\)\)/);
    // The argument list contains its own parentheses, so match lazily across them.
    expect(fte).toMatch(/templateFieldLabelChanged\([\s\S]{0,200}?lockedKeySet\.value\)/);
  });

  it('and markdown import consults it too, rather than recomputing every key', () => {
    // The import path replaces the whole template, so it walked straight past
    // the lock until it was taught to carry saved keys across.
    expect(read('FormTemplateEditor.vue')).toMatch(/withPreservedKeys\(parsed\)/);
  });

  // Positive control: if the files stop being readable this suite must fail
  // loudly rather than pass vacuously on five regexes that match nothing.
  it('read the components it claims to check', () => {
    for (const f of ['ContestEditor.vue', 'ContestStagesEditor.vue', 'ContestStageCard.vue', 'FormTemplateEditor.vue']) {
      expect(read(f).length).toBeGreaterThan(2000);
    }
  });
});
