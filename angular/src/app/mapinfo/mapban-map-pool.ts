import type { MapInfo } from "../observer/observer.component";

export type MapBanFormat = "bo1" | "bo3" | "bo5";

export interface MapBanSessionMap {
  name: string;
  score?: [number | null, number | null] | null;
  bannedBy?: number;
  pickedBy?: number;
  sidePickedBy?: number;
}

export interface MapBanSessionSnapshot {
  format: string;
  teams: { tricode: string }[];
  selectedMaps: MapBanSessionMap[];
}

export interface MapBanMapPool {
  left: MapInfo;
  center: MapInfo;
  right: MapInfo;
  currentMapNumber: number | null;
  mapCount: number;
  warning: string;
}

const disabled = (): MapInfo => ({ type: "Disabled", picker: "decider" });
const expectedMaps: Record<MapBanFormat, number> = { bo1: 1, bo3: 3, bo5: 5 };
const normalizeTricode = (tricode: string): string => tricode.trim().toUpperCase();

function pickerFor(map: MapBanSessionMap, slots: [number, number]): "left" | "right" | "decider" {
  // The decider belongs to neither team's map picks. In BO1, sidePickedBy
  // identifies the side chooser rather than the map picker.
  if (!Number.isInteger(map.pickedBy)) return "decider";
  if (map.pickedBy === slots[0]) return "left";
  if (map.pickedBy === slots[1]) return "right";
  throw new Error("MapBan returned a map picker that does not match either team");
}

function hasScore(map: MapBanSessionMap): boolean {
  return Array.isArray(map.score) && map.score.length === 2 &&
    map.score.every(score => Number.isInteger(score) && score !== null && score >= 0);
}

export function projectMapBanPool(
  snapshot: MapBanSessionSnapshot,
  clientLeftTricode: string,
  clientRightTricode: string,
): MapBanMapPool {
  if (!(snapshot.format in expectedMaps)) {
    throw new Error("MapBan format must be BO1, BO3 or BO5");
  }
  const format = snapshot.format as MapBanFormat;
  const count = expectedMaps[format];
  if (!Array.isArray(snapshot.teams) || snapshot.teams.length !== 2 ||
      !Array.isArray(snapshot.selectedMaps)) {
    throw new Error("MapBan session is missing teams or veto results");
  }
  const tricodes = snapshot.teams.map(team => normalizeTricode(team.tricode || ""));
  const leftSlot = tricodes.indexOf(normalizeTricode(clientLeftTricode));
  const rightSlot = tricodes.indexOf(normalizeTricode(clientRightTricode));
  if (leftSlot < 0 || rightSlot < 0 || leftSlot === rightSlot ||
      !clientLeftTricode.trim() || !clientRightTricode.trim()) {
    throw new Error("Spectra team tricodes must uniquely match the MapBan session teams");
  }
  const slots: [number, number] = [leftSlot, rightSlot];

  // Selected maps arrive in veto-action order. Ignore bans; picked/decider
  // entries are already chronological, including BO5 double-ban advantage.
  const maps = snapshot.selectedMaps.filter(map =>
    !Number.isInteger(map.bannedBy) &&
    (Number.isInteger(map.pickedBy) || Number.isInteger(map.sidePickedBy)),
  );
  if (maps.length !== count) {
    throw new Error(`MapBan veto not ready: found ${maps.length} of ${count} selected maps`);
  }

  let complete = 0;
  while (complete < count && hasScore(maps[complete])) complete++;
  const warning = maps.slice(complete + 1).some(hasScore)
    ? "Later map scores were entered before an earlier map. Using the first unscored map as current."
    : "";
  const current = complete < count ? complete : null;
  // For the deciding map, keep the previous two completed maps visible.
  // Earlier BO3/BO5 maps slide so the most recent finished map is on the left
  // and the next available map is on the right.
  const windowStart = count === 1 ? 0 :
    current === null || current === count - 1 ? count - 3 :
    current === 0 ? 0 : current - 1;
  const visible = maps.slice(windowStart, windowStart + Math.min(3, count));

  const toMapInfo = (map: MapBanSessionMap, absoluteIndex: number): MapInfo => {
    if (absoluteIndex < complete && hasScore(map)) {
      return {
        type: "Past", map: map.name,
        leftScore: map.score![leftSlot],
        rightScore: map.score![rightSlot],
      };
    }
    const picker = pickerFor(map, slots);
    if (absoluteIndex === current) return { type: "Present", picker };
    return { type: "Future", map: map.name, picker };
  };
  const results: MapInfo[] = visible.map((map, index) =>
    toMapInfo(map, windowStart + index));
  while (results.length < 3) results.push(disabled());

  return {
    left: results[0],
    center: results[1],
    right: results[2],
    currentMapNumber: current === null ? null : current + 1,
    mapCount: count,
    warning,
  };
}
