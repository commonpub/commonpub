import type { ComputedRef, MaybeRef } from 'vue'

type ComponentProps<T> = T extends new(...args: any) => { $props: infer P } ? NonNullable<P>
  : T extends (props: infer P, ...args: any) => any ? P
  : {}

declare module 'nuxt/app' {
  interface NuxtLayouts {
    admin: ComponentProps<typeof import("/Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference/layouts/admin.vue").default>,
    auth: ComponentProps<typeof import("/Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference/layouts/auth.vue").default>,
    default: ComponentProps<typeof import("/Users/obsidian/Projects/ossuary-projects/snaplify/apps/reference/layouts/default.vue").default>,
}
  export type LayoutKey = keyof NuxtLayouts extends never ? string : keyof NuxtLayouts
  interface PageMeta {
    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>
  }
}