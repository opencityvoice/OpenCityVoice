"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShareButtons } from "../reports/[number]/share-button";
import { useLocale, useTranslations } from "next-intl";
import imageCompression from "browser-image-compression";
import { ArrowLeft, Camera, CircleCheck, ImagePlus, Loader2, LocateFixed, MapPin, ThumbsUp, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategoryIcon } from "@/components/category-icon";
import { LocationPicker } from "@/components/map/location-picker";
import { IndependentNotice } from "@/components/legal-links";
import { createReport, toggleVote } from "@/app/actions/reports";
import { createClient } from "@/lib/supabase/client";
import { localized } from "@/i18n/config";
import { MAX_PHOTOS, PHOTO_BUCKET, photoUrl } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Category, PublicMunicipality } from "@/lib/types";

export type ActiveReport = {
  id: string;
  number: number;
  title: string | null;
  description: string;
  category_id: string;
  lat: number;
  lng: number;
  vote_count: number;
  photos: string[];
};

type Props = {
  userId: string;
  municipality: PublicMunicipality;
  categories: Category[];
  boundary: GeoJSON.Geometry | null;
  activeReports: ActiveReport[];
};

type Photo = { id: string; blob: Blob; preview: string };
type Duplicate = { id: string; number: number; title: string | null; description: string; vote_count: number; photos: string[]; distance_m: number };
type Step = "location" | "details" | "done";

const steps: Step[] = ["location", "details"];
// A photo taken farther than this from the pin is offered as the report location.
const PHOTO_LOCATION_THRESHOLD_M = 30;

async function readGps(file: File): Promise<[number, number] | null> {
  try {
    const { gps } = await import("exifr");
    const result = await gps(file);
    return result && Number.isFinite(result.latitude) ? [result.latitude, result.longitude] : null;
  } catch {
    return null;
  }
}

function distanceM([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export function NewReportWizard({ userId, municipality, categories, boundary, activeReports }: Props) {
  const t = useTranslations("newReport");
  const tc = useTranslations("common");
  const tr = useTranslations("report");
  const locale = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("location");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [processing, setProcessing] = useState(false);
  const [position, setPosition] = useState<[number, number]>([municipality.center_lat, municipality.center_lng]);
  const [photoPosition, setPhotoPosition] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [inside, setInside] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const [nearby, setNearby] = useState<Duplicate[]>([]);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdNumber, setCreatedNumber] = useState<number | null>(null);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.preview)), [photos]);

  // Start at the device location; the map shows the municipality until it arrives.
  useEffect(() => {
    locate();
  }, []);

  // Validate the boundary, find open reports nearby and look up a readable address whenever the pin settles.
  useEffect(() => {
    const [lat, lng] = position;
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc("point_in_municipality", {
        p_municipality_id: municipality.id,
        p_lat: lat,
        p_lng: lng,
      });
      setInside(data !== false);
      const { data: near } = await supabase.rpc("nearby_reports", {
        p_municipality_id: municipality.id,
        p_lat: lat,
        p_lng: lng,
        p_radius_m: 50,
      });
      setNearby((near ?? []) as Duplicate[]);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}&accept-language=${locale}`,
        );
        const json = await res.json();
        const a = json.address ?? {};
        const street = [a.road ?? a.pedestrian ?? a.footway ?? a.square, a.house_number].filter(Boolean).join(" ");
        const place = a.city ?? a.town ?? a.village ?? a.suburb;
        setAddress([street, place].filter(Boolean).join(", ") || null);
      } catch {
        setAddress(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [position, municipality.id, supabase, locale]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const pins = useMemo(
    () =>
      activeReports
        .filter((r) => categoryById.has(r.category_id))
        .map((r) => ({
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          color: categoryById.get(r.category_id)!.color,
          closed: Boolean(categoryId) && r.category_id !== categoryId,
        })),
    [activeReports, categoryById, categoryId],
  );
  const nearbyShown = (categoryId ? nearby.filter((d) => activeReports.find((r) => r.id === d.id)?.category_id === categoryId) : nearby).slice(0, 2);
  const pinned = selectedPin ? activeReports.find((r) => r.id === selectedPin) : null;

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setProcessing(true);
    const next: Photo[] = [];
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
      if (photos.length === 0 && next.length === 0) {
        const gps = await readGps(file);
        setPhotoPosition(gps && distanceM(gps, position) > PHOTO_LOCATION_THRESHOLD_M ? gps : null);
      }
      try {
        const blob = await imageCompression(file, {
          maxWidthOrHeight: 1600,
          maxSizeMB: 0.7,
          fileType: "image/jpeg",
          initialQuality: 0.82,
          useWebWorker: true,
        });
        next.push({ id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) });
      } catch {
        toast.error(tc("error"));
      }
    }
    setPhotos((current) => [...current, ...next]);
    setProcessing(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition([coords.latitude, coords.longitude]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function checkDuplicates() {
    if (!categoryId) return;
    const { data } = await supabase.rpc("nearby_reports", {
      p_municipality_id: municipality.id,
      p_lat: position[0],
      p_lng: position[1],
      p_radius_m: 50,
      p_category_id: categoryId,
    });
    return (data ?? []) as Duplicate[];
  }

  async function submit(skipDuplicateCheck = false) {
    if (!categoryId || description.trim().length < 3) return;
    setSubmitting(true);
    if (!skipDuplicateCheck) {
      const found = await checkDuplicates();
      if (found && found.length > 0) {
        setDuplicates(found);
        setSubmitting(false);
        return;
      }
    }
    setDuplicates(null);

    const paths: string[] = [];
    for (const photo of photos) {
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo.blob, { contentType: "image/jpeg" });
      if (error) {
        toast.error(tc("error"));
        setSubmitting(false);
        return;
      }
      paths.push(path);
    }

    const result = await createReport({
      municipalityId: municipality.id,
      categoryId,
      description,
      lat: position[0],
      lng: position[1],
      address: address ?? undefined,
      photos: paths,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(
        result.error === "outside"
          ? t("outsideMunicipality", { municipality: municipality.name })
          : result.error === "rateLimited"
            ? t("rateLimited")
            : tc("error"),
      );
      return;
    }
    setCreatedNumber(result.number);
    setStep("done");
  }

  async function supportExisting(report: { id: string; number: number }) {
    const path = `/${municipality.slug}/reports/${report.number}`;
    const result = await toggleVote(report.id, path);
    // toggleVote removes an existing vote; restore it so "support" never un-supports.
    if (result.ok && !result.voted) await toggleVote(report.id, path);
    router.push(path);
  }

  const stepIndex = steps.indexOf(step);
  const canSubmit = Boolean(categoryId) && inside && description.trim().length >= 3 && !submitting && !processing;

  if (step === "done" && createdNumber !== null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CircleCheck className="size-7" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold">{t("successTitle")}</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">{t("successText", { number: createdNumber })}</p>
        <div className="mt-8 w-full max-w-sm rounded-xl border bg-muted/30 p-4 text-left">
          <h2 className="text-sm font-semibold">{tr("shareTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tr("shareText")}</p>
          <ShareButtons
            className="mt-3"
            url={`${window.location.origin}/${municipality.slug}/reports/${createdNumber}`}
            text={tr("shareMessage", { title: description.slice(0, 80), municipality: municipality.name })}
          />
        </div>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
          <Button className="h-11" render={<Link href={`/${municipality.slug}/reports/${createdNumber}`} />} nativeButton={false}>
            {t("viewReport")}
          </Button>
          <Button variant="ghost" className="h-11" render={<Link href={`/${municipality.slug}`} />} nativeButton={false}>
            {t("backToMap")}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-2">
          {stepIndex > 0 ? (
            <Button variant="ghost" size="icon-lg" onClick={() => setStep(steps[stepIndex - 1]!)} aria-label={tc("back")}>
              <ArrowLeft />
            </Button>
          ) : (
            <Button variant="ghost" size="icon-lg" render={<Link href={`/${municipality.slug}`} />} nativeButton={false} aria-label={tc("close")}>
              <X />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t("title")}</p>
            <p className="truncate text-xs text-muted-foreground">{municipality.name}</p>
          </div>
          <span className="pr-3 text-xs text-muted-foreground tabular-nums">
            {stepIndex + 1}/{steps.length}
          </span>
        </div>
        <div className="mx-auto flex max-w-2xl gap-1 px-4 pb-2">
          {steps.map((s, i) => (
            <span key={s} className={cn("h-1 flex-1 rounded-full", i <= stepIndex ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </header>

      {step === "location" && (
        <main className="relative flex flex-1 flex-col">
          <LocationPicker
            value={position}
            boundary={boundary}
            defaultStyle={municipality.default_map_style}
            pins={pins}
            onPinClick={setSelectedPin}
            onChange={(value) => {
              setPosition(value);
              setSelectedPin(null);
            }}
            className="min-h-[45vh] flex-1"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
            <div className="pointer-events-auto mx-auto max-w-md rounded-xl border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
              <p className="font-semibold">{t("locationTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("locationText")}</p>
            </div>
          </div>
          <div className="pb-safe border-t bg-background pt-3">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-start gap-2 px-4 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate font-medium">{address ?? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`}</p>
                <Button variant="outline" size="sm" onClick={locate} disabled={locating} className="shrink-0">
                  {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
                  {t("useMyLocation")}
                </Button>
              </div>
              {!inside && (
                <p className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <TriangleAlert className="size-4 shrink-0" />
                  {t("outsideMunicipality", { municipality: municipality.name })}
                </p>
              )}

              <fieldset className="mt-3">
                <legend className="px-4 text-sm font-medium">{t("category")}</legend>
                <div className="mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
                  {categories.map((c) => {
                    const active = c.id === categoryId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCategoryId(active ? null : c.id);
                          setDuplicates(null);
                        }}
                        aria-pressed={active}
                        className={cn(
                          "flex w-[104px] shrink-0 flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left text-xs leading-snug transition-colors",
                          active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60",
                        )}
                      >
                        <span className="flex size-7 items-center justify-center rounded-lg" style={{ backgroundColor: c.color }}>
                          <CategoryIcon name={c.icon} className="size-4 text-white" />
                        </span>
                        <span className="line-clamp-2 font-medium">{localized(c.name, locale)}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {inside && (pinned || nearbyShown.length > 0) && (
                <section className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  {pinned ? (
                    <DuplicateList
                      items={[{ ...pinned, distance_m: distanceM([pinned.lat, pinned.lng], position) }]}
                      slug={municipality.slug}
                      onSupport={supportExisting}
                    />
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-amber-950">{t("nearbyTitle", { count: nearbyShown.length })}</p>
                      <p className="mt-0.5 text-xs text-amber-900">{t("nearbyText")}</p>
                      <DuplicateList items={nearbyShown} slug={municipality.slug} onSupport={supportExisting} className="mt-2" />
                    </>
                  )}
                </section>
              )}
              <div className="px-4">
                <Button className="mt-3 h-12 w-full" disabled={!inside || !categoryId} onClick={() => setStep("details")}>
                  {categoryId ? tc("next") : t("chooseCategory")}
                </Button>
              </div>
            </div>
          </div>
        </main>
      )}

      {step === "details" && (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-6">
          <h1 className="text-xl font-semibold">{t("detailsTitle")}</h1>
          {categoryId && (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded" style={{ backgroundColor: categoryById.get(categoryId)?.color }}>
                <CategoryIcon name={categoryById.get(categoryId)?.icon ?? ""} className="size-3 text-white" />
              </span>
              {localized(categoryById.get(categoryId)?.name, locale)} · {address ?? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`}
            </p>
          )}

          <input ref={fileInput} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
          <div className="mt-5">
            <p className="text-sm font-medium">
              {t("photos")} <span className="font-normal text-muted-foreground">({tc("optional")})</span>
            </p>
            {photos.length === 0 ? (
              <button
                onClick={() => fileInput.current?.click()}
                disabled={processing}
                className="mt-2 flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted"
              >
                {processing ? <Loader2 className="size-7 animate-spin" /> : <Camera className="size-8" />}
                <span className="text-sm font-medium text-foreground">{processing ? t("processing") : t("takePhoto")}</span>
              </button>
            ) : (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                    <Image src={photo.preview} alt="" fill className="object-cover" unoptimized />
                    <button
                      onClick={() => setPhotos((current) => current.filter((p) => p.id !== photo.id))}
                      className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white"
                      aria-label={t("removePhoto")}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    onClick={() => fileInput.current?.click()}
                    disabled={processing}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs text-muted-foreground hover:bg-muted"
                    aria-label={t("addAnother")}
                  >
                    {processing ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                  </button>
                )}
              </div>
            )}
            {photoPosition && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">{t("photoElsewhere", { meters: Math.round(distanceM(photoPosition, position)) })}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPosition(photoPosition);
                    setPhotoPosition(null);
                    setDuplicates(null);
                  }}
                >
                  {t("usePhotoLocation")}
                </Button>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={4}
              maxLength={4000}
              className="text-base sm:text-sm"
            />
          </div>

          {!inside && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <TriangleAlert className="size-4 shrink-0" />
              {t("outsideMunicipality", { municipality: municipality.name })}
            </p>
          )}

          {duplicates && duplicates.length > 0 && (
            <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-semibold text-amber-950">{t("duplicatesTitle")}</p>
              <p className="mt-1 text-sm text-amber-900">{t("duplicatesText")}</p>
              <DuplicateList items={duplicates} slug={municipality.slug} onSupport={supportExisting} className="mt-3" />
            </section>
          )}

          <div className="pb-safe sticky bottom-0 mt-auto bg-background pt-6">
            {!municipality.is_official && <IndependentNotice municipality={municipality.name} className="mb-3" />}
            <Button className="h-12 w-full" disabled={!canSubmit} onClick={() => submit(Boolean(duplicates))}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? t("submitting") : duplicates ? t("notDuplicate") : t("submit")}
            </Button>
          </div>
        </main>
      )}
    </>
  );
}

function DuplicateList({
  items,
  slug,
  onSupport,
  className,
}: {
  items: Duplicate[];
  slug: string;
  onSupport: (report: Duplicate) => void;
  className?: string;
}) {
  const t = useTranslations("newReport");
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((d) => (
        <li key={d.id} className="flex items-center gap-3 rounded-lg border bg-background p-2.5">
          {d.photos[0] ? (
            <Image src={photoUrl(d.photos[0])} alt="" width={96} height={96} className="size-12 rounded-md object-cover" unoptimized />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
              #{d.number}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <Link href={`/${slug}/reports/${d.number}`} className="block truncate text-sm font-medium hover:underline">
              {d.title || d.description}
            </Link>
            <p className="text-xs text-muted-foreground">
              {t("metersAway", { meters: Math.round(d.distance_m) })} · <ThumbsUp className="inline size-3" /> {d.vote_count}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onSupport(d)}>
            {t("supportThis")}
          </Button>
        </li>
      ))}
    </ul>
  );
}
