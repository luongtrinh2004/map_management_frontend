import React, { useEffect, useState } from 'react';
import { api, type Region, type MapVersion, type Stats } from './api';
import MapPreview from './MapPreview';
import { MapPin, Layers, Clock, Plus, Activity, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

function App() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [versions, setVersions] = useState<MapVersion[]>([]);
  
  // Navigation State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<MapVersion | null>(null);
  const [isHomePage, setIsHomePage] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  // Region Form State
  const [newRegionName, setNewRegionName] = useState('');
  const [newRegionCode, setNewRegionCode] = useState('');

  // Upload/Version Form State
  const [versionName, setVersionName] = useState('');
  const [description, setDescription] = useState('');
  const [creator, setCreator] = useState('Mapping Team');
  const [utmZone, setUtmZone] = useState('48P');
  const [mgrsZone, setMgrsZone] = useState('48PYS');
  const [coordinateSystem, setCoordinateSystem] = useState('UTM/MGRS');
  const [osmFile, setOsmFile] = useState<File | null>(null);
  const [pcdFile, setPcdFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  useEffect(() => {
    if (!versionName) {
      setVersionError(null);
      return;
    }
    let actualVersionName = versionName;
    if (!/^v/i.test(actualVersionName)) {
      actualVersionName = 'v' + actualVersionName;
    }

    const isDuplicate = versions.some((v: MapVersion) => v.version.toLowerCase() === actualVersionName.toLowerCase());
    if (isDuplicate) {
      setVersionError(`Version "${actualVersionName}" already exists.`);
      return;
    }

    if (versions.length > 0) {
      const parse = (v: string) => v.replace(/^v/i, '').split('.').map(Number);
      
      const highestVersion = [...versions].reduce((highest, current) => {
        const pCur = parse(current.version);
        const pHigh = parse(highest.version);
        for (let i = 0; i < Math.max(pCur.length, pHigh.length); i++) {
          const n1 = pCur[i] || 0;
          const n2 = pHigh[i] || 0;
          if (n1 > n2) return current;
          if (n1 < n2) return highest;
        }
        return highest;
      }, versions[0]);

      const pNew = parse(actualVersionName);
      const pHigh = parse(highestVersion.version);
      let isLower = false;
      for (let i = 0; i < Math.max(pNew.length, pHigh.length); i++) {
        const n1 = pNew[i] || 0;
        const n2 = pHigh[i] || 0;
        if (n1 < n2) { isLower = true; break; }
        if (n1 > n2) { isLower = false; break; }
      }
      
      if (isLower) {
        setVersionError(`Version must be higher than the current latest version (${highestVersion.version}).`);
        return;
      }
    }

    setVersionError(null);
  }, [versionName, versions]);

  useEffect(() => {
    fetchRegions();
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get<Stats>('/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  useEffect(() => {
    if (selectedRegion) {
      fetchVersions(selectedRegion.code);
    } else {
      setVersions([]);
    }
  }, [selectedRegion]);

  const fetchRegions = async () => {
    try {
      const res = await api.get<Region[]>('/regions');
      setRegions(res.data);
      if (res.data.length > 0 && !selectedRegion) {
        setSelectedRegion(res.data[0]);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch regions', err);
    }
  };

  const fetchVersions = async (code: string) => {
    try {
      const res = await api.get<MapVersion[]>(`/regions/${code}/versions`);
      setVersions(res.data);
    } catch (err: unknown) {
      console.error('Failed to fetch versions', err);
    }
  };

  const handleCreateRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegionName || !newRegionCode) return;
    try {
      const res = await api.post<Region>('/regions', { name: newRegionName, code: newRegionCode });
      setShowRegionModal(false);
      setNewRegionName('');
      setNewRegionCode('');
      await fetchRegions();
      await fetchStats();
      setSelectedRegion(res.data);
    } catch {
      alert('Failed to create region.');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegion || isUploading || versionError) return;
    setIsUploading(true);
    
    let actualVersionName = versionName;
    if (!/^v/i.test(actualVersionName)) {
      actualVersionName = 'v' + actualVersionName;
    }

    const formData = new FormData();
    formData.append('region_code', selectedRegion.code);
    formData.append('version_name', actualVersionName);
    formData.append('description', description);
    formData.append('creator', creator);
    formData.append('utm_zone', utmZone);
    formData.append('mgrs_zone', mgrsZone);
    formData.append('coordinate_system', coordinateSystem);

    if (osmFile) formData.append('osm_file', osmFile);
    if (pcdFile) formData.append('pcd_file', pcdFile);

    try {
      await api.post('/versions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowUploadModal(false);
      resetUploadForm();
      fetchVersions(selectedRegion.code);
      fetchStats();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Upload failed. Check backend logs.';
      alert(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadForm = () => {
    setVersionName('');
    setDescription('');
    setCreator('Mapping Team');
    setUtmZone('48P');
    setMgrsZone('48PYS');
    setCoordinateSystem('UTM/MGRS');
    setOsmFile(null);
    setPcdFile(null);
  };

  return (
    <div className="h-screen w-full bg-white text-gray-900 font-sans flex overflow-hidden">
      {/* Sidebar Overlay on Mobile */}
      {!isSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={() => setIsSidebarOpen(true)} />
      )}

      <aside 
        className={`bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out z-50 shrink-0 overflow-hidden
          ${isSidebarOpen ? 'w-[300px]' : 'w-[64px]'}
          fixed md:relative h-full
        `}
      >
        <div className="w-[300px] h-full flex flex-col bg-gray-50">
          
          <div className="h-16 border-b border-gray-200/60 flex items-center relative">
            <div className={`flex items-center justify-between w-full px-4 h-full transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
              <button 
                onClick={() => {
                  setIsHomePage(true);
                  setSelectedRegion(null);
                }}
                className="flex items-center"
              >
                <img src="/imgs/admap.png" alt="Admap Logo" className="h-6 w-auto object-contain" />
              </button>
            </div>

            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`flex items-center justify-center bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 rounded-full transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95 z-50
                ${isSidebarOpen ? 'w-8 h-8 absolute right-4' : 'w-10 h-10 absolute left-[12px]'}
              `}
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? (
                <ChevronLeft className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-6 h-6" />
              )}
            </button>
          </div>
        
          <div className={`flex-1 overflow-y-auto p-4 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
            <div className="flex items-center justify-between mb-4 px-2 group">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Regions</span>
              <button 
                onClick={() => setShowRegionModal(true)}
                className="text-gray-400 hover:text-indigo-600 transition-colors p-1 hover:bg-white border border-transparent hover:border-gray-100 rounded-md shadow-sm active:scale-90"
                title="Add Region"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <nav className="space-y-1">
              {regions.length === 0 ? (
                <p className="text-sm text-gray-500 px-2 mt-2">No regions found.</p>
              ) : (
                regions.map((r: Region) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRegion(r);
                      setIsHomePage(false);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      !isHomePage && selectedRegion?.id === r.id 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105' 
                        : 'text-gray-600 hover:bg-white hover:shadow-sm hover:text-indigo-600'
                    }`}
                  >
                    <MapPin className={`w-4 h-4 shrink-0 ${!isHomePage && selectedRegion?.id === r.id ? 'text-white' : 'text-gray-400'}`} />
                    <span className="truncate">{r.name}</span>
                  </button>
                ))
              )}
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 bg-white relative overflow-hidden h-full transition-all duration-300 ease-in-out">
        {/* Toggle Button for Desktop/Mobile when Sidebar is closed */}
        {/* Unified with sidebar toggle */}

        {isHomePage ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white overflow-y-auto">
            <div className="max-w-4xl w-full">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-4">
                  <Activity className="w-3 h-3" />
                  System Dashboard
                </div>
                <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tight">
                  Map Portal <span className="text-indigo-600">Overview</span>
                </h1>
                <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                  Monitor and manage your autonomous driving map ecosystem. Access high-precision Lanelet2 and Point Cloud datasets across all regions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 transition-all hover:shadow-md hover:border-indigo-100 group">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Total Regions</h3>
                  <div className="text-3xl font-black text-gray-900">{stats?.totalRegions || regions.length}</div>
                </div>

                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 transition-all hover:shadow-md hover:border-indigo-100 group">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Total Versions</h3>
                  <div className="text-3xl font-black text-gray-900">{stats?.totalVersions || 0}</div>
                </div>

                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 transition-all hover:shadow-md hover:border-indigo-100 group">
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 mb-4 group-hover:scale-110 transition-transform">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Last Updated</h3>
                  <div className="text-xl font-bold text-gray-900 mt-1">
                    {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : 'No updates'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-gray-400">Quick Actions</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowRegionModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all hover:-translate-y-1 shadow-lg shadow-gray-200"
                  >
                    <Plus className="w-5 h-5" />
                    New Region
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : selectedRegion ? (
          <>
            <header className={`bg-white border-b border-slate-200 px-8 py-6 max-w-6xl mx-auto w-full flex items-center justify-between transition-all duration-300 ${!isSidebarOpen ? 'pl-20 md:pl-20' : ''}`}>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedRegion.name}</h2>
                <div className="text-sm text-slate-500 font-mono mt-1 font-medium">{selectedRegion.code}</div>
              </div>
              <button 
                onClick={() => setShowUploadModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm shadow-indigo-200 transition-all hover:-translate-y-0.5"
              >
                Upload Version
              </button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
              {versions.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center bg-white">
                  <h3 className="text-sm font-medium text-gray-900">No versions uploaded</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by uploading a new map version.</p>
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Upload now
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {versions.map((v: MapVersion, i: number) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">{v.version}</h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              v.status === 'STABLE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {v.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Released on {new Date(v.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {Object.entries(v.downloads).map(([type, url]) => (
                            <a 
                              key={type} 
                              href={url} 
                              download
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                              Download {type}
                            </a>
                          ))}
                          <button 
                            onClick={() => setPreviewVersion(v)}
                            className="inline-flex items-center px-3 py-1.5 border border-blue-200 shadow-sm text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none transition-colors"
                          >
                            Preview Map
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-gray-500 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <div>
                          <p className="text-gray-400 uppercase tracking-wider mb-1">Creator</p>
                          <p className="text-gray-900">{v.creator || '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 uppercase tracking-wider mb-1">UTM Zone</p>
                          <p className="text-gray-900">{v.utm_zone || '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 uppercase tracking-wider mb-1">MGRS Zone</p>
                          <p className="text-gray-900">{v.mgrs_zone || '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 uppercase tracking-wider mb-1">Coord System</p>
                          <p className="text-gray-900">{v.coordinate_system || '—'}</p>
                        </div>
                      </div>
                                            {/* Phase 3: Smart Diff Analysis */}
                      <div className="mt-4 bg-blue-50/50 border border-blue-100 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Smart Diff Analysis</span>
                        </div>
                        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                          {v.analysis?.isInitial ? (
                            <>
                              <li>Initial Map Region Dataset upload detected.</li>
                              <li>Lanelet Elements: {v.analysis?.osmNodesDiff} nodes, {v.analysis?.osmWaysDiff} ways.</li>
                              <li>Status: OSM and PCD have been uploaded securely.</li>
                            </>
                          ) : v.analysis ? (
                            <>
                              <li>
                                Lanelet Layout Change: 
                                <span className={v.analysis.osmNodesDiff > 0 ? 'text-green-600 font-bold ml-1' : v.analysis.osmNodesDiff < 0 ? 'text-red-500 font-bold ml-1' : 'ml-1'}>
                                  {v.analysis.osmNodesDiff > 0 ? '+' : ''}{v.analysis.osmNodesDiff} nodes
                                </span>, 
                                <span className={v.analysis.osmWaysDiff > 0 ? 'text-green-600 font-bold ml-1' : v.analysis.osmWaysDiff < 0 ? 'text-red-500 font-bold ml-1' : 'ml-1'}>
                                  {v.analysis.osmWaysDiff > 0 ? '+' : ''}{v.analysis.osmWaysDiff} ways
                                </span>
                              </li>
                              {v.analysis.pcdSizeDiffPercent !== undefined && v.analysis.pcdSizeDiffPercent !== 0 && (
                                <li>
                                  PCD Point Density Change: 
                                  <span className={v.analysis.pcdSizeDiffPercent > 0 ? 'text-green-600 font-bold ml-1' : 'text-red-500 font-bold ml-1'}>
                                    {v.analysis.pcdSizeDiffPercent > 0 ? '+' : ''}{v.analysis.pcdSizeDiffPercent}%
                                  </span>
                                </li>
                              )}
                              {v.description && <li>Notes: {v.description}</li>}
                            </>
                          ) : (
                            <>
                              {v.description ? <li>{v.description}</li> : <li>Sự thay đổi dữ liệu: Không có meta-data cho phiên bản này.</li>}
                              <li>Trạng thái liên kết: OSM và PCD đã được align thành công.</li>
                            </>
                          )}
                        </ul>
                      </div>
                      {/* Phase 3: Release & Rollback actions */}
                      <div className="mt-4 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                        {v.status !== 'STABLE' && (
                          <button className="text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-md transition-colors border border-transparent hover:border-green-200">
                            ✓ Mark as Stable
                          </button>
                        )}
                        {v.status === 'STABLE' && (
                          <button className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded-md transition-colors border border-transparent hover:border-orange-200">
                            ↺ Rollback from this
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
            <div className="text-center text-gray-500 max-w-sm">
              <h2 className="text-lg font-medium text-gray-900">No Region Selected</h2>
              <p className="mt-2 text-sm">Select a region from the sidebar or create a new one to view and manage maps.</p>
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && selectedRegion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Upload to {selectedRegion.name}</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-500">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Version Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. 1.1 or v1.1"
                  className={`w-full border rounded-md shadow-sm py-2 px-3 text-sm outline-none transition-colors ${versionError ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                  value={versionName} 
                  onChange={(e) => setVersionName(e.target.value)} 
                />
                {versionError && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {versionError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Creator</label>
                  <input 
                    type="text" 
                    className="w-full border-gray-300 border rounded-md shadow-sm py-2 px-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                    value={creator} 
                    onChange={(e) => setCreator(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UTM Zone</label>
                  <input 
                    type="text" 
                    className="w-full border-gray-300 border rounded-md shadow-sm py-2 px-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                    value={utmZone} 
                    onChange={(e) => setUtmZone(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MGRS Zone</label>
                  <input 
                    type="text" 
                    className="w-full border-gray-300 border rounded-md shadow-sm py-2 px-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                    value={mgrsZone} 
                    onChange={(e) => setMgrsZone(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coord System</label>
                  <input 
                    type="text" 
                    className="w-full border-gray-300 border rounded-md shadow-sm py-2 px-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                    value={coordinateSystem} 
                    onChange={(e) => setCoordinateSystem(e.target.value)} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  rows={2}
                  className="w-full border-gray-300 border rounded-md shadow-sm py-2 px-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Map Files</label>
                <p className="text-[10px] text-gray-500 -mt-1 mb-1 italic">
                  * If not uploaded, the latest available version's files will be inherited.
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className={`flex justify-center flex-col items-center w-full h-16 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none ${osmFile ? 'border-blue-500 bg-blue-50' : ''}`}>
                      <span className="flex items-center space-x-2">
                        <span className="font-medium text-gray-600 text-xs">
                          {osmFile ? osmFile.name : '.OSM (Lanelet2)'}
                        </span>
                      </span>
                      <input type="file" className="hidden" onChange={(e) => setOsmFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <div className="flex-1">
                    <label className={`flex justify-center flex-col items-center w-full h-16 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none ${pcdFile ? 'border-blue-500 bg-blue-50' : ''}`}>
                      <span className="flex items-center space-x-2">
                        <span className="font-medium text-gray-600 text-xs">
                          {pcdFile ? pcdFile.name : '.PCD (PointCloud)'}
                        </span>
                      </span>
                      <input type="file" className="hidden" onChange={(e) => setPcdFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={isUploading || !!versionError} className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm focus:outline-none transition-all ${isUploading || versionError ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-gray-800'}`}>
                  {isUploading ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Region Modal */}
      {showRegionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">New Region</h3>
              <button onClick={() => setShowRegionModal(false)} className="text-gray-400 hover:text-gray-500">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreateRegion} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Masterise or Phenikaa Campus"
                  className="w-full border-gray-300 border rounded-md shadow-sm py-2 px-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                  value={newRegionName} 
                  onChange={(e) => setNewRegionName(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region Code</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. masterise"
                  className="w-full border-gray-300 border rounded-md shadow-sm py-2 px-3 text-sm font-mono focus:border-blue-500 focus:ring-blue-500"
                  value={newRegionCode} 
                  onChange={(e) => setNewRegionCode(e.target.value.toLowerCase().replace(/\s+/g, '_'))} 
                />
                <p className="mt-1 text-xs text-gray-500">A unique snake_case identifier.</p>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowRegionModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-gray-900 border border-transparent rounded-md shadow-sm hover:bg-gray-800 focus:outline-none">
                  Create Region
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Preview Modal */}
      {previewVersion && (
        <MapPreview 
          versionId={previewVersion.id}
          versionName={previewVersion.version}
          onClose={() => setPreviewVersion(null)}
        />
      )}

    </div>
  );
}

export default App;
