import React, { useEffect, useState } from 'react';
import { Project, Station, Segment, Structure } from '../types';
import { getStations, getSegments, getStructures } from '../services/db';
import { ArrowRight, MapPin, Plus, FileText, Download, Activity, Eye, ChevronLeft } from 'lucide-react';

interface StationListProps {
  project: Project;
  onBack: () => void;
  onAddStation: (lastStation: Station | null) => void;
  onAddStructure: (station: Station) => void;
  onViewSketch: () => void;
}

const StationList: React.FC<StationListProps> = ({ project, onBack, onAddStation, onAddStructure, onViewSketch }) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);

  useEffect(() => {
    loadData();
  }, [project.id]);

  const loadData = async () => {
    if (!project.id) return;
    const s = await getStations(project.id);
    const seg = await getSegments(project.id);
    const str = await getStructures(project.id);
    setStations(s);
    setSegments(seg);
    setStructures(str);
  };

  const exportCSV = () => {
    // Basic CSV Export logic
    const headers = "ID,Station,East,North,Elev,Notes\n";
    const rows = stations.map(s => `${s.id},${s.name},${s.easting.toFixed(3)},${s.northing.toFixed(3)},${s.elevation.toFixed(3)},"${s.notes || ''}"`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_data.csv`;
    a.click();
  };

  const getLastStation = () => stations.length > 0 ? stations[stations.length - 1] : null;

  return (
    <div className="flex flex-col h-full bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 p-4 shadow-sm z-10">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={onBack} className="p-1 rounded-full hover:bg-stone-100 text-stone-500">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-stone-900 truncate">{project.name}</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onViewSketch}
            className="flex-1 bg-emerald-50 text-emerald-700 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 border border-emerald-100 hover:bg-emerald-100"
          >
            <Eye className="w-4 h-4" /> Ver Croquis
          </button>
          <button 
            onClick={exportCSV}
            className="px-3 bg-stone-100 text-stone-600 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 hover:bg-stone-200"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* Traverse List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0 pb-28 no-scrollbar relative">
        {stations.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <MapPin className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p>No hay estaciones registradas.</p>
            <p className="text-sm">Agrega el Punto de Inicio.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-stone-300 ml-4 space-y-6">
            {stations.map((station, index) => {
              const segment = segments.find(s => s.toStationId === station.id);
              const stationStructures = structures.filter(s => s.stationId === station.id);

              return (
                <div key={station.id} className="pl-6 relative">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[9px] top-4 w-4 h-4 rounded-full border-2 border-white ${station.isOrigin ? 'bg-black' : 'bg-emerald-600'} shadow-sm z-10`}></div>
                  
                  {/* Segment Info (Line connecting previous) */}
                  {segment && (
                    <div className="mb-2 text-xs text-stone-500 bg-stone-100 inline-block px-2 py-1 rounded border border-stone-200">
                      <span className="font-mono">Az: {segment.azimuth}°</span> • <span className="font-mono">V: {segment.dip}°</span> • <span className="font-mono">Dist: {segment.distance}m</span>
                    </div>
                  )}

                  {/* Station Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-3 relative group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                          {station.name}
                          {station.isOrigin && <span className="text-[10px] bg-stone-800 text-white px-1.5 rounded">ORIGEN</span>}
                        </h3>
                        <div className="font-mono text-xs text-stone-500 mt-1 grid grid-cols-3 gap-2">
                          <span>E: {station.easting.toFixed(3)}</span>
                          <span>N: {station.northing.toFixed(3)}</span>
                          <span>Z: {station.elevation.toFixed(3)}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => onAddStructure(station)}
                        className="text-amber-600 bg-amber-50 p-2 rounded-lg hover:bg-amber-100"
                        title="Agregar Estructura"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Structures attached */}
                    {stationStructures.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-dashed border-stone-200 space-y-1">
                        {stationStructures.map(str => (
                          <div key={str.id} className="text-xs flex items-center gap-2 text-stone-600">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            <span className="font-bold uppercase">{str.type}</span>
                            <span>Rumbo: {str.strike}° / Buz: {str.dip}°</span>
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-stone-200 safe-area-bottom">
        <button
          onClick={() => onAddStation(getLastStation())}
          className="w-full bg-emerald-600 text-white font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-emerald-200 active:scale-[0.98] flex items-center justify-center gap-2 transition-transform hover:bg-emerald-700"
        >
          <Plus className="w-6 h-6" />
          {stations.length === 0 ? "Establecer Origen (E-1)" : "Registrar Avance"}
        </button>
      </div>
    </div>
  );
};

export default StationList;