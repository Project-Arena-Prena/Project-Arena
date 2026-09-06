import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL('../public/art/', import.meta.url);
const assets = [
  { file: 'founding-gateway.webp', url: 'https://d8j0ntlcm91z4.cloudfront.net/user_3IvmFraeJMm0roCzMD7eQ6luAZ8/hf_20260906_005543_e2bc2f68-5ff2-42a4-a3d4-a17511c6882e_min.webp', bytes: 314926 },
  { file: 'founding-gateway-scrub.mp4', url: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3IvmFraeJMm0roCzMD7eQ6luAZ8/0e54bcf6-026d-4d8c-a288-317c09afe980.mp4', bytes: 2912826, sha256: 'af03ea52c3ab3a39f74433f2a14c2dec07d510a466dabd9ba9cd4d2e669c30e0' },
];
const valid = (bytes, asset) => bytes.length === asset.bytes && (!asset.sha256 || createHash('sha256').update(bytes).digest('hex') === asset.sha256);
await mkdir(base, { recursive: true });
for (const asset of assets) {
  const target = new URL(asset.file, base);
  const existing = await readFile(target).catch(() => null);
  if (existing && valid(existing, asset)) continue;
  const response = await fetch(asset.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('Asset unavailable: ' + asset.file + ' (' + response.status + ')');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!valid(bytes, asset)) throw new Error('Asset integrity check failed: ' + asset.file);
  await writeFile(target, bytes);
  console.log('Prepared ' + asset.file);
}
