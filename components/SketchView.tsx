import React, { useMemo } from 'react';
import { Station, Segment } from '../types';
import { ChevronLeft } from 'lucide-react';
import { getStations, getSegments } from '../services/db';

interface SketchViewProps {
  projectId: number;
  onClose: () => void;
}

const SketchView: React.FC<SketchViewProps> = ({ projectId, onClose }) => {
  const [stations, setStations] = React.useState<Station[]>([]);
  const [segments, setSegments] = React.useState<Segment[]>([]);

  React.useEffect(() => {
    getStations(projectId).then(setStations);
    getSegments(projectId).then(setSegments);
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

    return { stations, segments, project, walls, wCanvas, hCanvas };
  }, [stations, segments]);

  if (!drawingData) return <div className="p-10">Cargando...</div>;
  
  const { project, walls, wCanvas, hCanvas } = drawingData;

  return (
    <div className="flex flex-col h-full bg-stone-900">
      <div className="p-4 flex items-center justify-between bg-stone-800 text-white">
        <h2 className="font-bold">Croquis de Planta (2D)</h2>
        <button onClick={onClose} className="bg-stone-700 p-2 rounded-full hover:bg-stone-600"><ChevronLeft /></button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <svg 
          viewBox={`0 0 ${wCanvas} ${hCanvas}`} 
          className="bg-stone-100 rounded shadow-lg max-w-full"
          style={{ maxHeight: '80vh' }}
        >
          {/* Grid */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="gray" strokeWidth="0.5" opacity="0.2"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Walls */}
          {walls.map((d, i) => (
             <path key={i} d={d} stroke="#57534e" strokeWidth="2" fill="none" />
          ))}

          {/* Center Line (Traverse) */}
          {segments.map(seg => {
             const s1 = stations.find(s => s.id === seg.fromStationId);
             const s2 = stations.find(s => s.id === seg.toStationId);
             if(!s1 || !s2) return null;
             const p1 = project(s1.easting, s1.northing);
             const p2 = project(s2.easting, s2.northing);
             return <line key={seg.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#ef4444" strokeWidth="1" strokeDasharray="4" />;
          })}

          {/* Stations */}
          {stations.map(s => {
            const p = project(s.easting, s.northing);
            return (
              <g key={s.id}>
                <circle cx={p.x} cy={p.y} r="4" fill="black" />
                <text x={p.x + 6} y={p.y} fontSize="10" fill="black" fontWeight="bold">{s.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default SketchView;