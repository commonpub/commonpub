
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


export const AnnouncementBand: typeof import("../components/AnnouncementBand.vue")['default']
export const AuthorCard: typeof import("../components/AuthorCard.vue")['default']
export const AuthorRow: typeof import("../components/AuthorRow.vue")['default']
export const CommentSection: typeof import("../components/CommentSection.vue")['default']
export const ContentCard: typeof import("../components/ContentCard.vue")['default']
export const ContentTypeBadge: typeof import("../components/ContentTypeBadge.vue")['default']
export const CountdownTimer: typeof import("../components/CountdownTimer.vue")['default']
export const CpubEditor: typeof import("../components/CpubEditor.vue")['default']
export const DiscussionItem: typeof import("../components/DiscussionItem.vue")['default']
export const EditorBlockLibrary: typeof import("../components/EditorBlockLibrary.vue")['default']
export const EditorPropertiesPanel: typeof import("../components/EditorPropertiesPanel.vue")['default']
export const EditorToolbar: typeof import("../components/EditorToolbar.vue")['default']
export const EngagementBar: typeof import("../components/EngagementBar.vue")['default']
export const FeedItem: typeof import("../components/FeedItem.vue")['default']
export const FilterChip: typeof import("../components/FilterChip.vue")['default']
export const HeatmapGrid: typeof import("../components/HeatmapGrid.vue")['default']
export const MemberCard: typeof import("../components/MemberCard.vue")['default']
export const MessageThread: typeof import("../components/MessageThread.vue")['default']
export const NotificationItem: typeof import("../components/NotificationItem.vue")['default']
export const ProgressTracker: typeof import("../components/ProgressTracker.vue")['default']
export const SectionHeader: typeof import("../components/SectionHeader.vue")['default']
export const SkillBar: typeof import("../components/SkillBar.vue")['default']
export const SortSelect: typeof import("../components/SortSelect.vue")['default']
export const StatBar: typeof import("../components/StatBar.vue")['default']
export const TOCNav: typeof import("../components/TOCNav.vue")['default']
export const TimelineItem: typeof import("../components/TimelineItem.vue")['default']
export const VideoCard: typeof import("../components/VideoCard.vue")['default']
export const EditorsArticleEditor: typeof import("../components/editors/ArticleEditor.vue")['default']
export const EditorsBlogEditor: typeof import("../components/editors/BlogEditor.vue")['default']
export const EditorsEditorShell: typeof import("../components/editors/EditorShell.vue")['default']
export const EditorsExplainerEditor: typeof import("../components/editors/ExplainerEditor.vue")['default']
export const EditorsFloatingToolbar: typeof import("../components/editors/FloatingToolbar.vue")['default']
export const EditorsProjectEditor: typeof import("../components/editors/ProjectEditor.vue")['default']
export const ViewsArticleView: typeof import("../components/views/ArticleView.vue")['default']
export const ViewsBlogView: typeof import("../components/views/BlogView.vue")['default']
export const ViewsExplainerView: typeof import("../components/views/ExplainerView.vue")['default']
export const ViewsProjectView: typeof import("../components/views/ProjectView.vue")['default']
export const NuxtWelcome: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/welcome.vue")['default']
export const NuxtLayout: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-layout")['default']
export const NuxtErrorBoundary: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
export const ClientOnly: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/client-only")['default']
export const DevOnly: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/dev-only")['default']
export const ServerPlaceholder: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/server-placeholder")['default']
export const NuxtLink: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-link")['default']
export const NuxtLoadingIndicator: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
export const NuxtTime: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
export const NuxtRouteAnnouncer: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
export const NuxtImg: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
export const NuxtPicture: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
export const NuxtPage: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/pages/runtime/page")['default']
export const NoScript: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['NoScript']
export const Link: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Link']
export const Base: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Base']
export const Title: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Title']
export const Meta: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Meta']
export const Style: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Style']
export const Head: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Head']
export const Html: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Html']
export const Body: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Body']
export const NuxtIsland: typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-island")['default']
export const LazyAnnouncementBand: LazyComponent<typeof import("../components/AnnouncementBand.vue")['default']>
export const LazyAuthorCard: LazyComponent<typeof import("../components/AuthorCard.vue")['default']>
export const LazyAuthorRow: LazyComponent<typeof import("../components/AuthorRow.vue")['default']>
export const LazyCommentSection: LazyComponent<typeof import("../components/CommentSection.vue")['default']>
export const LazyContentCard: LazyComponent<typeof import("../components/ContentCard.vue")['default']>
export const LazyContentTypeBadge: LazyComponent<typeof import("../components/ContentTypeBadge.vue")['default']>
export const LazyCountdownTimer: LazyComponent<typeof import("../components/CountdownTimer.vue")['default']>
export const LazyCpubEditor: LazyComponent<typeof import("../components/CpubEditor.vue")['default']>
export const LazyDiscussionItem: LazyComponent<typeof import("../components/DiscussionItem.vue")['default']>
export const LazyEditorBlockLibrary: LazyComponent<typeof import("../components/EditorBlockLibrary.vue")['default']>
export const LazyEditorPropertiesPanel: LazyComponent<typeof import("../components/EditorPropertiesPanel.vue")['default']>
export const LazyEditorToolbar: LazyComponent<typeof import("../components/EditorToolbar.vue")['default']>
export const LazyEngagementBar: LazyComponent<typeof import("../components/EngagementBar.vue")['default']>
export const LazyFeedItem: LazyComponent<typeof import("../components/FeedItem.vue")['default']>
export const LazyFilterChip: LazyComponent<typeof import("../components/FilterChip.vue")['default']>
export const LazyHeatmapGrid: LazyComponent<typeof import("../components/HeatmapGrid.vue")['default']>
export const LazyMemberCard: LazyComponent<typeof import("../components/MemberCard.vue")['default']>
export const LazyMessageThread: LazyComponent<typeof import("../components/MessageThread.vue")['default']>
export const LazyNotificationItem: LazyComponent<typeof import("../components/NotificationItem.vue")['default']>
export const LazyProgressTracker: LazyComponent<typeof import("../components/ProgressTracker.vue")['default']>
export const LazySectionHeader: LazyComponent<typeof import("../components/SectionHeader.vue")['default']>
export const LazySkillBar: LazyComponent<typeof import("../components/SkillBar.vue")['default']>
export const LazySortSelect: LazyComponent<typeof import("../components/SortSelect.vue")['default']>
export const LazyStatBar: LazyComponent<typeof import("../components/StatBar.vue")['default']>
export const LazyTOCNav: LazyComponent<typeof import("../components/TOCNav.vue")['default']>
export const LazyTimelineItem: LazyComponent<typeof import("../components/TimelineItem.vue")['default']>
export const LazyVideoCard: LazyComponent<typeof import("../components/VideoCard.vue")['default']>
export const LazyEditorsArticleEditor: LazyComponent<typeof import("../components/editors/ArticleEditor.vue")['default']>
export const LazyEditorsBlogEditor: LazyComponent<typeof import("../components/editors/BlogEditor.vue")['default']>
export const LazyEditorsEditorShell: LazyComponent<typeof import("../components/editors/EditorShell.vue")['default']>
export const LazyEditorsExplainerEditor: LazyComponent<typeof import("../components/editors/ExplainerEditor.vue")['default']>
export const LazyEditorsFloatingToolbar: LazyComponent<typeof import("../components/editors/FloatingToolbar.vue")['default']>
export const LazyEditorsProjectEditor: LazyComponent<typeof import("../components/editors/ProjectEditor.vue")['default']>
export const LazyViewsArticleView: LazyComponent<typeof import("../components/views/ArticleView.vue")['default']>
export const LazyViewsBlogView: LazyComponent<typeof import("../components/views/BlogView.vue")['default']>
export const LazyViewsExplainerView: LazyComponent<typeof import("../components/views/ExplainerView.vue")['default']>
export const LazyViewsProjectView: LazyComponent<typeof import("../components/views/ProjectView.vue")['default']>
export const LazyNuxtWelcome: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/welcome.vue")['default']>
export const LazyNuxtLayout: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
export const LazyNuxtErrorBoundary: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
export const LazyClientOnly: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/client-only")['default']>
export const LazyDevOnly: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/dev-only")['default']>
export const LazyServerPlaceholder: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyNuxtLink: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-link")['default']>
export const LazyNuxtLoadingIndicator: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
export const LazyNuxtTime: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
export const LazyNuxtImg: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
export const LazyNuxtPicture: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
export const LazyNuxtPage: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/pages/runtime/page")['default']>
export const LazyNoScript: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['NoScript']>
export const LazyLink: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Link']>
export const LazyBase: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Base']>
export const LazyTitle: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Title']>
export const LazyMeta: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Meta']>
export const LazyStyle: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Style']>
export const LazyHead: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Head']>
export const LazyHtml: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Html']>
export const LazyBody: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/head/runtime/components")['Body']>
export const LazyNuxtIsland: LazyComponent<typeof import("../../../node_modules/.pnpm/nuxt@3.21.1_@parcel+watcher@2.5.6_@vue+compiler-sfc@3.5.30_cac@6.7.14_db0@0.3.4_drizzle_e8e72a41c8f7c29d2b6fa04784db8f7b/node_modules/nuxt/dist/app/components/nuxt-island")['default']>

export const componentNames: string[]
