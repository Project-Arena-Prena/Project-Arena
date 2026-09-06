# Founding scroll preview

This branch restores the saved Founding UI and adds the approved Higgsfield gateway clip, scroll reveals and a Project preview before sign-in. It builds through the existing GitHub/Vercel integration; no local application server is required.

## Behavior
- The server renders readable text and a still image before JavaScript.
- Desktop scroll controls the six-second silent gateway journey. Motion rests while idle; reverse scroll seeks backwards.
- Small screens, portrait tablets, coarse-pointer landscape phones, reduced motion, Save-Data and slow connections receive the still hero.
- Reveal motion retires its delay after entry, reveals focused content immediately, and follows live reduced-motion changes.
- Project preview stays on the current browser for at most 24 hours. Applying or discarding it is explicit. Failed saves preserve input.
- Event copy comes from confirmed Founding Arena state. Unavailable data does not create mock entrants or rankings.

## Assets
The image and approved clip are fetched by `npm run prepare:founding-assets` before development and builds. The clip is pinned by SHA-256 and both files by size. Build failure preserves the previous deployment if media is unavailable. The browser receives same-origin assets. The clip cost 6 approved credits; this branch makes no generation requests.

## Cloud validation
GitHub Actions runs typecheck, lint, production build, existing wallet checks, Founding phase checks, motion browser tests and responsive screenshots. The browser suite uses development-only fixtures with no Supabase credentials and cannot create real entries or payments.

## Deployment and recovery
Use this branch's Vercel preview to review. No migrations or production promotion are required for the preview. The production site remains on its existing commit. Rollback before merge is closing the preview PR; after any separately authorized deployment, use the previous Vercel deployment. No stored competition or payment data is changed by this patch.
