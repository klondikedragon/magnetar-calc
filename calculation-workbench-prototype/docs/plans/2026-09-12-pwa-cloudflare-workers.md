# PWA and Cloudflare Workers deployment

## Status

In progress. This plan is the implementation checklist for publishing the
calculator at `calc.magnetar.app` and making it an installable, offline-capable
iPad web app.

## Decisions

- Deploy a public static client through Cloudflare Workers Static Assets.
- Keep calculator computation and persisted workspace state in the browser.
- Do not add cloud sync, sign-in, push notifications, App Store packaging, or
  an in-app Safari installation prompt in this release.
- Use `vite-plugin-pwa` and Workbox rather than hand-maintained precache logic.
- Do not add the Cloudflare Vite plugin until the app needs Worker-runtime
  development or server-side capabilities.
- Check for a new service-worker version on focus, reconnect, and no more than
  once per 16 hours while the app remains open.

## Update safety contract

An available update may activate and reload automatically only after the current
workspace has been flushed to browser storage and the app is idle: no open
modal, calculation, History queue, import, export, or other interruptible
operation. It should wait briefly after recent input before reloading. An
unsafe update remains waiting and is retried after the blocking operation,
focus, reconnect, or the next scheduled check.

The service worker must never force activation in the middle of a calculation.
Its cached app shell must stay internally consistent: the HTML and the hashed
assets it names are activated as one version.

## Slices

### 1. Web-app identity and metadata

- [x] Preserve the original Magnetar icon master and derivative Apple/PWA sizes.
- [x] Add the web manifest, document title, metadata, and Apple touch-icon
  links.
- [x] Validate manifest fields and icon URLs in a production build.

### 2. Offline application shell

- [x] Add `vite-plugin-pwa` using Workbox `injectManifest` mode.
- [x] Precache the Vite application shell, calculator worker, manifest, and
  shipping icons; provide an offline navigation fallback.
- [x] Keep the service-worker source small and explicit about what it caches.
- [ ] Test first-load, offline restart, and offline calculation in a production
  preview.

### 3. Safe automatic updates

- [x] Add a centralized idle predicate and a synchronous workspace-persistence
  flush before a reload.
- [x] Register the intended update cadence: focus, reconnect, and a throttled
  16-hour timer.
- [x] Activate a waiting worker only when the idle predicate passes; retry later
  otherwise.
- [ ] Test update deferral during a modal, an active calculation, and a queued
  History run.

### 4. Cloudflare Workers Static Assets

- [x] Add `wrangler.toml` for the client build output and SPA navigation
  fallback. The connected Cloudflare Worker must be named
  `magnetar-calculator`.
- [x] Add static response headers: revalidate HTML, manifest, and service
  worker; cache hashed build assets immutably, and attach security headers from
  the Worker because it handles asset responses.
- [ ] Deploy a staging Worker, then bind `calc.magnetar.app` after verification.
- [ ] Document rollback as redeploying the last known good Worker version.

### 4a. Public-repository build policy

- [x] Add an all-files `CODEOWNERS` rule requiring `@klondikedragon` review.
- [ ] Protect `main` in GitHub: require pull requests and passing checks, and
  disallow direct and force pushes.
- [ ] Enable the production Worker build for `main` only.
- [ ] Enable non-production branch previews only for trusted repository branches.
  Do not enable untrusted fork builds until their build-token isolation is
  explicitly confirmed in the Cloudflare account configuration.

### 5. Release verification

- [ ] Verify a clean install in iPad Safari through Add to Home Screen.
- [ ] Verify offline startup after the initial online load.
- [ ] Verify persisted calculator state survives an idle automatic update.
- [ ] Verify an active calculation is not interrupted by an available update.

## Acceptance criteria

The deployed calculator uses HTTPS, displays the Magnetar icon when installed,
opens in standalone mode, and remains functional offline after its first
successful load. Published changes reach connected devices without requiring
manual cache clearing, while ongoing calculator work is never discarded by an
automatic reload.
