
export interface Project {
  id?: number;
  name: string;
  type: 'underground' | 'surface';
  operator: string;
  shift?: string;
  method: 'compass_tape';
  createdAt: number;
  synced?: boolean;
  updatedAt?: number;
}

export interface Subproject {
  id?: number;
  projectId: number;
  name: string;
  createdAt: number;
  synced?: boolean;
  updatedAt?: number;
}

export interface Station {
  id?: number;
  projectId: number;
  subprojectId?: number; // New: Link to a specific gallery/sector
  name: string;
  easting: number;
  northing: number;
  elevation: number;
  isOrigin: boolean;
  notes?: string;
  createdAt: number;
  synced?: boolean;
  updatedAt?: number;
}

export interface Segment {
  id?: number;
  projectId: number;
  subprojectId?: number; // New
  fromStationId: number;
  toStationId: number;
  
  // Measurements
  azimuth: number;
  dip: string | number;
  distance: number;
  
  // Dimensions
  left: number;
  right: number;
  up?: number;
  down?: number;
  
  notes?: string;
  synced?: boolean;
  updatedAt?: number;
}

export interface IntermediatePoint {
  id?: number;
  projectId: number;
  subprojectId?: number; // New
  segmentId?: number;
  distanceFromStart: number;
  left?: number;
  right?: number;
  up?: number;
  down?: number;
  notes?: string;
  synced?: boolean;
  updatedAt?: number;
}

export interface Structure {
  id?: number;
  projectId: number;
  subprojectId?: number; // New
  stationId: number;
  distanceFromStart?: number;
  type: 'falla' | 'veta' | 'estrato' | 'fractura' | 'contacto' | 'otros';
  otherType?: string; // Custom name if type is 'otros'
  strike: number;
  dip: string | number;
  location?: string[];
  aperture?: number;
  fill?: string;
  notes?: string;
  photoUrl?: string;
  synced?: boolean;
  updatedAt?: number;
}

export interface GeoPoint {
  id?: number;
  timestamp: number;
  pointId: string;
  easting: number;
  northing: number;
  elevation: number;
  nextPointId?: string;
  horizontalAngle?: number;
  verticalAngle?: number;
  slantDistance?: number;
  intermediatePointId?: string;
  distanceLeft?: number;
  distanceRight?: number;
  observations?: string;
  photoDataUrl?: string;
}

export type ViewMode = 'home' | 'project_detail' | 'form_station' | 'form_advance' | 'sketch' | 'table_view';