# Arena scroll and sign-in polish

## Why
The global header always opened the email modal, even with a valid session. A server-verified session now seeds a shared client provider before rendering the navigation. Supabase auth events update the display and refresh server components when identity changes. Signed-in Builders see Dashboard; an already-open login page offers Continue instead of asking for another email. Server authorization remains authoritative.

The header puts Founding Event with the other navigation links, gives account access a distinct control, and switches to the mobile menu below 1024px. Callback failures and protected-route redirects retain the requested internal destination. Session refresh cookies and cache headers are retained on redirects; auth responses are private and not cached.

## Motion and assets
Higgsfield Seedance 2.5 job `312fbe37-12c3-4198-99cc-8b6c211878c1`, 8 seconds, 16:9, 1920x1080, native 24 fps, silent, high bitrate. Generation estimate: 72 credits. Source: https://d8j0ntlcm91z4.cloudfront.net/user_3IvmFraeJMm0roCzMD7eQ6luAZ8/hf_20260908_205544_312fbe37-12c3-4198-99cc-8b6c211878c1.mp4

A single continuous dolly moves through a shaded Roman entrance into a sunlit amphitheater. Higgsfield's media sandbox converted the HEVC source to browser-compatible H.264, yuv420p, fast-start MP4, with one keyframe every four frames and no B-frames.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| Desktop 1920x1080 | 5535052 | 8203bdf6cdfa8388771d254a3877db076a4af1ab1338496a5488f28ff13f3a9c |
| Mobile 960x540 | 1301596 | 789faaa3775b430df44751d3a5d3aeba5f4f5f785a6251856728b8402096d671 |
| First-frame WebP | 39270 | a9e288dda7a4bc1837df0f389653714a422877107321b4aae9b132d225ee18d2 |

The preparation script downloads all three into `public/media` and verifies SHA-256 before build. Source IDs and checksums are versioned; visitors receive same-origin files with no third-party runtime media dependency. Download failure fails the build instead of deploying missing assets. The same script prepares existing page artwork.

Scroll position controls video time in either direction. There is at most one seek in flight; the next seek uses the newest position. Rendering sleeps when settled, offscreen or hidden. Desktop uses a 260svh journey; tall mobile screens use 190svh and the 1.3 MB encode. No autoplay, audio or wheel/touch interception. The visible action and native anchor let visitors leave the sequence immediately.

Reduced motion, Save-Data, 2G and short phone viewports keep a still poster and do not request video. Live preference changes release the video source. Download or decode failures preserve the still artwork, text and entry link. Server HTML remains readable without JavaScript.

## Validation and deployment
Required: typecheck, lint, production build, Founding phase tests and Founding browser suite. The suite covers decoded forward/backward video seeking, settled playback, mobile source selection, live reduced-motion changes, no-download fallbacks, failed media, responsive pages, modal focus, signed-in server/client rendering and preserved redirects. The signed-in harness is development-only and cannot authorize data access; it is excluded from production builds. A fresh real-account OTP sign-in is a separate operator check; no email is sent by these tests.

No migrations, lifecycle mutations or Stripe writes are included. Read-only inspection on 2026-09-08 found no `arenas.slug = founding` row in the connected project; the current Preparing state is therefore correct. Opening event entry requires a separately configured real event.

Rollback: restore Vercel production deployment `dpl_9CZXkAPan7b7tbB6Kg8FjCtK1QCg` or revert this PR. No database rollback is needed.
