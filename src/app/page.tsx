import { getServerNow } from "@/lib/server-clock";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { getArena } from "@/lib/queries";
import { foundingAction, foundingPhase, PHASE_LABEL } from "@/lib/founding";
import { ArenaRefresh } from "@/components/founding/arena-refresh";
import { EventSummary } from "@/components/founding/event-summary";
import { ButtonLink, Container } from "@/components/ui";
import { ScrollReveals } from "@/components/founding/scroll-reveals";
import { GatewayJourney } from "@/components/founding/gateway-journey";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Project Arena — Where projects compete for attention" },
  description:
    "The first Projects enter Project Arena. Discover, support and watch what rises.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const arena = await getArena("founding");
  const now = await getServerNow();
  const phase = foundingPhase(arena, now);
  const action = foundingAction(phase);
  return (
    <ScrollReveals>
      <ArenaRefresh />
      <GatewayJourney><section className="founding-hero">
        <div className="founding-hero-art" aria-hidden="true">
          <Image
            src="/media/arena-scroll-poster.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <video className="gateway-video" muted playsInline preload="none" disablePictureInPicture tabIndex={-1} aria-hidden="true" />
        </div>
        <div className="founding-hero-shade" />
        <div className="gateway-progress" aria-hidden="true"><span /></div>
        <Container className="relative z-10">
          <p className="founding-eyebrow">
            <span className="event-light" />
            Founding Event · {PHASE_LABEL[phase]}
          </p>
          <div className="gateway-titles"><h1 className="founding-headline gateway-intro">
            Where projects
            <br />
            compete for
            <br />
            <em>attention.</em>
          </h1>
          <p className="founding-headline gateway-settle" aria-hidden="true">A place is entered.<br /><em>A rank<br />is earned.</em></p></div>
          <div className="hero-bottom">
            <div>
              <p className="founding-copy">
                The internet is building.
                <br />
                Give it something to watch.
              </p>
              <ButtonLink href={action.href} size="lg" className="mt-7">
                {action.label}
                <ArrowUpRight size={16} />
              </ButtonLink>
            </div>
            <Link className="scroll-cue" href="#approach">
              Discover how it works <ArrowDown size={16} />
            </Link>
          </div>
        </Container>
        <div className="hero-caption">
          <span>Project Arena / The beginning</span>
          <span>Discover. Compete. Get seen.</span>
        </div>
      </section></GatewayJourney>
      <section id="approach" className="approach-section founding-section">
        <Container>
          <p className="founding-eyebrow">01 / Approach</p>
          <div className="approach-layout">
            <h2 className="statement" data-reveal="rise">
              The internet
              <br />
              is building.
              <br />
              <span className="text-bone-faint">
                Most projects
                <br />
                are never seen.
              </span>
            </h2>
            <div className="approach-note" data-reveal="fade">
              <span className="architectural-rule" aria-hidden="true" />
              <p>
                Good work deserves
                <br />
                an audience.
              </p>
              <p className="founding-copy mt-5">
                A shared stage. A limited time.
                <br />
                Projects worth discovering.
              </p>
              <p className="founding-eyebrow mt-8">
                Project Arena changes that.
              </p>
            </div>
          </div>
        </Container>
      </section>
      <section id="how-it-works" className="entry-narrative founding-section">
        <div className="entry-art" aria-hidden="true">
          <Image
            src="/art/roman-vault.webp"
            fill
            sizes="(min-width: 768px) 55vw, 100vw"
            alt=""
            className="object-cover"
          />
        </div>
        <Container className="relative">
          <p className="founding-eyebrow">02 / Enter</p>
          <div className="entry-copy" data-reveal="depth">
            <h2 className="statement">
              Projects enter.
              <br />
              <em>
                Attention decides
                <br />
                who rises.
              </em>
            </h2>
            <p className="founding-copy mt-8">
              Explore the work. Support what matters.
              <br />
              Watch the field move.
            </p>
            <Link href="/for-builders#project-preview" className="preview-link mt-6">
              Preview your Project <ArrowUpRight size={16} />
            </Link>
          </div>
          <ol className="mechanics">
            <li data-reveal="rise">
              <span>01</span>
              <h3>Discover</h3>
              <p>Meet the Projects entering the Arena.</p>
            </li>
            <li data-reveal="rise" style={{ '--reveal-delay': '90ms' } as React.CSSProperties}>
              <span>02</span>
              <h3>Explore & support</h3>
              <p>Visit the work. Back the Projects you believe in.</p>
            </li>
            <li data-reveal="rise" style={{ '--reveal-delay': '180ms' } as React.CSSProperties}>
              <span>03</span>
              <h3>Watch what rises</h3>
              <p>
                Follow earned support and qualified visits on the live board.
              </p>
            </li>
          </ol>
        </Container>
      </section>
      <section className="founding-section">
        <Container>
          <div className="competition-heading" data-reveal="rise">
            <div>
              <p className="founding-eyebrow">03 / Compete</p>
              <h2 className="statement mt-6">
                A place is entered.
                <br />
                <em>A rank is earned.</em>
              </h2>
            </div>
            <p className="founding-copy">
              Money buys participation.
              <br />
              It never buys rank.
            </p>
          </div>
          <Link href="/rankings" className="quiet-board" data-reveal="depth">
            <span className="founding-eyebrow">
              The Founding Arena / Standings
            </span>
            <span className="quiet-board-title">
              {phase === "live"
                ? "The competition is live."
                : phase === "completed"
                  ? "The final record is here."
                  : phase === "finalizing"
                    ? "The results are being verified."
                    : "The Arena is quiet."}
            </span>
            <span className="founding-copy">
              {phase === "live" || phase === "completed" || phase === "finalizing"
                ? "Explore the board"
                : "Rankings appear when competition begins."}
              <ArrowUpRight size={20} />
            </span>
          </Link>
        </Container>
      </section>
      <section className="founding-finale founding-section">
        <Image
          src="/art/roman-arena-field.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        <Container className="relative z-10">
          <p className="founding-eyebrow mb-12">
            04 / Be part of the beginning
          </p>
          <div data-reveal="rise"><EventSummary arena={arena} now={now} /></div>
        </Container>
      </section>
    </ScrollReveals>
  );
}
