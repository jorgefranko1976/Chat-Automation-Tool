
export interface ControlPoint {
  id: string;
  sequence: number;
  type: 'Load' | 'Unload' | 'Check';
  location: string;
  city: string;
  address: string;
  coordinates: { lat: number; lng: number };
  scheduledTime: string;
  agreedTimeMinutes: number;
  status: 'Pending' | 'Arrived' | 'Departed' | 'Reported' | 'Delayed';
  arrivalTime?: string;
  departureTime?: string;
  novelty?: string;
}

export interface Manifest {
  id: string; // IngresoIdManifesto
  radical: string; // Radicado
  consecutive: string;
  vehiclePlate: string;
  driverId: string;
  companyNit: string;
  issueDate: string;
  status: 'Active' | 'Completed' | 'Cancelled';
  controlPoints: ControlPoint[];
  lastUpdate: string;
}

export const MOCK_MANIFESTS: Manifest[] = [
  {
    id: "111954381",
    radical: "122073829",
    consecutive: "111",
    vehiclePlate: "VMT301",
    driverId: "9999999999",
    companyNit: "9013690938",
    issueDate: "2025-05-12",
    status: 'Active',
    lastUpdate: "2025-05-12T17:36:00",
    controlPoints: [
      {
        id: "cp-1",
        sequence: 1,
        type: 'Load',
        location: "KM2 VIA FUNZA SIBERIA",
        city: "11001000",
        address: "KM2 VIA FUNZA SIBERIA",
        coordinates: { lat: 4.72987, lng: -74.19123 },
        scheduledTime: "2025-05-12T08:00:00",
        agreedTimeMinutes: 2520,
        status: 'Departed',
        arrivalTime: "2025-05-12T07:55:00",
        departureTime: "2025-05-12T09:30:00"
      },
      {
        id: "cp-2",
        sequence: 2,
        type: 'Unload',
        location: "GRANJAS VIA GARAGOA",
        city: "11001000",
        address: "GRANJAS VIA GARAGOA",
        coordinates: { lat: 5.08364, lng: -73.37227 },
        scheduledTime: "2025-05-12T17:00:00",
        agreedTimeMinutes: 2520,
        status: 'Pending'
      }
    ]
  },
  {
    id: "111953859",
    radical: "122073827",
    consecutive: "112",
    vehiclePlate: "WHK426",
    driverId: "888888888",
    companyNit: "9013690938",
    issueDate: "2025-05-12",
    status: 'Active',
    lastUpdate: "2025-05-12T16:00:00",
    controlPoints: [
      {
        id: "cp-3",
        sequence: 1,
        type: 'Load',
        location: "KM2 VIA FUNZA SIBERIA",
        city: "11001000",
        address: "KM2 VIA FUNZA SIBERIA",
        coordinates: { lat: 4.72987, lng: -74.19123 },
        scheduledTime: "2025-05-12T07:00:00",
        agreedTimeMinutes: 2520,
        status: 'Reported',
        arrivalTime: "2025-05-12T06:50:00",
        departureTime: "2025-05-12T08:15:00"
      },
      {
        id: "cp-4",
        sequence: 2,
        type: 'Unload',
        location: "ARBELAEZ CUNDINAMARCA",
        city: "5001000",
        address: "ARBELAEZ CUNDINAMARCA",
        coordinates: { lat: 4.27344, lng: -74.41674 },
        scheduledTime: "2025-05-12T16:00:00",
        agreedTimeMinutes: 2520,
        status: 'Arrived',
        arrivalTime: "2025-05-12T15:45:00"
      }
    ]
  }
];
