
import React, { useEffect, useState } from 'react';
import { Project, Station, Segment, Structure, Subproject } from '../types';
import { getStations, getSegments, getStructures, getSubprojects, getAllProjectStations } from '../services/db';
import { ArrowRight, MapPin, Plus, Download, Eye, ChevronLeft, Pencil, FolderPlus, GitBranch, Layers, TableProperties, Edit2 } from 'lucide-react';

interface StationListProps {
  project: Project;
  activeSubproject: Subproject | null;
  onSelectSubproject: (sub: Subproject | null) => void;
  onCreateSubproject: (name: string, originStation?: Station) => void;
  onRenameContext: (newName: string) => void;
  onBack: () => void;
  onAddStation: (lastStation: Station | null) => void;
  onAddStructure: (station: Station) => void;
  onViewSketch: () => void;
  onViewTable: () => void;
  onEditStation: (station: Station) => void;
}

const StationList: React.FC<StationListProps> = ({ 
  project, 
  activeSubproject, 
  onSelectSubproject, 
  onCreateSubproject,
  onRenameContext,
  onBack, 
  onAddStation, 
  onAddStructure, 
  onViewSketch, 
  onViewTable,
  onEditStation 
}) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  
  // Modal State
  const [isCreatingSub, setIsCreatingSub] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  
  const [newSubName, setNewSubName] = useState('');
  const [allStations, setAllStations] = useState<Station[]>([]); // For Origin selection
  const [selectedOriginId, setSelectedOriginId] = useState<string>('');

  useEffect(() => {
    loadData();
    loadSubprojects();
  }, [project.id, activeSubproject?.id]);

  const loadSubprojects = async () => {
    if (!project.id) return;
    const subs = await getSubprojects(project.id);
    setSubprojects(subs);
  };

  const loadData = async () => {
    if (!project.id) return;
    // Load data specific to current subproject (or null for main)
    const s = await getStations(project.id, activeSubproject?.id || null);
    const seg = await getSegments(project.id, activeSubproject?.id || null);
    const str = await getStructures(project.id, activeSubproject?.id || null);
    setStations(s);
    setSegments(seg);
    setStructures(str);

    // Also load ALL stations for linking purposes
    const all = await getAllProjectStations(project.id);
    setAllStations(all);
  };

  const exportCSV = () => {
    const headers = "ID,Station,East,North,Elev,Notes\n";
    // Modified: Remove .toFixed(3) to prevent rounding
    const rows = stations.map(s => `${s.id},${s.name},${s.easting},${s.northing},${s.elevation},"${s.notes || ''}"`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_${activeSubproject?.name || 'Main'}.csv`;
    a.click();
  };

  const getLastStation = () => stations.length > 0 ? stations[stations.length - 1] : null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName) return;
    
    let origin: Station | undefined = undefined;
    if (selectedOriginId) {
      origin = allStations.find(s => s.id?.toString() === selectedOriginId);
    }
    
    onCreateSubproject(newSubName, origin);
    setIsCreatingSub(false);
    setNewSubName('');
    setSelectedOriginId('');
  };

  const startRename = () => {
    const currentName = activeSubproject ? activeSubproject.name : (project.rootSectorName || 'Labor Principal');
    setRenameValue(currentName);
    setIsRenaming(true);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameValue.trim()) {
      onRenameContext(renameValue);
      setIsRenaming(false);
    }
  };

  const currentContextName = activeSubproject ? activeSubproject.name : (project.rootSectorName || 'Labor Principal');

  return (
    <div className="flex flex-col h-full bg-slate-100">
      
      {/* Top Bar: Navigation + Project Name */}
      <div className="bg-slate-900 text-white p-4 shadow-md z-20">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 pr-2">
            <h1 className="text-xs font-bold text-slate-400 truncate uppercase tracking-widest">{project.name}</h1>
            <div className="flex items-center gap-2">
              <div className="text-xl font-black text-white leading-tight truncate">
                {currentContextName}
              </div>
              <button 
                onClick={startRename}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Subproject Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => onSelectSubproject(null)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              activeSubproject === null 
                ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-900/20' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
             {project.rootSectorName || 'Principal'}
          </button>
          {subprojects.map(sp => (
            <button
              key={sp.id}
              onClick={() => onSelectSubproject(sp)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                activeSubproject?.id === sp.id 
                  ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-900/20' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {sp.name}
            </button>
          ))}
          <button
            onClick={() => setIsCreatingSub(true)}
            className="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-orange-500 border border-slate-700 hover:bg-slate-700 flex items-center gap-1 hover:text-orange-400 transition-colors"
          >
            <Plus className="w-3 h-3" /> Sector
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white p-2 flex gap-2 border-b border-slate-200 shadow-sm">
          <button 
            onClick={onViewTable}
            className="flex-1 bg-slate-50 text-slate-700 py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border border-slate-200 active:scale-95 transition-transform hover:bg-slate-100"
          >
            <TableProperties className="w-4 h-4 text-slate-500" /> Ver Tabla
          </button>
          <button 
            onClick={onViewSketch}
            className="flex-1 bg-slate-50 text-orange-700 py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border border-slate-200 active:scale-95 transition-transform hover:bg-slate-100"
          >
            <Eye className="w-4 h-4 text-orange-600" /> Ver Croquis
          </button>
          <button 
            onClick={exportCSV}
            className="px-4 bg-slate-50 text-slate-600 py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border border-slate-200 active:scale-95 transition-transform hover:bg-slate-100"
          >
            <Download className="w-4 h-4" />
          </button>
      </div>

      {/* Traverse List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0 pb-28 no-scrollbar relative bg-slate-100">
        {stations.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Layers className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-bold text-slate-500">Sector Vacío</p>
            <p className="text-sm mt-1">Establece el origen para comenzar.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-300 ml-4 space-y-6">
            {stations.map((station, index) => {
              const segment = segments.find(s => s.toStationId === station.id);
              const stationStructures = segment 
                ? structures.filter(s => s.stationId === segment.fromStationId)
                : [];
                
              const fromStation = segment ? stations.find(s => s.id === segment.fromStationId) : null;

              return (
                <div key={station.id} className="pl-6 relative">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[9px] top-4 w-4 h-4 rounded-full border-2 border-slate-100 ${station.isOrigin ? 'bg-slate-800' : 'bg-orange-500'} shadow-sm z-10`}></div>
                  
                  {/* Segment Info */}
                  {segment && (
                    <div className="mb-2 text-xs text-slate-500 bg-white inline-block px-2 py-1 rounded border border-slate-200 font-mono shadow-sm">
                      Az: <span className="text-slate-900 font-bold">{segment.azimuth}°</span> • V: <span className="text-slate-900 font-bold">{segment.dip}</span> • Dist: <span className="text-slate-900 font-bold">{segment.distance}m</span>
                    </div>
                  )}

                  {/* Station Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 relative group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                          {fromStation ? (
                            <>
                              <span className="text-slate-400">{fromStation.name}</span>
                              <ArrowRight className="w-4 h-4 text-slate-300" />
                              <span className="text-slate-900">{station.name}</span>
                            </>
                          ) : (
                            <span className="text-slate-900">{station.name}</span>
                          )}
                          {station.isOrigin && <span className="text-[10px] bg-slate-800 text-white px-1.5 rounded font-bold tracking-wider">ORIGEN</span>}
                        </h3>
                        {/* Modified: Remove .toFixed(3) for full precision display */}
                        <div className="font-mono text-xs text-slate-500 mt-1 grid grid-cols-3 gap-3 bg-slate-50 p-1.5 rounded border border-slate-100">
                          <span>E: <b className="text-slate-700">{station.easting}</b></span>
                          <span>N: <b className="text-slate-700">{station.northing}</b></span>
                          <span>Z: <b className="text-slate-700">{station.elevation}</b></span>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <button 
                          onClick={() => onEditStation(station)}
                          className="text-slate-400 bg-slate-50 p-2 rounded-lg hover:bg-orange-50 hover:text-orange-600 border border-transparent hover:border-orange-100 transition-colors"
                          title="Editar Datos"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Structures attached (from the segment arriving here) */}
                    {stationStructures.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-dashed border-slate-200 space-y-1">
                        {stationStructures.map(str => (
                          <div key={str.id} className="text-xs flex items-center gap-2 text-slate-600 bg-amber-50/50 p-1 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span className="font-bold uppercase text-amber-900">
                              {str.type}
                            </span>
                            {str.otherType && <span className="text-amber-800 normal-case">: {str.otherType}</span>}
                            <span className="text-amber-700 ml-auto font-mono">R:{str.strike}° / B:{str.dip}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-slate-200 safe-area-bottom z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => onAddStation(getLastStation())}
          className="w-full bg-orange-600 text-white font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-orange-200 active:scale-[0.98] flex items-center justify-center gap-2 transition-transform hover:bg-orange-700"
        >
          <Plus className="w-5 h-5" />
          {stations.length === 0 ? "Establecer Punto Inicio" : "Registrar Avance"}
        </button>
      </div>

      {/* Rename Modal */}
      {isRenaming && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 border border-slate-200">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                 <Edit2 className="w-5 h-5 text-orange-600"/> Renombrar Labor
               </h3>
               <button onClick={() => setIsRenaming(false)} className="text-slate-400 hover:text-slate-600 font-bold px-2">✕</button>
            </div>
            <form onSubmit={handleRenameSubmit} className="p-5">
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre de la Labor / Sector</label>
               <input 
                 autoFocus
                 className="w-full bg-white border border-slate-300 rounded-lg p-3 font-bold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 outline-none"
                 value={renameValue}
                 onChange={e => setRenameValue(e.target.value)}
                 required
               />
               <button 
                type="submit"
                className="w-full bg-orange-600 text-white font-bold py-3.5 rounded-xl mt-4 hover:bg-orange-700 shadow-lg shadow-orange-200"
              >
                Guardar Nombre
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Subproject Modal */}
      {isCreatingSub && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                 <FolderPlus className="w-5 h-5 text-orange-600"/> Nuevo Sector
               </h3>
               <button onClick={() => setIsCreatingSub(false)} className="text-slate-400 hover:text-slate-600 font-bold px-2">✕</button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre (Galería/Chimenea)</label>
                <input 
                  autoFocus
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 font-bold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Ej. Galería Secundaria B"
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Origen / Punto de Partida</label>
                <div className="relative">
                  <select
                    className="w-full bg-white border border-slate-300 rounded-lg p-3 font-medium text-slate-900 appearance-none focus:ring-2 focus:ring-orange-500 outline-none"
                    value={selectedOriginId}
                    onChange={e => setSelectedOriginId(e.target.value)}
                  >
                    <option value="">Definir Coordenadas Manualmente</option>
                    <optgroup label="Puntos Existentes (Todo el Proyecto)">
                      {allStations.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} (E:{s.easting}, N:{s.northing})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <GitBranch className="absolute right-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  {selectedOriginId 
                    ? "Se creará una copia de este punto como origen del nuevo sector." 
                    : "Tendrás que ingresar manualmente las coordenadas iniciales (0,0,0)."}
                </p>
              </div>

              <button 
                type="submit"
                className="w-full bg-orange-600 text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-orange-700 shadow-lg shadow-orange-200"
              >
                Crear Sector
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StationList;
