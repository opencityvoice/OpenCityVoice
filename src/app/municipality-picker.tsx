"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, LocateFixed, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { MunicipalityLogo } from "@/components/municipality-logo";

type Item = { id: string; slug: string; name: string; primary_color: string; logo_path: string | null };

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function MunicipalityPicker({ municipalities }: { municipalities: Item[] }) {
  const t = useTranslations("home");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? municipalities.filter((m) => normalize(m.name).includes(q)) : municipalities;
  }, [query, municipalities]);

  function locate() {
    if (!navigator.geolocation) return setMessage(t("locationDenied"));
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { data } = await createClient().rpc("municipality_at", { p_lat: coords.latitude, p_lng: coords.longitude });
        const match = Array.isArray(data) ? data[0] : null;
        if (match) router.push(`/${match.slug}`);
        else {
          setLocating(false);
          setMessage(t("notFound"));
        }
      },
      () => {
        setLocating(false);
        setMessage(t("locationDenied"));
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      <h2 className="px-1 font-medium">{t("chooseMunicipality")}</h2>
      {municipalities.length > 1 && (
        <>
          <Button onClick={locate} disabled={locating} className="mt-4 h-11 w-full">
            {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
            {locating ? t("locating") : t("useLocation")}
          </Button>
          {message && <p className="mt-3 px-1 text-sm text-muted-foreground">{message}</p>}
        </>
      )}
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-11 pl-9"
          aria-label={t("searchPlaceholder")}
        />
      </div>
      <ul className="mt-2 max-h-80 overflow-y-auto">
        {filtered.map((m) => (
          <li key={m.id}>
            <Link
              href={`/${m.slug}`}
              className="flex items-center gap-3 rounded-lg px-2 py-3 text-sm hover:bg-muted"
            >
              <MunicipalityLogo name={m.name} logoPath={m.logo_path} color={m.primary_color} />
              <span className="flex-1 font-medium">{m.name}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
        {filtered.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">{t("noResults")}</li>}
      </ul>
    </div>
  );
}
