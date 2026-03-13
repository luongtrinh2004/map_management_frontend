import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X, Map as MapIcon, Loader2, Maximize2, AlertTriangle } from 'lucide-react';
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
  
  const [viewMode, setViewMode] = useState<ViewMode>('3D');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetStatus, setAssetStatus] = useState<string>('Initializing...');
  const [refreshKey, setRefreshKey] = useState(0);

  const is2DInit = useRef(false);
  const is3DInit = useRef(false);

  // Cleanup on unmount or version change
  useEffect(() => {
    is2DInit.current = false;
    is3DInit.current = false;
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (rendererRef.current) {
        cancelAnimationFrame(reqIdRef.current);
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [versionId, refreshKey]);

  // --- 2D Mapbox Sync ---
  useEffect(() => {
    if (viewMode !== '2D' || is2DInit.current || !mapContainer.current) return;

    const init2D = async () => {
      if (mapContainer.current!.clientWidth === 0) {
        setTimeout(init2D, 100);
        return;
      }

      is2DInit.current = true;
      setLoading(true);
      setAssetStatus('Preparing 2D Map...');
      
      mapboxgl.accessToken = MAPBOX_TOKEN;
      if (!MAPBOX_TOKEN) {
        setError('Mapbox token is missing. Please check your .env file.');
        setLoading(false);
        return;
      }

      const m = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [105.8048, 21.0285],
        zoom: 14,
        antialias: true,
      });
      mapRef.current = m;

      try {
        setAssetStatus('Fetching Lanelet Data...');
        const res = await fetch(getLaneletPreviewUrl(versionId));
        if (!res.ok) throw new Error('Failed to fetch Lanelet data');
        const geojson = await res.json();

        const addDataToMap = () => {
          if (m.getSource('lanelet')) return;

          m.addSource('lanelet', { type: 'geojson', data: geojson });
          
          // 1. Core Lane Boundaries (Solid/Dashed lines)
          m.addLayer({
            id: 'lane-boundaries',
            type: 'line',
            source: 'lanelet',
            filter: ['==', ['get', 'display_type'], 'boundary'],
            paint: {
              'line-color': '#0ea5e9', // Sky blue
              'line-width': 2.5,
              'line-dasharray': ['case', ['==', ['get', 'subtype'], 'dashed'], ['literal', [2, 2]], ['literal', [1, 0]]],
            },
          });

          // 2. Stop Lines (Thicker/Red/White)
          m.addLayer({
            id: 'stop-lines',
            type: 'line',
            source: 'lanelet',
            filter: ['==', ['get', 'display_type'], 'stop_line'],
            paint: {
              'line-color': '#ef4444', // Red-500
              'line-width': 4,
            },
          });

          // 3. Virtual Lines (Blue dashed)
          m.addLayer({
            id: 'virtual-lines',
            type: 'line',
            source: 'lanelet',
            filter: ['==', ['get', 'display_type'], 'virtual'],
            paint: {
              'line-color': '#0ea5e9', // Blue-500
              'line-width': 1.5,
              'line-dasharray': [3, 2],
            },
          });

          // 4. Centerlines (if available in attributes) or generic way
          m.addLayer({
            id: 'other-ways',
            type: 'line',
            source: 'lanelet',
            filter: ['all', ['==', ['get', 'element_type'], 'way'], ['==', ['get', 'display_type'], 'other']],
            paint: {
              'line-color': '#94a3b8',
              'line-width': 1,
            },
          });

          // 5. Traffic Elements (Points)
          m.addLayer({
            id: 'traffic-points',
            type: 'circle',
            source: 'lanelet',
            filter: ['==', ['get', 'element_type'], 'point'],
            paint: {
              'circle-radius': 5,
              'circle-color': ['match', ['get', 'type'],
                'traffic_light', '#22c55e', // Green
                'traffic_sign', '#facc15',  // Yellow
                '#64748b' // Slate
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });

          if (geojson.features?.length) {
            const bounds = new mapboxgl.LngLatBounds();
            // Use more features for bounds calculation, up to 1000 or all points
            geojson.features.slice(0, 1000).forEach((f: any) => {
              if (f.geometry.type === 'LineString') {
                f.geometry.coordinates.forEach((c: any) => bounds.extend(c));
              } else if (f.geometry.type === 'Point') {
                bounds.extend(f.geometry.coordinates);
              }
            });
            
            if (!bounds.isEmpty()) {
              m.fitBounds(bounds, { padding: 50, duration: 0 });
            }
          }
          
          m.resize();
          setLoading(false);
        };

        if (m.loaded()) {
          addDataToMap();
        } else {
          m.on('load', addDataToMap);
        }

        // Fallback for load event if Mapbox hangs or style fails
        setTimeout(() => { if(loading && is2DInit.current) setLoading(false); }, 5000);

      } catch (err: any) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    };

    init2D();
  }, [viewMode, versionId, refreshKey]);

  // --- 3D Three.js Sync ---
  useEffect(() => {
    if (viewMode !== '3D' || is3DInit.current || !threeContainer.current) return;

    const init3D = () => {
      is3DInit.current = true;
      setLoading(true);
      setAssetStatus('Starting 3D Engine...');

      const container = threeContainer.current!;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf1f5f9);

      const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 10000);
      camera.up.set(0, 0, 1);
      camera.position.set(0, -100, 50);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;

      setAssetStatus('Downloading PCD (0%)...');
      const loader = new PCDLoader();
      loader.load(getPcdPreviewUrl(versionId), (points) => {
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
          camera.position.set(center.x, center.y - dist, center.z + dist * 0.5);
          camera.lookAt(center);
          controls.target.copy(center);

          // Height coloring
          const pos = points.geometry.attributes.position;
          const colors = new Float32Array(pos.count * 3);
          const minZ = bbox.min.z;
          const zRange = Math.max(0.1, bbox.max.z - minZ);
          for(let i=0; i<pos.count; i++) {
            let t = (pos.getZ(i) - minZ) / zRange;
            colors[i*3] = t;
            colors[i*3+1] = 1 - Math.abs(2 * t - 1);
            colors[i*3+2] = 1 - t;
          }
          points.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          (points.material as THREE.PointsMaterial).vertexColors = true;
          (points.material as THREE.PointsMaterial).size = 1.2;
        }
        scene.add(points);
        setLoading(false);
      }, 
      (xhr) => setAssetStatus(`Downloading PCD (${Math.round((xhr.loaded / (xhr.total || 1)) * 100)}%)...`),
      (err) => { 
        console.error('3D Loading Error:', err);
        setError('Failed to load 3D data'); 
        setLoading(false); 
      });

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
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    };

    init3D();
  }, [viewMode, versionId, refreshKey]);

  // View mode handle
  useEffect(() => {
    if (viewMode === '2D' && mapRef.current) {
        mapRef.current.resize();
    }
  }, [viewMode]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full h-full max-w-7xl md:rounded-3xl overflow-hidden flex flex-col shadow-2xl bg-white">
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white z-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
               <MapIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{versionName}</h3>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">AD Map Visualizer</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {(['2D', '3D'] as ViewMode[]).map(m => (
                <button 
                  key={m} 
                  onClick={() => setViewMode(m)}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button onClick={() => setRefreshKey(k => k + 1)} className="p-2.5 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-200 transition-colors"><Maximize2 className="w-5 h-5" /></button>
            <button onClick={onClose} className="p-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </header>

        {/* Containers */}
        <div className="flex-1 relative bg-slate-50 overflow-hidden">
          <div ref={mapContainer} className={`absolute inset-0 ${viewMode === '2D' ? 'block' : 'hidden'}`} />
          <div ref={threeContainer} className={`absolute inset-0 ${viewMode === '3D' ? 'block' : 'hidden'}`} />
          
          {loading && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-white/90 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <p className="text-xs font-bold text-slate-900 uppercase tracking-widest">{assetStatus}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-white p-12">
              <div className="text-center max-w-sm">
                <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                <h4 className="text-xl font-bold text-slate-900 mb-2">Error</h4>
                <p className="text-sm text-slate-500 mb-8">{error}</p>
                <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold">Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapPreview;
