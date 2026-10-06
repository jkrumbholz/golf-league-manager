export interface FormatOption {
  id: string;
  label: string;
  team: boolean;
  teamSize: number | null;
  teamGross: boolean;
  runningTee: boolean;
}

export const FORMATS: FormatOption[] = [
  { id: 'stroke_play', label: 'Stroke Play (net)', team: false, teamSize: 1, teamGross: false, runningTee: false },
  { id: 'oceans_6', label: "Ocean's 6", team: false, teamSize: 1, teamGross: false, runningTee: false },
  { id: 'best_ball', label: 'Best Ball', team: true, teamSize: null, teamGross: false, runningTee: false },
  { id: 'high_ball', label: 'High Ball', team: true, teamSize: null, teamGross: false, runningTee: false },
  { id: 'vegas', label: 'Vegas', team: true, teamSize: 2, teamGross: false, runningTee: false },
  { id: 'up_and_back', label: 'Team Up & Back', team: true, teamSize: null, teamGross: false, runningTee: true },
  { id: 'vegas_up_and_back', label: 'Vegas Up & Back', team: true, teamSize: 2, teamGross: false, runningTee: true },
  { id: 'scramble', label: 'Scramble', team: true, teamSize: null, teamGross: true, runningTee: false },
  { id: 'alternate_shot', label: 'Alternate Shot', team: true, teamSize: 2, teamGross: true, runningTee: false },
  { id: 'low_high_total', label: 'Low / High / Combo', team: true, teamSize: 2, teamGross: false, runningTee: false },
];

export function formatOption(id: string): FormatOption {
  return FORMATS.find(format => format.id === id) ?? FORMATS[0];
}
