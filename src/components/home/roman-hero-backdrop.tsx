'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

const DUST = [
  { left: '8%', top: '22%', delay: 0.4, duration: 8 },
  { left: '18%', top: '64%', delay: 2.1, duration: 11 },
  { left: '31%', top: '38%', delay: 1.2, duration: 9 },
  { left: '43%', top: '18%', delay: 3.2, duration: 12 },
  { left: '56%', top: '57%', delay: 0.8, duration: 10 },
  { left: '66%', top: '29%', delay: 2.8, duration: 13 },
  { left: '77%', top: '71%', delay: 1.7, duration: 9.5 },
  { left: '88%', top: '42%', delay: 3.7, duration: 11.5 },
];

export function RomanHeroBackdrop() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0a0704]" aria-hidden>
      <motion.div
        className="absolute -inset-[4%] will-change-transform"
        initial={false}
        animate={
          reduceMotion
            ? undefined
            : {
                scale: [1.025, 1.065, 1.025],
                x: [0, -8, 0],
                y: [0, 5, 0],
              }
        }
        transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity }}
      >
        <Image
          src="/art/roman-hero.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[58%_center] saturate-[0.72] contrast-[1.08] brightness-[0.66] sm:object-center"
        />
      </motion.div>

      <motion.div
        className="absolute left-[43%] top-[18%] h-[68%] w-[24%] origin-top -rotate-6 bg-[linear-gradient(105deg,transparent,rgba(255,221,168,0.15),transparent)] blur-2xl"
        animate={reduceMotion ? undefined : { opacity: [0.26, 0.62, 0.26], scaleX: [0.9, 1.1, 0.9] }}
        transition={{ duration: 7, ease: 'easeInOut', repeat: Infinity }}
      />

      {DUST.map((particle) => (
        <motion.span
          key={`${particle.left}-${particle.top}`}
          className="absolute h-1 w-1 rounded-full bg-[#f4d6a0]/45 shadow-[0_0_8px_rgba(244,214,160,0.55)]"
          style={{ left: particle.left, top: particle.top }}
          animate={
            reduceMotion
              ? undefined
              : {
                  y: [12, -34],
                  x: [0, 8, -3],
                  opacity: [0, 0.7, 0],
                  scale: [0.6, 1, 0.7],
                }
          }
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
      ))}

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.58)_0%,rgba(0,0,0,0.05)_30%,rgba(0,0,0,0.35)_67%,#000_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.52)_43%,rgba(0,0,0,0.08)_76%)]" />
      <div className="arena-noise absolute inset-0 opacity-[0.065] mix-blend-soft-light" />
    </div>
  );
}
