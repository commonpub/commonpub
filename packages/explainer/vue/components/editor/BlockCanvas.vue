<script setup lang="ts">
/**
 * Simplified standalone block canvas.
 * Renders each block with inline editing, selection, move/delete controls.
 * No TipTap dependency — uses native inputs for text editing.
 */
import { ref, computed } from 'vue';
import type { BlockEditor, EditorBlock } from '../../composables/useBlockEditor.js';

const props = defineProps<{ blockEditor: BlockEditor }>();

const draggedId = ref<string | null>(null);

function onDragStart(id: string): void { draggedId.value = id; }
function onDragEnd(): void { draggedId.value = null; }
function onDrop(targetId: string): void {
  if (!draggedId.value || draggedId.value === targetId) return;
  const from = props.blockEditor.getBlockIndex(draggedId.value);
  const to = props.blockEditor.getBlockIndex(targetId);
  if (from >= 0 && to >= 0) props.blockEditor.moveBlock(from, to);
  draggedId.value = null;
}

function updateField(block: EditorBlock, field: string, value: unknown): void {
  props.blockEditor.updateBlock(block.id, { [field]: value });
}

const isSelected = (id: string) => props.blockEditor.selectedBlockId.value === id;
</script>

<template>
  <div class="cpub-canvas">
    <div v-if="blockEditor.isEmpty.value" class="cpub-canvas-empty">
      <p>No blocks yet. Add blocks from the palette.</p>
    </div>

    <div
      v-for="block in blockEditor.blocks.value"
      :key="block.id"
      class="cpub-canvas-block"
      :class="{ selected: isSelected(block.id), dragging: draggedId === block.id }"
      draggable="true"
      @click="blockEditor.selectBlock(block.id)"
      @dragstart="onDragStart(block.id)"
      @dragend="onDragEnd"
      @dragover.prevent
      @drop="onDrop(block.id)"
    >
      <!-- Block controls -->
      <div class="cpub-block-controls">
        <span class="cpub-block-type-label">{{ block.type }}</span>
        <button class="cpub-block-ctrl" title="Move up" @click.stop="blockEditor.moveBlockUp(block.id)">&uarr;</button>
        <button class="cpub-block-ctrl" title="Move down" @click.stop="blockEditor.moveBlockDown(block.id)">&darr;</button>
        <button class="cpub-block-ctrl" title="Duplicate" @click.stop="blockEditor.duplicateBlock(block.id)">&#8910;</button>
        <button class="cpub-block-ctrl cpub-block-ctrl--danger" title="Delete" @click.stop="blockEditor.removeBlock(block.id)">&times;</button>
      </div>

      <!-- Inline block editors by type -->
      <div class="cpub-block-body">
        <!-- Text / Paragraph -->
        <div v-if="block.type === 'paragraph' || block.type === 'text'">
          <textarea class="cpub-inline-textarea" :value="(block.content.html as string) || ''" placeholder="Write text (HTML)..." rows="3" @input="updateField(block, 'html', ($event.target as HTMLTextAreaElement).value)" />
        </div>

        <!-- Heading -->
        <div v-else-if="block.type === 'heading'" class="cpub-inline-row">
          <select class="cpub-inline-select" :value="block.content.level || 2" @change="updateField(block, 'level', Number(($event.target as HTMLSelectElement).value))">
            <option :value="1">H1</option><option :value="2">H2</option><option :value="3">H3</option><option :value="4">H4</option>
          </select>
          <input class="cpub-inline-input" type="text" :value="(block.content.text as string) || ''" placeholder="Heading text..." @input="updateField(block, 'text', ($event.target as HTMLInputElement).value)" />
        </div>

        <!-- Section Header -->
        <div v-else-if="block.type === 'sectionHeader'" class="cpub-inline-stack">
          <div class="cpub-inline-row">
            <input class="cpub-inline-input cpub-inline-input--sm" type="text" :value="(block.content.tag as string) || ''" placeholder="Tag (§ 01)" @input="updateField(block, 'tag', ($event.target as HTMLInputElement).value)" />
            <input class="cpub-inline-input" type="text" :value="(block.content.title as string) || ''" placeholder="Section title..." @input="updateField(block, 'title', ($event.target as HTMLInputElement).value)" />
          </div>
          <textarea class="cpub-inline-textarea" :value="(block.content.body as string) || ''" placeholder="Section intro..." rows="2" @input="updateField(block, 'body', ($event.target as HTMLTextAreaElement).value)" />
        </div>

        <!-- Code -->
        <div v-else-if="block.type === 'code_block' || block.type === 'code'" class="cpub-inline-stack">
          <div class="cpub-inline-row">
            <input class="cpub-inline-input cpub-inline-input--sm" type="text" :value="(block.content.language as string) || ''" placeholder="Language" @input="updateField(block, 'language', ($event.target as HTMLInputElement).value)" />
            <input class="cpub-inline-input" type="text" :value="(block.content.filename as string) || ''" placeholder="Filename" @input="updateField(block, 'filename', ($event.target as HTMLInputElement).value)" />
          </div>
          <textarea class="cpub-inline-textarea cpub-inline-textarea--code" :value="(block.content.code as string) || ''" placeholder="Code..." rows="5" @input="updateField(block, 'code', ($event.target as HTMLTextAreaElement).value)" />
        </div>

        <!-- Image -->
        <div v-else-if="block.type === 'image'" class="cpub-inline-stack">
          <input class="cpub-inline-input" type="url" :value="(block.content.src as string) || ''" placeholder="Image URL..." @input="updateField(block, 'src', ($event.target as HTMLInputElement).value)" />
          <input class="cpub-inline-input" type="text" :value="(block.content.alt as string) || ''" placeholder="Alt text..." @input="updateField(block, 'alt', ($event.target as HTMLInputElement).value)" />
          <input class="cpub-inline-input" type="text" :value="(block.content.caption as string) || ''" placeholder="Caption..." @input="updateField(block, 'caption', ($event.target as HTMLInputElement).value)" />
        </div>

        <!-- Callout -->
        <div v-else-if="block.type === 'callout'" class="cpub-inline-stack">
          <select class="cpub-inline-select" :value="block.content.variant || 'info'" @change="updateField(block, 'variant', ($event.target as HTMLSelectElement).value)">
            <option value="info">Info</option><option value="tip">Tip</option><option value="warning">Warning</option><option value="danger">Danger</option>
          </select>
          <textarea class="cpub-inline-textarea" :value="(block.content.html as string) || ''" placeholder="Callout content (HTML)..." rows="2" @input="updateField(block, 'html', ($event.target as HTMLTextAreaElement).value)" />
        </div>

        <!-- Quiz -->
        <div v-else-if="block.type === 'quiz'" class="cpub-inline-stack">
          <input class="cpub-inline-input" type="text" :value="(block.content.question as string) || ''" placeholder="Question..." @input="updateField(block, 'question', ($event.target as HTMLInputElement).value)" />
          <div class="cpub-quiz-options-editor">
            <div v-for="(opt, i) in ((block.content.options as Array<{text: string; correct: boolean}>) || [])" :key="i" class="cpub-quiz-opt-row">
              <input type="checkbox" :checked="opt.correct" @change="() => { const opts = [...(block.content.options as Array<{text:string;correct:boolean}>)]; opts[i] = { ...opts[i]!, correct: !opt.correct }; updateField(block, 'options', opts); }" />
              <input class="cpub-inline-input" type="text" :value="opt.text" placeholder="Option text..." @input="(e) => { const opts = [...(block.content.options as Array<{text:string;correct:boolean}>)]; opts[i] = { ...opts[i]!, text: (e.target as HTMLInputElement).value }; updateField(block, 'options', opts); }" />
              <button class="cpub-block-ctrl cpub-block-ctrl--danger" @click="() => { const opts = [...(block.content.options as Array<{text:string;correct:boolean}>)]; opts.splice(i, 1); updateField(block, 'options', opts); }">&times;</button>
            </div>
            <button class="cpub-add-option-btn" @click="() => { const opts = [...((block.content.options as Array<{text:string;correct:boolean}>) || []), { text: '', correct: false }]; updateField(block, 'options', opts); }">+ Add Option</button>
          </div>
        </div>

        <!-- Slider -->
        <div v-else-if="block.type === 'interactiveSlider' || block.type === 'slider'" class="cpub-inline-stack">
          <input class="cpub-inline-input" type="text" :value="(block.content.label as string) || ''" placeholder="Label..." @input="updateField(block, 'label', ($event.target as HTMLInputElement).value)" />
          <div class="cpub-inline-row">
            <input class="cpub-inline-input cpub-inline-input--sm" type="number" :value="block.content.min" placeholder="Min" @input="updateField(block, 'min', Number(($event.target as HTMLInputElement).value))" />
            <input class="cpub-inline-input cpub-inline-input--sm" type="number" :value="block.content.max" placeholder="Max" @input="updateField(block, 'max', Number(($event.target as HTMLInputElement).value))" />
            <input class="cpub-inline-input cpub-inline-input--sm" type="number" :value="block.content.step" placeholder="Step" @input="updateField(block, 'step', Number(($event.target as HTMLInputElement).value))" />
            <input class="cpub-inline-input cpub-inline-input--sm" type="text" :value="(block.content.unit as string) || ''" placeholder="Unit" @input="updateField(block, 'unit', ($event.target as HTMLInputElement).value)" />
          </div>
        </div>

        <!-- Checkpoint -->
        <div v-else-if="block.type === 'checkpoint'">
          <input class="cpub-inline-input" type="text" :value="(block.content.label as string) || ''" placeholder="Checkpoint label..." @input="updateField(block, 'label', ($event.target as HTMLInputElement).value)" />
        </div>

        <!-- Quote -->
        <div v-else-if="block.type === 'blockquote' || block.type === 'quote'" class="cpub-inline-stack">
          <textarea class="cpub-inline-textarea" :value="(block.content.html as string) || ''" placeholder="Quote (HTML)..." rows="2" @input="updateField(block, 'html', ($event.target as HTMLTextAreaElement).value)" />
          <input class="cpub-inline-input" type="text" :value="(block.content.attribution as string) || ''" placeholder="Attribution..." @input="updateField(block, 'attribution', ($event.target as HTMLInputElement).value)" />
        </div>

        <!-- Embed -->
        <div v-else-if="block.type === 'embed'">
          <input class="cpub-inline-input" type="url" :value="(block.content.url as string) || ''" placeholder="Embed URL..." @input="updateField(block, 'url', ($event.target as HTMLInputElement).value)" />
        </div>

        <!-- Divider -->
        <div v-else-if="block.type === 'horizontal_rule' || block.type === 'divider'">
          <hr class="cpub-inline-divider" />
        </div>

        <!-- Fallback -->
        <div v-else class="cpub-inline-fallback">
          <pre class="cpub-inline-json">{{ JSON.stringify(block.content, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-canvas { display: flex; flex-direction: column; gap: 2px; padding: 16px; min-height: 200px; }
.cpub-canvas-empty { text-align: center; padding: 60px 20px; color: var(--text-faint); font-size: 13px; }
.cpub-canvas-block { position: relative; border: var(--border-width-default) solid transparent; padding: 8px 12px; transition: border-color 0.1s, background 0.1s; cursor: grab; }
.cpub-canvas-block:hover { border-color: var(--border2); background: var(--surface); }
.cpub-canvas-block.selected { border-color: var(--accent); background: var(--accent-bg); }
.cpub-canvas-block.dragging { opacity: 0.4; }
.cpub-block-controls { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.cpub-block-type-label { font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); flex: 1; }
.cpub-block-ctrl { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: var(--surface2); border: 1px solid var(--border2); color: var(--text-faint); cursor: pointer; font-size: 11px; }
.cpub-block-ctrl:hover { background: var(--surface3); color: var(--text); }
.cpub-block-ctrl--danger:hover { color: var(--red); }
.cpub-block-body { }
.cpub-inline-input { width: 100%; padding: 6px 8px; border: 1px solid var(--border2); background: var(--surface); font-size: 12px; color: var(--text); outline: none; font-family: inherit; }
.cpub-inline-input:focus { border-color: var(--accent); }
.cpub-inline-input--sm { max-width: 100px; }
.cpub-inline-textarea { width: 100%; padding: 6px 8px; border: 1px solid var(--border2); background: var(--surface); font-size: 12px; color: var(--text); outline: none; resize: vertical; font-family: inherit; line-height: 1.5; }
.cpub-inline-textarea:focus { border-color: var(--accent); }
.cpub-inline-textarea--code { font-family: var(--font-mono); font-size: 11px; background: #0d1117; color: #e6edf3; border-color: #30363d; }
.cpub-inline-select { padding: 5px 8px; border: 1px solid var(--border2); background: var(--surface); font-size: 11px; font-family: var(--font-mono); color: var(--text); cursor: pointer; }
.cpub-inline-row { display: flex; gap: 6px; align-items: center; }
.cpub-inline-stack { display: flex; flex-direction: column; gap: 6px; }
.cpub-inline-divider { border: none; border-top: 2px dashed var(--border2); margin: 8px 0; }
.cpub-inline-fallback { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }
.cpub-inline-json { margin: 0; white-space: pre-wrap; }
.cpub-quiz-options-editor { display: flex; flex-direction: column; gap: 4px; }
.cpub-quiz-opt-row { display: flex; align-items: center; gap: 6px; }
.cpub-quiz-opt-row input[type="checkbox"] { cursor: pointer; }
.cpub-add-option-btn { align-self: flex-start; padding: 4px 10px; font-size: 11px; background: var(--surface2); border: 1px solid var(--border2); color: var(--text-dim); cursor: pointer; font-family: inherit; }
.cpub-add-option-btn:hover { background: var(--surface3); color: var(--text); }
</style>
