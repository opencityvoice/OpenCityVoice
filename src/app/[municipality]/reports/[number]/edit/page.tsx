import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getBoundary, getMunicipality, getStatuses, requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { EditReportForm } from "./edit-form";

type Params = PageProps<"/[municipality]/reports/[number]/edit">;

export async function generateMetadata() {
  const t = await getTranslations("editReport");
  return { title: t("title") };
}

export default async function EditReportPage({ params }: Params) {
  const { municipality: slug, number: numberParam } = await params;
  const number = Number(numberParam);
  if (!Number.isInteger(number) || number < 1) notFound();
  const municipality = await getMunicipality(slug);
  const reportPath = `/${slug}/reports/${number}`;
  const user = await requireUser(`${reportPath}/edit`);
  const supabase = await createClient();
  const [{ data: report }, statuses, boundary] = await Promise.all([
    supabase
      .from("reports")
      .select("id, author_id, title, description, lat, lng, address, photos, status_id, is_hidden")
      .eq("municipality_id", municipality.id)
      .eq("number", number)
      .maybeSingle(),
    getStatuses(municipality.id),
    getBoundary(municipality.id),
  ]);
  const status = statuses.find((s) => s.id === report?.status_id);
  if (!report || report.author_id !== user.id || report.is_hidden || !status?.is_initial) redirect(reportPath);

  return (
    <div style={{ "--primary": municipality.primary_color } as React.CSSProperties} className="flex min-h-dvh flex-col">
      <EditReportForm
        userId={user.id}
        municipality={municipality}
        boundary={boundary}
        report={{
          id: report.id,
          title: report.title,
          description: report.description,
          lat: report.lat,
          lng: report.lng,
          address: report.address,
          photos: report.photos,
        }}
        reportPath={reportPath}
      />
    </div>
  );
}
