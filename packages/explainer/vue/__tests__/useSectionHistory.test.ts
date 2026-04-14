import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useSectionHistory } from '../composables/useSectionHistory';

describe('useSectionHistory', () => {
  it('starts with canUndo=false, canRedo=false', () => {
    const source = ref({ sections: [{ id: '1', heading: 'Intro' }] });
    const history = useSectionHistory(source);
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
  });

  it('push enables undo after second push', () => {
    const source = ref({ value: 1 });
    const history = useSectionHistory(source);
    history.push(); // snapshot 0
    source.value = { value: 2 };
    history.push(); // snapshot 1
    expect(history.canUndo.value).toBe(true);
    expect(history.canRedo.value).toBe(false);
  });

  it('undo restores previous state', () => {
    const source = ref({ name: 'A' });
    const history = useSectionHistory(source);
    history.push();
    source.value = { name: 'B' };
    history.push();
    source.value = { name: 'C' };
    history.push();

    history.undo();
    expect(source.value).toEqual({ name: 'B' });

    history.undo();
    expect(source.value).toEqual({ name: 'A' });
  });

  it('redo restores next state', () => {
    const source = ref({ name: 'A' });
    const history = useSectionHistory(source);
    history.push();
    source.value = { name: 'B' };
    history.push();

    history.undo();
    expect(source.value).toEqual({ name: 'A' });

    history.redo();
    expect(source.value).toEqual({ name: 'B' });
  });

  it('undo returns null when at start', () => {
    const source = ref(42);
    const history = useSectionHistory(source);
    history.push();
    expect(history.undo()).toBeNull();
  });

  it('redo returns null when at end', () => {
    const source = ref(42);
    const history = useSectionHistory(source);
    history.push();
    expect(history.redo()).toBeNull();
  });

  it('new push after undo truncates redo stack', () => {
    const source = ref({ v: 1 });
    const history = useSectionHistory(source);
    history.push();
    source.value = { v: 2 };
    history.push();
    source.value = { v: 3 };
    history.push();

    history.undo(); // back to v:2
    source.value = { v: 4 };
    history.push(); // branch: v:1, v:2, v:4

    expect(history.canRedo.value).toBe(false);
    history.undo();
    expect(source.value).toEqual({ v: 2 });
  });

  it('clear resets history', () => {
    const source = ref({ v: 1 });
    const history = useSectionHistory(source);
    history.push();
    source.value = { v: 2 };
    history.push();

    history.clear();
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
  });

  it('isRestoring is true during undo/redo', () => {
    const source = ref({ v: 1 });
    const history = useSectionHistory(source);
    history.push();
    source.value = { v: 2 };
    history.push();

    // isRestoring should be false before and after undo
    expect(history.isRestoring.value).toBe(false);
    history.undo();
    expect(history.isRestoring.value).toBe(false);
  });

  it('push during isRestoring is no-op', () => {
    const source = ref({ v: 1 });
    const history = useSectionHistory(source);
    history.push();
    source.value = { v: 2 };
    history.push();

    // Simulate calling push while restoring
    history.isRestoring.value = true;
    source.value = { v: 99 };
    history.push(); // should be ignored
    history.isRestoring.value = false;

    history.undo();
    expect(source.value).toEqual({ v: 1 });
  });

  it('respects max history limit', () => {
    const source = ref(0);
    const history = useSectionHistory(source);
    // Push 60 snapshots (max is 50)
    for (let i = 0; i < 60; i++) {
      source.value = i;
      history.push();
    }

    // Should only be able to undo 49 times (50 entries, index at 49)
    let undoCount = 0;
    while (history.canUndo.value) {
      history.undo();
      undoCount++;
    }
    expect(undoCount).toBe(49);
  });
});
