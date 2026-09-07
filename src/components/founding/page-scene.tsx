import Image from 'next/image';
import type { ReactNode } from 'react';
import { Container } from '@/components/ui';

export type SceneName = 'builders' | 'rankings' | 'about' | 'founding';
export function SceneArt({ scene }: { scene: SceneName }) {
  return <div className="page-scene-art" aria-hidden="true"><Image src={'/art/arena-' + scene + '.webp'} alt="" fill priority sizes="100vw" className="object-cover" /></div>;
}
export function PageScene({ scene, children }: { scene: SceneName; children: ReactNode }) {
  return <section className={'page-scene page-scene-' + scene}><SceneArt scene={scene} /><Container className="page-scene-content">{children}</Container></section>;
}
