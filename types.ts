
export interface Project {
  id?: number;
  name: string;
  type: 'underground' | 'surface';
  operator: string;
  shift?: string;
  method: 'compass_tape';
  createdAt: number;
}

export interface Station {
  id?: number;
  projectId: number;
  name: string; // e.g., "E-1", "E-2"
  easting: number;
  northing: number;
  elevation: number;
  isOrigin: boolean; // True if manually entered, False if calculated
  notes?: string;
  createdAt: number;
}

export interface Segment {
  id?: number;
  projectId: number;
  fromStationId: number; // ID of Station
  toStationId: number;   // ID of Station
  
  // Measurements
  azimuth: number;       // 0-360
  dip: number;          // -90 to 90 (0 is horizontal)
  distance: number;      // Slant distance
  
  // Dimensions at the Destination Station (Profile)
  left: number;
  right: number;
  up?: number;
  down?: number;
  
  notes?: string;
}

export interface IntermediatePoint {
  id?: number;
  projectId: number;
  segmentId?: number; // Linked to the segment (traverse leg)
  distanceFromStart: number; // Distance recorded on tape from Origin
  left?: number;
  right?: number;
  up?: number;
  down?: number;
  notes?: string;
}

export interface Structure {
  id?: number;
  projectId: number;
  stationId: number; // Linked to the station where it was observed (From Station)
  distanceFromStart?: number; // Distance from the station along the tape
  type: 'falla' | 'veta' | 'estrato' | 'fractura' | 'contacto';
  strike: number; // Rumbo
  dip: number;    // Buzamiento
  aperture?: number;
  fill?: string;
  notes?: string;
  photoUrl?: string;
}

// Keeping legacy type for compatibility if needed
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

export type ViewMode = 'home' | 'project_detail' | 'form_station' | 'form_advance' | 'sketch';
