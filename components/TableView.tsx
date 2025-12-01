
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
      // Flatten data to include stations AND intermediate points in chronological order
      // Order: Station (Origin) -> Intermediates (Outgoing) -> Next Station
      const data = stations.flatMap(st => {
        // Incoming Segment (How we got TO this station) - For Station Row Details
        const incomingSeg = segments.find(s => s.toStationId === st.id);
        const fromSt = incomingSeg ? stations.find(s => s.id === incomingSeg.fromStationId) : null;
        
        // Outgoing Segment (Starting FROM this station) - For Intermediate Points
        const outgoingSeg = segments.find(s => s.fromStationId === st.id);
        
        // Find intermediates for the OUTGOING segment
        const segmentIntermediates = outgoingSeg 
          ? intermediatePoints
              .filter(ip => ip.segmentId === outgoingSeg.id)
              .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
          : [];

        // Map intermediates to rows
        const intRows = segmentIntermediates.map(ip => ({
          ID: `INT-${ip.id}`,
          Estacion: `+ ${ip.distanceFromStart}m`,
          Desde: st.name, // Measured from current station
          Este: '', // Interpolated coords not calculated here
          Norte: '',
          Cota: '',
          Azimut: outgoingSeg ? outgoingSeg.azimuth : '', // Inherits azimuth from outgoing segment
          Buzamiento: outgoingSeg ? outgoingSeg.dip : '',   // Inherits dip from outgoing segment
          Distancia: ip.distanceFromStart,
          Izq: ip.left,
          Der: ip.right,
          Techo: ip.up,
          Piso: ip.down,
          Notas: ip.notes || '(Punto Intermedio)'
        }));

        // The main station row
        const stationRow = {
          ID: st.id,
          Estacion: st.name,
          Desde: fromSt ? fromSt.name : '-',
          Este: st.easting,
          Norte: st.northing,
          Cota: st.elevation,
          Azimut: incomingSeg ? incomingSeg.azimuth : '',
          Buzamiento: incomingSeg ? incomingSeg.dip : '',
          Distancia: incomingSeg ? incomingSeg.distance : '',
          Izq: incomingSeg ? incomingSeg.left : '',
          Der: incomingSeg ? incomingSeg.right : '',
          Techo: incomingSeg ? incomingSeg.up : '',
          Piso: incomingSeg ? incomingSeg.down : '',
          Notas: st.notes || ''
        };

        // Station first, then its outgoing Intermediates
        return [stationRow, ...intRows];
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
      // Find the station this segment leads to (The Advance Record containing this data)
      const station = stations.find(s => s.id === seg.toStationId);
      if (station) onEditStation(station);
    }
  };

  const editStructureParent = (structure: Structure) => {
    const seg = segments.find(s => s.fromStationId === structure.stationId);
    if (seg) {
      const station = stations.find(s => s.id === seg.toStationId);
      if (station) onEditStation(station);
    } else {
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
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'survey' 
              ? 'bg-slate-50 text-orange-700 border-b-2 border-orange-600' 
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Mountain className="w-5 h-5" /> Levantamiento
        </button>
        <button
          onClick={() => setActiveTab('geology')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'geology' 
              ? 'bg-slate-50 text-amber-700 border-b-2 border-amber-600' 
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-5 h-5" /> Geología
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-3 flex justify-end bg-slate-50 border-b border-slate-200">
         <button 
           onClick={handleExport}
           className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-slate-100 transition-colors"
         >
           <Download className="w-4 h-4" /> Exportar esta tabla
         </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-slate-100 p-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              {activeTab === 'survey' ? (
                <>
                  <thead className="bg-orange-50 text-orange-900 border-b border-orange-100 uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4 w-10">Acciones</th>
                      <th className="px-6 py-4">Estación / Punto</th>
                      <th className="px-6 py-4">Coord. Este</th>
                      <th className="px-6 py-4">Coord. Norte</th>
                      <th className="px-6 py-4">Cota (Z)</th>
                      <th className="px-6 py-4 border-l border-orange-100">Azimut</th>
                      <th className="px-6 py-4">Buz.</th>
                      <th className="px-6 py-4">Dist.</th>
                      <th className="px-6 py-4 border-l border-orange-100">Izq</th>
                      <th className="px-6 py-4">Der</th>
                      <th className="px-6 py-4">Techo</th>
                      <th className="px-6 py-4">Piso</th>
                      <th className="px-6 py-4 border-l border-orange-100">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stations.map((st, i) => {
                      // Incoming Segment: How we arrived AT this station (shown in station row)
                      const incomingSeg = segments.find(s => s.toStationId === st.id);
                      
                      // Outgoing Segment: How we leave this station (contains Intermediates for next section)
                      const outgoingSeg = segments.find(s => s.fromStationId === st.id);
                      
                      const segmentIntermediates = outgoingSeg 
                        ? intermediatePoints
                            .filter(ip => ip.segmentId === outgoingSeg.id)
                            .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
                        : [];

                      return (
                        <React.Fragment key={st.id}>
                          {/* Render Station Row FIRST */}
                          <tr className="hover:bg-slate-50 border-t border-slate-100 transition-colors">
                            <td className="px-6 py-4">
                                <button onClick={() => onEditStation(st)} className="text-slate-400 hover:text-orange-600 p-2 rounded hover:bg-slate-200">
                                  <Pencil className="w-4 h-4" />
                                </button>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800 text-base">
                              {st.name} 
                              {st.isOrigin && <span className="ml-2 text-[10px] bg-slate-800 text-white px-2 py-0.5 rounded uppercase tracking-wider">ORIGEN</span>}
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-700">{st.easting}</td>
                            <td className="px-6 py-4 font-mono text-slate-700">{st.northing}</td>
                            <td className="px-6 py-4 font-mono text-slate-700">{st.elevation}</td>
                            
                            {/* Segment Data (Incoming) */}
                            <td className="px-6 py-4 border-l border-slate-100 text-slate-700">{incomingSeg ? incomingSeg.azimuth + '°' : '-'}</td>
                            <td className="px-6 py-4 text-slate-700">{incomingSeg ? incomingSeg.dip : '-'}</td>
                            <td className="px-6 py-4 font-bold text-slate-900">{incomingSeg ? incomingSeg.distance + 'm' : '-'}</td>
                            
                            {/* Dims (Incoming) */}
                            <td className="px-6 py-4 border-l border-slate-100 text-slate-600">{incomingSeg ? incomingSeg.left : '-'}</td>
                            <td className="px-6 py-4 text-slate-600">{incomingSeg ? incomingSeg.right : '-'}</td>
                            <td className="px-6 py-4 text-slate-600">{incomingSeg ? incomingSeg.up : '-'}</td>
                            <td className="px-6 py-4 text-slate-600">{incomingSeg ? incomingSeg.down : '-'}</td>
                            
                            <td className="px-6 py-4 border-l border-slate-100 italic text-slate-400 max-w-[250px] truncate">
                              {st.notes}
                            </td>
                          </tr>

                          {/* Render Intermediate Points (Outgoing from this station) */}
                          {segmentIntermediates.map(ip => (
                            <tr key={`int-${ip.id}`} className="bg-slate-50/50 text-slate-500 italic">
                               <td className="px-6 py-3">
                                  <button onClick={() => editIntermediateParent(ip)} className="text-slate-400 hover:text-orange-600 p-2 rounded hover:bg-slate-200">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                               </td>
                               <td className="px-6 py-3 pl-10 flex items-center gap-2">
                                 <CornerDownRight className="w-4 h-4 opacity-50" />
                                 <span>+ {ip.distanceFromStart}m</span>
                               </td>
                               <td className="px-6 py-3">-</td>
                               <td className="px-6 py-3">-</td>
                               <td className="px-6 py-3">-</td>
                               {/* Vector Data (Outgoing) */}
                               <td className="px-6 py-3 border-l border-slate-100 opacity-50">{outgoingSeg?.azimuth}°</td>
                               <td className="px-6 py-3 opacity-50">{outgoingSeg?.dip}</td>
                               <td className="px-6 py-3 font-mono text-slate-400">{ip.distanceFromStart}</td>
                               {/* Dimensions */}
                               <td className="px-6 py-3 border-l border-slate-100 font-mono">{ip.left}</td>
                               <td className="px-6 py-3 font-mono">{ip.right}</td>
                               <td className="px-6 py-3 font-mono">{ip.up}</td>
                               <td className="px-6 py-3 font-mono">{ip.down}</td>
                               <td className="px-6 py-3 border-l border-slate-100 max-w-[200px] truncate text-slate-400">
                                 {ip.notes}
                               </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </>
              ) : (
                <>
                  <thead className="bg-amber-50 text-amber-900 border-b border-amber-100 uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4 w-10">Acciones</th>
                      <th className="px-6 py-4">Ref. Estación</th>
                      <th className="px-6 py-4">Dist. desde Ref.</th>
                      <th className="px-6 py-4">Tipo</th>
                      <th className="px-6 py-4">Rumbo (Strike)</th>
                      <th className="px-6 py-4">Buz. (Dip)</th>
                      <th className="px-6 py-4">Potencia</th>
                      <th className="px-6 py-4">Ubicación</th>
                      <th className="px-6 py-4">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {structures.length === 0 ? (
                       <tr><td colSpan={9} className="p-8 text-center text-slate-400 italic text-sm">No hay estructuras registradas</td></tr>
                    ) : (
                      structures.map((str, i) => {
                        const st = stations.find(s => s.id === str.stationId);
                        const locationMap: Record<string, string> = { left: 'Izq', right: 'Der', up: 'Techo', down: 'Piso' };
                        const locs = str.location?.map(l => locationMap[l]).join(', ') || '-';
                        return (
                          <tr key={str.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-6 py-4">
                                <button onClick={() => editStructureParent(str)} className="text-slate-400 hover:text-amber-600 p-2 rounded hover:bg-slate-200">
                                  <Pencil className="w-4 h-4" />
                                </button>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800 text-base">{st ? st.name : 'Desconocido'}</td>
                            <td className="px-6 py-4 font-mono text-slate-700">{str.distanceFromStart} m</td>
                            <td className="px-6 py-4">
                               <span className="uppercase font-bold text-amber-700 bg-amber-100 rounded px-2 py-0.5 text-xs tracking-wide">
                                {str.type}
                               </span>
                               {str.otherType && <span className="block mt-1 text-sm text-amber-900 font-medium">{str.otherType}</span>}
                            </td>
                            <td className="px-6 py-4 text-slate-700">{str.strike}°</td>
                            <td className="px-6 py-4 text-slate-700">{str.dip}</td>
                            <td className="px-6 py-4 text-slate-700">{str.aperture ? str.aperture + ' m' : '-'}</td>
                            <td className="px-6 py-4 text-slate-600 text-xs font-medium">{locs}</td>
                            <td className="px-6 py-4 italic text-slate-500 max-w-[250px] truncate">{str.notes}</td>
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
