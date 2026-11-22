import { getTranslations } from "next-intl/server";
import { getBoundary, getCategories, getMunicipality, getReports, getStatuses, requireUser } from "@/lib/data";
import { NewReportWizard } from "./wizard";

export async function generateMetadata() {
  const t = await getTranslations("newReport");
  return { title: t("title") };
}

export default async function NewReportPage({ params }: PageProps<"/[municipality]/new">) {
  const { municipality: slug } = await params;
  const user = await requireUser(`/${slug}/new`);
  const municipality = await getMunicipality(slug);
  const [categories, boundary, statuses, reports] = await Promise.all([
    getCategories(municipality.id),
    getBoundary(municipality.id),
    getStatuses(municipality.id),
    getReports(municipality.id),
  ]);
  const closed = new Set(statuses.filter((s) => s.is_closed).map((s) => s.id));
  const activeReports = reports
    .filter((r) => !closed.has(r.status_id))
    .map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      description: r.description,
      category_id: r.category_id,
      lat: r.lat,
      lng: r.lng,
      vote_count: r.vote_count,
      photos: r.photos,
    }));

  return (
    <div style={{ "--primary": municipality.primary_color } as React.CSSProperties} className="flex min-h-dvh flex-col">
      <NewReportWizard
        userId={user.id}
        municipality={municipality}
        categories={categories.filter((c) => c.is_active)}
        boundary={boundary}
        activeReports={activeReports}
      />
    </div>
  );
}
