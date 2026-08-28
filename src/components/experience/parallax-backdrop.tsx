'use client';

import Image from 'next/image';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { cn } from '@/lib/cn';

export function ParallaxBackdrop({
  src,
  alt = '',
  priority = false,
  sizes = '100vw',
  className,
  imageClassName,
}: {
  src: string;
  alt?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  imageClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], ['-3%', '4%']);
  const scale = useTransform(scrollYProgress, [0, 1], [1.025, 1.085]);

  return (
    <div
      ref={ref}
      className={cn('pointer-events-none absolute -inset-y-[8%] inset-x-0 overflow-hidden', className)}
      aria-hidden={alt ? undefined : true}
    >
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={reduceMotion ? undefined : { y, scale }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn('object-cover', imageClassName)}
        />
      </motion.div>
    </div>
  );
}
