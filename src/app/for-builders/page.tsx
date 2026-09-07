import { Container, ButtonLink } from "@/components/ui";
import { ScrollReveals } from "@/components/founding/scroll-reveals";
import { ProjectPreview } from "@/components/founding/project-preview";
import { PageScene } from "@/components/founding/page-scene";
export const metadata = {
  title: "For Builders",
  alternates: { canonical: "/for-builders" },
};
export default function BuildersPage() {
  return (
    <ScrollReveals><PageScene scene="builders">
      <p className="founding-eyebrow">For Builders</p>
      <h1 className="statement mt-6">
        You built it.
        <br />
        <em>Let it be seen.</em>
      </h1>
      <p className="founding-copy mt-8">
        Apps, games, tools, communities and internet Projects.
        <br />
        Enter the first field and give people a reason to explore your work.
      </p>
    </PageScene><Container className="founding-section page-scene-follow">
      <ol className="mechanics">
        <li data-reveal="rise">
          <span>01 / Enter</span>
          <h2>Bring your Project.</h2>
          <p>
            Create a Project profile, select the Founding Arena and review the
            entry details.
          </p>
        </li>
        <li data-reveal="rise">
          <span>02 / Get accepted</span>
          <h2>Take your place.</h2>
          <p>
            Submission awaits review. Acceptance confirms your place in the
            field.
          </p>
        </li>
        <li data-reveal="rise">
          <span>03 / Compete</span>
          <h2>Make attention count.</h2>
          <p>
            Share your entry. Follow supporters, qualified visits, rank movement
            and final results in your dashboard.
          </p>
        </li>
      </ol>
      <ProjectPreview />
      <div className="event-principles">
        <div>
          <h2>Know what your entry earns.</h2>
          <p>
            Your dashboard tracks profile views, qualified visits, outbound CTR
            and supporters. Exposure depends on the competition; traffic is
            never guaranteed.
          </p>
        </div>
        <div>
          <h2>Build a lasting record.</h2>
          <p>
            Earn Arena Rating through verified performance. Share your ranking
            and return for the next competition.
          </p>
        </div>
      </div>
      <ButtonLink href="/arena/founding" size="lg" className="mt-12">
        Explore the Founding Arena
      </ButtonLink>
    </Container></ScrollReveals>
  );
}
