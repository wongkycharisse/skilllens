import { parseJourney, yocvLink } from "../../../lib/journey";
import HostDemo from "./HostDemo";

// Mock course host page. Opened with ?journey=demo (journey contract v1) it is Phase 3 of the connected journey: it reads
// the contract's parameters, maps course=opp-course-001 to solar-pv and yoid=yoid-ng-7f3a0123 to Halima (yp-001), and
// links on to YoCV once cred-002 is recorded. Without journey=demo it is the same page as before.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const journey = parseJourney(await searchParams);
  return <HostDemo journey={journey} yocvHref={journey ? yocvLink(journey) : null} />;
}
