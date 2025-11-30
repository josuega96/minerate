import React, { useState, useEffect } from 'react';
import { Project, Station, Segment, Structure, IntermediatePoint } from '../types';
import { ArrowRight, Save, X, Compass, Ruler, Calculator, AlertTriangle, Plus, Trash2, List, Layers } from 'lucide-react';
import { InputGroup } from './InputGroup';

interface FormsProps {
  type: 'station_origin' | 'advance';
  project: Project;
  baseStation?: Station; 
  onSaveStation: (station: Station, segment: Segment | null, intermediates?: IntermediatePoint[], structures?: Structure[]) => Promise<void>;
  onCancel: () => void;
}

const Forms: React.FC<FormsProps> = ({ type, project, baseStation, onSaveStation, onCancel }) => {
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
    dip: '0',
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
  const [tempStructure, setTempStructure] = useState<Partial<Structure>>({
    type: 'veta',
    strike: undefined,
    dip: undefined,
    aperture: undefined,
    distanceFromStart: undefined,
    notes: ''
  });

  // Auto-name next station
  useEffect(() => {
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
  }, [baseStation, type]);

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

  const handleAddStructure = () => {
    if (!baseStation) return;
    const newStructure: Structure = {
      projectId: project.id!,
      stationId: baseStation.id!, // Temporary, validated on save
      distanceFromStart: tempStructure.distanceFromStart || 0,
      type: tempStructure.type as any,
      strike: tempStructure.strike || 0,
      dip: tempStructure.dip || 0,
      aperture: tempStructure.aperture,
      notes: tempStructure.notes
    };

    setStructures([...structures, newStructure]);
    setTempStructure({ type: 'veta', strike: undefined, dip: undefined, aperture: undefined, distanceFromStart: undefined, notes: '' });
  };

  const removeStructure = (index: number) => {
    const newList = [...structures];
    newList.splice(index, 1);
    setStructures(newList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (type === 'station_origin') {
      const station: Station = {
        projectId: project.id!,
        name: originData.name,
        easting: parseFloat(originData.easting),
        northing: parseFloat(originData.northing),
        elevation: parseFloat(originData.elevation),
        isOrigin: true,
        notes: originData.notes,
        createdAt: Date.now()
      };
      await onSaveStation(station, null);
    } 
    else if (type === 'advance' && baseStation) {
      // CALCULATE COORDINATES
      const dist = parseFloat(advanceData.distance);
      const az = parseFloat(advanceData.azimuth);
      const dip = parseFloat(advanceData.dip);
      
      const radAz = az * (Math.PI / 180);
      const radDip = dip * (Math.PI / 180);

      const hDist = dist * Math.cos(radDip);
      const vDist = dist * Math.sin(radDip);

      const dE = hDist * Math.sin(radAz);
      const dN = hDist * Math.cos(radAz);

      const newStation: Station = {
        projectId: project.id!,
        name: advanceData.nextName,
        easting: baseStation.easting + dE,
        northing: baseStation.northing + dN,
        elevation: baseStation.elevation + vDist,
        isOrigin: false,
        notes: advanceData.notes,
        createdAt: Date.now()
      };

      const newSegment: Segment = {
        projectId: project.id!,
        fromStationId: baseStation.id!,
        toStationId: 0, // Placeholder, filled by DB helper
        azimuth: az,
        dip: dip,
        distance: dist,
        left: parseFloat(advanceData.left),
        right: parseFloat(advanceData.right),
        up: parseFloat(advanceData.up),
        down: parseFloat(advanceData.down)
      };

      await onSaveStation(newStation, newSegment, intermediates, structures);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
        <h2 className="font-bold text-lg text-stone-800">
          {type === 'station_origin' && "Definir Punto de Inicio"}
          {type === 'advance' && "Registrar Avance"}
        </h2>
        <button onClick={onCancel} className="bg-stone-200 p-2 rounded-full hover:bg-stone-300">
          <X className="w-5 h-5 text-stone-600" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 pb-32">
        
        {/* ORIGIN FORM */}
        {type === 'station_origin' && (
          <div className="space-y-4">
            <InputGroup label="Nombre Estación" name="name" value={originData.name} onChange={e => setOriginData({...originData, name: e.target.value})} required />
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Este (X)" name="easting" type="number" step="0.001" value={originData.easting} onChange={e => setOriginData({...originData, easting: e.target.value})} required />
              <InputGroup label="Norte (Y)" name="northing" type="number" step="0.001" value={originData.northing} onChange={e => setOriginData({...originData, northing: e.target.value})} required />
              <InputGroup label="Cota (Z)" name="elevation" type="number" step="0.001" value={originData.elevation} onChange={e => setOriginData({...originData, elevation: e.target.value})} required />
            </div>
            <div className="pt-2">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Notas</label>
              <textarea className="w-full border border-stone-300 rounded-lg p-3 focus:ring-emerald-500 focus:border-emerald-500" rows={3} value={originData.notes} onChange={e => setOriginData({...originData, notes: e.target.value})} />
            </div>
          </div>
        )}

        {/* ADVANCE FORM */}
        {type === 'advance' && baseStation && (
          <div className="space-y-6">
            {/* Header: From -> To */}
            <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="text-center">
                <div className="text-xs text-emerald-500 font-bold uppercase">Desde</div>
                <div className="font-bold text-xl text-emerald-700">{baseStation.name}</div>
              </div>
              <ArrowRight className="text-emerald-300" />
              <div className="flex-1">
                <label className="block text-xs text-emerald-500 font-bold uppercase mb-1">Hacia (Nuevo)</label>
                <input 
                  className="w-full bg-white border border-emerald-200 rounded-lg px-2 py-1 font-bold text-lg text-emerald-700 focus:ring-emerald-500 focus:border-emerald-500"
                  value={advanceData.nextName}
                  onChange={e => setAdvanceData({...advanceData, nextName: e.target.value})}
                  required
                />
              </div>
            </div>

            {/* Section 1: Compass Readings */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide flex items-center gap-2 border-b border-stone-100 pb-2">
                <Compass className="w-4 h-4" /> Lecturas Brújula
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <InputGroup label="Azimut / Rumbo" name="azimuth" type="number" value={advanceData.azimuth} onChange={e => setAdvanceData({...advanceData, azimuth: e.target.value})} required placeholder="0-360°" />
                </div>
                <div className="col-span-1">
                  <InputGroup label="Buzamiento" name="dip" type="number" value={advanceData.dip} onChange={e => setAdvanceData({...advanceData, dip: e.target.value})} required placeholder="+/- Grados" />
                </div>
              </div>
            </div>

            {/* Section 2: Intermediate Points */}
            <div className="space-y-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
              <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide flex items-center gap-2">
                <List className="w-4 h-4" /> Puntos Intermedios
              </h3>
              <p className="text-xs text-stone-500">Agrega detalles de paredes o radiaciones.</p>

              {/* Input for new intermediate */}
              <div className="flex flex-col gap-3">
                 <div className="grid grid-cols-5 gap-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Dist.</label>
                      <input 
                        type="number" step="0.1" 
                        className="w-full p-2 border border-stone-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" 
                        value={tempIntermediate.dist} 
                        onChange={e => setTempIntermediate({...tempIntermediate, dist: e.target.value})} 
                        placeholder="m" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Izq</label>
                      <input 
                        type="number" step="0.1" 
                        className="w-full p-2 border border-stone-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" 
                        value={tempIntermediate.left} 
                        onChange={e => setTempIntermediate({...tempIntermediate, left: e.target.value})} 
                        placeholder="L" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Der</label>
                      <input 
                        type="number" step="0.1" 
                        className="w-full p-2 border border-stone-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" 
                        value={tempIntermediate.right} 
                        onChange={e => setTempIntermediate({...tempIntermediate, right: e.target.value})} 
                        placeholder="R" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Techo</label>
                      <input 
                        type="number" step="0.1" 
                        className="w-full p-2 border border-stone-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" 
                        value={tempIntermediate.up} 
                        onChange={e => setTempIntermediate({...tempIntermediate, up: e.target.value})} 
                        placeholder="T" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Piso</label>
                      <input 
                        type="number" step="0.1" 
                        className="w-full p-2 border border-stone-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" 
                        value={tempIntermediate.down} 
                        onChange={e => setTempIntermediate({...tempIntermediate, down: e.target.value})} 
                        placeholder="P" 
                      />
                    </div>
                 </div>
                 
                 <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 p-2 border border-stone-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Descripción / Nota..."
                      value={tempIntermediate.notes}
                      onChange={e => setTempIntermediate({...tempIntermediate, notes: e.target.value})}
                    />
                    <button 
                      type="button" 
                      onClick={handleAddIntermediate}
                      disabled={!tempIntermediate.dist}
                      className="bg-stone-800 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-stone-900 flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4"/> Agregar
                    </button>
                 </div>
              </div>

              {/* List of intermediates */}
              {intermediates.length > 0 && (
                <div className="mt-2 bg-white rounded-lg border border-stone-200 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-100 text-stone-500 font-semibold">
                      <tr>
                        <th className="p-2">Dist.</th>
                        <th className="p-2">Dimensiones</th>
                        <th className="p-2">Nota</th>
                        <th className="p-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {intermediates.map((pt, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-bold text-stone-700">{pt.distanceFromStart}m</td>
                          <td className="p-2 text-stone-600">
                            <div className="flex gap-2">
                               <span>L:{pt.left} R:{pt.right}</span>
                               <span className="text-stone-400">|</span>
                               <span>T:{pt.up} P:{pt.down}</span>
                            </div>
                          </td>
                          <td className="p-2 text-stone-500 italic truncate max-w-[80px]">{pt.notes}</td>
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
            <div className="space-y-4 bg-amber-50 p-4 rounded-xl border border-amber-200">
              <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide flex items-center gap-2">
                <Layers className="w-4 h-4" /> Estructuras Geológicas
              </h3>
              
              <div className="space-y-3">
                 <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                       <select 
                        className="w-full bg-white border border-amber-200 rounded-lg p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                        value={tempStructure.type}
                        onChange={e => setTempStructure({...tempStructure, type: e.target.value as any})}
                      >
                        <option value="veta">Veta</option>
                        <option value="falla">Falla</option>
                        <option value="fractura">Fractura</option>
                        <option value="estrato">Estrato</option>
                        <option value="contacto">Contacto</option>
                      </select>
                    </div>
                    <div>
                      <input type="number" className="w-full p-2 border border-amber-200 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500" placeholder="Rumbo" value={tempStructure.strike === undefined ? '' : tempStructure.strike} onChange={e => setTempStructure({...tempStructure, strike: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      <input type="number" className="w-full p-2 border border-amber-200 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500" placeholder="Buzamiento" value={tempStructure.dip === undefined ? '' : tempStructure.dip} onChange={e => setTempStructure({...tempStructure, dip: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      <input type="number" className="w-full p-2 border border-amber-200 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500" placeholder="Distancia (m)" value={tempStructure.distanceFromStart === undefined ? '' : tempStructure.distanceFromStart} onChange={e => setTempStructure({...tempStructure, distanceFromStart: parseFloat(e.target.value)})} />
                    </div>
                     <div>
                      <input type="number" className="w-full p-2 border border-amber-200 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500" placeholder="Potencia (m)" value={tempStructure.aperture === undefined ? '' : tempStructure.aperture} onChange={e => setTempStructure({...tempStructure, aperture: parseFloat(e.target.value)})} />
                    </div>
                    <div className="col-span-2">
                       <input 
                        type="text" 
                        className="w-full p-2 border border-amber-200 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500" 
                        placeholder="Notas / Observaciones de la estructura..." 
                        value={tempStructure.notes || ''} 
                        onChange={e => setTempStructure({...tempStructure, notes: e.target.value})} 
                      />
                    </div>
                 </div>
                 <button 
                    type="button" 
                    onClick={handleAddStructure}
                    className="w-full bg-amber-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-amber-700"
                   >
                     + Agregar Estructura
                   </button>
              </div>

               {structures.length > 0 && (
                <div className="mt-2 bg-white rounded-lg border border-amber-100 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-amber-50 text-amber-700 font-semibold">
                      <tr>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Datos</th>
                        <th className="p-2">Nota</th>
                        <th className="p-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-50">
                      {structures.map((st, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-bold uppercase text-xs text-amber-900">
                            {st.type}
                            <div className="text-[10px] font-normal text-amber-700">Dist: {st.distanceFromStart}m</div>
                          </td>
                          <td className="p-2 text-amber-900">
                            <div>R: {st.strike}° / B: {st.dip}°</div>
                            {st.aperture && <div className="text-[10px] text-amber-700">Pot: {st.aperture}m</div>}
                          </td>
                          <td className="p-2 text-amber-700 italic truncate max-w-[100px]">{st.notes}</td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={() => removeStructure(idx)} className="text-amber-500 hover:bg-amber-100 p-1 rounded">
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

            {/* Section 4: Final Profile */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide flex items-center gap-2 border-b border-stone-100 pb-2">
                <Ruler className="w-4 h-4" /> Perfil Final (Estación {advanceData.nextName})
              </h3>
              
              <div className="mb-2">
                 <InputGroup label="Distancia Inclinada (m)" name="distance" type="number" step="0.01" value={advanceData.distance} onChange={e => setAdvanceData({...advanceData, distance: e.target.value})} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Izq (m)" name="left" type="number" step="0.01" value={advanceData.left} onChange={e => setAdvanceData({...advanceData, left: e.target.value})} />
                <InputGroup label="Der (m)" name="right" type="number" step="0.01" value={advanceData.right} onChange={e => setAdvanceData({...advanceData, right: e.target.value})} />
                <InputGroup label="Techo (m)" name="up" type="number" step="0.01" value={advanceData.up} onChange={e => setAdvanceData({...advanceData, up: e.target.value})} />
                <InputGroup label="Piso (m)" name="down" type="number" step="0.01" value={advanceData.down} onChange={e => setAdvanceData({...advanceData, down: e.target.value})} />
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Footer Actions */}
      <div className="p-4 border-t border-stone-200 bg-white absolute bottom-0 w-full z-10">
        <button 
          onClick={handleSubmit}
          className="w-full bg-emerald-700 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 active:bg-emerald-800 shadow-lg shadow-emerald-100 hover:bg-emerald-800"
        >
          <Save className="w-5 h-5" /> Guardar Datos
        </button>
      </div>
    </div>
  );
};

export default Forms;