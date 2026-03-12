# CommonPub Restructure — Master Plan

Saved copy of the restructure plan. See the implementation prompt for full details.

## Phases

- **Phase 0**: Preparation & Tracking ✅
- **Phase 1**: Global Rename (commonpub → commonpub)
- **Phase 2**: Delete & Prepare for Framework Switch
- **Phase 3**: Server Logic Library + Protocol/Auth Fixes
- **Phase 4**: Design Token System Rebuild
- **Phase 5**: UI Component Library Rebuild (Vue 3)
- **Phase 6**: Reference App Rebuild (Nuxt 3)
- **Phase 7**: Documentation & Cleanup

## Execution Order

```
Phase 0 (prep)              — read-only, tracking files
  ↓
Phase 1 (rename)            — mechanical, build must pass
  ↓
Phase 2 (delete + prep)     — remove Svelte, add Vue/Nuxt deps
  ↓
  ├─ Phase 3 (server lib + fixes)  — framework-agnostic
  ├─ Phase 4 (tokens)              — CSS only
  │    ↓
  │  Phase 5 (UI rebuild in Vue)   — depends on Phase 4
  │    ↓
  │  Phase 6 (Nuxt ref app)        — depends on Phase 3 + 5
  ↓
Phase 7 (docs)              — after everything
```
