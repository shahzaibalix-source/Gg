export type SignalAspect = 'green' | 'amber' | 'red';

export interface TrafficSignalPhaseState {
  nsAspect: SignalAspect;
  ewAspect: SignalAspect;
}

/**
 * Shared 22-second traffic signal cycle updated in TrafficSignalClock:
 * 0..9s   : NS Green, EW Red
 * 9..11s  : NS Amber, EW Red
 * 11..20s : NS Red, EW Green
 * 20..22s : NS Red, EW Amber
 */
export const sharedTrafficSignals: TrafficSignalPhaseState = {
  nsAspect: 'green',
  ewAspect: 'red',
};

export function updateSharedTrafficSignals(elapsedSeconds: number): void {
  const cycle = ((elapsedSeconds % 22) + 22) % 22;
  if (cycle < 9) {
    sharedTrafficSignals.nsAspect = 'green';
    sharedTrafficSignals.ewAspect = 'red';
  } else if (cycle < 11) {
    sharedTrafficSignals.nsAspect = 'amber';
    sharedTrafficSignals.ewAspect = 'red';
  } else if (cycle < 20) {
    sharedTrafficSignals.nsAspect = 'red';
    sharedTrafficSignals.ewAspect = 'green';
  } else {
    sharedTrafficSignals.nsAspect = 'red';
    sharedTrafficSignals.ewAspect = 'amber';
  }
}
