
import Dexie, { Table } from 'dexie';
import { Project, Station, Segment, Structure, IntermediatePoint } from '../types';

class GeoDatabase extends Dexie {
  projects!: Table<Project>;
  stations!: Table<Station>;
  segments!: Table<Segment>;
  structures!: Table<Structure>;
  intermediatePoints!: Table<IntermediatePoint>;

  constructor() {
    super('GeoMapperDB');
    (this as any).version(4).stores({
      projects: '++id, name, createdAt',
      stations: '++id, projectId, name',
      segments: '++id, projectId, fromStationId, toStationId',
      structures: '++id, projectId, stationId',
      intermediatePoints: '++id, projectId, segmentId'
    });
  }
}

export const db = new GeoDatabase();

// --- API Helpers ---

// Projects
export const getProjects = () => db.projects.orderBy('createdAt').reverse().toArray();
export const createProject = (p: Project) => db.projects.add(p);
export const deleteProject = async (id: number) => {
  await (db as any).transaction('rw', db.projects, db.stations, db.segments, db.structures, db.intermediatePoints, async () => {
    await db.stations.where({ projectId: id }).delete();
    await db.segments.where({ projectId: id }).delete();
    await db.structures.where({ projectId: id }).delete();
    await db.intermediatePoints.where({ projectId: id }).delete();
    await db.projects.delete(id);
  });
};

// Stations
export const getStations = (projectId: number) => db.stations.where({ projectId }).toArray();
export const getLastStation = async (projectId: number) => {
  const stations = await db.stations.where({ projectId }).reverse().sortBy('id');
  return stations[0];
};

// Segments
export const getSegments = (projectId: number) => db.segments.where({ projectId }).toArray();

// Structures
export const getStructures = (projectId: number) => db.structures.where({ projectId }).toArray();

// Intermediate Points
export const getIntermediatePoints = (projectId: number) => db.intermediatePoints.where({ projectId }).toArray();

// Complex Actions
export const saveStationAndSegment = async (
  station: Station, 
  segment: Segment | null,
  intermediates: IntermediatePoint[] = [],
  structures: Structure[] = []
) => {
  return (db as any).transaction('rw', db.stations, db.segments, db.intermediatePoints, db.structures, async () => {
    // 1. Save the new Station (Destination)
    const stationId = await db.stations.add(station);
    
    if (segment) {
      // 2. Save the Segment linking Origin -> New Station
      const segmentId = await db.segments.add({ 
        ...segment, 
        toStationId: stationId as number 
      });

      // 3. Save Intermediate Points linked to this Segment
      if (intermediates.length > 0) {
        const pointsToSave = intermediates.map(pt => ({
          ...pt,
          segmentId: segmentId as number, // Link to the newly created segment
          projectId: station.projectId
        }));
        await db.intermediatePoints.bulkAdd(pointsToSave);
      }

      // 4. Save Structures linked to the Origin Station (where the measurement started)
      if (structures.length > 0) {
        const structuresToSave = structures.map(str => ({
          ...str,
          stationId: segment.fromStationId, // Linked to the origin of the measurement
          projectId: station.projectId
        }));
        await db.structures.bulkAdd(structuresToSave);
      }
    }
    return stationId;
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
