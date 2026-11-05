# LINE OA Rich Menus

## User behavior

- Users without an application session see the public menu. Its primary entry opens the LIFF app at the login/onboarding page.
- After a verified LINE ID-token exchange, the API classifies the account from active server-side membership and lease records, then links the account/owner/tenant/Super Admin menu through LINE's per-user Rich Menu API. No client-supplied role or LINE user ID is used to select the role.
- Persisted `SUPER_ADMIN` gets the platform administration menu; owner/manager/staff membership gets the property operations menu; an active tenant lease gets tenant self-service; a newly authenticated account gets profile/onboarding links. The authenticated app replaces its guest login CTA with the workspace and profile navigation.
- Logout removes the per-user menu link. It does not send a LINE message.

## Provision in DEV

Run as root on the VPS after deploying the API image:

```sh
bash infra/provision-line-rich-menus.sh
```

The script uses `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` and `VITE_LIFF_ID` from the API container environment, creates versioned templates for public, owner, tenant, account, and Super Admin only when missing, uploads each PNG, and sets the public guest menu as the default for all OA users. It prints menu role names only. Re-running is idempotent. Do not enable outbound LINE message delivery as part of provisioning.

Artwork source is `infra/generate-line-rich-menu-assets.mjs`; Thai fonts and their OFL license are in `infra/line-rich-menu-fonts/`. The resulting versioned PNG assets are under `apps/api/assets/line-rich-menus/`.

## LINE behavior and operational note

LINE's per-user menu has display priority over the public default. The user must be a friend of the Official Account for per-user assignment to work. If a login succeeds but the menu link cannot be applied, the API logs a sanitized provider status and keeps the login session active; the public default remains visible. The next login retries assignment.

Verify actual behavior with a consented DEV test account by opening the OA chat after login and checking that the assigned menu matches the account role. Automated tests use a mock provider and are not real LINE UAT evidence.

## Visual and tap-area design

Each tile is an independent LINE URI action area. The five role templates use a restrained navy/slate base with muted role accents; each button still navigates to its own role-appropriate LIFF section. Rebuild PNG/SVG assets with `node infra/generate-line-rich-menu-assets.mjs`.
