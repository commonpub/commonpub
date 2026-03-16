
import type { DefineComponent, SlotsType } from 'vue'
type IslandComponent<T> = DefineComponent<{}, {refresh: () => Promise<void>}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, SlotsType<{ fallback: { error: unknown } }>> & T

type HydrationStrategies = {
  hydrateOnVisible?: IntersectionObserverInit | true
  hydrateOnIdle?: number | true
  hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true
  hydrateOnMediaQuery?: string
  hydrateAfter?: number
  hydrateWhen?: boolean
  hydrateNever?: true
}
type LazyComponent<T> = DefineComponent<HydrationStrategies, {}, {}, {}, {}, {}, {}, { hydrated: () => void }> & T

interface _GlobalComponents {
  AnnouncementBand: typeof import("../../components/AnnouncementBand.vue")['default']
  AuthorCard: typeof import("../../components/AuthorCard.vue")['default']
  AuthorRow: typeof import("../../components/AuthorRow.vue")['default']
  CommentSection: typeof import("../../components/CommentSection.vue")['default']
  ContentCard: typeof import("../../components/ContentCard.vue")['default']
  ContentTypeBadge: typeof import("../../components/ContentTypeBadge.vue")['default']
  CountdownTimer: typeof import("../../components/CountdownTimer.vue")['default']
  CpubEditor: typeof import("../../components/CpubEditor.vue")['default']
  DiscussionItem: typeof import("../../components/DiscussionItem.vue")['default']
  EditorBlockLibrary: typeof import("../../components/EditorBlockLibrary.vue")['default']
  EditorPropertiesPanel: typeof import("../../components/EditorPropertiesPanel.vue")['default']
  EditorToolbar: typeof import("../../components/EditorToolbar.vue")['default']
  EngagementBar: typeof import("../../components/EngagementBar.vue")['default']
  FeedItem: typeof import("../../components/FeedItem.vue")['default']
  FilterChip: typeof import("../../components/FilterChip.vue")['default']
  HeatmapGrid: typeof import("../../components/HeatmapGrid.vue")['default']
  MemberCard: typeof import("../../components/MemberCard.vue")['default']
  MessageThread: typeof import("../../components/MessageThread.vue")['default']
  NotificationItem: typeof import("../../components/NotificationItem.vue")['default']
  ProgressTracker: typeof import("../../components/ProgressTracker.vue")['default']
  SectionHeader: typeof import("../../components/SectionHeader.vue")['default']
  SkillBar: typeof import("../../components/SkillBar.vue")['default']
  SortSelect: typeof import("../../components/SortSelect.vue")['default']
  StatBar: typeof import("../../components/StatBar.vue")['default']
  TOCNav: typeof import("../../components/TOCNav.vue")['default']
  TimelineItem: typeof import("../../components/TimelineItem.vue")['default']
  VideoCard: typeof import("../../components/VideoCard.vue")['default']
  EditorsArticleEditor: typeof import("../../components/editors/ArticleEditor.vue")['default']
  EditorsBlogEditor: typeof import("../../components/editors/BlogEditor.vue")['default']
  EditorsEditorShell: typeof import("../../components/editors/EditorShell.vue")['default']
  EditorsExplainerEditor: typeof import("../../components/editors/ExplainerEditor.vue")['default']
  EditorsFloatingToolbar: typeof import("../../components/editors/FloatingToolbar.vue")['default']
  EditorsProjectEditor: typeof import("../../components/editors/ProjectEditor.vue")['default']
  ViewsArticleView: typeof import("../../components/views/ArticleView.vue")['default']
  ViewsBlogView: typeof import("../../components/views/BlogView.vue")['default']
  ViewsExplainerView: typeof import("../../components/views/ExplainerView.vue")['default']
  ViewsProjectView: typeof import("../../components/views/ProjectView.vue")['default']
  NuxtWelcome: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/welcome.vue")['default']
  NuxtLayout: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-layout")['default']
  NuxtErrorBoundary: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
  ClientOnly: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/client-only")['default']
  DevOnly: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/dev-only")['default']
  ServerPlaceholder: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/server-placeholder")['default']
  NuxtLink: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-link")['default']
  NuxtLoadingIndicator: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
  NuxtTime: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
  NuxtRouteAnnouncer: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
  NuxtImg: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
  NuxtPicture: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
  NuxtPage: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/pages/runtime/page")['default']
  NoScript: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['NoScript']
  Link: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Link']
  Base: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Base']
  Title: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Title']
  Meta: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Meta']
  Style: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Style']
  Head: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Head']
  Html: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Html']
  Body: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Body']
  NuxtIsland: typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-island")['default']
  LazyAnnouncementBand: LazyComponent<typeof import("../../components/AnnouncementBand.vue")['default']>
  LazyAuthorCard: LazyComponent<typeof import("../../components/AuthorCard.vue")['default']>
  LazyAuthorRow: LazyComponent<typeof import("../../components/AuthorRow.vue")['default']>
  LazyCommentSection: LazyComponent<typeof import("../../components/CommentSection.vue")['default']>
  LazyContentCard: LazyComponent<typeof import("../../components/ContentCard.vue")['default']>
  LazyContentTypeBadge: LazyComponent<typeof import("../../components/ContentTypeBadge.vue")['default']>
  LazyCountdownTimer: LazyComponent<typeof import("../../components/CountdownTimer.vue")['default']>
  LazyCpubEditor: LazyComponent<typeof import("../../components/CpubEditor.vue")['default']>
  LazyDiscussionItem: LazyComponent<typeof import("../../components/DiscussionItem.vue")['default']>
  LazyEditorBlockLibrary: LazyComponent<typeof import("../../components/EditorBlockLibrary.vue")['default']>
  LazyEditorPropertiesPanel: LazyComponent<typeof import("../../components/EditorPropertiesPanel.vue")['default']>
  LazyEditorToolbar: LazyComponent<typeof import("../../components/EditorToolbar.vue")['default']>
  LazyEngagementBar: LazyComponent<typeof import("../../components/EngagementBar.vue")['default']>
  LazyFeedItem: LazyComponent<typeof import("../../components/FeedItem.vue")['default']>
  LazyFilterChip: LazyComponent<typeof import("../../components/FilterChip.vue")['default']>
  LazyHeatmapGrid: LazyComponent<typeof import("../../components/HeatmapGrid.vue")['default']>
  LazyMemberCard: LazyComponent<typeof import("../../components/MemberCard.vue")['default']>
  LazyMessageThread: LazyComponent<typeof import("../../components/MessageThread.vue")['default']>
  LazyNotificationItem: LazyComponent<typeof import("../../components/NotificationItem.vue")['default']>
  LazyProgressTracker: LazyComponent<typeof import("../../components/ProgressTracker.vue")['default']>
  LazySectionHeader: LazyComponent<typeof import("../../components/SectionHeader.vue")['default']>
  LazySkillBar: LazyComponent<typeof import("../../components/SkillBar.vue")['default']>
  LazySortSelect: LazyComponent<typeof import("../../components/SortSelect.vue")['default']>
  LazyStatBar: LazyComponent<typeof import("../../components/StatBar.vue")['default']>
  LazyTOCNav: LazyComponent<typeof import("../../components/TOCNav.vue")['default']>
  LazyTimelineItem: LazyComponent<typeof import("../../components/TimelineItem.vue")['default']>
  LazyVideoCard: LazyComponent<typeof import("../../components/VideoCard.vue")['default']>
  LazyEditorsArticleEditor: LazyComponent<typeof import("../../components/editors/ArticleEditor.vue")['default']>
  LazyEditorsBlogEditor: LazyComponent<typeof import("../../components/editors/BlogEditor.vue")['default']>
  LazyEditorsEditorShell: LazyComponent<typeof import("../../components/editors/EditorShell.vue")['default']>
  LazyEditorsExplainerEditor: LazyComponent<typeof import("../../components/editors/ExplainerEditor.vue")['default']>
  LazyEditorsFloatingToolbar: LazyComponent<typeof import("../../components/editors/FloatingToolbar.vue")['default']>
  LazyEditorsProjectEditor: LazyComponent<typeof import("../../components/editors/ProjectEditor.vue")['default']>
  LazyViewsArticleView: LazyComponent<typeof import("../../components/views/ArticleView.vue")['default']>
  LazyViewsBlogView: LazyComponent<typeof import("../../components/views/BlogView.vue")['default']>
  LazyViewsExplainerView: LazyComponent<typeof import("../../components/views/ExplainerView.vue")['default']>
  LazyViewsProjectView: LazyComponent<typeof import("../../components/views/ProjectView.vue")['default']>
  LazyNuxtWelcome: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/welcome.vue")['default']>
  LazyNuxtLayout: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
  LazyNuxtErrorBoundary: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
  LazyClientOnly: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/client-only")['default']>
  LazyDevOnly: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/dev-only")['default']>
  LazyServerPlaceholder: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
  LazyNuxtLink: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-link")['default']>
  LazyNuxtLoadingIndicator: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
  LazyNuxtTime: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
  LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
  LazyNuxtImg: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
  LazyNuxtPicture: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
  LazyNuxtPage: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/pages/runtime/page")['default']>
  LazyNoScript: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['NoScript']>
  LazyLink: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Link']>
  LazyBase: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Base']>
  LazyTitle: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Title']>
  LazyMeta: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Meta']>
  LazyStyle: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Style']>
  LazyHead: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Head']>
  LazyHtml: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Html']>
  LazyBody: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Body']>
  LazyNuxtIsland: LazyComponent<typeof import("../../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-island")['default']>
}

declare module 'vue' {
  export interface GlobalComponents extends _GlobalComponents { }
}

export {}
