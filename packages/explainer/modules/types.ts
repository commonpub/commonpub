import type { Component } from 'vue';

/** Module category for grouping in the picker */
export type ModuleCategory = 'layout' | 'input' | 'display' | 'simulation' | 'custom';

/** Module metadata — every module must export this */
export interface ModuleMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: ModuleCategory;
  /** Which content fields this module uses in the section editor */
  contentFields: {
    heading?: boolean;
    body?: boolean;
    insight?: boolean;
    bridge?: boolean;
    aside?: boolean;
  };
}

/** A config field definition for the module's config panel */
export interface ConfigField {
  key: string;
  title: string;
  type: 'text' | 'number' | 'textarea' | 'toggle' | 'select' | 'code' | 'color' | 'array';
  default?: unknown;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  group?: string;
  width?: 'full' | 'half';
  advanced?: boolean;
}

/** A loaded module with all its parts resolved */
export interface LoadedModule {
  meta: ModuleMeta;
  viewer: Component;
  configFields: ConfigField[];
}
