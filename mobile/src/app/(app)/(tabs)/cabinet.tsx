import { Guard } from '@/components/Guard'
import { DriversScreen } from '@/components/screens/DriversScreen'

export default function CabinetTab() {
  return <Guard permission="driver.self"><DriversScreen tabbed /></Guard>
}
