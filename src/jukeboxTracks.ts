export type MusicTrack = "home" | "roster" | "battle";
export const JUKEBOX_TRACKS = [
  { id: "last-booth-blues", title: "Last Booth Blues", scene: "home" },
  { id: "neon-after-midnight", title: "Neon After Midnight", scene: "home" },
  { id: "grease-stained-45", title: "Grease-stained 45", scene: "roster" },
  { id: "chrome-and-coffee", title: "Chrome & Coffee", scene: "roster" },
  { id: "quarter-slot-shuffle", title: "Quarter Slot Shuffle", scene: "battle" },
  { id: "backroom-boogie", title: "Backroom Boogie", scene: "battle" },
] as const;

export const musicSource = (id: string) => `/music/jukebox/${id}.mp3`;
