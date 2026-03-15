import React, { useEffect, useState, useMemo, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { MapView, FlyToInterpolator } from "@deck.gl/core";
import { GeoJsonLayer } from "@deck.gl/layers";
import Map from "react-map-gl/mapbox";
import * as THREE from "three";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  X,
  Map as MapIcon,
  Loader2,
  AlertTriangle,
  Box,
  LayoutPanelTop,
  DownloadCloud,
} from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
import { getLaneletPreviewUrl, getPcdPreviewUrl } from "./api";

// Mapbox setup
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface MapPreviewProps {
  versionId: string;
  versionName: string;
  onClose: () => void;
}

type ViewMode = "2D" | "3D";

const MapPreview: React.FC<MapPreviewProps> = ({
  versionId,
  versionName,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("2D");

  // Data States
  const [laneletData, setLaneletData] = useState<any>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const reqIdRef = useRef<number>(0);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Đang khởi tạo Engine...");
  const [error, setError] = useState<string | null>(null);

  // 2D View State
  const [mapViewState, setMapViewState] = useState({
    longitude: 105.8048,
    latitude: 21.0285,
    zoom: 15,
    pitch: 0,
    bearing: 0,
    transitionDuration: 1000,
    transitionInterpolator: new FlyToInterpolator(),
  });

  const is3DInit = useRef(false);

  // Load 2D Data
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setLoadingMsg("Đang lấy dữ liệu bản đồ...");

    fetch(getLaneletPreviewUrl(versionId))
      .then((r) => r.json())
      .then((geoJson) => {
        if (!isMounted) return;
        if (geoJson?.features?.length > 0) {
          setLaneletData(geoJson);
          let sumLng = 0,
            sumLat = 0,
            count = 0;
          geoJson.features.slice(0, 500).forEach((f: any) => {
            if (f.geometry.type === "LineString") {
              f.geometry.coordinates.forEach((c: any) => {
                sumLng += c[0];
                sumLat += c[1];
                count++;
              });
            } else if (f.geometry.type === "Point") {
              sumLng += f.geometry.coordinates[0];
              sumLat += f.geometry.coordinates[1];
              count++;
            }
          });

          if (count > 0) {
            setMapViewState((prev) => ({
              ...prev,
              longitude: sumLng / count,
              latitude: sumLat / count,
              zoom: 16.5,
            }));
          }
        }
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setError("Không thể tải bộ dữ liệu bản đồ");
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [versionId]);

  // Load 3D Data using Three.js logic explicitly restricted to ViewMode="3D"
  useEffect(() => {
    if (viewMode !== "3D" || is3DInit.current || !threeContainerRef.current)
      return;

    const init3D = () => {
      is3DInit.current = true;
      setLoading(true);
      setLoadingMsg("Đang tải xuống PCD đã tối ưu...");

      const container = threeContainerRef.current!;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf1f5f9);

      const camera = new THREE.PerspectiveCamera(
        60,
        container.clientWidth / container.clientHeight,
        0.1,
        10000,
      );
      camera.up.set(0, 0, 1);
      camera.position.set(0, -100, 50);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      // Allow zooming and panning fully natively
      controls.enableZoom = true;
      controls.enablePan = true;

      const loader = new PCDLoader();

      const pcdUrl = getPcdPreviewUrl(versionId);

      loader.load(
        pcdUrl,
        (points) => {
          points.geometry.computeBoundingBox();
          const bbox = points.geometry.boundingBox;
          if (bbox) {
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.2;
            camera.position.set(
              center.x,
              center.y - dist,
              center.z + dist * 0.5,
            );
            camera.lookAt(center);
            controls.target.copy(center);

            // Custom High-Tech Cyan / Height Coloring
            const pos = points.geometry.attributes.position;
            const colors = new Float32Array(pos.count * 3);
            const minZ = bbox.min.z;
            const zRange = Math.max(0.1, bbox.max.z - minZ);

            for (let i = 0; i < pos.count; i++) {
              let t = (pos.getZ(i) - minZ) / zRange;
              if ((points.geometry.attributes as any).color) {
                // Ignore external colors
                continue;
              }
              colors[i * 3] = 14 / 255; // Sky blue
              colors[i * 3 + 1] = 165 / 255;
              colors[i * 3 + 2] = (233 - t * 50) / 255;
            }

            if (!(points.geometry.attributes as any).color) {
              points.geometry.setAttribute(
                "color",
                new THREE.BufferAttribute(colors, 3),
              );
              (points.material as THREE.PointsMaterial).vertexColors = true;
            }
            (points.material as THREE.PointsMaterial).size = 1.2;
          }
          scene.add(points);
          setLoading(false);
        },
        (xhr) =>
          setLoadingMsg(
            `Đang tải xuống PCD (${Math.round((xhr.loaded / (xhr.total || 1)) * 100)}%)...`,
          ),
        (err) => {
          console.error("3D Loading Error:", err);
          setError("Không thể tải dữ liệu 3D");
          setLoading(false);
        },
      );

      const animate = () => {
        if (!rendererRef.current) return;
        reqIdRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        if (!container || !rendererRef.current) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    };

    const cleanup = init3D();
    return () => {
      if (cleanup) cleanup();
    };
  }, [viewMode, versionId]);

  // Clean memory on Unmount
  useEffect(() => {
    return () => {
      is3DInit.current = false;
      if (rendererRef.current) {
        cancelAnimationFrame(reqIdRef.current);
        rendererRef.current.dispose();
        // Force cleanup of the dom element to avoid multiple canvas if re-rendered
        if (threeContainerRef.current) {
          threeContainerRef.current.innerHTML = "";
        }
      }
    };
  }, []);

  // Layers for 2D Deck GL
  const layers = useMemo(() => {
    return [
      viewMode === "2D" &&
        laneletData &&
        new GeoJsonLayer({
          id: "lanelet-layer",
          data: laneletData,
          pickable: true,
          stroked: false,
          filled: true,
          extruded: false,
          pointType: "circle",
          lineWidthScale: 1,
          lineWidthMinPixels: 2.5,
          getLineColor: (f) => {
            const type = f.properties.display_type;
            if (type === "boundary") return [56, 189, 248, 255];
            if (type === "virtual") return [56, 189, 248, 120];
            if (type === "stop_line") return [248, 113, 113, 255];
            return [148, 163, 184, 150];
          },
          getLineWidth: (f) =>
            f.properties.display_type === "stop_line" ? 2 : 1,
          getFillColor: [100, 116, 139, 150],
          getPointRadius: 2.5,
          pointRadiusUnits: "meters",
          transitions: {
            getLineColor: 1000,
            getLineWidth: 1000,
          },
        }),
    ].filter(Boolean);
  }, [viewMode, laneletData]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-all duration-500"
        onClick={onClose}
      />

      {/* Container */}
      <div className="relative w-full h-full max-w-[95vw] md:max-w-7xl max-h-[90vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl bg-white border border-slate-200">
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white/90 backdrop-blur-xl z-50">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
              <MapIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg tracking-tight">
                {versionName}
              </h3>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <p className="text-[10px] uppercase font-bold text-blue-600 tracking-widest">
                  Deck.GL + Three.JS Engine
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode("2D")}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${viewMode === "2D" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <LayoutPanelTop className="w-4 h-4" />
                2D Map
              </button>
              <button
                onClick={() => setViewMode("3D")}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${viewMode === "3D" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Box className="w-4 h-4" />
                Đám mây 3D
              </button>
            </div>
            <div className="h-8 w-px bg-slate-200 mx-1"></div>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all group"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </header>

        {/* Viewport Container */}
        <div className="flex-1 relative bg-slate-50 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-white/80 backdrop-blur-md">
              <div className="flex flex-col items-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-xl bg-blue-400/30 animate-pulse"></div>
                  <DownloadCloud className="w-12 h-12 text-blue-500 animate-bounce relative z-10" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />{" "}
                    {loadingMsg}
                  </p>
                  <p className="text-xs text-slate-500 text-center max-w-[250px]">
                    Đang áp dụng Voxel Grid Downsampling & xử lý luồng
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-white/95 backdrop-blur-md p-12">
              <div className="text-center max-w-sm">
                <div className="inline-block p-4 bg-red-50 rounded-full mb-6 relative">
                  <div className="absolute inset-0 bg-red-100 blur-xl rounded-full"></div>
                  <AlertTriangle className="w-10 h-10 text-red-500 relative z-10" />
                </div>
                <h4 className="text-2xl font-bold text-slate-900 mb-2">
                  Lỗi hiển thị
                </h4>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                  {error}
                </p>
                <button
                  onClick={onClose}
                  className="px-8 py-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-xl font-bold shadow-lg shadow-red-200"
                >
                  Đóng trình xem
                </button>
              </div>
            </div>
          )}

          {/* 3D Container using Three.js */}
          <div
            ref={threeContainerRef}
            className={`absolute inset-0 z-40 ${viewMode === "3D" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          />

          {/* Core DeckGL Engine for 2D Only - Destroy instance when not needed to avoid WebGL context loss errors */}
          {viewMode === "2D" && (
            <div className="absolute inset-0 z-30 opacity-100 pointer-events-auto">
              <DeckGL
                layers={layers as any}
                views={[new MapView({ id: "2D", controller: true })]}
                viewState={{ "2D": mapViewState }}
                onViewStateChange={({ viewState }) =>
                  setMapViewState(viewState as any)
                }
                getCursor={({ isDragging }) =>
                  isDragging ? "grabbing" : "grab"
                }
              >
                {MAPBOX_TOKEN && (
                  <Map
                    mapStyle="mapbox://styles/mapbox/light-v11"
                    mapboxAccessToken={MAPBOX_TOKEN}
                    reuseMaps
                  />
                )}
              </DeckGL>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.05)] z-[45]"></div>
        </div>
      </div>
    </div>
  );
};

export default MapPreview;
