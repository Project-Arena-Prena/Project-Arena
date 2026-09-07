# Founding scroll preview

The Founding homepage uses the previous Roman interior artwork from `public/art/roman-hero.webp`. A short desktop scroll sequence gently moves toward the archway and reveals the closing message. The artwork is already in the repository, so builds no longer download generated media.

## Behavior
- Server HTML contains readable text and the still artwork.
- Scrolling controls the camera-like transform in both directions; it rests when scrolling settles.
- Mobile, portrait tablets, coarse-pointer landscape phones, reduced motion, Save-Data and slow connections retain the still hero.
- Reveal motion retires delays after entry, immediately reveals focused content, and follows live reduced-motion changes.
- Project previews stay in this browser for at most 24 hours. Applying or discarding a draft is explicit; failed saves preserve input.
- Event copy uses confirmed Founding Arena state. Unavailable data does not create mock entrants or rankings.

## Media
The earlier Higgsfield gateway video is no longer used. This revision spends no generation credits and makes no video requests.

## Cloud validation
GitHub Actions runs typecheck, lint, production build, wallet checks, Founding phase checks, motion browser tests and responsive screenshots. Browser tests use development-only fixtures without Supabase credentials.

## Deployment and recovery
Review this branch's Vercel preview. No migrations or production promotion are required. Recovery before merge is closing the preview PR; after any separately authorized production deployment, restore the previous Vercel deployment. Competition and payment data are preserved.
