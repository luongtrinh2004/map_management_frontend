import React, { useEffect, useState, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { PointCloudLayer } from '@deck.gl/layers';
import { PCDLoader } from '@loaders.gl/pcd';
import { registerLoaders, parse } from '@loaders.gl/core';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X, Map as MapIcon, Loader2, Maximize2, Info, AlertTriangle } from 'lucide-react';
import { getLaneletPreviewUrl, getPcdPreviewUrl } from './api';

registerLoaders([PCDLoader]);

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface MapPreviewProps {
  versionId: string;
  versionName: string;
  onClose: () => void;
}

type ViewMode = '2D' | '3D';

const MapPreview: React.FC<MapPreviewProps> = ({ versionId, versionName, onClose }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const anchorPoint = useRef<[number, number] | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('2D');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [assetStatus, setAssetStatus] = useState<string>('Initializing...');
  const [refreshKey, setRefreshKey] = useState(0);
  const [is3D, setIs3D] = useState(false);

  // --- Helper: Fit Bounds & Save Anchor ---
  const fitBounds = useCallback((geojson: any) => {
    if (!mapRef.current || !geojson?.features?.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    geojson.features.forEach((f: any) => {
      const add = (coords: [number, number]) => {
        const [lng, lat] = coords;
        if (lng > 100 && lng < 112 && lat > 8 && lat < 24) bounds.extend(coords);
      };
      if (f.geometry.type === 'LineString') f.geometry.coordinates.forEach(add);
      else if (f.geometry.type === 'Point') add(f.geometry.coordinates);
      else if (f.geometry.type === 'Polygon') f.geometry.coordinates[0]?.forEach(add);
    });
    if (!bounds.isEmpty()) {
      const center = bounds.getCenter();
      anchorPoint.current = [center.lng, center.lat];
      mapRef.current.fitBounds(bounds, { padding: 80, duration: 1200 });
    }
  }, []);

  // --- 1. Init Mapbox ---
  useEffect(() => {
    if (!mapContainer.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [105.8048, 21.0285],
      zoom: 14,
      antialias: true,
      trackResize: true,
      preserveDrawingBuffer: true,
    });
    mapRef.current = m;

    const onLoad = () => {
      setMapLoaded(true);
      m.resize();
      // Keep resizing for 3s to catch modal animation
      let n = 0;
      const iv = setInterval(() => { m.resize(); if (++n > 6) clearInterval(iv); }, 500);
    };

    m.on('load', onLoad);
    // Fallback
    const t = setTimeout(() => { if (!mapLoaded) onLoad(); }, 3000);

    return () => {
      clearTimeout(t);
      if (overlayRef.current) { try { m.removeControl(overlayRef.current as any); } catch (_) {} overlayRef.current = null; }
      m.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- 2. ResizeObserver ---
  useEffect(() => {
    if (!mapContainer.current || !mapRef.current) return;
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(mapContainer.current);
    return () => ro.disconnect();
  }, [mapLoaded]);

  // --- 3. Create Deck.gl Overlay ONCE ---
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || overlayRef.current) return;
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    mapRef.current.addControl(overlay as any);
    overlayRef.current = overlay;
  }, [mapLoaded]);

  // --- 4. Data Loading ---
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !overlayRef.current) return;

    const map = mapRef.current;
    const overlay = overlayRef.current;

    const ensure2DLayers = (geojson: any) => {
      if (!map.getSource('lanelet')) {
        map.addSource('lanelet', { type: 'geojson', data: geojson });
      } else {
        (map.getSource('lanelet') as mapboxgl.GeoJSONSource).setData(geojson);
      }
      if (!map.getLayer('lane-fill')) {
        map.addLayer({
          id: 'lane-fill',
          type: 'line',
          source: 'lanelet',
          paint: { 'line-color': '#0ea5e9', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 18, 6] },
        });
      }
      map.setLayoutProperty('lane-fill', 'visibility', 'visible');
    };

    const hide2DLayers = () => {
      if (map.getLayer('lane-fill')) map.setLayoutProperty('lane-fill', 'visibility', 'none');
    };

    const runLoad = async () => {
      setLoading(true);
      setError(null);
      setAssetStatus('Fetching data...');

      try {
        if (viewMode === '2D') {
          setIs3D(false);
          map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
          overlay.setProps({ layers: [] });

          const res = await fetch(getLaneletPreviewUrl(versionId));
          if (!res.ok) throw new Error(`Lanelet fetch failed: ${res.status}`);
          const geojson = await res.json();
          setAssetStatus('Rendering 2D...');

          const doSetup = () => {
            ensure2DLayers(geojson);
            fitBounds(geojson);
          };

          if (map.isStyleLoaded()) doSetup();
          else map.once('style.load', doSetup);

          setLoading(false);
        } else {
          // ---- 3D PCD MODE ----
          setIs3D(true);
          map.easeTo({ pitch: 60, bearing: -20, duration: 800 });
          hide2DLayers();

          setAssetStatus('Downloading PCD...');
          const res = await fetch(getPcdPreviewUrl(versionId));
          if (!res.ok) throw new Error(`PCD fetch failed: ${res.status}`);
          const buffer = await res.arrayBuffer();

          setAssetStatus('Parsing PCD...');
          const pcd = await parse(buffer, PCDLoader);

          if (!pcd?.header) throw new Error('PCD parse failed: no header.');
          const vertexCount = pcd.header.vertexCount || 0;
          console.log('[PCD] vertexCount:', vertexCount, 'attributes:', Object.keys(pcd.attributes || {}));

          // Extract positions
          const rawPositions =
            pcd.attributes?.POSITION?.value ??
            pcd.attributes?.positions?.value ??
            (pcd.attributes?.POSITION as any) ??
            (pcd.attributes?.positions as any);

          if (!rawPositions || rawPositions.length === 0) throw new Error('PCD: no POSITION attribute found.');

          const positions: Float32Array = rawPositions instanceof Float32Array
            ? rawPositions
            : new Float32Array(rawPositions);

          // Log sample values
          console.log('[PCD] Sample positions (first 9):', positions.slice(0, 9));

          // Detect coordinate system
          const absX = Math.abs(positions[0]);
          const absY = Math.abs(positions[1]);
          const isLngLat = (absX > 90 && absX < 180) || (absY > 10 && absY < 90);
          const isLocalMeters = !isLngLat;
          console.log('[PCD] Coord system detected:', isLocalMeters ? 'LOCAL METERS' : 'LNGLAT');

          // Build coordOrigin for meter-offset mode
          let coordSystem: any = COORDINATE_SYSTEM.LNGLAT;
          let coordOrigin: [number, number, number] = [0, 0, 0];

          if (isLocalMeters) {
            coordSystem = COORDINATE_SYSTEM.METER_OFFSETS;
            if (anchorPoint.current) {
              coordOrigin = [anchorPoint.current[0], anchorPoint.current[1], 0];
            } else {
              // Compute centroid from sample
              let sx = 0, sy = 0, cnt = 0;
              const stride = 3;
              const step = Math.max(1, Math.floor(vertexCount / 1000));
              for (let i = 0; i < vertexCount; i += step) {
                sx += positions[i * stride];
                sy += positions[i * stride + 1];
                cnt++;
              }
              if (cnt > 0) coordOrigin = [sx / cnt, sy / cnt, 0];
            }
            console.log('[PCD] Using METER_OFFSETS, origin:', coordOrigin);
            // Fly to anchor
            if (coordOrigin[0] !== 0) {
              map.flyTo({ center: [coordOrigin[0], coordOrigin[1]], zoom: 19.5, pitch: 65, bearing: -20, duration: 1500 });
            }
          } else {
            // LngLat: calc center from data
            let sx = 0, sy = 0, cnt = 0;
            const step = Math.max(1, Math.floor(vertexCount / 1000));
            for (let i = 0; i < vertexCount; i += step) {
              sx += positions[i * 3];
              sy += positions[i * 3 + 1];
              cnt++;
            }
            if (cnt > 0) {
              map.flyTo({ center: [sx / cnt, sy / cnt], zoom: 18, pitch: 65, bearing: -20, duration: 1500 });
            }
          }

          // Build default orange-yellow color if no color attribute
          const rawColors = pcd.attributes?.COLOR?.value ?? pcd.attributes?.colors?.value;
          let colorData: Uint8Array;
          if (rawColors && rawColors.length >= vertexCount * 3) {
            colorData = rawColors instanceof Uint8Array ? rawColors : new Uint8Array(rawColors);
          } else {
            // Orange-Gold gradient based on height (Z)
            colorData = new Uint8Array(vertexCount * 3);
            for (let i = 0; i < vertexCount; i++) {
              const z = positions[i * 3 + 2] || 0;
              const t = Math.min(1, Math.max(0, (z + 2) / 10)); // normalize roughly
              colorData[i * 3] = Math.round(255 * (0.8 + 0.2 * t));     // R: always high
              colorData[i * 3 + 1] = Math.round(180 * t);               // G: rises with height
              colorData[i * 3 + 2] = 0;                                  // B: 0
            }
          }

          setAssetStatus('Rendering 3D...');
          const pcdLayer = new PointCloudLayer({
            id: 'pcd-layer',
            data: {
              length: vertexCount,
              attributes: {
                getPosition: { value: positions, size: 3 },
                getColor: { value: colorData, size: 3 },
              },
            },
            coordinateSystem: coordSystem,
            coordinateOrigin: coordOrigin,
            pointSize: 3,
            opacity: 1,
            parameters: { depthTest: true },
          });

          overlay.setProps({ layers: [pcdLayer] });
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[MapPreview] Error:', err);
        setError(err.message ?? String(err));
        setLoading(false);
      }
    };

    runLoad();
  }, [mapLoaded, viewMode, versionId, refreshKey, fitBounds]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full h-full max-w-7xl rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10"
        style={{ background: is3D ? '#0f0f1a' : '#ffffff' }}>
        
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between shrink-0 border-b"
          style={{ background: is3D ? '#1a1a2e' : '#ffffff', borderColor: is3D ? '#2d2d4e' : '#f1f5f9' }}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: is3D ? '#7c3aed' : '#0f172a' }}>
              <MapIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg" style={{ color: is3D ? '#e2e8f0' : '#0f172a' }}>{versionName}</h3>
              <p className="text-xs font-medium" style={{ color: is3D ? '#6366f1' : '#94a3b8' }}>
                AD Map Engine v3.0 {is3D ? '⚡ 3D PCD Active' : '· 2D Mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex p-1 rounded-xl" style={{ background: is3D ? '#16213e' : '#f1f5f9' }}>
              <button
                onClick={() => setViewMode('2D')}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                style={{ background: viewMode === '2D' ? (is3D ? '#7c3aed' : '#fff') : 'transparent',
                  color: viewMode === '2D' ? (is3D ? '#fff' : '#0f172a') : (is3D ? '#64748b' : '#64748b') }}>
                2D MAP
              </button>
              <button
                onClick={() => setViewMode('3D')}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                style={{ background: viewMode === '3D' ? (is3D ? '#7c3aed' : '#fff') : 'transparent',
                  color: viewMode === '3D' ? (is3D ? '#fff' : '#0f172a') : (is3D ? '#64748b' : '#64748b') }}>
                3D MAP
              </button>
            </div>
            <button onClick={() => setRefreshKey(k => k + 1)}
              className="p-2 rounded-lg transition-all"
              style={{ background: is3D ? '#16213e' : '#f8fafc', color: is3D ? '#7c3aed' : '#64748b' }}>
              <Maximize2 className="w-4 h-4" />
            </button>
            <button onClick={onClose}
              className="p-2 rounded-lg transition-all hover:opacity-80"
              style={{ background: is3D ? '#16213e' : '#f8fafc', color: is3D ? '#ef4444' : '#64748b' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Map Container */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={mapContainer}
            className="absolute inset-0"
            style={{ width: '100%', height: '100%' }}
          />

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: is3D ? 'rgba(15,15,26,0.8)' : 'rgba(255,255,255,0.75)', backdropFilter: 'blur(4px)' }}>
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Loader2 className="w-12 h-12 animate-spin" style={{ color: is3D ? '#7c3aed' : '#0ea5e9' }} />
                  {is3D && <div className="absolute inset-0 w-12 h-12 rounded-full animate-ping opacity-30"
                    style={{ background: '#7c3aed' }} />}
                </div>
                <p className="font-bold text-sm tracking-tight" style={{ color: is3D ? '#c4b5fd' : '#0f172a' }}>
                  {assetStatus}
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/95 p-8">
              <div className="max-w-md text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-slate-900 mb-2">Render Error</h4>
                <p className="text-sm text-slate-600 mb-6">{error}</p>
                <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold">Close</button>
              </div>
            </div>
          )}

          {/* Status Card */}
          {!loading && !error && (
            <div className="absolute bottom-6 right-6 z-20 px-4 py-3 rounded-2xl text-xs"
              style={{ background: is3D ? 'rgba(26,26,46,0.9)' : 'rgba(255,255,255,0.9)',
                border: `1px solid ${is3D ? '#2d2d4e' : '#e2e8f0'}`,
                backdropFilter: 'blur(8px)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5" style={{ color: is3D ? '#7c3aed' : '#0ea5e9' }} />
                <span className="font-black uppercase tracking-widest text-[9px]"
                  style={{ color: is3D ? '#475569' : '#94a3b8' }}>STATUS</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between gap-6">
                  <span style={{ color: is3D ? '#475569' : '#94a3b8' }}>Mode</span>
                  <span className="font-bold" style={{ color: is3D ? '#c4b5fd' : '#0f172a' }}>{viewMode} View</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span style={{ color: is3D ? '#475569' : '#94a3b8' }}>Status</span>
                  <span className="font-bold" style={{ color: is3D ? '#4ade80' : '#16a34a' }}>Active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapPreview;
