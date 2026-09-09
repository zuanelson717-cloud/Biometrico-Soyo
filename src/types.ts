export interface Employee {
  id: string;
  name: string;
  email: string;
  biometricId: string;
  nip: string;
  phoneNumber?: string;
  role?: string;
  password?: string;
  photoUrl?: string;
  isActive?: boolean;
}

export interface Attendance {
  id: string;
  employeeId: string;
  type: 'checkIn' | 'checkOut' | 'lunchIn' | 'lunchOut';
  timestamp: any; // Firestore Timestamp
}
