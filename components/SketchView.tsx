
import React, { useMemo, useState } from 'react';
import { Station, Segment, Structure } from '../types';
import { ChevronLeft, Layers, ZoomIn, ZoomOut, Maximize, AlertCircle } from 'lucide-react';
import { getStations, getSegments, getStructures } from '../services/db';

interface SketchViewProps {
  projectId: number;
  onClose: () => void;
}

const SketchView: React.FC<SketchViewProps> = ({ projectId, onClose }) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, seg, str] = await Promise.all([
          getStations(projectId),
          getSegments(projectId),
          getStructures(projectId)
        ]);
        setStations(s);
        setSegments(seg);
        setStructures(str);
      } catch (error) {
        console.error("Error fetching sketch data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // Transform Logic
  const drawingData = useMemo(() => {
    if (stations.length === 0) return null;

    // Bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    stations.forEach(s => {
      minX = Math.min(minX, s.easting);
      maxX = Math.max(maxX, s.easting);
      minY = Math.min(minY, s.northing);
      maxY = Math.max(maxY, s.northing);
    });

    const padding = Math.max((maxX - minX), (maxY - minY)) * 0.2 || 10;
    minX -= padding; maxX += padding;
    minY -= padding; maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;

    // Project function: Map East/North to SVG pixels
    // Note: SVG Y is down. North is Up. So we flip Y.
    const wCanvas = 800; 
    const hCanvas = 800 * (height / width);
    
    const project = (e: number, n: number) => ({
      x: ((e - minX) / width) * wCanvas,
      y: hCanvas - ((n - minY) / height) * hCanvas
    });

    // Helper: Degrees to Radians
    const toRad = (deg: number) => deg * (Math.PI / 180);

    // Generate Walls
    const walls: string[] = [];
    segments.forEach(seg => {
      const start = stations.find(s => s.id === seg.fromStationId);
      const end = stations.find(s => s.id === seg.toStationId);
      
      if (start && end) {
        const p1 = project(start.easting, start.northing);
        const p2 = project(end.easting, end.northing);
        
        // Calculate perpendicular vector for walls
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        const perpX = -dy / len;
        const perpY = dx / len;
        
        // Scale Factor (Map units to pixels)
        const scale = wCanvas / width;
        
        // Left Wall
        const l1x = p1.x - perpX * (seg.left * scale);
        const l1y = p1.y - perpY * (seg.left * scale);
        const l2x = p2.x - perpX * (seg.left * scale);
        const l2y = p2.y - perpY * (seg.left * scale);
        
        // Right Wall
        const r1x = p1.x + perpX * (seg.right * scale);
        const r1y = p1.y + perpY * (seg.right * scale);
        const r2x = p2.x + perpX * (seg.right * scale);
        const r2y = p2.y + perpY * (seg.right * scale);

        walls.push(`M ${l1x},${l1y} L ${l2x},${l2y}`); // Left Line
        walls.push(`M ${r1x},${r1y} L ${r2x},${r2y}`); // Right Line
      }
    });

    // Generate Structures
    const structureElements = structures.map(str => {
      // Find the segment originating from this station to determine position along line
      // Assumption: Structure is mapped relative to the segment starting at stationId
      const seg = segments.find(s => s.fromStationId === str.stationId);
      const station = stations.find(s => s.id === str.stationId);
      
      if (!seg || !station) return null;

      // 1. Calculate Center Position of Structure
      // E = E0 + d * sin(Az)
      // N = N0 + d * cos(Az)
      const azRad = toRad(seg.azimuth);
      const dist = str.distanceFromStart || 0;
      
      const strE = station.easting + dist * Math.sin(azRad);
      const strN = station.northing + dist * Math.cos(azRad);
      
      const center = project(strE, strN);

      // 2. Calculate Strike Line Endpoints
      // We want a line crossing the tunnel. Length e.g. 4 meters (world units)
      const lineLen = 4; 
      const halfLen = lineLen / 2;
      const strikeRad = toRad(str.strike);
      
      // Delta for strike line
      const dE = halfLen * Math.sin(strikeRad);
      const dN = halfLen * Math.cos(strikeRad);

      const pStart = project(strE - dE, strN - dN);
      const pEnd = project(strE + dE, strN + dN);

      // Colors based on type
      let color = '#9ca3af'; // default grey
      if (str.type === 'veta') color = '#ef4444'; // red
      if (str.type === 'falla') color = '#2563eb'; // blue
      if (str.type === 'fractura') color = '#9333ea'; // purple
      if (str.type === 'estrato') color = '#16a34a'; // green
      if (str.type === 'contacto') color = '#f97316'; // orange

      return {
        id: str.id,
        x1: pStart.x, y1: pStart.y,
        x2: pEnd.x, y2: pEnd.y,
        color,
        type: str.type
      };
    }).filter(Boolean);

    return { stations, segments, project, walls, wCanvas, hCanvas, structureElements };
  }, [stations, segments, structures]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center text-stone-400">
          <p>Cargando datos...</p>
        </div>
      );
    }

    if (!drawingData) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-500 p-8 text-center">
          <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-bold text-lg">Sin Datos Suficientes</p>
          <p className="text-sm mt-2 max-w-xs">Agrega al menos una estación y un segmento de avance para visualizar el croquis.</p>
        </div>
      );
    }

    const { project, walls, wCanvas, hCanvas, structureElements } = drawingData;

    return (
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 relative bg-stone-100">
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
          <button 
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 4))} 
            className="p-2 bg-white text-stone-700 shadow-md rounded-lg hover:bg-stone-50 active:bg-stone-100 border border-stone-200"
            title="Acercar"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setZoomLevel(1)} 
            className="p-2 bg-white text-stone-700 shadow-md rounded-lg hover:bg-stone-50 active:bg-stone-100 border border-stone-200"
            title="Restablecer"
          >
            <Maximize className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.25))} 
            className="p-2 bg-white text-stone-700 shadow-md rounded-lg hover:bg-stone-50 active:bg-stone-100 border border-stone-200"
            title="Alejar"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>

        <svg 
          viewBox={`0 0 ${wCanvas} ${hCanvas}`} 
          className="bg-white rounded shadow-xl max-w-full origin-center transition-transform duration-200 ease-out border border-stone-200"
          style={{ 
            maxHeight: '75vh',
            transform: `scale(${zoomLevel})` 
          }}
        >
          {/* Grid */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Walls */}
          {walls.map((d, i) => (
             <path key={i} d={d} stroke="#78716c" strokeWidth="2" fill="none" />
          ))}

          {/* Center Line (Traverse) */}
          {segments.map(seg => {
             const s1 = stations.find(s => s.id === seg.fromStationId);
             const s2 = stations.find(s => s.id === seg.toStationId);
             if(!s1 || !s2) return null;
             const p1 = project(s1.easting, s1.northing);
             const p2 = project(s2.easting, s2.northing);
             return <line key={seg.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fca5a5" strokeWidth="1" strokeDasharray="4" opacity="0.6" />;
          })}

          {/* Geological Structures */}
          {structureElements?.map((s: any) => (
            <g key={s.id}>
              {/* Strike Line */}
              <line 
                x1={s.x1} y1={s.y1} 
                x2={s.x2} y2={s.y2} 
                stroke={s.color} 
                strokeWidth="3" 
                strokeLinecap="round"
                strokeDasharray={s.type === 'fractura' || s.type === 'contacto' ? "4,2" : ""}
              />
            </g>
          ))}

          {/* Stations */}
          {stations.map(s => {
            const p = project(s.easting, s.northing);
            return (
              <g key={s.id}>
                <circle cx={p.x} cy={p.y} r="3" fill="#1f2937" stroke="white" strokeWidth="1" />
                <text x={p.x + 5} y={p.y - 5} fontSize="10" fill="#374151" fontWeight="bold">{s.name}</text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 p-3 rounded-lg shadow-lg border border-stone-200 text-xs z-20 backdrop-blur-sm">
          <h4 className="font-bold mb-2 text-stone-700">Leyenda</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex items-center gap-2"><span className="w-3 h-1 bg-red-500 rounded-full"></span> Veta</div>
            <div className="flex items-center gap-2"><span className="w-3 h-1 bg-blue-600 rounded-full"></span> Falla</div>
            <div className="flex items-center gap-2"><span className="w-3 h-1 bg-purple-600 rounded-full border-b border-dashed"></span> Fractura</div>
            <div className="flex items-center gap-2"><span className="w-3 h-1 bg-green-600 rounded-full"></span> Estrato</div>
            <div className="flex items-center gap-2"><span className="w-3 h-1 bg-orange-500 rounded-full"></span> Contacto</div>
            <div className="flex items-center gap-2"><span className="w-3 h-1 bg-stone-400 rounded-full"></span> Otros</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-stone-50">
      <div className="p-4 flex items-center justify-between bg-white text-stone-900 border-b border-stone-200 shadow-sm z-10">
        <h2 className="font-bold flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-600" /> Croquis Geológico (Planta)
        </h2>
        <button onClick={onClose} className="bg-stone-100 p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
      
      {renderContent()}
    </div>
  );
};

export default SketchView;
