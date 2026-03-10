import React, { useEffect, useState } from 'react';
import { api } from './api';
import type { Region } from './api';

function App() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionCode, setRegionCode] = useState('');
  const [versionName, setVersionName] = useState('');
  const [osmFile, setOsmFile] = useState<File | null>(null);
  const [pcdFile, setPcdFile] = useState<File | null>(null);

  useEffect(() => {
    api.get<Region[]>('/regions').then((res) => setRegions(res.data)).catch(() => { });
  }, []);

  const handleCreateRegion = async () => {
    const name = prompt("Enter region name:");
    const code = prompt("Enter region code:");
    if (!name || !code) return;
    await api.post('/regions', { name, code });
    const res = await api.get<Region[]>('/regions');
    setRegions(res.data);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('region_code', regionCode);
    formData.append('version_name', versionName);
    if (osmFile) formData.append('osm_file', osmFile);
    if (pcdFile) formData.append('pcd_file', pcdFile);

    try {
      await api.post('/versions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Upload successful!');
    } catch (err) {
      alert('Upload failed. Ensure the region exists.');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen bg-slate-50 font-sans">
      <h1 className="text-4xl font-extrabold mb-8 text-slate-800 tracking-tight">🗺️ AD Map Configuration</h1>
      <div className="bg-yellow-200 p-2 mb-4 text-black font-bold">FE IS LOADING...</div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Regions</h2>
          <button onClick={handleCreateRegion} className="bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-slate-700 font-medium">
            + Add Region
          </button>
        </div>
        {regions.length === 0 ? (
          <p className="text-slate-500 italic">No regions configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {regions.map(r => (
              <div key={r.id} className="p-4 rounded-xl bg-slate-100 border border-slate-200">
                <p className="font-semibold text-slate-800">{r.name}</p>
                <p className="text-sm text-slate-500 font-mono mt-1">{r.code}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold mb-6 text-slate-800">Upload Map Version</h2>
        <form onSubmit={handleUpload} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Region Code</label>
              <select className="border border-slate-300 rounded-lg px-4 py-2 w-full bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                value={regionCode} onChange={(e) => setRegionCode(e.target.value)} required>
                <option value="" disabled>Select Region</option>
                {regions.map(r => <option key={r.id} value={r.code}>{r.name} ({r.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Version</label>
              <input type="text" className="border border-slate-300 rounded-lg px-4 py-2 w-full bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. v1.1.0" value={versionName} onChange={(e) => setVersionName(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 text-center">
              <label className="block text-sm font-semibold text-slate-700 mb-2 cursor-pointer">
                📄 Lanelet2 Data (.osm)
                <input type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mt-2"
                  onChange={(e) => setOsmFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 text-center">
              <label className="block text-sm font-semibold text-slate-700 mb-2 cursor-pointer">
                ☁️ Point Cloud (.pcd)
                <input type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mt-2"
                  onChange={(e) => setPcdFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
          <hr className="border-slate-200" />
          <div className="flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg shadow hover:bg-blue-700 font-medium transition-colors">
              Upload to System
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
