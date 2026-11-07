# ApartMe responsive UI audit — 2026-11-07

## Customer issue and verified root causes

The **"อนุมัติและออกทั้งชุด"** button was outside the visible mobile/tablet viewport in the batch invoice preview/history card. A Playwright baseline at 320px measured `document.documentElement.scrollWidth=651` and the approval button at `x=493..635`. The main cause was a nested CSS grid with an implicit `auto` min-content track: the invoice details table (`min-width:580px`) and unwrapped action heading forced the whole grid/card wider than the screen. This was not simply a missing overflow-hidden rule; clipping the body would have made the primary action unreachable.

The initial cross-page audit also identified a room-rate override form overflowing at 768px, when the desktop sidebar left a content column narrower than the CSS viewport breakpoint assumed. The navigation drawer also covered the only menu toggle on a phone, leaving no obvious way to close it without navigating.

## Fixes

- Make `.claim-list` and `.platform-account-list` explicit `minmax(0,1fr)` grids, and add min-width constraints for nested cards, panel headers, report cards and scroll containers.
- Allow action headers to wrap; on phone widths the batch approval CTA fills the **visible card width** and is no longer pushed off-screen.
- Restrict wide invoice tables to **local horizontal scrolling inside `.table-scroll`**. Do **not** hide horizontal overflow globally on the body, as this would conceal important actions.
- Make room-rate forms adaptive to the available column width with `auto-fit/minmax`, even when a sidebar is present.
- Improve responsive wrapping for long names, messages, notifications, rate rows, headings, actions, inputs and selects.
- Improve phone navigation: explicit close button, dim backdrop that closes the drawer and Escape keyboard support; toggle exposes `aria-expanded` and `aria-controls`.

## Regression verification

Run after a production web build:

```sh
corepack pnpm --filter @apartment/web build
corepack pnpm --filter @apartment/web smoke:responsive
```

`smoke:responsive` runs headless Chromium with **all API responses intercepted and mocked**. It verifies:

- Billing batch CTA is visible fully inside the viewport at widths `320, 360, 375, 390, 430, 600, 768, 820, 1024, 1440` px.
- Wide invoice tables scroll within their own card rather than enlarging the entire page.
- Batch preview, confirmation and success message are usable on 320px screens (mock transaction only).
- No global horizontal overflow across **14 app sections × 10 viewport widths**, including Overview, Rooms, Meter, Billing, Reports, Payments, Maintenance, Invitations, Staff, Settings, Notifications, Profile, Tenant and Super Admin, with representative records and long display strings.
- Mobile drawer can open and close; touch-device Chromium emulation with actual `isMobile=true`, `hasTouch=true`, DPR=2, 375px device viewport can tap the approval button successfully.
- No uncaught client-side render errors in these mocked sections.

The browser tests **never issue real invoices or mutate real customer data**. Native iOS Safari and actual authenticated customer-specific layouts still merit manual device testing, particularly tables with unusually long data, uploaded photos and downloaded documents.
