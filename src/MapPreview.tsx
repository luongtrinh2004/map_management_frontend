import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X, Map as MapIcon, Loader2, Maximize2, Info, AlertTriangle } from 'lucide-react';
import { getLaneletPreviewUrl, getPcdPreviewUrl } from './api';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface MapPreviewProps {
  versionId: string;
  versionName: string;
  onClose: () => void;
}

type ViewMode = '2D' | '3D';

const MapPreview: React.FC<MapPreviewProps> = ({ versionId, versionName, onClose }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const threeContainer = useRef<HTMLDivElement>(null);
  
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const reqIdRef = useRef<number>(0);

  const [viewMode, setViewMode] = useState<ViewMode>('2D');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetStatus, setAssetStatus] = useState<string>('Initializing...');
  const [refreshKey, setRefreshKey] = useState(0);

  // --- 1. Init Mapbox (2D Only) ---
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
    });
    mapRef.current = m;

    return () => {
      m.remove();
      mapRef.current = null;
    };
  }, []);

  // --- 2. Load 2D Data ---
  useEffect(() => {
    if (viewMode !== '2D') return;

    const abortController = new AbortController();
    const load2D = async () => {
      setLoading(true);
      setError(null);
      setAssetStatus('Fetching Lanelets...');

      try {
        const res = await fetch(getLaneletPreviewUrl(versionId), { signal: abortController.signal });
        if (!res.ok) throw new Error(`Lanelet fetch failed: ${res.status}`);
        const geojson = await res.json();
        const m = mapRef.current;
        if (!m) return;

        const setup = () => {
          if (!m.getSource('lanelet')) {
            m.addSource('lanelet', { type: 'geojson', data: geojson });
            m.addLayer({
              id: 'lane-fill',
              type: 'line',
              source: 'lanelet',
              paint: { 'line-color': '#0ea5e9', 'line-width': 3 },
            });
          } else {
            (m.getSource('lanelet') as mapboxgl.GeoJSONSource).setData(geojson);
          }

          // Fit Bounds
          if (geojson?.features?.length) {
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
              m.fitBounds(bounds, { padding: 80, duration: 1200 });
            }
          }
        };

        if (m.isStyleLoaded()) setup();
        else m.once('style.load', setup);

        setLoading(false);
      } catch(err: any) {
        if (err.name === 'AbortError') return;
        setError(err.message ?? String(err));
        setLoading(false);
      }
    };

    load2D();
    return () => abortController.abort();
  }, [viewMode, versionId, refreshKey]);

  // --- 3. Load 3D Point Cloud (Three.js) ---
  useEffect(() => {
    if (viewMode !== '3D' || !threeContainer.current) return;

    setLoading(true);
    setError(null);
    setAssetStatus('Initializing 3D Engine...');

    const width = threeContainer.current.clientWidth;
    const height = threeContainer.current.clientHeight;

    const scene = new THREE.Scene();
    // Consistent light theme background
    scene.background = new THREE.Color(0xf1f5f9);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000);
    // LiDAR scans usually have Z as up axis. Tell three.js about it.
    camera.up.set(0, 0, 1);
    camera.position.set(0, -100, 50);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    threeContainer.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Load PCD
    setAssetStatus('Downloading PCD (.pcd)...');
    const loader = new PCDLoader();
    let loadedPoints: THREE.Points | null = null;
    
    loader.load(getPcdPreviewUrl(versionId), (points: THREE.Points) => {
      loadedPoints = points;
      
      points.geometry.computeBoundingBox();
      const bbox = points.geometry.boundingBox;
      if (bbox) {
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraDist = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraDist *= 1.2;

        camera.position.set(center.x, center.y - cameraDist, center.z + cameraDist * 0.5);
        camera.lookAt(center);
        controls.target.copy(center);

        // Auto color by height (Z) if points are raw
        const hasColor = Object.keys(points.geometry.attributes).some(k => k.toLowerCase().includes('color'));
        if (!hasColor && points.geometry.attributes.position) {
           const pos = points.geometry.attributes.position;
           const colors = new Float32Array(pos.count * 3);
           const minZ = bbox.min.z;
           const zRange = Math.max(0.1, bbox.max.z - minZ);
           const colorObj = new THREE.Color();
           for(let i=0; i<pos.count; i++) {
              let t = (pos.getZ(i) - minZ) / zRange;
              t = Math.max(0, Math.min(1, t));
              // Spectral color map (blue -> red)
              colorObj.setHSL(0.6 - (t * 0.6), 1.0, 0.5); 
              colors[i*3] = colorObj.r;
              colors[i*3+1] = colorObj.g;
              colors[i*3+2] = colorObj.b;
           }
           points.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
           (points.material as THREE.PointsMaterial).vertexColors = true;
        }

        const pMaterial = points.material as THREE.PointsMaterial;
        pMaterial.size = 2; // Fixed pixel size
        pMaterial.sizeAttenuation = false;
      }
      
      // Rotate if it's upside down or weird (LiDAR is usually X front, Y left, Z up)
      scene.add(points);
      setLoading(false);
    }, 
    (xhr: ProgressEvent) => {
       if (xhr.total) setAssetStatus(`Downloading ${Math.round(xhr.loaded / xhr.total * 100)}%`);
       else setAssetStatus(`Downloading ${Math.round(xhr.loaded / 1024)} KB`);
    }, 
    (err: any) => {
       console.error('[Three PCDLoader Error]:', err);
       setError('Failed to load PCD point cloud. Data format might be completely raw or corrupted.');
       setLoading(false);
    });

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!threeContainer.current) return;
      const w = threeContainer.current.clientWidth;
      const h = threeContainer.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(reqIdRef.current);
      if (loadedPoints) scene.remove(loadedPoints);
      if (rendererRef.current && threeContainer.current) {
        try { threeContainer.current.removeChild(rendererRef.current.domElement); } catch(_) {}
        rendererRef.current.dispose();
      }
    };
  }, [viewMode, versionId, refreshKey]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full h-full max-w-7xl rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10 bg-white">
        
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-100 bg-white relative z-50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900">
              <MapIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">{versionName}</h3>
              <p className="text-xs font-medium text-slate-500">
                AD Map Engine v3.0 {viewMode === '3D' ? '⚡ 3D PCD Viewer' : '· 2D Mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex p-1 rounded-xl bg-slate-100">
              <button
                onClick={() => setViewMode('2D')}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: viewMode === '2D' ? '#fff' : 'transparent',
                  color: viewMode === '2D' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === '2D' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}>
                2D MAP
              </button>
              <button
                onClick={() => setViewMode('3D')}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: viewMode === '3D' ? '#fff' : 'transparent',
                  color: viewMode === '3D' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === '3D' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}>
                3D MAP
              </button>
            </div>
            <button onClick={() => setRefreshKey(k => k + 1)}
              className="p-2 rounded-lg transition-all bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-200">
              <Maximize2 className="w-5 h-5" />
            </button>
            <button onClick={onClose}
              className="p-2 rounded-lg transition-all hover:bg-red-50 bg-slate-50 text-slate-500 hover:text-red-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Maps Container */}
        <div className="flex-1 relative overflow-hidden bg-slate-100">
          
          {/* 2D Map */}
          <div
            ref={mapContainer}
            className={`absolute inset-0 transition-opacity duration-300 ${viewMode === '2D' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          />

          {/* 3D Map (Three.js) */}
          <div 
            ref={threeContainer}
            className={`absolute inset-0 transition-opacity duration-300 ${viewMode === '3D' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          />

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Loader2 className="w-12 h-12 animate-spin text-sky-500" />
                </div>
                <p className="font-bold text-sm tracking-tight text-slate-900">
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
                <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">Close</button>
              </div>
            </div>
          )}

          {/* Status Card */}
          {!loading && !error && (
            <div className="absolute bottom-6 right-6 z-20 px-4 py-3 rounded-2xl text-xs bg-white/90 border border-slate-200 backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-sky-500" />
                <span className="font-black uppercase tracking-widest text-[9px] text-slate-400">STATUS</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between gap-6">
                  <span className="text-slate-500">Mode</span>
                  <span className="font-bold text-slate-900">{viewMode} View</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span className="text-slate-500">Status</span>
                  <span className="font-bold text-green-600">Active</span>
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
