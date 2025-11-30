
import React, { useEffect, useState } from 'react';
import { Project, Station, Segment, Structure, Subproject } from '../types';
import { getStations, getSegments, getStructures, getSubprojects, getAllProjectStations } from '../services/db';
import { ArrowRight, MapPin, Plus, Download, Eye, ChevronLeft, Pencil, FolderPlus, GitBranch, Layers } from 'lucide-react';

interface StationListProps {
  project: Project;
  activeSubproject: Subproject | null;
  onSelectSubproject: (sub: Subproject | null) => void;
  onCreateSubproject: (name: string, originStation?: Station) => void;
  onBack: () => void;
  onAddStation: (lastStation: Station | null) => void;
  onAddStructure: (station: Station) => void;
  onViewSketch: () => void;
  onEditStation: (station: Station) => void;
}

const StationList: React.FC<StationListProps> = ({ 
  project, 
  activeSubproject, 
  onSelectSubproject, 
  onCreateSubproject,
  onBack, 
  onAddStation, 
  onAddStructure, 
  onViewSketch, 
  onEditStation 
}) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  
  // Modal State
  const [isCreatingSub, setIsCreatingSub] = useState(false);
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
    const rows = stations.map(s => `${s.id},${s.name},${s.easting.toFixed(3)},${s.northing.toFixed(3)},${s.elevation.toFixed(3)},"${s.notes || ''}"`).join("\n");
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

  return (
    <div className="flex flex-col h-full bg-stone-50">
      
      {/* Top Bar: Navigation + Project Name */}
      <div className="bg-white border-b border-stone-200 p-3 shadow-sm z-20">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onBack} className="p-1 rounded-full hover:bg-stone-100 text-stone-500">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-stone-500 truncate leading-none">{project.name}</h1>
            <div className="text-lg font-black text-stone-900 leading-tight">
              {activeSubproject ? activeSubproject.name : 'Labor Principal'}
            </div>
          </div>
        </div>
        
        {/* Subproject Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => onSelectSubproject(null)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
              activeSubproject === null 
                ? 'bg-stone-800 text-white border-stone-800' 
                : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-100'
            }`}
          >
            Principal
          </button>
          {subprojects.map(sp => (
            <button
              key={sp.id}
              onClick={() => onSelectSubproject(sp)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                activeSubproject?.id === sp.id 
                  ? 'bg-stone-800 text-white border-stone-800' 
                  : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-100'
              }`}
            >
              {sp.name}
            </button>
          ))}
          <button
            onClick={() => setIsCreatingSub(true)}
            className="whitespace-nowrap px-2 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Sector
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-stone-100 p-2 flex gap-2 border-b border-stone-200">
          <button 
            onClick={onViewSketch}
            className="flex-1 bg-white text-emerald-700 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border border-stone-200 shadow-sm active:scale-95 transition-transform"
          >
            <Eye className="w-4 h-4" /> Ver Croquis
          </button>
          <button 
            onClick={exportCSV}
            className="px-4 bg-white text-stone-600 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border border-stone-200 shadow-sm active:scale-95 transition-transform"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
      </div>

      {/* Traverse List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0 pb-28 no-scrollbar relative">
        {stations.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <Layers className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-bold">Sector Vacío</p>
            <p className="text-sm mt-1">Establece el origen para comenzar.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-stone-300 ml-4 space-y-6">
            {stations.map((station, index) => {
              const segment = segments.find(s => s.toStationId === station.id);
              const stationStructures = structures.filter(s => s.stationId === station.id);
              const fromStation = segment ? stations.find(s => s.id === segment.fromStationId) : null;

              return (
                <div key={station.id} className="pl-6 relative">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[9px] top-4 w-4 h-4 rounded-full border-2 border-white ${station.isOrigin ? 'bg-black' : 'bg-emerald-600'} shadow-sm z-10`}></div>
                  
                  {/* Segment Info */}
                  {segment && (
                    <div className="mb-2 text-xs text-stone-500 bg-stone-100 inline-block px-2 py-1 rounded border border-stone-200">
                      <span className="font-mono">Az: {segment.azimuth}°</span> • <span className="font-mono">V: {segment.dip}</span> • <span className="font-mono">Dist: {segment.distance}m</span>
                    </div>
                  )}

                  {/* Station Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-3 relative group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                          {fromStation ? (
                            <>
                              <span className="text-stone-500">{fromStation.name}</span>
                              <ArrowRight className="w-4 h-4 text-stone-400" />
                              <span className="text-stone-900">{station.name}</span>
                            </>
                          ) : (
                            <span>{station.name}</span>
                          )}
                          {station.isOrigin && <span className="text-[10px] bg-stone-800 text-white px-1.5 rounded">ORIGEN</span>}
                        </h3>
                        <div className="font-mono text-xs text-stone-500 mt-1 grid grid-cols-3 gap-2">
                          <span>E: {station.easting.toFixed(3)}</span>
                          <span>N: {station.northing.toFixed(3)}</span>
                          <span>Z: {station.elevation.toFixed(3)}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <button 
                          onClick={() => onEditStation(station)}
                          className="text-stone-400 bg-stone-50 p-2 rounded-lg hover:bg-stone-100 hover:text-stone-700"
                          title="Editar Datos"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Structures attached */}
                    {stationStructures.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-dashed border-stone-200 space-y-1">
                        {stationStructures.map(str => (
                          <div key={str.id} className="text-xs flex items-center gap-2 text-stone-600">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            <span className="font-bold uppercase">{str.type}</span>
                            <span>Rumbo: {str.strike}° / Buz: {str.dip}</span>
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-stone-200 safe-area-bottom z-10">
        <button
          onClick={() => onAddStation(getLastStation())}
          className="w-full bg-emerald-600 text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-emerald-200 active:scale-[0.98] flex items-center justify-center gap-2 transition-transform hover:bg-emerald-700"
        >
          <Plus className="w-5 h-5" />
          {stations.length === 0 ? "Establecer Punto Inicio" : "Registrar Avance"}
        </button>
      </div>

      {/* New Subproject Modal */}
      {isCreatingSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
               <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                 <FolderPlus className="w-5 h-5 text-emerald-600"/> Nuevo Sector
               </h3>
               <button onClick={() => setIsCreatingSub(false)} className="text-stone-400 hover:text-stone-600 font-bold px-2">✕</button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Nombre (Galería/Chimenea)</label>
                <input 
                  autoFocus
                  className="w-full border border-stone-300 rounded-lg p-3 font-bold text-stone-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Ej. Galería Secundaria B"
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Origen / Punto de Partida</label>
                <div className="relative">
                  <select
                    className="w-full border border-stone-300 rounded-lg p-3 font-medium text-stone-700 appearance-none bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={selectedOriginId}
                    onChange={e => setSelectedOriginId(e.target.value)}
                  >
                    <option value="">Definir Coordenadas Manualmente</option>
                    <optgroup label="Puntos Existentes (Todo el Proyecto)">
                      {allStations.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} (E:{s.easting.toFixed(1)}, N:{s.northing.toFixed(1)})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <GitBranch className="absolute right-3 top-3.5 w-5 h-5 text-stone-400 pointer-events-none" />
                </div>
                <p className="text-[10px] text-stone-400 mt-1 leading-tight">
                  {selectedOriginId 
                    ? "Se creará una copia de este punto como origen del nuevo sector." 
                    : "Tendrás que ingresar manualmente las coordenadas iniciales (0,0,0)."}
                </p>
              </div>

              <button 
                type="submit"
                className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl mt-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200"
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
