'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight } from 'lucide-react';
import { Container, Label } from '@/components/ui';

const EASE = [0.16, 1, 0.3, 1] as const;

export function RomanArtInterlude() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden border-b hairline bg-[#090704] py-20 sm:py-28 lg:py-36">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,rgba(217,195,171,0.09),transparent_38%)]"
        aria-hidden
      />
      <Container className="relative">
        <div className="grid items-center gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: reduceMotion ? 0 : 0.65, ease: EASE }}
          >
            <Label className="text-arena">The architecture of attention</Label>
            <h2 className="mt-5 max-w-xl text-[clamp(2.8rem,6vw,5.6rem)] font-semibold uppercase leading-[0.86] tracking-[-0.07em]">
              A new field.
              <br />
              An ancient instinct.
            </h2>
            <p className="mt-7 max-w-md text-sm leading-relaxed text-bone-dim sm:text-base">
              People have always gathered around a stage to witness ambition, form opinions, and
              remember the names that earned the crowd.
            </p>
            <div className="mt-9 flex items-center gap-4 border-t border-white/20 pt-5 font-mono text-[9px] uppercase tracking-[0.18em] text-bone-faint">
              <ArrowDownRight className="h-4 w-4 text-arena" aria-hidden />
              Built for the public record
            </div>
          </motion.div>

          <div className="relative min-h-[500px] sm:min-h-[640px]">
            <motion.figure
              initial={reduceMotion ? false : { opacity: 0, x: 28, rotate: 0.8 }}
              whileInView={{ opacity: 1, x: 0, rotate: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: reduceMotion ? 0 : 0.8, ease: EASE }}
              className="absolute inset-x-0 top-0 h-[58%] overflow-hidden border border-white/15 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:left-[8%]"
            >
              <Image
                src="/art/roman-vault.webp"
                alt="Roman vaulted hall rendered as an aged architectural fresco"
                fill
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-cover saturate-[0.7] contrast-[1.06] brightness-[0.86] transition-transform duration-[1400ms] hover:scale-[1.025]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <figcaption className="absolute bottom-4 left-4 font-mono text-[8px] uppercase tracking-[0.18em] text-white/65">
                Passage to the field · Study I
              </figcaption>
            </motion.figure>

            <motion.figure
              initial={reduceMotion ? false : { opacity: 0, y: 36, rotate: -1.2 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: reduceMotion ? 0 : 0.85, delay: reduceMotion ? 0 : 0.12, ease: EASE }}
              className="absolute bottom-0 right-[4%] h-[62%] w-[44%] overflow-hidden border border-white/15 bg-[#b9a17d] shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:right-[2%] sm:w-[39%]"
            >
              <Image
                src="/art/roman-victory.webp"
                alt="Classical victory statue, laurel wreath, amphora, and Roman mosaic"
                fill
                sizes="(max-width: 1024px) 44vw, 24vw"
                className="object-cover object-center saturate-[0.72] contrast-[1.04] transition-transform duration-[1400ms] hover:scale-[1.03]"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/15" />
            </motion.figure>

            <motion.div
              className="absolute bottom-[9%] left-[2%] hidden h-px w-[42%] bg-gradient-to-r from-arena/80 to-transparent sm:block"
              initial={reduceMotion ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: reduceMotion ? 0 : 1, delay: reduceMotion ? 0 : 0.35, ease: EASE }}
              style={{ transformOrigin: 'left' }}
              aria-hidden
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
