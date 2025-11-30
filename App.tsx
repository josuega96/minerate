import React, { useState } from 'react';
import ProjectList from './components/ProjectList';
import StationList from './components/StationList';
import Forms from './components/Forms';
import SketchView from './components/SketchView';
import { Project, Station, Segment, Structure, IntermediatePoint, ViewMode } from './types';
import { saveStationAndSegment, db } from './services/db';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeStation, setActiveStation] = useState<Station | undefined>(undefined);
  
  // Navigation Handlers
  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    setCurrentView('project_detail');
  };

  const handleAddStation = (lastStation: Station | null) => {
    setActiveStation(lastStation || undefined);
    // If no last station, we are setting Origin
    setCurrentView(lastStation ? 'form_advance' : 'form_station');
  };

  // Save Handlers
  const handleSaveStation = async (
    station: Station, 
    segment: Segment | null, 
    intermediates: IntermediatePoint[] = [],
    structures: Structure[] = []
  ) => {
    if (!activeProject) return;
    try {
      await saveStationAndSegment(station, segment, intermediates, structures);
      setCurrentView('project_detail');
    } catch (e) {
      console.error(e);
      alert("Error guardando datos");
    }
  };

  // Render Logic
  return (
    <div className="h-screen w-full bg-stone-100 overflow-hidden flex justify-center">
      <div className="w-full max-w-md h-full bg-white shadow-2xl relative">
        
        {currentView === 'home' && (
          <ProjectList onSelectProject={handleSelectProject} />
        )}

        {currentView === 'project_detail' && activeProject && (
          <StationList 
            project={activeProject}
            onBack={() => setCurrentView('home')}
            onAddStation={handleAddStation}
            onAddStructure={() => {}} // Deprecated functionality, structures now in advance
            onViewSketch={() => setCurrentView('sketch')}
          />
        )}

        {(currentView === 'form_station' || currentView === 'form_advance') && activeProject && (
          <Forms 
            type={currentView === 'form_station' ? 'station_origin' : 'advance'}
            project={activeProject}
            baseStation={activeStation}
            onSaveStation={handleSaveStation}
            onCancel={() => setCurrentView('project_detail')}
          />
        )}

        {currentView === 'sketch' && activeProject && (
          <SketchView 
            projectId={activeProject.id!} 
            onClose={() => setCurrentView('project_detail')}
          />
        )}

      </div>
    </div>
  );
};

export default App;