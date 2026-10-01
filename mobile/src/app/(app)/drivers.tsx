import { Guard } from '@/components/Guard'
import { DriversScreen } from '@/components/screens/DriversScreen'

export default function DriversRoute() {
  return <Guard any={['staff.view', 'driver.self']}><DriversScreen /></Guard>
}
