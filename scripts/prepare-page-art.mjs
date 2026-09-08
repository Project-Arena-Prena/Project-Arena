import { createHash } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Generated Higgsfield assets, pinned to completed job URLs. Served locally after build.
const sources = [
  {
    "name": "builders",
    "url": "https://d8j0ntlcm91z4.cloudfront.net/user_3IvmFraeJMm0roCzMD7eQ6luAZ8/hf_20260907_071402_a7ea08ff-3671-47a7-bc9f-d98858a945a2_min.webp",
    "job": "a7ea08ff-3671-47a7-bc9f-d98858a945a2"
  },
  {
    "name": "rankings",
    "url": "https://d8j0ntlcm91z4.cloudfront.net/user_3IvmFraeJMm0roCzMD7eQ6luAZ8/hf_20260907_071401_dead788c-cba1-49e1-9c1f-31a60788c5eb_min.webp",
    "job": "dead788c-cba1-49e1-9c1f-31a60788c5eb"
  },
  {
    "name": "about",
    "url": "https://d8j0ntlcm91z4.cloudfront.net/user_3IvmFraeJMm0roCzMD7eQ6luAZ8/hf_20260907_071402_94494264-7b57-4616-9600-00972cc08229_min.webp",
    "job": "94494264-7b57-4616-9600-00972cc08229"
  },
  {
    "name": "founding",
    "url": "https://d8j0ntlcm91z4.cloudfront.net/user_3IvmFraeJMm0roCzMD7eQ6luAZ8/hf_20260907_071401_0619c8a7-8385-4412-acfe-f898e5d4426e_min.webp",
    "job": "0619c8a7-8385-4412-acfe-f898e5d4426e"
  },
  {
    "name": "signin",
    "url": "https://d8j0ntlcm91z4.cloudfront.net/user_3IvmFraeJMm0roCzMD7eQ6luAZ8/hf_20260907_071402_c97763bc-b28f-45cb-9b0e-3b03e5cb7c88_min.webp",
    "job": "c97763bc-b28f-45cb-9b0e-3b03e5cb7c88"
  }
];
const directory = new URL('../public/art/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const source of sources) {
  const target = new URL('arena-' + source.name + '.webp', directory);
  try { await access(target); continue; } catch {}
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error('Artwork download returned ' + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1000 || bytes.length > 8_000_000 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Invalid WebP artwork');
      await writeFile(target, bytes);
      console.log('Prepared ' + fileURLToPath(target).split('/').pop() + ': ' + bytes.length + ' bytes');
      lastError = null;
      break;
    } catch (error) { lastError = error; }
  }
  if (lastError) throw lastError;
}


// Pinned, optimized Higgsfield film. The browser always uses same-origin assets.
const media = [
  { name: 'arena-scroll-desktop.mp4', id: 'd6df24e2-3e0b-46e2-a55b-09d8973f0f2f.mp4', sha: '8203bdf6cdfa8388771d254a3877db076a4af1ab1338496a5488f28ff13f3a9c' },
  { name: 'arena-scroll-mobile.mp4', id: '6e217024-743c-4fbc-bdfc-fe68a85cf62f.mp4', sha: '789faaa3775b430df44751d3a5d3aeba5f4f5f785a6251856728b8402096d671' },
  { name: 'arena-scroll-poster.webp', id: '4a4a5fbc-3ad1-43ab-a1f9-21903d0b9560.webp', sha: 'a9e288dda7a4bc1837df0f389653714a422877107321b4aae9b132d225ee18d2' },
];
const mediaDirectory = new URL('../public/media/', import.meta.url);
await mkdir(mediaDirectory, { recursive: true });
const { readFile } = await import('node:fs/promises');
for (const source of media) {
  const target = new URL(source.name, mediaDirectory);
  const valid = (bytes) => createHash('sha256').update(bytes).digest('hex') === source.sha;
  try { if (valid(await readFile(target))) continue; } catch {}
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('https://d2ol7oe51mr4n9.cloudfront.net/user_3IvmFraeJMm0roCzMD7eQ6luAZ8/' + source.id, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error('Film download returned ' + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!valid(bytes)) throw new Error('Film checksum mismatch: ' + source.name);
      await writeFile(target, bytes);
      console.log('Prepared ' + source.name + ': ' + bytes.length + ' bytes');
      lastError = null;
      break;
    } catch (error) { lastError = error; }
  }
  if (lastError) throw lastError;
}
