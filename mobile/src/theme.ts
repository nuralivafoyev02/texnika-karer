// Web ilovaning ranglari (tailwind.config.js) bilan bir xil.
export const colors = {
  ink: '#17231D',
  forest: '#0A4FA8',
  leaf: '#1F90FF',
  mint: '#E6F1FF',
  canvas: '#F5F7FB',
  card: '#FFFFFF',
  muted: '#6E7B8F',
  line: '#E7ECF3',
  amber: '#D28A30',
  amberBg: '#FFF7EB',
  amberLine: '#F2DFC2',
  amberText: '#764B16',
  danger: '#C94F4F',
  dangerBg: '#FDEEEE',
  success: '#1E9E6A',
  successBg: '#E5F6EE',
  navy: '#0B2F5E',
  placeholder: '#9AA6B6',
  overlay: 'rgba(11, 25, 48, 0.45)',
} as const

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, full: 999 } as const
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const

export const shadow = {
  soft: { shadowColor: '#102A54', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  float: { shadowColor: '#0F2346', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
} as const

export const font = { regular: 'System', size: { xs: 11, sm: 12, base: 14, md: 15, lg: 17, xl: 22, xxl: 28 } } as const
