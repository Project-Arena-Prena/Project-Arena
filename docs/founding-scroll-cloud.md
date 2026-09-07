# Founding scroll preview

The Founding homepage uses the previous Roman interior artwork from `public/art/roman-hero.webp`. A short desktop scroll sequence gently moves toward the archway and reveals the closing message. The artwork is already in the repository, so it does not depend on generated media downloads.

## Behavior
- Server HTML contains readable text and the still artwork.
- Scrolling controls the camera-like transform in both directions; it rests when scrolling settles.
- Mobile, portrait tablets, coarse-pointer landscape phones, reduced motion, Save-Data and slow connections retain the still hero.
- Reveal motion retires delays after entry, immediately reveals focused content, and follows live reduced-motion changes.
- Project previews stay in this browser for at most 24 hours. Applying or discarding a draft is explicit; failed saves preserve input.
- Event copy uses confirmed Founding Arena state. Unavailable data does not create mock entrants or rankings.

## Media
The earlier Higgsfield gateway video is no longer used. Five additional Higgsfield images extend the Roman aesthetic to For Builders, Rankings, About, Founding Event and sign-in. The batch was estimated at 10 credits. No video requests are made. `npm run prepare:art` downloads the five completed jobs as WebP into `public/art` before development, build and Founding browser tests; the browser uses same-origin assets. Build downloads retry three times and validate the WebP signature and size. An unavailable source fails the build rather than shipping a broken image.\n\nPage scenes gain modest scroll-linked depth only on fine-pointer desktops with CSS timeline support; other browsers and reduced-motion users see readable stills. Sign-in uses a native modal dialog with focus containment, Escape/backdrop dismissal and focus restoration. `/login` remains a direct destination and retains safe redirects and the existing email-code authentication. Auth requests occur only when the user submits. Contact links point to https://x.com/ProjectArenaXYZ and mailto:hello@projectarena.xyz.

## Cloud validation
GitHub Actions runs typecheck, lint, production build, wallet checks, Founding phase checks, motion browser tests and responsive screenshots. Browser tests use development-only fixtures without Supabase credentials.

## Deployment and recovery
Review this branch's Vercel preview. No migrations or production promotion are required. Recovery before merge is closing the preview PR; after any separately authorized production deployment, restore the previous Vercel deployment. Competition and payment data are preserved.
