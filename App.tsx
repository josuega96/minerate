
import React, { useState, useEffect } from 'react';
import ProjectList from './components/ProjectList';
import StationList from './components/StationList';
import Forms from './components/Forms';
import SketchView from './components/SketchView';
import TableView from './components/TableView';
import { Project, Station, Segment, Structure, IntermediatePoint, ViewMode, Subproject } from './types';
import { saveStationAndSegment, updateStationAndSegment, getSegments, getIntermediatePoints, getStructures, db, createSubproject, getSubprojects } from './services/db';
import { syncService } from './services/sync';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  
  // Subproject State
  // null = Main/Default Project Scope
  // number = ID of the subproject
  const [activeSubproject, setActiveSubproject] = useState<Subproject | null>(null);

  const [activeStation, setActiveStation] = useState<Station | undefined>(undefined);
  
  // Edit Mode State
  const [editData, setEditData] = useState<{
    station: Station;
    segment?: Segment;
    intermediates: IntermediatePoint[];
    structures: Structure[];
    baseStation: Station | undefined;
  } | undefined>(undefined);

  // Sync State
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'syncing' | 'error'>('online');
  const [pendingUploads, setPendingUploads] = useState(0);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((status, pending) => {
      setSyncStatus(status);
      setPendingUploads(pending);
    });
    return unsubscribe;
  }, []);
  
  // Navigation Handlers
  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    setActiveSubproject(null); // Reset to main when opening project
    setCurrentView('project_detail');
  };

  const handleSelectSubproject = (sub: Subproject | null) => {
    setActiveSubproject(sub);
  };

  const handleCreateSubproject = async (name: string, originStation?: Station) => {
    if (!activeProject) return;

    // 1. Create Subproject container
    const id = await createSubproject({
      projectId: activeProject.id!,
      name,
      createdAt: Date.now()
    });

    const newSubproject: Subproject = { id: id as number, projectId: activeProject.id!, name, createdAt: Date.now() };

    // 2. If origin station selected, DUPLICATE it into this subproject as the origin
    if (originStation) {
      const newOrigin: Station = {
        projectId: activeProject.id!,
        subprojectId: id as number,
        name: originStation.name, // Keep name or modify? Usually keeping name helps context
        easting: originStation.easting,
        northing: originStation.northing,
        elevation: originStation.elevation,
        isOrigin: true, // It is the origin of THIS subproject
        notes: `Inicio de sección. Vinculado a ${originStation.name} (Principal)`,
        createdAt: Date.now(),
        synced: false
      };
      await db.stations.add(newOrigin);
    }

    // 3. Select it
    setActiveSubproject(newSubproject);
    triggerSyncCheck();
  };

  const handleAddStation = (lastStation: Station | null) => {
    setActiveStation(lastStation || undefined);
    setEditData(undefined);
    setCurrentView(lastStation ? 'form_advance' : 'form_station');
  };

  const handleEditStation = async (station: Station) => {
    if (!activeProject) return;

    const allSegments = await getSegments(activeProject.id!, activeSubproject?.id || null);
    const segment = allSegments.find(s => s.toStationId === station.id);

    let intermediates: IntermediatePoint[] = [];
    if (segment) {
      const allIntermediates = await getIntermediatePoints(activeProject.id!, activeSubproject?.id || null);
      intermediates = allIntermediates.filter(i => i.segmentId === segment.id);
    }

    let baseStation: Station | undefined = undefined;
    if (segment) {
      // Base station might be in another subproject (rare) or same. 
      // For now, assume simple hierarchy, look in all stations just in case?
      // Actually, standard fetch is safer
      baseStation = await db.stations.get(segment.fromStationId);
    }

    let structures: Structure[] = [];
    if (baseStation) {
      const allStructures = await getStructures(activeProject.id!, activeSubproject?.id || null);
      structures = allStructures.filter(s => s.stationId === baseStation!.id);
    }

    setEditData({
      station,
      segment,
      intermediates,
      structures,
      baseStation
    });
    
    setActiveStation(baseStation);
    setCurrentView(station.isOrigin ? 'form_station' : 'form_advance');
  };

  // Save Handlers
  const handleSaveStation = async (
    station: Station, 
    segment: Segment | null, 
    intermediates: IntermediatePoint[] = [],
    structures: Structure[] = []
  ) => {
    if (!activeProject) return;
    
    // Inject current Subproject ID
    const subId = activeSubproject?.id;
    station.subprojectId = subId;
    if (segment) segment.subprojectId = subId;
    // Intermediates/Structures handled in db.ts save function via inheritance from Station/Segment

    try {
      await saveStationAndSegment(station, segment, intermediates, structures);
      triggerSyncCheck();
      setCurrentView('project_detail');
    } catch (e) {
      console.error(e);
      alert("Error guardando datos");
    }
  };

  const handleUpdateStation = async (
    stationId: number,
    station: Partial<Station>, 
    segmentId: number | undefined,
    segment: Partial<Segment> | null, 
    intermediates: IntermediatePoint[], 
    structures: Structure[]
  ) => {
     if (!activeProject) return;
     
     // Ensure subproject persistence
     const subId = activeSubproject?.id;
     station.subprojectId = subId;
     if (segment) segment.subprojectId = subId;

     try {
       await updateStationAndSegment(stationId, station, segmentId, segment, intermediates, structures);
       setEditData(undefined);
       triggerSyncCheck();
       setCurrentView('project_detail');
     } catch (e) {
       console.error(e);
       alert("Error actualizando datos");
     }
  };

  const triggerSyncCheck = () => {
    syncService.checkPending();
    syncService.attemptSync();
  };

  return (
    <div className="h-screen w-full bg-stone-100 overflow-hidden flex justify-center">
      <div className="w-full max-w-md h-full bg-white shadow-2xl relative flex flex-col">
        
        {/* Sync Status Bar */}
        <div className={`
          px-4 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider transition-colors
          ${syncStatus === 'offline' ? 'bg-stone-800 text-stone-300' : 
            syncStatus === 'error' ? 'bg-red-600 text-white' :
            syncStatus === 'syncing' ? 'bg-blue-600 text-white' :
            pendingUploads > 0 ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}
        `}>
          <div className="flex items-center gap-2">
            {syncStatus === 'offline' && <><CloudOff className="w-3 h-3" /> Sin Conexión</>}
            {syncStatus === 'syncing' && <><RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando...</>}
            {syncStatus === 'error' && <><AlertTriangle className="w-3 h-3" /> Error de Sync</>}
            {syncStatus === 'online' && (
               pendingUploads > 0 
                 ? <><Cloud className="w-3 h-3" /> {pendingUploads} Pendientes</>
                 : <><CheckCircle2 className="w-3 h-3" /> Datos Sincronizados</>
            )}
          </div>
          {syncStatus === 'online' && pendingUploads > 0 && (
            <button onClick={() => syncService.attemptSync()} className="hover:underline">Sincronizar ahora</button>
          )}
        </div>

        <div className="flex-1 overflow-hidden relative">
          {currentView === 'home' && (
            <ProjectList onSelectProject={handleSelectProject} />
          )}

          {currentView === 'project_detail' && activeProject && (
            <StationList 
              project={activeProject}
              activeSubproject={activeSubproject}
              onSelectSubproject={handleSelectSubproject}
              onCreateSubproject={handleCreateSubproject}
              onBack={() => setCurrentView('home')}
              onAddStation={handleAddStation}
              onAddStructure={() => {}} 
              onViewSketch={() => setCurrentView('sketch')}
              onViewTable={() => setCurrentView('table_view')}
              onEditStation={handleEditStation}
            />
          )}

          {(currentView === 'form_station' || currentView === 'form_advance') && activeProject && (
            <Forms 
              type={currentView === 'form_station' ? 'station_origin' : 'advance'}
              project={activeProject}
              baseStation={activeStation}
              initialData={editData}
              onSaveStation={handleSaveStation}
              onUpdateStation={handleUpdateStation}
              onCancel={() => {
                setEditData(undefined);
                setCurrentView('project_detail');
              }}
            />
          )}

          {currentView === 'sketch' && activeProject && (
            <SketchView 
              projectId={activeProject.id!} 
              onClose={() => setCurrentView('project_detail')}
            />
          )}

          {currentView === 'table_view' && activeProject && (
            <TableView 
              project={activeProject}
              activeSubproject={activeSubproject}
              onClose={() => setCurrentView('project_detail')}
              onEditStation={handleEditStation}
            />
          )}
        </div>

      </div>
    </div>
  );
};

export default App;
