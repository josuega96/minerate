import React, { useState, useEffect } from 'react';
import { Project, Station, Segment, Structure, Subproject, IntermediatePoint } from '../types';
import { getStations, getSegments, getStructures, getIntermediatePoints, downloadData, exportToCSV } from '../services/db';
import { ChevronLeft, FileText, Mountain, Layers, Download, CornerDownRight, Pencil } from 'lucide-react';

interface TableViewProps {
  project: Project;
  activeSubproject: Subproject | null;
  onClose: () => void;
  onEditStation: (station: Station) => void;
}

const TableView: React.FC<TableViewProps> = ({ project, activeSubproject, onClose, onEditStation }) => {
  const [activeTab, setActiveTab] = useState<'survey' | 'geology'>('survey');
  const [stations, setStations] = useState<Station[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [intermediatePoints, setIntermediatePoints] = useState<IntermediatePoint[]>([]);

  useEffect(() => {
    loadData();
  }, [project.id, activeSubproject?.id]);

  const loadData = async () => {
    if (!project.id) return;
    const subId = activeSubproject?.id || null;
    
    const [s, seg, str, int] = await Promise.all([
      getStations(project.id, subId),
      getSegments(project.id, subId),
      getStructures(project.id, subId),
      getIntermediatePoints(project.id, subId)
    ]);

    setStations(s);
    setSegments(seg);
    setStructures(str);
    setIntermediatePoints(int);
  };

  const handleExport = () => {
    if (activeTab === 'survey') {
      // Flatten data to include stations AND intermediate points in order
      const data = stations.flatMap(st => {
        const seg = segments.find(s => s.toStationId === st.id);
        const fromSt = seg ? stations.find(s => s.id === seg.fromStationId) : null;
        
        // Find intermediates for this segment
        const segmentIntermediates = seg 
          ? intermediatePoints
              .filter(ip => ip.segmentId === seg.id)
              .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
          : [];

        // Map intermediates to rows
        const intRows = segmentIntermediates.map(ip => ({
          ID: `INT-${ip.id}`,
          Estacion: `+ ${ip.distanceFromStart}m`,
          Desde: fromSt ? fromSt.name : '',
          Este: '', // Usually interpolated, leaving blank for raw data
          Norte: '',
          Cota: '',
          Azimut: seg ? seg.azimuth : '', // Inherits segment azimuth
          Buzamiento: seg ? seg.dip : '',   // Inherits segment dip
          Distancia: ip.distanceFromStart,
          Izq: ip.left,
          Der: ip.right,
          Techo: ip.up,
          Piso: ip.down,
          Notas: ip.notes || '(Punto Intermedio)'
        }));

        // The main station row
        // Modified: Removed toFixed(3) to preserve full precision
        const stationRow = {
          ID: st.id,
          Estacion: st.name,
          Desde: fromSt ? fromSt.name : '-',
          Este: st.easting,
          Norte: st.northing,
          Cota: st.elevation,
          Azimut: seg ? seg.azimuth : '',
          Buzamiento: seg ? seg.dip : '',
          Distancia: seg ? seg.distance : '',
          Izq: seg ? seg.left : '',
          Der: seg ? seg.right : '',
          Techo: seg ? seg.up : '',
          Piso: seg ? seg.down : '',
          Notas: st.notes || ''
        };

        return [...intRows, stationRow];
      });

      const csv = exportToCSV(data);
      downloadData(csv, `Levantamiento_${project.name}.csv`, 'csv');
    } else {
      const locationMap: Record<string, string> = { left: 'Izq', right: 'Der', up: 'Techo', down: 'Piso' };
      const data = structures.map(str => {
        const st = stations.find(s => s.id === str.stationId);
        // Combine Type and Name for export
        const typeStr = str.otherType ? `${str.type.toUpperCase()}: ${str.otherType}` : str.type.toUpperCase();
        
        return {
          ID: str.id,
          Estacion_Ref: st ? st.name : 'Unknown',
          Distancia: str.distanceFromStart,
          Tipo: typeStr,
          Rumbo: str.strike,
          Buzamiento: str.dip,
          Potencia: str.aperture || '',
          Ubicacion: str.location?.map((l: string) => locationMap[l] || l).join(', ') || '',
          Notas: str.notes || ''
        };
      });
      const csv = exportToCSV(data);
      downloadData(csv, `Geologia_${project.name}.csv`, 'csv');
    }
  };

  // --- Edit Handlers ---
  const editIntermediateParent = (intermediate: IntermediatePoint) => {
    // Find the segment this intermediate belongs to
    const seg = segments.find(s => s.id === intermediate.segmentId);
    if (seg) {
      // Find the station this segment leads to (The Advance Record)
      const station = stations.find(s => s.id === seg.toStationId);
      if (station) onEditStation(station);
    }
  };

  const editStructureParent = (structure: Structure) => {
    // Structure is linked to the START station of a segment.
    // We need to find the segment that STARTS at structure.stationId to find the Advance Record (Destination Station)
    // However, a station might have multiple outgoing segments if it's a junction.
    // But usually in the UI we display structure under the segment that created it.
    
    // Simplification: We look for the segment where fromStationId matches the structure's stationId.
    // NOTE: This might be ambiguous if there are branches. 
    // Ideally structure should link to the Segment or the creating Station context.
    // For now, we find the first segment starting here in this subproject context.
    const seg = segments.find(s => s.fromStationId === structure.stationId);
    if (seg) {
      const station = stations.find(s => s.id === seg.toStationId);
      if (station) onEditStation(station);
    } else {
      // Fallback: If no segment goes out (maybe it's the last station?), check if it IS a station
      // But structures are usually recorded IN an advance.
      alert("No se encontró el registro de avance asociado a esta estructura.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex justify-between items-center shadow-md z-10">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-400" /> Tabla Resumen
          </h2>
          <p className="text-xs text-slate-400">
            {project.name} {activeSubproject ? `• ${activeSubproject.name}` : ''}
          </p>
        </div>
        <button onClick={onClose} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setActiveTab('survey')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'survey' 
              ? 'bg-slate-50 text-orange-700 border-b-2 border-orange-600' 
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Mountain className="w-4 h-4" /> Levantamiento
        </button>
        <button
          onClick={() => setActiveTab('geology')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'geology' 
              ? 'bg-slate-50 text-amber-700 border-b-2 border-amber-600' 
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" /> Geología
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-2 flex justify-end bg-slate-50 border-b border-slate-200">
         <button 
           onClick={handleExport}
           className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm hover:bg-slate-100"
         >
           <Download className="w-3.5 h-3.5" /> Exportar esta tabla
         </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-slate-100 p-4">
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              {activeTab === 'survey' ? (
                <>
                  <thead className="bg-orange-50 text-orange-900 border-b border-orange-100 uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3 w-10">Acciones</th>
                      <th className="px-4 py-3">Estación / Punto</th>
                      <th className="px-4 py-3">Coord. Este</th>
                      <th className="px-4 py-3">Coord. Norte</th>
                      <th className="px-4 py-3">Cota (Z)</th>
                      <th className="px-4 py-3 border-l border-orange-100">Azimut</th>
                      <th className="px-4 py-3">Buz.</th>
                      <th className="px-4 py-3">Dist.</th>
                      <th className="px-4 py-3 border-l border-orange-100">Izq</th>
                      <th className="px-4 py-3">Der</th>
                      <th className="px-4 py-3">Techo</th>
                      <th className="px-4 py-3">Piso</th>
                      <th className="px-4 py-3 border-l border-orange-100">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stations.map((st, i) => {
                      const seg = segments.find(s => s.toStationId === st.id);
                      const segmentIntermediates = seg 
                        ? intermediatePoints
                            .filter(ip => ip.segmentId === seg.id)
                            .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
                        : [];

                      return (
                        <React.Fragment key={st.id}>
                          {/* Render Intermediate Points First */}
                          {segmentIntermediates.map(ip => (
                            <tr key={`int-${ip.id}`} className="bg-slate-50/50 text-slate-500 italic">
                               <td className="px-4 py-2">
                                  <button onClick={() => editIntermediateParent(ip)} className="text-slate-400 hover:text-orange-600 p-1">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                               </td>
                               <td className="px-4 py-2 pl-8 flex items-center gap-1">
                                 <CornerDownRight className="w-3 h-3 opacity-50" />
                                 <span>+ {ip.distanceFromStart}m</span>
                               </td>
                               <td className="px-4 py-2">-</td>
                               <td className="px-4 py-2">-</td>
                               <td className="px-4 py-2">-</td>
                               {/* Inherited Vector Data */}
                               <td className="px-4 py-2 border-l border-slate-100 opacity-50">{seg?.azimuth}°</td>
                               <td className="px-4 py-2 opacity-50">{seg?.dip}</td>
                               <td className="px-4 py-2 font-mono">{ip.distanceFromStart}</td>
                               {/* Dimensions */}
                               <td className="px-4 py-2 border-l border-slate-100 font-mono">{ip.left}</td>
                               <td className="px-4 py-2 font-mono">{ip.right}</td>
                               <td className="px-4 py-2 font-mono">{ip.up}</td>
                               <td className="px-4 py-2 font-mono">{ip.down}</td>
                               <td className="px-4 py-2 border-l border-slate-100 max-w-[150px] truncate text-slate-400">
                                 {ip.notes}
                               </td>
                            </tr>
                          ))}

                          {/* Render Station Row */}
                          <tr className="hover:bg-slate-50 border-t border-slate-100">
                            <td className="px-4 py-2">
                                <button onClick={() => onEditStation(st)} className="text-slate-400 hover:text-orange-600 p-1">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                            </td>
                            <td className="px-4 py-2 font-bold text-slate-800">
                              {st.name} 
                              {st.isOrigin && <span className="ml-2 text-[9px] bg-slate-800 text-white px-1 rounded">ORIGEN</span>}
                            </td>
                            {/* Modified: Removed toFixed(3) */}
                            <td className="px-4 py-2 font-mono text-slate-600">{st.easting}</td>
                            <td className="px-4 py-2 font-mono text-slate-600">{st.northing}</td>
                            <td className="px-4 py-2 font-mono text-slate-600">{st.elevation}</td>
                            
                            {/* Segment Data */}
                            <td className="px-4 py-2 border-l border-slate-100">{seg ? seg.azimuth + '°' : '-'}</td>
                            <td className="px-4 py-2">{seg ? seg.dip : '-'}</td>
                            <td className="px-4 py-2 font-bold">{seg ? seg.distance + 'm' : '-'}</td>
                            
                            {/* Dims */}
                            <td className="px-4 py-2 border-l border-slate-100">{seg ? seg.left : '-'}</td>
                            <td className="px-4 py-2">{seg ? seg.right : '-'}</td>
                            <td className="px-4 py-2">{seg ? seg.up : '-'}</td>
                            <td className="px-4 py-2">{seg ? seg.down : '-'}</td>
                            
                            <td className="px-4 py-2 border-l border-slate-100 italic text-slate-400 max-w-[150px] truncate">
                              {st.notes}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </>
              ) : (
                <>
                  <thead className="bg-amber-50 text-amber-900 border-b border-amber-100 uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3 w-10">Acciones</th>
                      <th className="px-4 py-3">Ref. Estación</th>
                      <th className="px-4 py-3">Dist. desde Ref.</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Rumbo (Strike)</th>
                      <th className="px-4 py-3">Buz. (Dip)</th>
                      <th className="px-4 py-3">Potencia</th>
                      <th className="px-4 py-3">Ubicación</th>
                      <th className="px-4 py-3">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {structures.length === 0 ? (
                       <tr><td colSpan={9} className="p-8 text-center text-slate-400 italic">No hay estructuras registradas</td></tr>
                    ) : (
                      structures.map((str, i) => {
                        const st = stations.find(s => s.id === str.stationId);
                        const locationMap: Record<string, string> = { left: 'Izq', right: 'Der', up: 'Techo', down: 'Piso' };
                        const locs = str.location?.map(l => locationMap[l]).join(', ') || '-';
                        return (
                          <tr key={str.id} className="hover:bg-amber-50/30">
                            <td className="px-4 py-2">
                                <button onClick={() => editStructureParent(str)} className="text-slate-400 hover:text-amber-600 p-1">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                            </td>
                            <td className="px-4 py-2 font-bold text-slate-800">{st ? st.name : 'Desconocido'}</td>
                            <td className="px-4 py-2 font-mono text-slate-600">{str.distanceFromStart} m</td>
                            <td className="px-4 py-2 uppercase font-bold text-amber-700 bg-amber-50 inline-block m-1 rounded px-2 text-[10px]">
                              {str.type}
                              {str.otherType && <span className="normal-case text-amber-600">: {str.otherType}</span>}
                            </td>
                            <td className="px-4 py-2">{str.strike}°</td>
                            <td className="px-4 py-2">{str.dip}</td>
                            <td className="px-4 py-2">{str.aperture ? str.aperture + ' m' : '-'}</td>
                            <td className="px-4 py-2 text-slate-500 text-[10px]">{locs}</td>
                            <td className="px-4 py-2 italic text-slate-400 max-w-[200px] truncate">{str.notes}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableView;