# ApartMe LINE OA Rich Menus — Pastel v3 (2026-11-07)

## Design

All artwork uses a quiet warm-white background, pastel tints, readable dark Thai text, line icons and the **ApartMe** name. Six equally sized tiles match the exact 2500 × 1686 LINE tap-area coordinates; PNGs are less than LINE's 1 MB limit. The visual no longer uses neon, dark navy cards or decorative gradients. Fonts are bundled locally in `infra/line-rich-menu-fonts/` and are not fetched from a CDN.

Versioned source: `infra/generate-line-rich-menu-assets.mjs`; generated `.png` and `.svg` under `apps/api/assets/line-rich-menus/`. Rebuild by running `node infra/generate-line-rich-menu-assets.mjs`. Never change clickable area coordinates without changing the generator and test in the same commit.

## Menus and destinations

| Verified account type | Rich menu name | Available destinations |
| --- | --- | --- |
| Guest/default | `apartme-public-pastel-v3` | เริ่มใช้งาน, รู้จัก ApartMe, โปรไฟล์, ดูระบบหอพัก, สำหรับผู้เช่า, ติดต่อเรา |
| Owner (active OWNER membership) | `apartme-owner-pastel-v3` | ภาพรวม, ห้องพัก, ออกบิล, รายงานบิล, รับชำระ, โปรไฟล์ |
| Tenant (verified active LINE-linked lease, no elevated property role) | `apartme-tenant-pastel-v3` | หน้าหลัก, ใบแจ้งหนี้, การชำระเงิน, แจ้งซ่อม, ประวัติบิล, โปรไฟล์ |
| Property team (MANAGER/STAFF) | `apartme-staff-pastel-v3` | ห้องพัก, จดมิเตอร์, หลักฐานมิเตอร์, งานของฉัน, คู่มือห้องพัก, โปรไฟล์ |
| Platform admin (verified SUPER_ADMIN) | `apartme-superadmin-pastel-v3` | จัดการระบบ, ภาพรวม, หอพัก, แจ้งเตือน, งานซ่อม, โปรไฟล์ |
| Logged-in general account | `apartme-account-pastel-v3` | หน้าหลัก, โปรไฟล์, เชิญเข้าพัก, รายการบิล, แจ้งซ่อม, ติดต่อเรา |

All rich-menu actions use LIFF URIs with section/anchor parameters; **Backend controls access** to every route and API. The menu is only a navigation aid. The default OA menu is guest; all verified users receive a per-user menu after LINE ID token verification, with SUPER_ADMIN > OWNER > MANAGER > STAFF > active tenant lease > account priority. Revoked memberships and inactive organizations do not qualify.

## Provisioning & syncing existing accounts

Image content cannot be overwritten on an existing LINE menu ID. Version v3 creates **new** LINE rich-menu IDs and retains older v2 IDs to avoid breaking links during rollout. The provisioning operation updates the default guest menu only and **does not send LINE messages**. Running it again is idempotent.

1. Build/redeploy API with new PNG assets, then run `bash infra/provision-line-rich-menus.sh` as root. The script sources the LINE token and LIFF ID only inside the API container; never show or store credentials in output.
2. Dry-run the role sync: `docker exec apartment-dokploy-dev-ajcnbm-api-1 sh -lc 'cd /workspace/apps/api && corepack pnpm exec tsx src/scripts/sync-line-rich-menu-roles.ts'`. It prints aggregate counts only.
3. After verifying the counts, apply with the same command and `--apply`. Only active verified `U...` LINE users in the application are assigned; users not following the OA can fail (404) and are counted as unavailable. This only calls the per-user rich-menu link API; it never sends chat messages or modifies financial data.
4. A user's next verified LIFF login also reapplies the current role menu. Logout unlinks the per-user menu and the guest default becomes visible.

## Tests and boundaries

`apps/api/tests/rich-menus.test.ts` checks artwork dimensions, PNG color, text labels/tap areas, role selection, idempotent provisioning and mocked LINE link calls. Real LINE UAT should open the OA chat with at least one verified admin, owner and tenant account, tap each tile and confirm the right LIFF section. The OS may need the chat to be reopened to refresh a linked menu. Do not post screenshots containing tenant names or tokens.

Property MANAGER and STAFF receive a distinct team menu, **not** the OWNER financial menu. This does not grant or remove backend permissions. Users with multiple active memberships receive the highest permitted navigation role; the current organization and property selection within the app still governs actual data access.
