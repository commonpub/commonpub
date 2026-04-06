import type { Component } from 'vue';
import type { LoadedModule, ConfigField } from './types';

// Module meta imports
import heroMeta from './hero/meta';
import conclusionMeta from './conclusion/meta';
import textOnlyMeta from './text-only/meta';
import sliderMeta from './slider/meta';
import quizMeta from './quiz/meta';
import toggleMeta from './toggle/meta';
import revealCardsMeta from './reveal-cards/meta';
import compareMeta from './compare/meta';
import clickableCardsMeta from './clickable-cards/meta';
import customHtmlMeta from './custom-html/meta';

// Module config imports
import sliderConfig from './slider/config';
import quizConfig from './quiz/config';
import toggleConfig from './toggle/config';
import revealCardsConfig from './reveal-cards/config';
import compareConfig from './compare/config';
import clickableCardsConfig from './clickable-cards/config';
import customHtmlConfig from './custom-html/config';

// Module viewer imports
import SliderBlock from '../vue/components/blocks/SliderBlock.vue';
import QuizBlock from '../vue/components/blocks/QuizBlock.vue';
import ToggleViewer from './toggle/Viewer.vue';
import RevealCardsViewer from './reveal-cards/Viewer.vue';
import CompareViewer from './compare/Viewer.vue';
import ClickableCardsViewer from './clickable-cards/Viewer.vue';
import CustomHtmlViewer from './custom-html/Viewer.vue';

/** All registered modules */
export const modules: Map<string, LoadedModule> = new Map();

// Register layout modules (no viewer — handled by dedicated renderers)
modules.set('hero', { meta: heroMeta, viewer: null as unknown as Component, configFields: [] });
modules.set('conclusion', { meta: conclusionMeta, viewer: null as unknown as Component, configFields: [] });
modules.set('text-only', { meta: textOnlyMeta, viewer: null as unknown as Component, configFields: [] });

// Register interactive modules
modules.set('slider', { meta: sliderMeta, viewer: SliderBlock, configFields: sliderConfig });
modules.set('quiz', { meta: quizMeta, viewer: QuizBlock, configFields: quizConfig });
modules.set('toggle', { meta: toggleMeta, viewer: ToggleViewer, configFields: toggleConfig });
modules.set('reveal-cards', { meta: revealCardsMeta, viewer: RevealCardsViewer, configFields: revealCardsConfig });
modules.set('compare', { meta: compareMeta, viewer: CompareViewer, configFields: compareConfig });
modules.set('clickable-cards', { meta: clickableCardsMeta, viewer: ClickableCardsViewer, configFields: clickableCardsConfig });
modules.set('custom-html', { meta: customHtmlMeta, viewer: CustomHtmlViewer, configFields: customHtmlConfig });

/** Get a module by ID */
export function getModule(id: string): LoadedModule | undefined {
  return modules.get(id);
}

/** Get all modules grouped by category */
export function getModulesByCategory(): Map<string, LoadedModule[]> {
  const grouped = new Map<string, LoadedModule[]>();
  for (const mod of modules.values()) {
    const cat = mod.meta.category;
    const list = grouped.get(cat) ?? [];
    list.push(mod);
    grouped.set(cat, list);
  }
  return grouped;
}

/** Get the viewer component for a module type */
export function getModuleViewer(type: string): Component | null {
  return modules.get(type)?.viewer ?? null;
}

/** Get the config fields for a module type */
export function getModuleConfig(type: string): ConfigField[] {
  return modules.get(type)?.configFields ?? [];
}

/** Get all interactive module IDs (non-layout) */
export function getInteractiveModuleIds(): string[] {
  return [...modules.entries()]
    .filter(([, mod]) => mod.meta.category !== 'layout')
    .map(([id]) => id);
}

/** Build a component map for the viewer's InteractiveContainer */
export function buildModuleMap(): Record<string, Component> {
  const map: Record<string, Component> = {};
  for (const [id, mod] of modules.entries()) {
    if (mod.viewer && mod.meta.category !== 'layout') {
      map[id] = mod.viewer;
    }
  }
  return map;
}
