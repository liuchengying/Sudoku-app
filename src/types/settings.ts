export interface AppSettings {
  highlightRelated: boolean
  highlightSameDigit: boolean
  autoRemoveCandidates: boolean
  immediateErrorCheck: boolean
  autoPauseOnBackground: boolean
  disableCompletedDigit: boolean
  smartNotes: boolean
  sound: boolean
  haptics: boolean
  theme: 'light' | 'dark'
  largeDigits: boolean
  inputStyle: 'cell-first' | 'number-first'
  onboardingSeen: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  highlightRelated: true,
  highlightSameDigit: true,
  autoRemoveCandidates: true,
  immediateErrorCheck: true,
  autoPauseOnBackground: true,
  disableCompletedDigit: true,
  smartNotes: true,
  sound: true,
  haptics: true,
  theme: 'light',
  largeDigits: false,
  inputStyle: 'cell-first',
  onboardingSeen: false
}

export type BooleanSetting = { [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never }[keyof AppSettings]
