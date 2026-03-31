/** Data-agnostic view models for hub components.
 *  Components accept these shapes — pages map domain types into them. */

export interface HubViewModel {
  name: string
  description: string | null
  iconUrl: string | null
  bannerUrl: string | null
  hubType: 'community' | 'product' | 'company'
  memberCount: number
  postCount: number
  foundedLabel: string | null
  isOfficial: boolean
  joinPolicy: string | null
  categories: string[] | null
  website: string | null
}

export interface HubPostViewModel {
  id: string
  type: string
  content: string
  author: HubPostAuthor
  createdAt: string
  likeCount: number
  replyCount: number
  isPinned: boolean
  isLocked: boolean
  linkTo: string | null
  sharedContent?: {
    type: string
    slug: string
    title: string
    description: string | null
    coverImageUrl: string | null
    /** External URL for federated shared content (when slug isn't a local route) */
    url?: string | null
  }
}

export interface HubPostAuthor {
  name: string
  handle: string | null
  avatarUrl: string | null
}

export interface HubMemberViewModel {
  name: string
  username: string
  role: string
  avatarUrl: string | null
  profileLink: string
  joinedAt: string
}

export interface HubTabDef {
  value: string
  label: string
  icon: string
  count?: number
}
