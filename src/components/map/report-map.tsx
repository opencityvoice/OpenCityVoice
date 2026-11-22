"use client";

import { useEffect, useRef } from "react";
import { maplibregl } from "./maplibre";
import type { GeoJSONSource, MapLayerMouseEvent, MapMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { MapStyleControl, boundaryPaint, isMapStyleId, mapStyle, storedMapStyle, type MapStyleId } from "./map-styles";

export type MapPin = { id: string; lat: number; lng: number; color: string; closed?: boolean };

type Props = {
  center: [number, number];
  zoom: number;
  pins: MapPin[];
  boundary?: GeoJSON.Geometry | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  interactive?: boolean;
  defaultStyle?: string;
  className?: string;
};

function toFeatureCollection(pins: MapPin[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => ({
      type: "Feature",
      id: p.id,
      properties: { id: p.id, color: p.color, closed: p.closed ? 1 : 0 },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    })),
  };
}

export function ReportMap({ center, zoom, pins, boundary, selectedId, onSelect, interactive = true, defaultStyle, className }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loaded = useRef(false);
  const onSelectRef = useRef(onSelect);
  const pinsRef = useRef(pins);
  const selectedRef = useRef(selectedId);
  const t = useTranslations("map");

  useEffect(() => {
    onSelectRef.current = onSelect;
    pinsRef.current = pins;
    selectedRef.current = selectedId;
  });

  useEffect(() => {
    if (!container.current) return;
    const fallback = isMapStyleId(defaultStyle) ? defaultStyle : "map";
    let styleId: MapStyleId = interactive ? storedMapStyle(fallback) : fallback;
    const map = new maplibregl.Map({
      container: container.current,
      style: mapStyle(styleId),
      center: [center[1], center[0]],
      zoom,
      attributionControl: { compact: true },
      interactive,
      cooperativeGestures: false,
    });
    mapRef.current = map;
    if (interactive) {
      map.addControl(
        new MapStyleControl(
          { title: t("style"), map: t("map"), detailed: t("detailed"), satellite: t("satellite") },
          styleId,
          (id) => {
            styleId = id;
            map.setStyle(mapStyle(id), { diff: false });
          },
        ),
        "top-right",
      );
      map.addControl(
        new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
        "top-right",
      );
    }

    // Runs on the first load and after every base style switch, which drops the app's own layers.
    map.on("style.load", () => {
      map.addSource("boundary", {
        type: "geojson",
        data: boundary ? { type: "Feature", properties: {}, geometry: boundary } : { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "boundary-line",
        type: "line",
        source: "boundary",
        paint: boundaryPaint(styleId),
      });

      map.addSource("reports", {
        type: "geojson",
        data: toFeatureCollection(pinsRef.current),
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 15,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "reports",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1c1917",
          "circle-opacity": 0.85,
          "circle-radius": ["step", ["get", "point_count"], 15, 10, 19, 50, 24],
          "circle-stroke-width": 3,
          "circle-stroke-color": "rgba(255,255,255,0.9)",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "reports",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Bold"] },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "pins",
        type: "circle",
        source: "reports",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", ["==", ["get", "closed"], 1], 0.45, 1],
          "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 11, 7.5],
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 4, 2.5],
          "circle-stroke-color": "#ffffff",
        },
      });

      loaded.current = true;
      if (selectedRef.current) map.setFeatureState({ source: "reports", id: selectedRef.current }, { selected: true });
    });

    map.on("load", () => {
      if (!interactive) return;
      map.on("click", "pins", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onSelectRef.current?.(id);
      });
      map.on("click", "clusters", async (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const source = map.getSource("reports") as GeoJSONSource;
        const nextZoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
        map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom: nextZoom });
      });
      map.on("click", (e: MapMouseEvent) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ["pins", "clusters"] });
        if (hits.length === 0) onSelectRef.current?.(null);
      });
      for (const layer of ["pins", "clusters"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
    });

    return () => {
      loaded.current = false;
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => (map.getSource("reports") as GeoJSONSource | undefined)?.setData(toFeatureCollection(pins));
    if (loaded.current) apply();
    else map.once("load", apply);
  }, [pins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const apply = () => {
      if (!map.getSource("reports")) return;
      map.setFeatureState({ source: "reports", id: selectedId }, { selected: true });
      const pin = pinsRef.current.find((p) => p.id === selectedId);
      if (pin && !map.getBounds().contains([pin.lng, pin.lat])) map.easeTo({ center: [pin.lng, pin.lat] });
    };
    if (loaded.current) apply();
    else map.once("load", apply);
    return () => {
      if (loaded.current && map.getSource("reports")) map.setFeatureState({ source: "reports", id: selectedId }, { selected: false });
    };
  }, [selectedId]);

  return (
    <div className={className}>
      <div ref={container} className="size-full" />
    </div>
  );
}
