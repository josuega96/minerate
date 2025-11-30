import React, { useState, useRef, useEffect } from 'react';
import { Camera, Save, RefreshCw, Wand2, Trash2, ArrowRight, Check, MapPin, Footprints, ChevronLeft, ChevronRight, History, Calculator } from 'lucide-react';
import { GeoPoint } from '../types';
import { InputGroup } from './InputGroup';
import { enhanceObservations } from '../services/geminiService';

interface PointFormProps {
  onSave: (point: GeoPoint) => Promise<void>;
  onExit: () => void;
  existingPoints: GeoPoint[];
}

// Helper to increment IDs ending in numbers (e.g. "P-1" -> "P-2")
const incrementId = (id: string): string => {
  if (!id) return '';
  const match = id.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const number = parseInt(match[2], 10);
    return `${prefix}${number + 1}`;
  }
  return id;
};

// Helper: Convert degrees to radians
const toRadians = (deg: number) => deg * (Math.PI / 180);

const PointForm: React.FC<PointFormProps> = ({ onSave, onExit, existingPoints }) => {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Default to true for continuous workflow
  const [continuousMode, setContinuousMode] = useState(true);
  const [showSuccessToast, setShowSuccessToast] = useState<{message: string} | null>(null);

  // History Navigation State
  // -1 means we are editing the NEW point. 
  // 0 means looking at the most recent saved point, 1 is the one before that, etc.
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  // State for form fields (The "Current" Draft)
  const [formData, setFormData] = useState<Partial<GeoPoint>>({
    pointId: 'P-1', // Default start
    easting: undefined,
    northing: undefined,
    elevation: undefined,
    nextPointId: 'P-2', // Default next
    horizontalAngle: undefined,
    verticalAngle: undefined,
    slantDistance: undefined,
    intermediatePointId: '',
    distanceLeft: undefined,
    distanceRight: undefined,
    observations: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Refs for auto-focus management
  const eastingRef = useRef<HTMLInputElement>(null);
  const angleRef = useRef<HTMLInputElement>(null);

  // Determine what data to display (History vs Current Draft)
  const isHistoryMode = historyIndex >= 0;
  
  const displayData = isHistoryMode 
    ? existingPoints[historyIndex] 
    : formData;

  const displayPhoto = isHistoryMode 
    ? displayData.photoDataUrl 
    : photoPreview;

  // Navigation Logic
  const handlePrevPoint = () => {
    if (historyIndex < existingPoints.length - 1) {
      setHistoryIndex(prev => prev + 1);
    }
  };

  const handleNextPoint = () => {
    if (historyIndex > -1) {
      setHistoryIndex(prev => prev - 1);
    }
  };

  const handleReturnToCurrent = () => {
    setHistoryIndex(-1);
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isHistoryMode) return; // Prevent editing history
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value
    }));
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isHistoryMode) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiEnhance = async () => {
    if (isHistoryMode) return;
    if (!formData.observations) return;
    setAiLoading(true);
    const enhanced = await enhanceObservations(formData.observations);
    setFormData(prev => ({ ...prev, observations: enhanced }));
    setAiLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isHistoryMode) return;

    if (!formData.pointId || formData.easting === undefined || formData.northing === undefined || formData.elevation === undefined) {
      alert("Faltan datos obligatorios del Punto Principal (Estación).");
      return;
    }

    setLoading(true);
    
    const newPoint: GeoPoint = {
      timestamp: Date.now(),
      pointId: formData.pointId!,
      easting: formData.easting!,
      northing: formData.northing!,
      elevation: formData.elevation!,
      nextPointId: formData.nextPointId,
      horizontalAngle: formData.horizontalAngle,
      verticalAngle: formData.verticalAngle,
      slantDistance: formData.slantDistance,
      intermediatePointId: formData.intermediatePointId,
      distanceLeft: formData.distanceLeft,
      distanceRight: formData.distanceRight,
      observations: formData.observations || '',
      photoDataUrl: photoPreview || undefined
    };

    try {
      await onSave(newPoint);
      
      if (continuousMode) {
        // Smart Workflow Logic
        
        if (formData.nextPointId) {
          // TRAVERSE logic (Change Station)
          const oldNext = formData.nextPointId;
          const predictedNext = incrementId(oldNext);
          
          // --- AUTOMATIC COORDINATE CALCULATION ---
          // Assuming:
          // 1. Horizontal Angle = Azimuth
          // 2. Vertical Angle = Zenith (0 is Up, 90 is Horizon)
          
          let newEasting: number | undefined = undefined;
          let newNorthing: number | undefined = undefined;
          let newElevation: number | undefined = undefined;
          let calcMsg = "";

          if (formData.easting !== undefined && 
              formData.northing !== undefined && 
              formData.elevation !== undefined && 
              formData.horizontalAngle !== undefined && 
              formData.slantDistance !== undefined) {
            
            const currentE = formData.easting;
            const currentN = formData.northing;
            const currentZ = formData.elevation;
            
            const azRad = toRadians(formData.horizontalAngle);
            // If user enters nothing for vertical, assume 90 (flat). If they enter, use it.
            const vAng = formData.verticalAngle !== undefined ? formData.verticalAngle : 90;
            const vRad = toRadians(vAng);
            const sDist = formData.slantDistance;

            // Formulas (Zenith Angle)
            // H_Dist = S_Dist * sin(V_Ang)
            // V_Dist = S_Dist * cos(V_Ang)
            const hDist = sDist * Math.sin(vRad);
            const vDist = sDist * Math.cos(vRad);

            // Delta N = H_Dist * cos(Az)
            // Delta E = H_Dist * sin(Az)
            const dN = hDist * Math.cos(azRad);
            const dE = hDist * Math.sin(azRad);

            newEasting = parseFloat((currentE + dE).toFixed(3));
            newNorthing = parseFloat((currentN + dN).toFixed(3));
            newElevation = parseFloat((currentZ + vDist).toFixed(3));
            calcMsg = " (Coordenadas Calculadas)";
          }
          // ----------------------------------------

          setFormData(prev => ({
            ...prev,
            pointId: oldNext,         
            nextPointId: predictedNext, 
            easting: newEasting,       
            northing: newNorthing,
            elevation: newElevation,
            horizontalAngle: undefined, 
            verticalAngle: undefined,
            slantDistance: undefined,
            intermediatePointId: '',    
            observations: ''
          }));
          
          setShowSuccessToast({ message: `Estación movida a ${oldNext}${calcMsg}` });
          
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            // If coordinates were calculated, maybe focus on next ID or observations? 
            // If not, focus on easting to enter manually.
            if (newEasting) {
               angleRef.current?.focus(); // Focus on reading inputs since coords are done
            } else {
               eastingRef.current?.focus(); 
            }
          }, 100);

        } else if (formData.intermediatePointId) {
          // RADIATION logic
          const oldInter = formData.intermediatePointId;
          const newInter = incrementId(oldInter);

          setFormData(prev => ({
            ...prev,
            intermediatePointId: newInter,
            horizontalAngle: undefined, 
            verticalAngle: undefined,
            slantDistance: undefined,
            distanceLeft: undefined,
            distanceRight: undefined,
            observations: ''
          }));

          setShowSuccessToast({ message: `Punto ${oldInter} guardado. Siguiente: ${newInter}` });
          
          setTimeout(() => {
             angleRef.current?.focus();
          }, 100);
        } else {
           setFormData(prev => ({
            ...prev,
            observations: '',
            horizontalAngle: undefined,
            verticalAngle: undefined,
            slantDistance: undefined
          }));
          setShowSuccessToast({ message: "Punto Guardado" });
        }

        setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        
      } else {
        onExit();
      }
    } catch (error) {
      // Error handled in App
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="pb-28 relative">
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-slate-800/95 backdrop-blur-sm text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-[60] animate-in fade-in slide-in-from-top-4 duration-300 w-[90%] max-w-sm border border-slate-700">
          <div className="bg-emerald-500 rounded-full p-1.5 shrink-0">
            <Check className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">{showSuccessToast.message}</p>
            <p className="text-xs text-slate-400 mt-0.5">Listo para el siguiente punto</p>
          </div>
        </div>
      )}

      {showSuccessToast && <ToastTimer onClose={() => setShowSuccessToast(null)} />}

      {/* Navigation Bar for History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 p-2 flex items-center justify-between sticky top-0 z-40">
        <button
          type="button"
          onClick={handlePrevPoint}
          disabled={historyIndex >= existingPoints.length - 1}
          className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600 flex items-center gap-1 text-xs font-semibold"
        >
          <ChevronLeft className="w-5 h-5" /> Ant.
        </button>

        <div className="flex flex-col items-center">
          {isHistoryMode ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 rounded-full cursor-pointer" onClick={handleReturnToCurrent}>
              <History className="w-3 h-3" />
              <span className="text-xs font-bold">REVISANDO: {displayData.pointId || 'ID?'}</span>
            </div>
          ) : (
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Entrada Actual</div>
          )}
        </div>

        <button
          type="button"
          onClick={handleNextPoint}
          disabled={historyIndex === -1}
          className={`p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 flex items-center gap-1 text-xs font-semibold ${historyIndex === -1 ? 'text-slate-300' : 'text-blue-600'}`}
        >
          {historyIndex === 0 ? "Nuevo" : "Sig."} <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Main Form Content */}
      <div className={`transition-opacity duration-300 ${isHistoryMode ? 'opacity-80 grayscale-[30%] pointer-events-none' : 'opacity-100'}`}>
        
        {/* Header (Visual only, logic in nav bar above) */}
        {!isHistoryMode && (
          <div className="mb-4 flex justify-between items-start px-1">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Levantamiento</h2>
              <p className="text-slate-500 text-xs font-medium flex items-center gap-1">
                {continuousMode ? (
                  <span className="text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full">
                    <Footprints className="w-3 h-3" /> Modo Corrida Activo
                  </span>
                ) : "Modo Manual"}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setContinuousMode(!continuousMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  continuousMode ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`${
                    continuousMode ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Station Section */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-1.5 h-full ${isHistoryMode ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MapPin className={`w-4 h-4 ${isHistoryMode ? 'text-amber-500' : 'text-blue-500'}`} /> 
              {isHistoryMode ? 'Estación Registrada' : 'Estación (Origen)'}
            </h3>
            {isHistoryMode && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">SOLO LECTURA</span>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">ID Estación *</label>
              <input 
                name="pointId" 
                value={displayData.pointId || ''} 
                onChange={handleInputChange} 
                required 
                readOnly={isHistoryMode}
                placeholder="Ej. P-1"
                className={`w-full text-lg font-bold border-2 rounded-xl block p-3 transition-colors ${
                  isHistoryMode ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900'
                }`}
              />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Este (X) *</label>
              <input 
                ref={eastingRef}
                name="easting" type="number" step="0.001" 
                value={displayData.easting === undefined ? '' : displayData.easting} 
                onChange={handleInputChange} required 
                readOnly={isHistoryMode}
                className="w-full bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2.5 text-sm disabled:bg-slate-100"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Norte (Y) *</label>
              <input 
                name="northing" type="number" step="0.001" 
                value={displayData.northing === undefined ? '' : displayData.northing} 
                onChange={handleInputChange} required 
                readOnly={isHistoryMode}
                className="w-full bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2.5 text-sm disabled:bg-slate-100"
              />
            </div>
            <div className="col-span-2">
              <InputGroup label="Cota (Z) / Elevación" name="elevation" type="number" step="0.001" value={displayData.elevation} onChange={handleInputChange} required />
            </div>
          </div>
        </div>

        {/* Common Measurements */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Lecturas de Equipo</h3>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
               <Calculator className="w-3 h-3" /> Auto-Calc Coords
            </div>
          </div>
          
          <div className="mb-4 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
            <InputGroup 
              label="ID Siguiente Punto (Visada)" 
              name="nextPointId" 
              value={displayData.nextPointId} 
              onChange={handleInputChange} 
              placeholder="Opcional"
              icon={<ArrowRight className="w-4 h-4 text-blue-400"/>}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Azimut / Áng. Hz.</label>
              <input 
                ref={angleRef}
                name="horizontalAngle" type="number" step="0.0001" 
                value={displayData.horizontalAngle === undefined ? '' : displayData.horizontalAngle} 
                onChange={handleInputChange} 
                readOnly={isHistoryMode}
                placeholder="Grados"
                className="w-full bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-3 text-lg font-mono disabled:bg-slate-100"
              />
            </div>
            <InputGroup label="Ángulo Vert. (0=Cenit)" name="verticalAngle" type="number" step="0.0001" value={displayData.verticalAngle} onChange={handleInputChange} />
            <div className="col-span-2">
              <InputGroup label="Distancia Inclinada (m)" name="slantDistance" type="number" step="0.001" value={displayData.slantDistance} onChange={handleInputChange} />
            </div>
          </div>
        </div>

        {/* Detail (Radiación) */}
        <div className="mb-4">
          <div className={`p-4 rounded-xl border transition-all duration-300 ${displayData.intermediatePointId ? 'bg-white border-amber-300 shadow-md ring-1 ring-amber-100' : 'bg-slate-50 border-slate-200 opacity-90'}`}>
            <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div> Punto Intermedio / Detalle
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3">
                <InputGroup label="ID Detalle" name="intermediatePointId" value={displayData.intermediatePointId} onChange={handleInputChange} placeholder="Ej. A-1, Relleno" />
              </div>
              <div className="col-span-1">
                <InputGroup label="Izq." name="distanceLeft" type="number" step="0.01" value={displayData.distanceLeft} onChange={handleInputChange} />
              </div>
              <div className="col-span-1">
                  <div className="text-center pt-8 text-slate-300 text-xs">--- Eje ---</div>
              </div>
              <div className="col-span-1">
                <InputGroup label="Der." name="distanceRight" type="number" step="0.01" value={displayData.distanceRight} onChange={handleInputChange} />
              </div>
            </div>
          </div>
        </div>

        {/* Observations & Photo */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4">
          <h3 className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Notas de Campo</h3>
          
          <div className="mb-4">
            <div className="relative">
              <textarea
                name="observations"
                rows={2}
                value={displayData.observations || ''}
                onChange={handleInputChange}
                readOnly={isHistoryMode}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 disabled:bg-slate-100"
                placeholder="Descripción..."
              />
              {!isHistoryMode && (
                <button
                  type="button"
                  onClick={handleAiEnhance}
                  disabled={aiLoading || !formData.observations}
                  className="absolute bottom-2 right-2 p-1.5 bg-white border border-indigo-100 text-indigo-600 rounded shadow-sm hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                >
                  {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <div className="">
            {!displayPhoto ? (
              !isHistoryMode && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl h-24 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors bg-slate-50 gap-2"
                >
                  <Camera className="w-6 h-6 text-slate-400" />
                  <span className="text-sm text-slate-500 font-medium">Adjuntar Foto</span>
                </div>
              )
            ) : (
              <div className="relative rounded-xl overflow-hidden h-40 bg-black group">
                <img src={displayPhoto} alt="Preview" className="w-full h-full object-cover opacity-90" />
                {!isHistoryMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment" 
              className="hidden"
              onChange={handlePhotoCapture}
            />
          </div>
        </div>
      </div>

      {/* Sticky Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 flex gap-3 z-50 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {isHistoryMode ? (
           <button
             type="button"
             onClick={handleReturnToCurrent}
             className="w-full py-3.5 px-4 bg-blue-600 text-white font-bold rounded-xl active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
           >
             <History className="w-5 h-5" /> Volver a Entrada Actual
           </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onExit}
              className="flex-1 py-3.5 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl active:bg-slate-200 transition-colors"
            >
              Salir
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-[2] py-3.5 px-4 text-white font-bold rounded-xl active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-70 ${
                continuousMode ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-800'
              }`}
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {continuousMode ? <ArrowRight className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                  {continuousMode ? (formData.nextPointId ? 'Mover Estación' : 'Guardar y Seguir') : 'Guardar'}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </form>
  );
};

// Simple helper component for toast timing
const ToastTimer: React.FC<{onClose: () => void}> = ({onClose}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);
  return null;
}

export default PointForm;