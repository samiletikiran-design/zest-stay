export interface Organization {
  id: string;
  name: string;
  ownerEmail: string;
  ownerPhone?: string;
  createdAt: string;
}

export interface Hostel {
  id: string;
  organizationId: string;
  name: string;
  address?: string;
  phone?: string;
  createdAt: string;
}

export interface User {
  id: string;
  organizationId: string;
  currentHostelId?: string;
  role: 'admin' | 'staff';
  email: string;
  name: string;
  phone?: string;
}

export interface Room {
  id: string;
  organizationId: string;
  hostelId: string;
  roomNumber: string;
  totalBeds: number;
  type: 'AC' | 'Non-AC';
}

export interface Bed {
  id: string;
  organizationId: string;
  hostelId: string;
  roomId: string;
  bedNumber: string;
  status: 'occupied' | 'vacant';
}

export interface Member {
  id: string;
  organizationId: string;
  hostelId: string;
  name: string;
  phone: string;
  idProof: string;
  roomId: string;
  bedId: string;
  rentAmount: number;
  deposit: number;
  joiningDate: string;
  lastPaidMonth?: string;
  status: 'active' | 'inactive';
  billingType?: 'anniversary' | 'fixed_first';
}

export interface Payment {
  id: string;
  organizationId: string;
  hostelId: string;
  memberId: string;
  amount: number;
  date: string;
  method: 'cash' | 'upi' | 'bank';
  status: 'paid' | 'pending' | 'partial';
  month: string;
}

export interface Staff {
  id: string;
  organizationId: string;
  hostelId: string;
  name: string;
  role: string;
  phone: string;
  salary: number;
  joinDate: string;
}

export interface SalaryPayment {
  id: string;
  organizationId: string;
  hostelId: string;
  staffId: string;
  amount: number;
  date: string;
  month: string;
  status: 'paid' | 'pending';
}

export interface Expense {
  id: string;
  organizationId: string;
  hostelId: string;
  category: string;
  amount: number;
  description: string;
  date: string;
}
