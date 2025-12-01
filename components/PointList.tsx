
import React, { useState } from 'react';
import { Download, Plus, FileText, Database, MapPin, Route, ArrowRight, TrendingUp, Ruler, Map as MapIcon, List } from 'lucide-react';
import { GeoPoint } from '../types';
import { exportToCSV, downloadData } from '../services/db';
import MapView from './MapView';

interface PointListProps {
  points: GeoPoint[];
  onAddNew: () => void;
}

const PointList: React.FC<PointListProps> = ({ points, onAddNew }) => {
  const [showTraverseOnly, setShowTraverseOnly] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const handleExportCSV = () => {
    if (points.length === 0) return;
    const csv = exportToCSV(points);
    const filename = `geo_survey_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadData(csv, filename, 'csv');
  };

  const handleExportJSON = () => {
    if (points.length === 0) return;
    const json = JSON.stringify(points, null, 2);
    const filename = `geo_survey_${new Date().toISOString().slice(0, 10)}.json`;
    downloadData(json, filename, 'json');
  };

  // Filter for Traverse View:
  // 1. Must have a nextPointId (indicates a move/traverse leg)
  // 2. Sort chronologically (Oldest first) to show the sequence 1->2->3
  const traversePoints = React.useMemo(() => {
    return points
      .filter(p => p.nextPointId && p.nextPointId.trim() !== '')
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [points]);

  const displayPoints = showTraverseOnly ? traversePoints : points;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white p-4 border-b border-slate-200 shadow-sm z-10 sticky top-0">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">GeoMap Pro</h1>
            <p className="text-xs text-slate-500 font-medium">
              {showMap 
                ? "Vista de Mapa" 
                : (showTraverseOnly 
                    ? `${traversePoints.length} corridas registradas` 
                    : `${points.length} registros totales`
                  )
              }
            </p>
          </div>
          <div className="flex gap-2">
             {/* Map Toggle Button */}
             <button
              onClick={() => setShowMap(!showMap)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${
                showMap
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title={showMap ? "Ver Lista" : "Ver Mapa"}
            >
              {showMap ? <List className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
              {showMap ? "Lista" : "Mapa"}
            </button>

            {!showMap && (
              <button 
                onClick={() => setShowTraverseOnly(!showTraverseOnly)}
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${
                  showTraverseOnly 
                    ? 'bg-indigo-100 text-indigo-700 shadow-inner' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Ver Historial de Corridas"
              >
                <Route className="w-5 h-5" />
              </button>
            )}
            
            {!showMap && !showTraverseOnly && (
              <>
                <button 
                  onClick={handleExportCSV}
                  disabled={points.length === 0}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg disabled:opacity-50 hover:bg-slate-200"
                  title="Export CSV"
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleExportJSON}
                  disabled={points.length === 0}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg disabled:opacity-50 hover:bg-slate-200"
                  title="Export JSON"
                >
                  <Database className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative bg-slate-50">
        {showMap ? (
          <MapView points={points} />
        ) : (
          <div className="h-full overflow-y-auto p-4 space-y-3 pb-24 no-scrollbar">
            {displayPoints.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center">
                {showTraverseOnly ? (
                   <>
                    <Route className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">No hay corridas registradas.</p>
                    <p className="text-xs mt-1">Guarda puntos con "Siguiente Estación" para verlos aquí.</p>
                   </>
                ) : (
                   <>
                    <MapPin className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">No hay puntos guardados.</p>
                    <p className="text-xs mt-1">Toca + para comenzar.</p>
                   </>
                )}
              </div>
            ) : (
              displayPoints.map((point, index) => {
                if (showTraverseOnly) {
                  // --- TRAVERSE VIEW CARD ---
                  return (
                    <div key={point.id} className="bg-white rounded-xl shadow-sm border-l-4 border-l-indigo-500 border-y border-r border-slate-200 p-4 relative">
                      <div className="absolute top-2 right-3 text-[10px] font-bold text-indigo-200 uppercase tracking-widest">
                        Corrida #{index + 1}
                      </div>
                      
                      <div className="flex items-center gap-3 mb-3">
                        <div className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-sm font-bold">
                          {point.pointId}
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                        <div className="bg-indigo-600 text-white px-2 py-1 rounded text-sm font-bold shadow-sm">
                          {point.nextPointId}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 border-t border-slate-50 pt-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5">Azimut</span>
                          {/* Modified: Removed toFixed(4) */}
                          <div className="flex items-center gap-1 text-slate-700 font-mono text-sm">
                            <TrendingUp className="w-3 h-3 text-slate-400" />
                            {point.horizontalAngle}°
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5">Dist. Inc.</span>
                          {/* Modified: Removed toFixed(3) */}
                          <div className="flex items-center gap-1 text-slate-700 font-mono text-sm">
                            <Ruler className="w-3 h-3 text-slate-400" />
                            {point.slantDistance}m
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5">V. Angle</span>
                          {/* Modified: Removed toFixed(4) */}
                          <div className="text-slate-700 font-mono text-sm">
                            {point.verticalAngle}°
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] text-slate-400 text-right">
                        {new Date(point.timestamp).toLocaleString()}
                      </div>
                    </div>
                  );
                } else {
                  // --- STANDARD VIEW CARD ---
                  return (
                    <div key={point.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden active:scale-[0.99] transition-transform duration-100">
                      <div className="flex">
                        {/* Image Thumbnail Sidebar */}
                        <div className="w-20 bg-slate-100 flex items-center justify-center border-r border-slate-100 shrink-0">
                          {point.photoDataUrl ? (
                            <img src={point.photoDataUrl} alt="Point" className="w-full h-full object-cover" />
                          ) : (
                            <MapPin className="text-slate-300 w-6 h-6" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 p-3 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{point.pointId}</span>
                              {point.nextPointId ? (
                                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 font-medium flex items-center gap-1">
                                  <ArrowRight className="w-3 h-3" /> {point.nextPointId}
                                </span>
                              ) : point.intermediatePointId ? (
                                 <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 font-medium">
                                  Det: {point.intermediatePointId}
                                </span>
                              ) : null}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                              {new Date(point.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                            <div className="bg-slate-50 p-1 rounded border border-slate-100">
                              <span className="block text-[9px] text-slate-400 uppercase">East</span>
                              {/* Modified: Removed toFixed(3) */}
                              <span className="font-mono text-slate-700 truncate">{point.easting}</span>
                            </div>
                            <div className="bg-slate-50 p-1 rounded border border-slate-100">
                              <span className="block text-[9px] text-slate-400 uppercase">North</span>
                              {/* Modified: Removed toFixed(3) */}
                              <span className="font-mono text-slate-700 truncate">{point.northing}</span>
                            </div>
                            <div className="bg-slate-50 p-1 rounded border border-slate-100">
                              <span className="block text-[9px] text-slate-400 uppercase">Elev</span>
                              {/* Modified: Removed toFixed(3) */}
                              <span className="font-mono text-slate-700 truncate">{point.elevation}</span>
                            </div>
                          </div>

                          {point.observations && (
                            <p className="text-xs text-slate-600 line-clamp-1 italic border-t border-slate-50 pt-1 truncate">
                              "{point.observations}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              })
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button - Only show in normal view (List or Map) */}
      {!showTraverseOnly && (
        <button
          onClick={onAddNew}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all z-50"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}
    </div>
  );
};

export default PointList;
