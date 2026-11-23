"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Camera, ImagePlus, Loader2, LocateFixed, MapPin, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationPicker } from "@/components/map/location-picker";
import { updateReport } from "@/app/actions/reports";
import { createClient } from "@/lib/supabase/client";
import { MAX_PHOTOS, PHOTO_BUCKET, photoUrl } from "@/lib/config";
import { compressPhoto, PHOTO_EXT, PHOTO_MIME } from "@/lib/photo-upload";
import type { PublicMunicipality } from "@/lib/types";

type EditableReport = {
  id: string;
  title: string | null;
  description: string;
  lat: number;
  lng: number;
  address: string | null;
  photos: string[];
};

type Props = {
  userId: string;
  municipality: PublicMunicipality;
  boundary: GeoJSON.Geometry | null;
  report: EditableReport;
  reportPath: string;
};

type NewPhoto = { id: string; blob: Blob; preview: string };

export function EditReportForm({ userId, municipality, boundary, report, reportPath }: Props) {
  const t = useTranslations("editReport");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const fileInput = useRef<HTMLInputElement>(null);

  const [position, setPosition] = useState<[number, number]>([report.lat, report.lng]);
  const [inside, setInside] = useState(true);
  const [address, setAddress] = useState<string | null>(report.address);
  const [locating, setLocating] = useState(false);
  const [keepPhotos, setKeepPhotos] = useState<string[]>(report.photos);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [description, setDescription] = useState(report.description);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => newPhotos.forEach((p) => URL.revokeObjectURL(p.preview)), [newPhotos]);

  // Validate the boundary and look up a readable address whenever the pin settles.
  useEffect(() => {
    const [lat, lng] = position;
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc("point_in_municipality", {
        p_municipality_id: municipality.id,
        p_lat: lat,
        p_lng: lng,
      });
      setInside(data !== false);
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

  const photoCount = keepPhotos.length + newPhotos.length;

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setProcessing(true);
    const next: NewPhoto[] = [];
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - photoCount)) {
      try {
        const blob = await compressPhoto(file);
        next.push({ id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) });
      } catch {
        toast.error(tc("error"));
      }
    }
    setNewPhotos((current) => [...current, ...next]);
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

  async function save() {
    if (description.trim().length < 3 || !inside) return;
    setSaving(true);
    const uploaded: string[] = [];
    for (const photo of newPhotos) {
      const path = `${userId}/${crypto.randomUUID()}.${PHOTO_EXT}`;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo.blob, { contentType: PHOTO_MIME });
      if (error) {
        if (uploaded.length) await supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
        toast.error(tc("error"));
        setSaving(false);
        return;
      }
      uploaded.push(path);
    }

    const result = await updateReport({
      reportId: report.id,
      title: report.title ?? undefined,
      description,
      lat: position[0],
      lng: position[1],
      address: address ?? undefined,
      photos: [...keepPhotos, ...uploaded],
    });
    if (!result.ok) {
      if (uploaded.length) await supabase.storage.from(PHOTO_BUCKET).remove(uploaded);
      toast.error(
        result.error === "outside"
          ? t("outsideMunicipality", { municipality: municipality.name })
          : result.error === "locked"
            ? t("locked")
            : tc("error"),
      );
      setSaving(false);
      return;
    }
    if (result.removedPhotos.length) await supabase.storage.from(PHOTO_BUCKET).remove(result.removedPhotos);
    router.push(reportPath);
    router.refresh();
  }

  const canSave = inside && description.trim().length >= 3 && !saving && !processing;

  return (
    <>
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-2">
          <Button variant="ghost" size="icon-lg" render={<Link href={reportPath} />} nativeButton={false} aria-label={tc("back")}>
            <ArrowLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t("title")}</p>
            <p className="truncate text-xs text-muted-foreground">{municipality.name}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-6">
        <section>
          <p className="text-sm font-medium">{t("location")}</p>
          <LocationPicker
            value={position}
            boundary={boundary}
            defaultStyle={municipality.default_map_style}
            onChange={setPosition}
            className="mt-2 h-64 overflow-hidden rounded-xl"
          />
          <div className="mt-2 flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 truncate font-medium">
              {address ?? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`}
            </p>
            <Button variant="outline" size="sm" onClick={locate} disabled={locating} className="shrink-0">
              {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
              {t("useMyLocation")}
            </Button>
          </div>
        </section>

        <input ref={fileInput} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
        <section className="mt-6">
          <p className="text-sm font-medium">
            {t("photos")} <span className="font-normal text-muted-foreground">({tc("optional")})</span>
          </p>
          {photoCount === 0 ? (
            <button
              onClick={() => fileInput.current?.click()}
              disabled={processing}
              className="mt-2 flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted"
            >
              {processing ? <Loader2 className="size-7 animate-spin" /> : <Camera className="size-8" />}
              <span className="text-sm font-medium text-foreground">{processing ? t("processing") : t("takePhoto")}</span>
            </button>
          ) : (
            <div className="mt-2 grid grid-cols-5 gap-2">
              {keepPhotos.map((path) => (
                <div key={path} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                  <Image src={photoUrl(path)} alt="" fill className="object-cover" unoptimized />
                  <button
                    onClick={() => setKeepPhotos((current) => current.filter((p) => p !== path))}
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white"
                    aria-label={t("removePhoto")}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {newPhotos.map((photo) => (
                <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                  <Image src={photo.preview} alt="" fill className="object-cover" unoptimized />
                  <button
                    onClick={() => setNewPhotos((current) => current.filter((p) => p.id !== photo.id))}
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white"
                    aria-label={t("removePhoto")}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {photoCount < MAX_PHOTOS && (
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
        </section>

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

        <div className="pb-safe sticky bottom-0 mt-auto flex gap-2 bg-background pt-6">
          <Button variant="outline" className="h-12 flex-1" render={<Link href={reportPath} />} nativeButton={false}>
            {tc("cancel")}
          </Button>
          <Button className="h-12 flex-1" disabled={!canSave} onClick={save}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? t("saving") : tc("save")}
          </Button>
        </div>
      </main>
    </>
  );
}
