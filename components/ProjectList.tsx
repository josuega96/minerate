import React, { useState, useEffect } from 'react';
import { Plus, FolderOpen, Trash2, Calendar, User, Mountain } from 'lucide-react';
import { Project } from '../types';
import { createProject, getProjects, deleteProject } from '../services/db';

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '',
    operator: '',
    type: 'underground',
    method: 'compass_tape'
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const list = await getProjects();
    setProjects(list);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.operator) return;
    
    await createProject({
      name: newProject.name,
      operator: newProject.operator,
      type: newProject.type as 'underground' | 'surface',
      method: 'compass_tape',
      createdAt: Date.now()
    });
    
    setIsCreating(false);
    setNewProject({ name: '', operator: '', type: 'underground', method: 'compass_tape' });
    loadProjects();
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('¿Eliminar proyecto y todos sus datos?')) {
      await deleteProject(id);
      loadProjects();
    }
  };

  if (isCreating) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <h2 className="text-2xl font-bold text-stone-800 mb-6">Nuevo Proyecto</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-stone-600 mb-1">Nombre del Proyecto</label>
            <input 
              className="w-full border border-stone-300 rounded-lg p-3 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Ej. Galería Nivel 340"
              value={newProject.name}
              onChange={e => setNewProject({...newProject, name: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-600 mb-1">Operador / Geólogo</label>
            <input 
              className="w-full border border-stone-300 rounded-lg p-3 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Nombre"
              value={newProject.operator}
              onChange={e => setNewProject({...newProject, operator: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-600 mb-1">Tipo de Labor</label>
            <select 
              className="w-full border border-stone-300 rounded-lg p-3 bg-white focus:ring-emerald-500 focus:border-emerald-500"
              value={newProject.type}
              onChange={e => setNewProject({...newProject, type: e.target.value as any})}
            >
              <option value="underground">Subterránea (Túnel/Galería)</option>
              <option value="surface">Superficie (Canal/Camino)</option>
            </select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="flex-1 py-3 text-stone-600 font-bold bg-stone-100 rounded-xl hover:bg-stone-200"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 text-white font-bold bg-emerald-600 rounded-xl shadow-lg hover:bg-emerald-700"
            >
              Crear Proyecto
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">GeoMapper</h1>
          <p className="text-sm text-stone-500">Mapeo Geológico Digital</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-emerald-600 text-white p-3 rounded-xl shadow-lg active:scale-95 transition-transform hover:bg-emerald-700"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-20 no-scrollbar">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-stone-400">
            <FolderOpen className="w-16 h-16 mb-4 opacity-20" />
            <p>Sin proyectos recientes</p>
          </div>
        ) : (
          projects.map(project => (
            <div 
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 active:bg-stone-50 transition-colors cursor-pointer group relative hover:border-emerald-200"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${project.type === 'underground' ? 'bg-stone-800 text-white' : 'bg-emerald-700 text-white'}`}>
                    <Mountain className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-stone-800">{project.name}</h3>
                    <p className="text-xs text-stone-500 uppercase font-bold tracking-wider">{project.type}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => handleDelete(e, project.id!)}
                  className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-4 text-sm text-stone-600">
                <div className="flex items-center gap-1.5 bg-stone-50 p-2 rounded-lg">
                  <User className="w-3.5 h-3.5" /> {project.operator}
                </div>
                <div className="flex items-center gap-1.5 bg-stone-50 p-2 rounded-lg">
                  <Calendar className="w-3.5 h-3.5" /> {new Date(project.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProjectList;