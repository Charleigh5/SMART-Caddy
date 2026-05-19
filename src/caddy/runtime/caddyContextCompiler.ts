import { ActiveCaddyContextCard } from './caddyTypes';

export function compileCaddyContext(
  profileId: string | null,
  round: any,
  hole: any,
  shots: any[],
  weather: any,
  clubs: any[]
): ActiveCaddyContextCard {
  const dataGaps = [];
  if (!profileId) dataGaps.push("No active profile");
  if (!round) dataGaps.push("No active round");
  if (!hole) dataGaps.push("No hole data");
  if (!weather) dataGaps.push("No weather data");
  if (!shots || shots.length === 0) dataGaps.push("No previous shots on this hole");
  
  return {
    profileId,
    roundId: round?.id || null,
    holeNumber: hole?.number || null,
    par: hole?.par || null,
    yardage: hole?.yardage || null,
    handicap: hole?.handicap || null,
    weather: weather || null,
    lastShots: shots || [],
    confirmedClubData: clubs || [],
    dataGaps
  };
}
