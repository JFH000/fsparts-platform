# Shared Footer Redesign — Design

**Date:** 2026-07-24
**Status:** Approved (pending spec review)

## Goal

Replace the current minimal `AppFooter.vue` (two lines of copyright text, no links, no branding) with a modern, premium, fully responsive footer — shared by `shop`, `calculator`, and `dashboard` exactly as today (`packages/ui/src/shell/AppFooter.vue`, consumed bare as `<AppFooter />` by all three apps) — covering: brand block with logo, quick links, contact info, newsletter signup, social icons, legal links, auto-copyright, and a back-to-top control.

## Constraints discovered during brainstorming

1. **No real content exists anywhere in the repo.** No quick-link target pages ("Servicios"/"Nosotros"/"Blog"/"Contacto"), no real email/phone/address, no real social media URLs, no newsletter backend. Confirmed via repo-wide grep before design started.
2. **`@lucide/vue` (the only icon dependency already in this monorepo) ships no brand/logo icons** — Facebook/Instagram/LinkedIn/X/GitHub do not exist in its export list (verified against `node_modules/@lucide/vue/dist/lucide-vue.d.ts`, zero matches for any of those names, case-insensitive). Lucide dropped brand marks in a past major version for trademark reasons.
3. **No dark/light theme system exists anywhere in this app** (confirmed: no `dark:` Tailwind variants, no theme composable, no `prefers-color-scheme` usage). The whole app, including the just-redesigned `AppHeader`, is light-only.

## Decisions (confirmed with user)

- **Quick links, legal links:** use the exact labels requested (Inicio/Servicios/Nosotros/Blog/Contacto; Política de privacidad/Términos y condiciones/Cookies) as configurable props, all defaulting to `href: '#'` placeholders — not real routes. The user explicitly chose this over adapting to each app's real routes.
- **Contact/social data:** all configurable via props with visible placeholder defaults (e.g. `contacto@fsparts.org`), so `<AppFooter />` keeps working unchanged in all three apps today, and real values can be passed in later without touching this component again.
- **No dark/light theme toggle.** The user explicitly said to implement nothing related to color-scheme switching. The footer itself uses a fixed dark surface (`slate-900`) as a deliberate design accent — consistent with `fsp_web`'s original `TheNavbar.vue`, which already used a dark `bg-slate-900` category-nav strip on an otherwise light page, so a dark footer is not a foreign element in this brand's visual language.
- **No new icon library.** Generic icons (mail, phone, pin, send, back-to-top arrow) come from the already-present `@lucide/vue`. The 5 brand/social icons are inline SVG (raw `<path>` data embedded as component-local constants) — zero new dependencies, matching the "avoid unnecessary libraries" requirement and lucide's own lack of brand marks.
- **Newsletter is presentational only.** No backend exists for it. The component emits `subscribe(email: string)`; if no parent listens, submitting is a harmless no-op — honest given there is nothing to send it to yet, rather than faking a "Subscribed!" success state with no real effect.
- **Scroll-reveal-on-view animation is explicitly omitted** (from the request's "extras opcionales" list). For a B2B parts catalog/calculator/admin tool, an on-scroll fade-in adds real complexity (`IntersectionObserver` setup, reduced-motion handling) for a component that's frequently the first thing rendered above the fold on short pages anyway. Hover microinteractions are kept; entrance animation is not.
- **Back-to-top button lives inside the footer**, not as a page-wide floating button. `AppFooter` is shared across apps with very different layouts — shop has a `CartDrawer` overlay, `dashboard`'s `AdminLayout` has its own `fixed`-positioned floating sidebar nav. A new always-visible fixed button from the footer risks colliding with those. Scoped inside the footer, it only appears once the user has actually scrolled to the footer, and needs no new z-index coordination with anything else in the app.

## Component: `packages/ui/src/shell/AppFooter.vue`

### Props (all optional, all with defaults — `<AppFooter />` bare keeps working)

```ts
interface FooterLink {
  label: string
  href: string
}

interface SocialLink {
  label: string
  href: string
  icon: 'facebook' | 'instagram' | 'linkedin' | 'x' | 'github'
}

interface Props {
  companyName?: string      // default: 'FSP Parts'
  description?: string      // default: 'Distribuidor especializado de repuestos HVAC/R — Colombia' (the exact tagline the current AppFooter already shows — not new fabricated copy)
  email?: string             // default: 'contacto@fsparts.org'
  phone?: string             // default: '+57 300 000 0000'
  address?: string           // default: undefined (omitted from render entirely when not provided — matches "opcional" from the original request)
  quickLinks?: FooterLink[]  // default: Inicio/Servicios/Nosotros/Blog/Contacto, all href: '#'
  legalLinks?: FooterLink[]  // default: Política de privacidad/Términos y condiciones/Cookies, all href: '#'
  socialLinks?: SocialLink[] // default: one entry per icon (facebook/instagram/linkedin/x/github), all href: '#'
}
```

### Emits

```ts
defineEmits<{ subscribe: [email: string] }>()
```

### Sections (mobile-first, CSS Grid)

1. **Brand column** — `<img>` of the already-shared logo asset (`packages/ui/src/assets/logo.png`, the same file `AppHeader` uses), `companyName`, `description`. Spans the full row on mobile, 2 columns on the desktop grid (visually the anchor of the layout, matching Stripe/Vercel-style footers where the brand column is wider than the link columns).
2. **Quick links** — `<nav aria-label="Enlaces rápidos">` + `<ul>` of `quickLinks`.
3. **Contacto** — semantic `<address>` element: email (`mailto:`), phone (`tel:`), address text if provided (each preceded by a small `Mail`/`Phone`/`MapPin` lucide icon).
4. **Newsletter** — heading, short description, `<form @submit.prevent>` with a labeled email `<input type="email">` and a submit `<button>` (Send icon), emitting `subscribe`.
5. **Social + legal row** — social icons (inline SVG, `aria-label` per platform) on one side, `legalLinks` list on the other; wraps under the divider.
6. **Bottom bar** — divider (`border-t border-slate-800`), auto-computed `&copy; {{ year }} {{ companyName }}. Todos los derechos reservados.`, and the "Volver arriba" button (smooth `window.scrollTo({ top: 0, behavior: 'smooth' })`).

### Visual design

- `bg-slate-900`, body text `text-slate-400`, headings `text-white font-semibold`, links `hover:text-white transition-colors`.
- Generous spacing: `py-16 md:py-20` main padding, `gap-10 lg:gap-12` grid gaps.
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` (brand column `lg:col-span-2`, three link/contact/newsletter columns `lg:col-span-1` each).
- Microinteractions: social icons `hover:-translate-y-0.5 hover:text-white transition-all`, subscribe button `hover:bg-brand-600 active:scale-[0.98]`, all interactive elements get `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400` (matching `AppButton.vue`'s existing focus-ring convention).
- No `@apply`/`@reference` in any `<style scoped>` block — utilities go directly in template `class` attributes, matching the `packages/ui` convention already established by `AppHeader`/`AppSwitcher`/the shared auth components.

### Accessibility

- Semantic landmarks: `<footer>`, `<address>`, `<nav aria-label="…">` per link group, heading elements (`<h2>`) for each section (visually styled, not visually-hidden — visible headings help sighted users too).
- Every icon-only link/button (social icons, back-to-top) gets an explicit `aria-label`.
- Newsletter input has a associated `<label>` (can be visually compact/`sr-only` styled, but present in the DOM for screen readers) plus a `placeholder`.
- All interactive elements are native `<a>`/`<button>`/`<input>` — full keyboard operability (Tab order, Enter/Space activation) with no custom JS needed.
- Contrast: `slate-400`/`slate-300` on `slate-900` and white headings on `slate-900` both clear WCAG AA for normal text.

### SEO

- Semantic footer/nav/address markup is directly crawlable.
- Because the quick/legal links are `href="#"` placeholders (per the user's explicit choice), they carry no real internal-linking SEO value yet — this is a known, accepted limitation of that choice, not a defect in the component; swapping in real hrefs later requires no code change, only different prop values.

## Non-goals (explicitly out of scope)

- No dark/light theme toggle or theme system of any kind.
- No new npm dependencies (no icon library beyond the already-present `@lucide/vue`, no animation library).
- No real backend wiring for the newsletter form (no email service integration).
- No scroll-triggered entrance animation.
- No page-wide floating "back to top" button.
- No changes to any consuming app's `App.vue` — `<AppFooter />` keeps being used bare; per-app real data can be passed in later as a separate, smaller follow-up.

## Testing

- New/rewritten `packages/ui/src/shell/AppFooter.test.ts`:
  - Renders with zero props: brand name/description defaults, current-year copyright, default quick/legal link labels, default social icons (by `aria-label`), placeholder contact info.
  - Renders custom props: overriding `companyName`, `email`, `quickLinks` replaces the defaults.
  - `address` prop omitted → no address line rendered; provided → rendered.
  - Newsletter form: typing an email and submitting emits `subscribe` with that exact email string; does not throw when no listener is attached.
  - Back-to-top button: clicking it calls `window.scrollTo` with `{ top: 0, behavior: 'smooth' }` (mocked in the test).
- Existing consumers' tests (`apps/shop/src/App.test.ts`, `apps/calculator/src/App.test.ts`, `apps/dashboard/src/App.test.ts`) must keep passing unchanged, since they mount `<AppFooter />` bare with no props and this redesign's defaults must not break their existing assertions (none of them currently assert on old footer text, confirmed by inspection).

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Inline brand-icon SVG path data recalled from memory is pixel-imperfect vs. official current brand kits (X's mark in particular has changed over brand history) | Low-medium | These are widely-embedded, standard icon-pack paths, not fabricated; any drift is cosmetic only (shape, not color/behavior) and trivially replaceable by swapping one `path` string per icon later — flagged explicitly rather than silently shipped as "verified." |
| A much larger footer (6 sections vs. 2 lines) could visually overwhelm the compact HVAC calculator or admin dashboard, which are utilitarian, low-chrome tools | Low | Footer is only rendered once, at the bottom of each app's content, same as today; dark-on-light contrast keeps it visually distinct from body content without competing with it. |
| Newsletter form with no real backend might read as a broken/fake feature to an end user | Low | It's a real, working form that emits a real event — "broken" only in the sense that nothing is listening yet, same honesty bar as `cartStore.openDrawer()` before Task 6 of the header work wired a button to it. |
