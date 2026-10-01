export type Role = {
  id: string
  name: string
  description: string
  isSystem: boolean
  grantsAll: boolean
  permissions: string[]
}

export type User = {
  id: string
  fullName: string
  email: string
  login: string
  phone: string
  roleId: string
  title: string
  driverRatePerTrip: number
  isActive: boolean
  isSuperadmin: boolean
  avatarPath: string
  avatarUrl: string
  avatarUrlAt?: number
}

export type Client = { id: string; name: string; phone: string; contactName: string; openingBalance: number; createdAt: string }
export type Material = { id: string; name: string; unitPrice: number; isActive: boolean }
export type VehicleStatus = 'active' | 'service' | 'repair'
export type Vehicle = { id: string; plate: string; model: string; driverId: string | null; status: VehicleStatus; year: number | null }
export type MonitoringStatus = 'pending' | 'approved'
export type SaleType = 'cash' | 'credit'

export type Trip = {
  id: string
  vehicleId: string
  driverId: string
  clientId: string | null
  materialId: string
  weightTons: number
  unitPrice: number
  totalAmount: number
  saleType: SaleType
  hoursWorked: number
  photoPath: string
  photoUrl: string
  note: string
  createdAt: string
  createdBy: string | null
  monitoringStatus: MonitoringStatus
  monitoredAt: string | null
  monitoringNote: string
  monitoredBy: string | null
}

export type PaymentMethod = 'cash' | 'bank'
export type Transaction = {
  id: string
  direction: 'in' | 'out'
  category: string
  amount: number
  paymentMethod: PaymentMethod
  clientId: string | null
  driverId: string | null
  vehicleId: string | null
  tripId: string | null
  note: string
  createdAt: string
  createdBy: string | null
  monitoringStatus: MonitoringStatus
  monitoredAt: string | null
  monitoringNote: string
  monitoredBy: string | null
}

export type MaintenanceReport = {
  id: string
  vehicleId: string
  driverId: string
  description: string
  status: 'open' | 'resolved'
  createdAt: string
}

export type Category = {
  id: string
  key: string
  label: string
  direction: 'in' | 'out'
  hint: string
  needsClient: boolean
  needsVehicle: boolean
  needsDriver: boolean
  isActive: boolean
  isSystem: boolean
}

export type Toast = { id: number; message: string; type: 'success' | 'error' }

// Rasm tanlash natijasi (kamera yoki galereya, siqilgan).
export type PickedPhoto = { uri: string; name: string; mimeType: string }

export type TripPayload = {
  vehicleId: string
  materialId: string
  clientId?: string | null
  saleType: SaleType
  weightTons: string | number
  hoursWorked: string | number
  note?: string
  photo?: PickedPhoto | null
}
export type PaymentPayload = { category?: string; amount: number; paymentMethod: PaymentMethod; clientId?: string | null; note?: string }
export type ExpensePayload = { category: string; amount: number; paymentMethod: PaymentMethod; vehicleId?: string | null; driverId?: string | null; note?: string }
export type TransactionEdit = {
  category: string
  amount: number
  paymentMethod: PaymentMethod
  clientId?: string | null
  vehicleId?: string | null
  driverId?: string | null
  note?: string
}
export type StaffPayload = {
  fullName: string
  login: string
  password: string
  generatePassword?: boolean
  phone: string
  title?: string
  roleId: string
  driverRatePerTrip: number
}
export type StaffResult = { ok?: boolean; userId?: string; login?: string; password?: string; fullName?: string; isSuperadmin?: boolean }
export type VehiclePayload = { plate: string; model: string; year?: number | null; driverId?: string | null; status?: VehicleStatus }
export type RolePayload = { id?: string; name: string; description?: string; grantsAll?: boolean; permissions?: string[] }
export type CategoryPayload = { label: string; hint?: string; direction: 'in' | 'out'; needsClient?: boolean; needsVehicle?: boolean; needsDriver?: boolean }
