import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getAccess, getBoundary, getCategories, getMunicipality, getReportListItem, getReports, getStatuses, getVotedReportIds } from "@/lib/data";
import { ExplorerView } from "./explorer-view";

export async function generateMetadata({ params }: PageProps<"/[municipality]">): Promise<Metadata> {
  const { municipality: slug } = await params;
  const municipality = await getMunicipality(slug);
  return { title: municipality.name };
}

export default async function MunicipalityPage({ params, searchParams }: PageProps<"/[municipality]">) {
  const { municipality: slug } = await params;
  const { report } = await searchParams;
  const initialSelected = typeof report === "string" ? report : null;
  const municipality = await getMunicipality(slug);
  const [categories, statuses, allReports, boundary, access, votedIds] = await Promise.all([
    getCategories(municipality.id),
    getStatuses(municipality.id),
    getReports(municipality.id),
    getBoundary(municipality.id),
    getAccess(municipality.id),
    getVotedReportIds(municipality.id),
  ]);
  let reports = allReports;
  if (initialSelected && !reports.some((r) => r.id === initialSelected)) {
    const selected = await getReportListItem(municipality.id, initialSelected).catch(() => null);
    if (selected) reports = [...reports, selected];
  }

  return (
    <div className="flex h-dvh flex-col" style={{ "--primary": municipality.primary_color } as React.CSSProperties}>
      <SiteHeader municipality={municipality} isStaff={access.isStaff} next={`/${slug}`} />
      <ExplorerView
        municipality={municipality}
        categories={categories}
        statuses={statuses}
        reports={reports}
        boundary={boundary}
        initialSelected={initialSelected}
        votedIds={votedIds}
        signedIn={Boolean(access.user)}
      />
    </div>
  );
}
