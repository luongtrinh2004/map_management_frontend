import React, { useEffect, useState } from 'react';
import { api } from './api';
import type { Region, MapVersion } from './api';
import MapPreview from './MapPreview';
import { Menu, MapPin } from 'lucide-react';

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

  useEffect(() => {
    fetchRegions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setSelectedRegion(res.data);
    } catch {
      alert('Failed to create region.');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegion || isUploading) return;
    setIsUploading(true);
    
    let actualVersionName = versionName;
    if (!/^v/i.test(actualVersionName)) {
      actualVersionName = 'v' + actualVersionName;
    }

    // Client-side duplicate check
    const isDuplicate = versions.some(v => v.version.toLowerCase() === actualVersionName.toLowerCase());
    if (isDuplicate) {
      alert(`Version "${actualVersionName}" already exists. Please use a unique version name.`);
      setIsUploading(false);
      return;
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

      {/* Basic Light Sidebar */}
      <aside 
        className={`bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-200 ease-in-out z-50 shrink-0
          ${isSidebarOpen ? 'w-[260px]' : 'w-0 border-r-0'}
          fixed md:relative h-full
        `}
      >
        <div className="w-[260px] h-full flex flex-col bg-gray-50 opacity-100 overflow-hidden">
          
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <button 
              onClick={() => {
                setIsHomePage(true);
                setSelectedRegion(null);
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className="flex items-center justify-center w-full hover:opacity-80 transition-opacity"
            >
              <img src="/imgs/admap.png" alt="Admap Logo" className="h-10 w-auto object-contain" />
            </button>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-gray-200 rounded-md text-gray-500 hover:text-gray-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 hover:bg-gray-200 rounded-md text-gray-500 hover:text-gray-900 transition-colors"
              title="Close Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4 px-2 group">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Regions</span>
              <button 
                onClick={() => setShowRegionModal(true)}
                className="text-gray-400 hover:text-gray-900 transition-colors p-1 hover:bg-gray-200 rounded-md"
                title="Add Region"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
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
                    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      !isHomePage && selectedRegion?.id === r.id 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <MapPin className="w-4 h-4 shrink-0 opacity-70" />
                    <span className="truncate">{r.name}</span>
                  </button>
                ))
              )}
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 bg-white relative overflow-hidden h-full">
        {/* Toggle Button for Desktop/Mobile when Sidebar is closed */}
        <div className="absolute top-4 left-4 z-30">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 rounded-lg text-gray-600 transition-all ${isSidebarOpen ? 'opacity-0 pointer-events-none -translate-x-5' : 'opacity-100 translate-x-0'}`}
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {isHomePage ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50">
            <div className="text-center max-w-xl">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                AD Map Management
              </h1>
              <p className="text-gray-500 mb-8">
                Welcome to the Autonomous Driving Map Management System. Please select a region from the sidebar or upload a new map dataset to begin mapping and viewing point clouds.
              </p>
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

                      {/* Phase 3: Smart Diff & Impact Analysis (Mock) */}
                      <div className="mt-4 bg-blue-50/50 border border-blue-100 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Smart Diff Analysis</span>
                        </div>
                        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                          {v.description ? <li>{v.description}</li> : <li>Sự thay đổi dữ liệu: Đã phát hiện 02 làn đường mới, mật độ PCD thay đổi 15%.</li>}
                          <li>Trạng thái liên kết: OSM và PCD đã được align thành công.</li>
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
                  className="w-full border-gray-300 border rounded-md shadow-sm py-2 px-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                  value={versionName} 
                  onChange={(e) => setVersionName(e.target.value)} 
                />
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
                <button type="submit" disabled={isUploading} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 border border-transparent rounded-md shadow-sm hover:bg-gray-800 focus:outline-none">
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
