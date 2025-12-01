
import Dexie, { Table } from 'dexie';
import { Project, Subproject, Station, Segment, Structure, IntermediatePoint } from '../types';

class GeoDatabase extends Dexie {
  projects!: Table<Project>;
  subprojects!: Table<Subproject>;
  stations!: Table<Station>;
  segments!: Table<Segment>;
  structures!: Table<Structure>;
  intermediatePoints!: Table<IntermediatePoint>;

  constructor() {
    super('GeoMapperDB');
    // Version 6: Add subprojects table and indexes
    (this as any).version(6).stores({
      projects: '++id, name, createdAt, synced',
      subprojects: '++id, projectId, synced',
      stations: '++id, projectId, subprojectId, name, synced',
      segments: '++id, projectId, subprojectId, fromStationId, toStationId, synced',
      structures: '++id, projectId, subprojectId, stationId, synced',
      intermediatePoints: '++id, projectId, subprojectId, segmentId, synced'
    });
  }
}

export const db = new GeoDatabase();

// --- API Helpers ---

// Projects
export const getProjects = () => db.projects.orderBy('createdAt').reverse().toArray();
export const createProject = (p: Project) => db.projects.add({ ...p, synced: false, updatedAt: Date.now() });
export const deleteProject = async (id: number) => {
  await (db as any).transaction('rw', db.projects, db.subprojects, db.stations, db.segments, db.structures, db.intermediatePoints, async () => {
    await db.subprojects.where('projectId').equals(id).delete();
    await db.stations.where('projectId').equals(id).delete();
    await db.segments.where('projectId').equals(id).delete();
    await db.structures.where('projectId').equals(id).delete();
    await db.intermediatePoints.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
};

// Subprojects
export const getSubprojects = (projectId: number) => db.subprojects.where('projectId').equals(projectId).toArray();
export const createSubproject = (sp: Subproject) => db.subprojects.add({ ...sp, synced: false, updatedAt: Date.now() });

// Stations
export const getStations = (projectId: number, subprojectId?: number | null) => {
  // If subprojectId is undefined, return all stations for the project (used for linking origin across subprojects)
  if (subprojectId === undefined) {
    return db.stations.where('projectId').equals(projectId).toArray();
  }
  
  if (subprojectId === null) {
    // Get "Main" stations (where subprojectId is null/undefined)
    return db.stations.where('projectId').equals(projectId).filter(s => s.subprojectId == null).toArray();
  }
  
  // Get stations for specific subproject
  return db.stations.where('projectId').equals(projectId).filter(s => s.subprojectId === subprojectId).toArray();
};

export const getAllProjectStations = (projectId: number) => db.stations.where('projectId').equals(projectId).toArray();

export const getLastStation = async (projectId: number, subprojectId?: number | null) => {
  let collection;
  
  if (subprojectId === null) {
    collection = db.stations.where('projectId').equals(projectId).filter(s => s.subprojectId == null);
  } else if (subprojectId !== undefined) {
    collection = db.stations.where('projectId').equals(projectId).filter(s => s.subprojectId === subprojectId);
  } else {
    collection = db.stations.where('projectId').equals(projectId);
  }

  const stations = await collection.reverse().sortBy('id');
  return stations[0];
};

// Segments
export const getSegments = (projectId: number, subprojectId?: number | null) => {
  if (subprojectId === undefined) return db.segments.where('projectId').equals(projectId).toArray();
  
  if (subprojectId === null) {
    return db.segments.where('projectId').equals(projectId).filter(s => s.subprojectId == null).toArray();
  }
  return db.segments.where('projectId').equals(projectId).filter(s => s.subprojectId === subprojectId).toArray();
};

// Structures
export const getStructures = (projectId: number, subprojectId?: number | null) => {
  if (subprojectId === undefined) return db.structures.where('projectId').equals(projectId).toArray();
  
  if (subprojectId === null) {
    return db.structures.where('projectId').equals(projectId).filter(s => s.subprojectId == null).toArray();
  }
  return db.structures.where('projectId').equals(projectId).filter(s => s.subprojectId === subprojectId).toArray();
};

// Intermediate Points
export const getIntermediatePoints = (projectId: number, subprojectId?: number | null) => {
  if (subprojectId === undefined) return db.intermediatePoints.where('projectId').equals(projectId).toArray();
  
  if (subprojectId === null) {
    return db.intermediatePoints.where('projectId').equals(projectId).filter(s => s.subprojectId == null).toArray();
  }
  return db.intermediatePoints.where('projectId').equals(projectId).filter(s => s.subprojectId === subprojectId).toArray();
};

// Complex Actions
export const saveStationAndSegment = async (
  station: Station, 
  segment: Segment | null,
  intermediates: IntermediatePoint[] = [],
  structures: Structure[] = []
) => {
  return (db as any).transaction('rw', db.stations, db.segments, db.intermediatePoints, db.structures, async () => {
    // 1. Save the new Station (Destination)
    const stationId = await db.stations.add({ 
      ...station, 
      synced: false, 
      updatedAt: Date.now() 
    });
    
    if (segment) {
      // 2. Save the Segment
      const segmentId = await db.segments.add({ 
        ...segment, 
        toStationId: stationId as number,
        synced: false,
        updatedAt: Date.now()
      });

      // 3. Save Intermediates
      if (intermediates.length > 0) {
        const pointsToSave = intermediates.map(pt => ({
          ...pt,
          segmentId: segmentId as number,
          projectId: station.projectId,
          subprojectId: station.subprojectId, // Inherit subproject
          synced: false,
          updatedAt: Date.now()
        }));
        await db.intermediatePoints.bulkAdd(pointsToSave);
      }

      // 4. Save Structures
      if (structures.length > 0) {
        const structuresToSave = structures.map(str => ({
          ...str,
          stationId: segment.fromStationId,
          projectId: station.projectId,
          subprojectId: station.subprojectId, // Inherit subproject
          synced: false,
          updatedAt: Date.now()
        }));
        await db.structures.bulkAdd(structuresToSave);
      }
    }
    return stationId;
  });
};

export const updateStationAndSegment = async (
  stationId: number,
  stationData: Partial<Station>,
  segmentId: number | undefined,
  segmentData: Partial<Segment> | null,
  intermediates: IntermediatePoint[],
  structures: Structure[]
) => {
  return (db as any).transaction('rw', db.stations, db.segments, db.intermediatePoints, db.structures, async () => {
    const now = Date.now();

    // 1. Update Station
    await db.stations.update(stationId, {
      ...stationData,
      synced: false,
      updatedAt: now
    });

    if (segmentId && segmentData) {
      // 2. Update Segment
      await db.segments.update(segmentId, {
        ...segmentData,
        synced: false,
        updatedAt: now
      });

      // 3. Replace Intermediate Points
      // Explicitly use index 'segmentId'
      await db.intermediatePoints.where('segmentId').equals(segmentId).delete();
      
      if (intermediates.length > 0) {
        const pointsToSave = intermediates.map(pt => ({
          ...pt,
          segmentId: segmentId,
          projectId: stationData.projectId!,
          subprojectId: stationData.subprojectId,
          synced: false,
          updatedAt: now
        }));
        await db.intermediatePoints.bulkAdd(pointsToSave);
      }

      // 4. Replace Structures
      const segment = await db.segments.get(segmentId);
      if (segment) {
        // Explicitly use index 'stationId' for structures linked to the FROM station
        await db.structures.where('stationId').equals(segment.fromStationId).delete();
        
        if (structures.length > 0) {
          const structuresToSave = structures.map(str => ({
            ...str,
            stationId: segment.fromStationId,
            projectId: stationData.projectId!,
            subprojectId: stationData.subprojectId,
            synced: false,
            updatedAt: now
          }));
          await db.structures.bulkAdd(structuresToSave);
        }
      }
    }
  });
};

// --- Export / Download Helpers ---

export const exportToCSV = (data: any[]) => {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(obj => Object.values(obj).map(val => 
    typeof val === 'string' && val.includes(',') ? `"${val}"` : val
  ).join(','));
  return [headers, ...rows].join('\n');
};

export const downloadData = (content: string, filename: string, type: 'csv' | 'json') => {
  const mimeType = type === 'csv' ? 'text/csv' : 'application/json';
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// --- Sync Helpers ---

export const getUnsyncedCount = async () => {
  const p = await db.projects.where('synced').equals(0).count(); // Dexie stores boolean as 0/1 in indexeddb mostly or handles boolean keys
  // Safer to use .filter for booleans if index is not behaving, but usually it works.
  // Actually, 'synced' is not the primary key, so where('synced').equals(false) works if indexed.
  // Assuming 'synced' index works with booleans (Dexie usually handles this).
  // If issues arise, change to .filter(x => !x.synced).
  
  // Using .filter is safest for booleans across browsers if not strictly indexed as 0/1
  const sp = await db.subprojects.filter(x => x.synced === false).count();
  const st = await db.stations.filter(x => x.synced === false).count();
  const sg = await db.segments.filter(x => x.synced === false).count();
  const str = await db.structures.filter(x => x.synced === false).count();
  const ip = await db.intermediatePoints.filter(x => x.synced === false).count();
  return p + sp + st + sg + str + ip;
};

export const markAllAsSynced = async () => {
  await (db as any).transaction('rw', db.projects, db.subprojects, db.stations, db.segments, db.structures, db.intermediatePoints, async () => {
    await db.projects.filter(x => x.synced === false).modify({ synced: true });
    await db.subprojects.filter(x => x.synced === false).modify({ synced: true });
    await db.stations.filter(x => x.synced === false).modify({ synced: true });
    await db.segments.filter(x => x.synced === false).modify({ synced: true });
    await db.structures.filter(x => x.synced === false).modify({ synced: true });
    await db.intermediatePoints.filter(x => x.synced === false).modify({ synced: true });
  });
};
