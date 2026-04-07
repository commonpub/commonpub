/**
 * Provide/inject keys for block editor component customization.
 *
 * Consumers can override individual block components by providing a component map:
 *
 * ```ts
 * import { provide } from 'vue';
 * import { BLOCK_COMPONENTS_KEY, type BlockComponentMap } from '@commonpub/editor/vue';
 * import CustomImageBlock from './CustomImageBlock.vue';
 *
 * provide(BLOCK_COMPONENTS_KEY, { image: CustomImageBlock });
 * ```
 *
 * BlockCanvas merges provided overrides with its built-in component map,
 * so you only need to provide the components you want to override.
 */
import type { InjectionKey, Component } from 'vue';

export type BlockComponentMap = Record<string, Component>;

/** Injection key for block component overrides */
export const BLOCK_COMPONENTS_KEY: InjectionKey<BlockComponentMap> = Symbol('cpub-block-components');

/** Injection key for upload handler */
export const UPLOAD_HANDLER_KEY: InjectionKey<(file: File) => Promise<{ url: string; width?: number | null; height?: number | null }>> = Symbol('cpub-upload-handler');

/** Injection key for product search handler */
export const SEARCH_PRODUCTS_KEY: InjectionKey<(query: string) => Promise<Array<{ id: string; name: string; slug: string; description: string | null; category: string | null; imageUrl: string | null; purchaseUrl: string | null }>>> = Symbol('cpub-search-products');
