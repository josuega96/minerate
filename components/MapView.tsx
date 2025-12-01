
import React, { useMemo, useState } from 'react';
import { GeoPoint } from '../types';
import { ZoomIn, ZoomOut, Maximize, Map as MapIcon, Navigation } from 'lucide-react';

interface MapViewProps {
  points: GeoPoint[];
}

const MapView: React.FC<MapViewProps> = ({ points }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedPoint, setSelectedPoint] = useState<GeoPoint | null>(null);

  // 1. Calculate Bounding Box (Extents)
  const bounds = useMemo(() => {
    if (points.length === 0) return null;

    let minE = points[0].easting;
    let maxE = points[0].easting;
    let minN = points[0].northing;
    let maxN = points[0].northing;

    points.forEach(p => {
      if (p.easting < minE) minE = p.easting;
      if (p.easting > maxE) maxE = p.easting;
      if (p.northing < minN) minN = p.northing;
      if (p.northing > maxN) maxN = p.northing;
    });

    // Add padding (buffer) so points aren't on the edge
    const paddingE = (maxE - minE) * 0.1 || 10; // Default 10m buffer if single point
    const paddingN = (maxN - minN) * 0.1 || 10;

    return {
      minE: minE - paddingE,
      maxE: maxE + paddingE,
      minN: minN - paddingN,
      maxN: maxN + paddingN,
      width: (maxE - minE) + (paddingE * 2) || 20,
      height: (maxN - minN) + (paddingN * 2) || 20
    };
  }, [points]);

  if (!bounds || points.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <MapIcon className="w-12 h-12 mb-2 opacity-20" />
        <p>No hay datos de coordenadas para mostrar.</p>
      </div>
    );
  }

  // 2. Coordinate Projection Helper
  // SVG Coordinate system: (0,0) is Top-Left. 
  // Map Coordinate system: (0,0) is usually Bottom-Left (North is Up).
  // We need to invert Y.
  
  // ViewBox logic: 
  // We want to map the real coordinates to the SVG viewBox.
  // However, SVG flips Y. To keep North UP, we transform manually or use transform.
  // Simplest: Map values to a 0-1000 standard grid for normalized rendering.
  
  const mapSize = 1000; // Internal resolution
  const aspectRatio = bounds.width / bounds.height;
  
  // Canvas dimensions based on aspect ratio
  const canvasWidth = aspectRatio >= 1 ? mapSize : mapSize * aspectRatio;
  const canvasHeight = aspectRatio >= 1 ? mapSize / aspectRatio : mapSize;

  const project = (e: number, n: number) => {
    const xPct = (e - bounds.minE) / bounds.width;
    const yPct = (n - bounds.minN) / bounds.height;
    
    return {
      x: xPct * canvasWidth,
      y: canvasHeight - (yPct * canvasHeight) // Invert Y so North is Up
    };
  };

  // 3. Generate Traverse Lines (Connect P1 -> NextPoint)
  // We need to find the destination point object for each "nextPointId"
  const traverseLines = points
    .filter(p => p.nextPointId)
    .map(p1 => {
      const p2 = points.find(p => p.pointId === p1.nextPointId);
      if (!p2) return null;
      
      const start = project(p1.easting, p1.northing);
      const end = project(p2.easting, p2.northing);
      
      return (
        <line 
          key={`${p1.id}-${p2.id}`}
          x1={start.x} y1={start.y}
          x2={end.x} y2={end.y}
          stroke="#cbd5e1"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
      );
    })
    .filter(Boolean);

  return (
    <div className="h-full w-full relative bg-slate-50 overflow-hidden select-none">
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 5))} className="p-2 bg-white shadow-md rounded-lg text-slate-700 active:bg-slate-100">
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={() => setZoomLevel(1)} className="p-2 bg-white shadow-md rounded-lg text-slate-700 active:bg-slate-100">
          <Maximize className="w-5 h-5" />
        </button>
        <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 0.5))} className="p-2 bg-white shadow-md rounded-lg text-slate-700 active:bg-slate-100">
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>

      {/* Info Card Overlay */}
      {selectedPoint && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-slate-200 z-30 animate-in slide-in-from-bottom-2">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${selectedPoint.intermediatePointId ? 'bg-amber-500' : 'bg-blue-600'}`}></div>
                {selectedPoint.pointId}
                {selectedPoint.intermediatePointId && <span className="text-xs font-normal text-amber-600">({selectedPoint.intermediatePointId})</span>}
              </h3>
              {/* Modified: Remove .toFixed(3) */}
              <div className="grid grid-cols-2 gap-x-4 text-xs mt-1 font-mono text-slate-600">
                <span>E: {selectedPoint.easting}</span>
                <span>N: {selectedPoint.northing}</span>
                <span>Z: {selectedPoint.elevation}</span>
              </div>
            </div>
            <button onClick={() => setSelectedPoint(null)} className="text-slate-400 hover:text-slate-600 px-2">✕</button>
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <div className="w-full h-full flex items-center justify-center p-8 overflow-auto">
        <svg 
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          className="transition-transform duration-300 ease-out"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {/* Grid/Axes background (Optional aesthetic) */}
          <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="none" />
          
          {/* Traverse Lines */}
          {traverseLines}

          {/* Points */}
          {points.map(p => {
            const coords = project(p.easting, p.northing);
            const isSelected = selectedPoint?.id === p.id;
            const isDetail = !!p.intermediatePointId;
            const isStation = !isDetail;

            return (
              <g 
                key={p.id} 
                onClick={() => setSelectedPoint(p)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hit area (larger invisible circle for easier touching) */}
                <circle cx={coords.x} cy={coords.y} r="20" fill="transparent" />
                
                {/* Visible Marker */}
                <circle 
                  cx={coords.x} 
                  cy={coords.y} 
                  r={isStation ? 6 : 4} 
                  fill={isDetail ? '#f59e0b' : '#2563eb'} 
                  stroke="white" 
                  strokeWidth="2"
                  className="drop-shadow-sm transition-all"
                  style={{ 
                    transformOrigin: `${coords.x}px ${coords.y}px`,
                    transform: isSelected ? 'scale(1.5)' : 'scale(1)' 
                  }}
                />
                
                {/* Label */}
                <text 
                  x={coords.x} 
                  y={coords.y - 12} 
                  textAnchor="middle" 
                  fontSize="12" 
                  fontWeight="bold"
                  fill={isSelected ? '#1e293b' : '#64748b'}
                  style={{ pointerEvents: 'none' }}
                >
                  {isDetail ? p.intermediatePointId : p.pointId}
                </text>
              </g>
            );
          })}
          
          {/* North Arrow (Static in top right relative to data) */}
          <g transform={`translate(${canvasWidth - 30}, 30)`}>
             <text x="0" y="-12" textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="bold">N</text>
             <Navigation className="text-slate-300" size={24} fill="#cbd5e1" transform="rotate(0)" />
          </g>

        </svg>
      </div>
    </div>
  );
};

export default MapView;
