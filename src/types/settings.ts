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
  haptics: true
}
