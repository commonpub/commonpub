# Research: Explainer Runtime — Animation & Scroll Libraries

## GSAP + ScrollTrigger Licensing

- **GSAP 3.x** is free for most use cases under the standard license
- **ScrollTrigger** is a free GSAP plugin (not a Club plugin)
- **GSAP "No Charge" license** allows use in open-source projects that are not tools/templates competing with GSAP
- CommonPub qualifies: it's a community platform, not an animation tool
- **Club GreenSock plugins** (MorphSVG, SplitText, DrawSVG) require paid license — avoid these
- GSAP 3.12+ is ~50KB gzipped (core + ScrollTrigger)

## Alternatives Evaluated

### Motion One (now Motion for JavaScript)

- Pros: Small (~3KB), Web Animations API-based, tree-shakeable
- Cons: No scroll-driven animation built-in (needs IntersectionObserver), less battle-tested for complex sequences
- Verdict: Good for simple animations, insufficient for section-based scroll narratives

### Web Animations API (native)

- Pros: Zero dependency, browser-native, performant
- Cons: No scroll-linking API (Scroll-driven Animations API is Chrome-only as of 2025), complex timeline management
- Verdict: Not ready for cross-browser scroll-driven animation

### CSS Scroll Snap

- Pros: Native, performant, zero JS
- Cons: No programmatic control, no animation triggers, no progress tracking
- Verdict: Good for section snapping UX, but not a replacement for animation orchestration

### Lenis + GSAP

- Pros: Smooth scroll + GSAP ScrollTrigger integration
- Cons: Extra dependency, opinionated scroll behavior
- Verdict: Consider for Phase 5b if smooth scroll is needed

## Decision

**Phase 5 (core)**: No animation library. Sections render statically. CSS scroll-snap for section navigation. Vanilla JS for quiz interactivity.

**Phase 5b (animations)**: GSAP + ScrollTrigger. Tree-shake unused plugins. Load dynamically only when `includeAnimations: true`. Graceful degradation: content readable without JS.

## Prior Art: Interactive Section-Based Content

### Observable / ObservableHQ

- Notebook-style cells with reactive code
- Each cell is a unit of content + computation
- Scroll-based visibility triggers re-evaluation
- Takeaway: Section-as-unit model works well

### Brilliant.org

- Step-by-step interactive lessons with quizzes gating progress
- Each step has text + interactive widget (slider, visualization)
- Progress bar at top, TOC sidebar
- Takeaway: Gate model (quiz must pass before next section) is effective

### Scrollama

- Lightweight scroll-driven storytelling library
- IntersectionObserver-based step triggers
- No animation — just "enter/exit" callbacks
- Takeaway: Good abstraction for step-based scrolling, but GSAP ScrollTrigger is more powerful

### Idyll

- Markup language for interactive documents
- Components embedded in narrative text
- Compiles to React
- Takeaway: Structured sections with embedded interactivity is the right model

## Scroll-Snap CSS vs ScrollTrigger

| Feature             | CSS Scroll Snap | GSAP ScrollTrigger      |
| ------------------- | --------------- | ----------------------- |
| Section snapping    | Yes (native)    | Yes (with snap plugin)  |
| Animation on scroll | No              | Yes                     |
| Progress tracking   | No              | Yes (onUpdate callback) |
| Pin sections        | No              | Yes                     |
| Browser support     | Excellent       | Excellent               |
| JS required         | No              | Yes                     |
| Bundle size         | 0               | ~50KB gzipped           |

**Conclusion**: Use CSS scroll-snap in Phase 5 for zero-JS section navigation. Add ScrollTrigger in Phase 5b for animations.
