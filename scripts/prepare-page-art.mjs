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
