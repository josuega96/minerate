
import React, { useState, useEffect } from 'react';
import { Project, Station, Segment, Structure, IntermediatePoint } from '../types';
import { ArrowRight, Save, X, Compass, Ruler, Calculator, AlertTriangle, Plus, Trash2, List, Layers, Pencil, BoxSelect } from 'lucide-react';
import { InputGroup } from './InputGroup';

interface FormsProps {
  type: 'station_origin' | 'advance';
  project: Project;
  baseStation?: Station; 
  initialData?: {
    station: Station;
    segment?: Segment;
    intermediates: IntermediatePoint[];
    structures: Structure[];
    baseStation?: Station;
  };
  onSaveStation: (station: Station, segment: Segment | null, intermediates?: IntermediatePoint[], structures?: Structure[]) => Promise<void>;
  onUpdateStation?: (stationId: number, station: Partial<Station>, segmentId: number | undefined, segment: Partial<Segment> | null, intermediates: IntermediatePoint[], structures: Structure[]) => Promise<void>;
  onCancel: () => void;
}

const Forms: React.FC<FormsProps> = ({ type, project, baseStation, initialData, onSaveStation, onUpdateStation, onCancel }) => {
  const isEditing = !!initialData;

  // --- STATE FOR ORIGIN ---
  const [originData, setOriginData] = useState({
    name: 'E-1',
    easting: '',
    northing: '',
    elevation: '',
    notes: ''
  });

  // --- STATE FOR ADVANCE ---
  const [advanceData, setAdvanceData] = useState({
    nextName: '', // Auto-calculated usually
    azimuth: '',
    dip: '0', // Stored as string to allow "45 NE" or "+5"
    distance: '',
    left: '1.5',
    right: '1.5',
    up: '2.0',
    down: '0',
    notes: ''
  });

  // --- STATE FOR INTERMEDIATE POINTS (Inside Advance) ---
  const [intermediates, setIntermediates] = useState<IntermediatePoint[]>([]);
  const [tempIntermediate, setTempIntermediate] = useState({
    dist: '',
    left: '',
    right: '',
    up: '',
    down: '',
    notes: ''
  });

  // --- STATE FOR STRUCTURES (Inside Advance) ---
  const [structures, setStructures] = useState<Structure[]>([]);
  
  // Split Dip State for UI
  const [structDipAngle, setStructDipAngle] = useState('');
  const [structDipDir, setStructDipDir] = useState('NE');
  // Location State for UI
  const [structLocation, setStructLocation] = useState<string[]>([]);

  const [tempStructure, setTempStructure] = useState<Partial<Structure>>({
    type: 'veta',
    otherType: '',
    strike: undefined,
    aperture: undefined,
    distanceFromStart: undefined,
    notes: ''
  });

  // Initialize Data for Editing
  useEffect(() => {
    if (initialData) {
      if (type === 'station_origin') {
        setOriginData({
          name: initialData.station.name,
          easting: initialData.station.easting.toString(),
          northing: initialData.station.northing.toString(),
          elevation: initialData.station.elevation.toString(),
          notes: initialData.station.notes || ''
        });
      } else if (type === 'advance' && initialData.segment) {
        setAdvanceData({
          nextName: initialData.station.name,
          azimuth: initialData.segment.azimuth.toString(),
          dip: initialData.segment.dip.toString(),
          distance: initialData.segment.distance.toString(),
          left: initialData.segment.left.toString(),
          right: initialData.segment.right.toString(),
          up: (initialData.segment.up || 0).toString(),
          down: (initialData.segment.down || 0).toString(),
          notes: initialData.station.notes || ''
        });
        setIntermediates(initialData.intermediates);
        setStructures(initialData.structures);
      }
    } else {
      // Auto-name next station only if NOT editing
      if (baseStation && type === 'advance') {
        const match = baseStation.name.match(/(\d+)$/);
        if (match) {
          const nextNum = parseInt(match[1]) + 1;
          const prefix = baseStation.name.replace(/\d+$/, '');
          setAdvanceData(prev => ({ ...prev, nextName: `${prefix}${nextNum}` }));
        } else {
          setAdvanceData(prev => ({ ...prev, nextName: `${baseStation.name}-Sig` }));
        }
      }
    }
  }, [baseStation, type, initialData]);

  const handleAddIntermediate = () => {
    if (!tempIntermediate.dist) return;
    const newPoint: IntermediatePoint = {
      projectId: project.id!,
      distanceFromStart: parseFloat(tempIntermediate.dist),
      left: parseFloat(tempIntermediate.left) || 0,
      right: parseFloat(tempIntermediate.right) || 0,
      up: parseFloat(tempIntermediate.up) || 0,
      down: parseFloat(tempIntermediate.down) || 0,
      notes: tempIntermediate.notes
    };
    
    setIntermediates([...intermediates, newPoint].sort((a,b) => a.distanceFromStart - b.distanceFromStart));
    setTempIntermediate({ dist: '', left: '', right: '', up: '', down: '', notes: '' });
  };

  const removeIntermediate = (index: number) => {
    const newList = [...intermediates];
    newList.splice(index, 1);
    setIntermediates(newList);
  };

  const toggleStructLocation = (loc: string) => {
    if (structLocation.includes(loc)) {
      setStructLocation(structLocation.filter(l => l !== loc));
    } else {
      setStructLocation([...structLocation, loc]);
    }
  };

  const handleAddStructure = () => {
    // In edit mode, we use the original baseStation logic or the initialData context, 
    // but the ID link is handled in DB update.
    if (!baseStation && !isEditing) return;

    // Combine Angle and Direction
    const combinedDip = structDipAngle ? `${structDipAngle}° ${structDipDir}` : '';

    const newStructure: Structure = {
      projectId: project.id!,
      stationId: 0, // Placeholder, resolved in DB
      distanceFromStart: tempStructure.distanceFromStart || 0,
      type: tempStructure.type as any,
      otherType: tempStructure.otherType,
      strike: tempStructure.strike || 0,
      dip: combinedDip, 
      location: structLocation,
      aperture: tempStructure.aperture,
      notes: tempStructure.notes
    };

    setStructures([...structures, newStructure]);
    setTempStructure({ type: 'veta', otherType: '', strike: undefined, aperture: undefined, distanceFromStart: undefined, notes: '' });
    setStructDipAngle('');
    setStructDipDir('NE');
    setStructLocation([]);
  };

  const removeStructure = (index: number) => {
    const newList = [...structures];
    newList.splice(index, 1);
    setStructures(newList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (type === 'station_origin') {
      const stationData: Partial<Station> = {
        projectId: project.id!,
        name: originData.name,
        easting: parseFloat(originData.easting),
        northing: parseFloat(originData.northing),
        elevation: parseFloat(originData.elevation),
        isOrigin: true,
        notes: originData.notes
      };

      if (isEditing && onUpdateStation && initialData) {
        await onUpdateStation(initialData.station.id!, stationData, undefined, null, [], []);
      } else {
        await onSaveStation(stationData as Station, null);
      }
    } 
    else if (type === 'advance' && (baseStation || isEditing)) {
      // CALCULATE COORDINATES
      const sourceStation = isEditing && initialData?.baseStation ? initialData.baseStation : baseStation;

      if (!sourceStation) {
        alert("Error: No se encontró la estación base para el cálculo.");
        return; 
      }

      const dist = parseFloat(advanceData.distance);
      const az = parseFloat(advanceData.azimuth);
      const dipNumeric = parseFloat(advanceData.dip) || 0;
      
      const radAz = az * (Math.PI / 180);
      const radDip = dipNumeric * (Math.PI / 180);

      const hDist = dist * Math.cos(radDip);
      const vDist = dist * Math.sin(radDip);

      const dE = hDist * Math.sin(radAz);
      const dN = hDist * Math.cos(radAz);

      const stationData: Partial<Station> = {
        projectId: project.id!,
        name: advanceData.nextName,
        easting: sourceStation.easting + dE,
        northing: sourceStation.northing + dN,
        elevation: sourceStation.elevation + vDist,
        isOrigin: false,
        notes: advanceData.notes
      };

      const segmentData: Partial<Segment> = {
        projectId: project.id!,
        fromStationId: sourceStation.id!,
        azimuth: az,
        dip: advanceData.dip,
        distance: dist,
        left: parseFloat(advanceData.left),
        right: parseFloat(advanceData.right),
        up: parseFloat(advanceData.up),
        down: parseFloat(advanceData.down)
      };

      if (isEditing && onUpdateStation && initialData) {
        await onUpdateStation(
            initialData.station.id!, 
            stationData, 
            initialData.segment?.id, 
            segmentData, 
            intermediates, 
            structures
        );
      } else {
        await onSaveStation(stationData as Station, segmentData as Segment, intermediates, structures);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className={`p-4 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm z-10`}>
        <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          {isEditing && <Pencil className="w-5 h-5 text-orange-600" />}
          {type === 'station_origin' && (isEditing ? "Editar Punto de Inicio" : "Definir Punto de Inicio")}
          {type === 'advance' && (isEditing ? "Editar Registro de Avance" : "Registrar Avance")}
        </h2>
        <button onClick={onCancel} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200">
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 pb-32">
        
        {/* ORIGIN FORM */}
        {type === 'station_origin' && (
          <div className="space-y-4">
            <InputGroup label="Nombre Estación" name="name" value={originData.name} onChange={e => setOriginData({...originData, name: e.target.value})} required />
            <div className="grid grid-cols-2 gap-4">
              {/* Changed step to "any" for all coordinate inputs */}
              <InputGroup label="Este (X)" name="easting" type="number" step="any" value={originData.easting} onChange={e => setOriginData({...originData, easting: e.target.value})} required />
              <InputGroup label="Norte (Y)" name="northing" type="number" step="any" value={originData.northing} onChange={e => setOriginData({...originData, northing: e.target.value})} required />
              <InputGroup label="Cota (Z)" name="elevation" type="number" step="any" value={originData.elevation} onChange={e => setOriginData({...originData, elevation: e.target.value})} required />
            </div>
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notas</label>
              <textarea 
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 font-medium focus:ring-orange-500 focus:border-orange-500" 
                rows={3} 
                value={originData.notes} 
                onChange={e => setOriginData({...originData, notes: e.target.value})} 
              />
            </div>
          </div>
        )}

        {/* ADVANCE FORM */}
        {type === 'advance' && (
          <div className="space-y-6">
            {/* Header: From -> To */}
            <div className={`flex items-center gap-4 p-4 rounded-xl border bg-white ${isEditing ? 'border-orange-200' : 'border-slate-200'}`}>
              <div className="text-center">
                <div className={`text-xs font-bold uppercase text-slate-400`}>Desde</div>
                <div className={`font-black text-xl text-slate-700`}>
                  {isEditing && initialData?.baseStation ? initialData.baseStation.name : baseStation?.name}
                </div>
              </div>
              <ArrowRight className="text-slate-300" />
              <div className="flex-1">
                <label className={`block text-xs font-bold uppercase mb-1 text-orange-600`}>Hacia (Destino)</label>
                <input 
                  className={`w-full bg-white border rounded-lg px-2 py-1 font-bold text-lg focus:ring-2 border-orange-200 text-orange-700 focus:ring-orange-500 focus:border-orange-500`}
                  value={advanceData.nextName}
                  onChange={e => setAdvanceData({...advanceData, nextName: e.target.value})}
                  required
                />
              </div>
            </div>

            {/* Section 1: Compass Readings */}
            <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Compass className="w-4 h-4 text-slate-500" /> Lecturas Brújula
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <InputGroup label="Azimut / Rumbo" name="azimuth" type="number" step="any" value={advanceData.azimuth} onChange={e => setAdvanceData({...advanceData, azimuth: e.target.value})} required placeholder="0-360°" />
                </div>
                <div className="col-span-1">
                  <InputGroup label="∠ Vertical" name="dip" type="text" value={advanceData.dip} onChange={e => setAdvanceData({...advanceData, dip: e.target.value})} required placeholder="Ej: +1, -1, 45 NE" />
                </div>
              </div>
            </div>

            {/* Section 2: Intermediate Points */}
            <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <List className="w-4 h-4 text-slate-500" /> Puntos Intermedios
              </h3>
              <p className="text-xs text-slate-500">Agrega detalles de paredes o radiaciones.</p>

              {/* Input for new intermediate */}
              <div className="flex flex-col gap-3">
                 <div className="grid grid-cols-5 gap-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Dist.</label>
                      <input 
                        type="number" step="any" 
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500" 
                        value={tempIntermediate.dist} 
                        onChange={e => setTempIntermediate({...tempIntermediate, dist: e.target.value})} 
                        placeholder="m" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Izq</label>
                      <input 
                        type="number" step="any" 
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500" 
                        value={tempIntermediate.left} 
                        onChange={e => setTempIntermediate({...tempIntermediate, left: e.target.value})} 
                        placeholder="L" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Der</label>
                      <input 
                        type="number" step="any" 
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500" 
                        value={tempIntermediate.right} 
                        onChange={e => setTempIntermediate({...tempIntermediate, right: e.target.value})} 
                        placeholder="R" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Techo</label>
                      <input 
                        type="number" step="any" 
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500" 
                        value={tempIntermediate.up} 
                        onChange={e => setTempIntermediate({...tempIntermediate, up: e.target.value})} 
                        placeholder="T" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Piso</label>
                      <input 
                        type="number" step="any" 
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500" 
                        value={tempIntermediate.down} 
                        onChange={e => setTempIntermediate({...tempIntermediate, down: e.target.value})} 
                        placeholder="P" 
                      />
                    </div>
                 </div>
                 
                 <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Descripción / Nota..."
                      value={tempIntermediate.notes}
                      onChange={e => setTempIntermediate({...tempIntermediate, notes: e.target.value})}
                    />
                    <button 
                      type="button" 
                      onClick={handleAddIntermediate}
                      disabled={!tempIntermediate.dist}
                      className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-900 flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4"/> Agregar
                    </button>
                 </div>
              </div>

              {/* List of intermediates */}
              {intermediates.length > 0 && (
                <div className="mt-2 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-500 font-semibold">
                      <tr>
                        <th className="p-2">Dist.</th>
                        <th className="p-2">Dimensiones</th>
                        <th className="p-2">Nota</th>
                        <th className="p-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {intermediates.map((pt, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-bold text-slate-700">{pt.distanceFromStart}m</td>
                          <td className="p-2 text-slate-600">
                            <div className="flex gap-2">
                               <span>L:{pt.left} R:{pt.right}</span>
                               <span className="text-slate-400">|</span>
                               <span>T:{pt.up} P:{pt.down}</span>
                            </div>
                          </td>
                          <td className="p-2 text-slate-500 italic truncate max-w-[80px]">{pt.notes}</td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={() => removeIntermediate(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 3: Structures (NEW) */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-300 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Layers className="w-4 h-4" /> Estructuras Geológicas
              </h3>
              
              <div className="space-y-3">
                 <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                       <select 
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500"
                        value={tempStructure.type}
                        onChange={e => setTempStructure({...tempStructure, type: e.target.value as any})}
                      >
                        <option value="veta">Veta</option>
                        <option value="falla">Falla</option>
                        <option value="fractura">Fractura</option>
                        <option value="estrato">Estrato</option>
                        <option value="contacto">Contacto</option>
                        <option value="otros">Otros</option>
                      </select>
                    </div>

                    {/* Input for Structure Name - NOW AVAILABLE FOR ALL TYPES */}
                    <div className="col-span-2 animate-in fade-in slide-in-from-top-1">
                      <input
                        type="text"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500 placeholder-slate-400"
                        placeholder="Nombre / Detalle (Ej. Falla Principal)"
                        value={tempStructure.otherType || ''}
                        onChange={e => setTempStructure({...tempStructure, otherType: e.target.value})}
                      />
                    </div>

                    <div>
                      <input type="number" step="any" className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500" placeholder="Rumbo" value={tempStructure.strike === undefined ? '' : tempStructure.strike} onChange={e => setTempStructure({...tempStructure, strike: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      {/* Split Dip Input: Angle + Direction */}
                      <div className="flex gap-1 h-full">
                         <input 
                           type="number"
                           step="any"
                           className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500 min-w-0" 
                           placeholder="Buz" 
                           value={structDipAngle} 
                           onChange={e => setStructDipAngle(e.target.value)} 
                         />
                         <select 
                           className="w-16 p-0 px-1 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500"
                           value={structDipDir}
                           onChange={e => setStructDipDir(e.target.value)}
                         >
                           <option value="NE">NE</option>
                           <option value="SE">SE</option>
                           <option value="SW">SW</option>
                           <option value="NW">NW</option>
                         </select>
                      </div>
                    </div>
                    <div>
                      <input type="number" step="any" className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500" placeholder="Distancia (m)" value={tempStructure.distanceFromStart === undefined ? '' : tempStructure.distanceFromStart} onChange={e => setTempStructure({...tempStructure, distanceFromStart: parseFloat(e.target.value)})} />
                    </div>
                     <div>
                      <input type="number" step="any" className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-bold focus:ring-orange-500 focus:border-orange-500" placeholder="Potencia (m)" value={tempStructure.aperture === undefined ? '' : tempStructure.aperture} onChange={e => setTempStructure({...tempStructure, aperture: parseFloat(e.target.value)})} />
                    </div>

                    {/* New Location Selector */}
                    <div className="col-span-2 flex flex-wrap gap-2 py-1">
                      {['left', 'right', 'up', 'down'].map((loc) => {
                         const isActive = structLocation.includes(loc);
                         const labels: Record<string, string> = { left: 'Izq', right: 'Der', up: 'Techo', down: 'Piso' };
                         return (
                           <button
                             key={loc}
                             type="button"
                             onClick={() => toggleStructLocation(loc)}
                             className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                               isActive 
                                ? 'bg-orange-600 text-white border-orange-600' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                             }`}
                           >
                             {labels[loc]}
                           </button>
                         )
                      })}
                    </div>

                    <div className="col-span-2">
                       <input 
                        type="text" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:ring-orange-500 focus:border-orange-500" 
                        placeholder="Notas / Observaciones de la estructura..." 
                        value={tempStructure.notes || ''} 
                        onChange={e => setTempStructure({...tempStructure, notes: e.target.value})} 
                      />
                    </div>
                 </div>
                 <button 
                    type="button" 
                    onClick={handleAddStructure}
                    className="w-full bg-slate-900 text-white p-3 rounded-lg text-xs font-bold hover:bg-slate-800 shadow-sm"
                   >
                     + Agregar Estructura
                   </button>
              </div>

               {structures.length > 0 && (
                <div className="mt-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold">
                      <tr>
                        <th className="p-2">Tipo/Ubic</th>
                        <th className="p-2">Datos</th>
                        <th className="p-2">Nota</th>
                        <th className="p-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {structures.map((st, idx) => {
                        const locLabels: Record<string, string> = { left: 'I', right: 'D', up: 'T', down: 'P' };
                        const locString = st.location?.map(l => locLabels[l]).join(',') || '-';
                        return (
                        <tr key={idx}>
                          <td className="p-2 font-bold uppercase text-xs text-slate-800">
                            <div>{st.type}</div>
                            {st.otherType && <div className="text-[10px] normal-case font-bold text-slate-500">{st.otherType}</div>}
                            <div className="text-[10px] font-normal text-slate-500 flex gap-1 mt-0.5">
                              <span>Dist: {st.distanceFromStart}m</span>
                              {st.location && st.location.length > 0 && (
                                <span className="bg-slate-200 px-1 rounded text-slate-700 font-bold">{locString}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-slate-800">
                            <div>R: {st.strike}° / B: {st.dip}</div>
                            {st.aperture && <div className="text-[10px] text-slate-500">Pot: {st.aperture}m</div>}
                          </td>
                          <td className="p-2 text-slate-600 italic truncate max-w-[100px]">{st.notes}</td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={() => removeStructure(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 4: Final Profile */}
            <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Ruler className="w-4 h-4 text-slate-500" /> Perfil Final (Estación {advanceData.nextName})
              </h3>
              
              <div className="mb-2">
                 <InputGroup label="Distancia Inclinada (m)" name="distance" type="number" step="any" value={advanceData.distance} onChange={e => setAdvanceData({...advanceData, distance: e.target.value})} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Izq (m)" name="left" type="number" step="any" value={advanceData.left} onChange={e => setAdvanceData({...advanceData, left: e.target.value})} />
                <InputGroup label="Der (m)" name="right" type="number" step="any" value={advanceData.right} onChange={e => setAdvanceData({...advanceData, right: e.target.value})} />
                <InputGroup label="Techo (m)" name="up" type="number" step="any" value={advanceData.up} onChange={e => setAdvanceData({...advanceData, up: e.target.value})} />
                <InputGroup label="Piso (m)" name="down" type="number" step="any" value={advanceData.down} onChange={e => setAdvanceData({...advanceData, down: e.target.value})} />
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-200 bg-white absolute bottom-0 w-full z-10 safe-area-bottom shadow-lg">
        <button 
          onClick={handleSubmit}
          className={`w-full text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-colors ${isEditing ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'}`}
        >
          {isEditing ? <><Save className="w-5 h-5" /> Actualizar Datos</> : <><Save className="w-5 h-5" /> Guardar Datos</>}
        </button>
      </div>
    </div>
  );
};

export default Forms;
