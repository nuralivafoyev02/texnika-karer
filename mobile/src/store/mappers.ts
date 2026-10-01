import { monitoringStatus as monitoringStatusOf } from '@/lib/monitoring'
import type { Category, Client, MaintenanceReport, Material, Transaction, Trip, User, Vehicle } from './types'

// Supabase qatorlari (snake_case) → ilova obyektlari (camelCase). Web `quarry.js` bilan bir xil.
type Row = Record<string, any>

export const mapUser = (row: Row): User => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email ?? '',
  login: row.login ?? String(row.email ?? '').split('@')[0] ?? '',
  phone: row.phone ?? '',
  roleId: row.role_id,
  title: row.title ?? '',
  driverRatePerTrip: Number(row.driver_rate_per_trip ?? 0),
  isActive: row.is_active !== false,
  isSuperadmin: row.is_superadmin === true,
  avatarPath: row.avatar_path ?? '',
  avatarUrl: '',
})
export const mapClient = (row: Row): Client => ({
  id: row.id, name: row.name, phone: row.phone ?? '', contactName: row.contact_name ?? '',
  openingBalance: Number(row.opening_balance ?? 0), createdAt: row.created_at,
})
export const mapMaterial = (row: Row): Material => ({ id: row.id, name: row.name, unitPrice: Number(row.unit_price ?? 0), isActive: row.is_active !== false })
export const mapVehicle = (row: Row): Vehicle => ({
  id: row.id, plate: row.plate, model: row.model ?? '', driverId: row.driver_id ?? null,
  status: row.status ?? 'active', year: row.year ?? null,
})
export const mapTrip = (row: Row): Trip => ({
  id: row.id, vehicleId: row.vehicle_id, driverId: row.driver_id, clientId: row.client_id ?? null,
  materialId: row.material_id, weightTons: Number(row.weight_tons ?? 0), unitPrice: Number(row.unit_price ?? 0),
  totalAmount: Number(row.total_amount ?? 0), saleType: row.sale_type ?? 'credit',
  hoursWorked: Number(row.hours_worked ?? 0), photoPath: row.photo_path ?? '', photoUrl: '',
  note: row.note ?? '', createdAt: row.created_at, createdBy: row.created_by ?? null,
  monitoringStatus: monitoringStatusOf(row), monitoredAt: row.monitored_at ?? null,
  monitoringNote: row.monitoring_note ?? '', monitoredBy: row.monitored_by ?? null,
})
export const mapTransaction = (row: Row): Transaction => ({
  id: row.id, direction: row.direction, category: row.category, amount: Number(row.amount ?? 0),
  paymentMethod: row.payment_method ?? 'cash', clientId: row.client_id ?? null,
  driverId: row.driver_id ?? null, vehicleId: row.vehicle_id ?? null, tripId: row.trip_id ?? null,
  note: row.note ?? '', createdAt: row.created_at, createdBy: row.created_by ?? null,
  monitoringStatus: monitoringStatusOf(row), monitoredAt: row.monitored_at ?? null,
  monitoringNote: row.monitoring_note ?? '', monitoredBy: row.monitored_by ?? null,
})
export const mapReport = (row: Row): MaintenanceReport => ({
  id: row.id, vehicleId: row.vehicle_id, driverId: row.driver_id, description: row.description,
  status: row.status ?? 'open', createdAt: row.created_at,
})
export const mapCategory = (row: Row): Category => ({
  id: row.id, key: row.key, label: row.label, direction: row.direction === 'in' ? 'in' : 'out',
  hint: row.hint ?? '', needsClient: row.needs_client === true, needsVehicle: row.needs_vehicle === true,
  needsDriver: row.needs_driver === true, isActive: row.is_active !== false, isSystem: row.is_system === true,
})
