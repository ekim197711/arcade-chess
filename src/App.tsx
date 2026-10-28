import { CookieNotice } from "./CookieNotice";
import { SOUND_THEMES, resolveSoundTheme, boardSoundAsset, soundPreviewAsset, type SoundTheme, type BoardSound } from "./soundThemes";
import { BOSS_NAMES, resolveBossCharacter, bossPortrait as portraitFor } from "./bossArtwork";
import {
  EMPTY_PROGRESS, LEGACY_STAGE_TO_RUNG, normalizeProgress, mergeProgress,
  hasProgress, applyResult, ladderClears, type Progress, type PendingResult,
} from "./progress";
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Chess, freestyleFen, type PlayMode, type Color, type Square } from "./chess";
import {
  type Session,
  type User,
} from "@supabase/supabase-js";
import {
  ArrowDownToLine,
  ArrowRight,
  Bookmark,
  Flag,
  VolumeX,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gamepad2,
  LockKeyhole,
  LogIn,
  Menu,
  Music2,
  RotateCcw,
  Settings,
  Trophy,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { legalTargets } from "./bot";
import { PieceArtwork, PIECE_CHOICES, loadPieceStyle, type PieceStyle } from "./PieceArtwork";
import { DragSquare } from "./DragSquare";
import { PromotionMenu, type PromotionPiece, type PromotionPosition } from "./PromotionMenu";
import { BoardResizeHandle } from "./BoardResizeHandle";
import { CoinInsertAnimation, type CoinInsertAnimationHandle } from "./CoinInsertAnimation";
import { SegmentedCredits } from "./SegmentedCredits";
import { GameReview } from "./GameReview";
import { OnlinePlay } from "./OnlinePlay";
import { OnlineHomeCard } from "./OnlineHomeCard";
import { HumanElo } from "./HumanElo";
import { MatchHistory, MatchResult } from "./MatchHistory";
import { DancingBosses } from "./DancingBosses";
import { SignupDisclaimer } from "./SignupDisclaimer";
import { EmailAuth } from "./EmailAuth";
import { SignupPlans, readSignupPlan, PENDING_SIGNUP_PLAN_KEY, type SignupPlan } from "./SignupPlans";
import { requestStockfishMove, bossStrengthDescription } from "./stockfish";
import { type ArchivedMatch } from "./matchArchive";
import { supabase, supabaseConfiguration } from "./supabase";
import { useMatchHistory } from "./useMatchHistory";
import { premoveBoard, usePremoveQueue } from "./premoves";
import { normalizeMoveTimes, appendMoveTime } from "./moveTiming";
import type { MedievalPieceType, PieceColor } from "./MedievalPiece";

const BOSS_MASCOTS = [
  "👹",
  "🦊",
  "🐸",
  "🦈",
  "🤖",
  "🐲",
  "🦉",
  "🐙",
  "🦄",
  "🐯",
  "👾",
  "🦖",
  "🐼",
  "🧙",
  "🦁",
  "🐧",
  "🧛",
  "🐵",
  "🐺",
  "🦇",
];
const BOSS_ARCHETYPES = [
  {
    icon: "👹",
    color: "mint",
    taunts: [
      "{pilot}, I've seen a screensaver play better.",
      "That move belongs in the blunder museum!",
      "Keep feeding me pieces, button-masher.",
      "Your king's already writing its resignation.",
      "That wasn't a fork. You just dropped the cutlery.",
      "Your knight took an L. Literally and emotionally.",
      "{pilot}, is this an opening or a garage sale?",
      "Your pawns want a union. The working conditions are awful.",
      "I've seen scarier attacks from a low-battery notification.",
      "Your bishop went diagonal just to avoid this conversation.",
      "You call it a sacrifice. I call it free delivery.",
      "Your king moves one square because that's all he can afford.",
      "Your rook has spent so long in that corner it's paying rent.",
      "{pilot}, your attack came with batteries not included.",
      "That pawn's not passed. It's just lost.",
      "Your king tried to castle. The mortgage was declined.",
      "Your pieces are holding a meeting. You're not invited.",
      "I've seen tighter formations in a bag of popcorn.",
      "Your knight jumps over pieces to avoid being seen with them.",
      "That move came straight from the bottom of the cereal box.",
      "Your bishop's praying. I'm starting to understand why.",
      "I'd explain the threat, but your king just fainted.",
      "Your pawn reached the other side and asked for a different manager.",
      "Your plan has more holes than my victory socks.",
    ],
  },
  {
    icon: "👾",
    color: "pink",
    taunts: [
      "Aww, {pilot} thinks that was a plan.",
      "I've got more strategy in my boot screen!",
      "Your queen called. She wants a better pilot.",
      "Stop polishing that blunder and resign!",
      "Your queen has nine directions: eight away from you, plus quit.",
      "{pilot}, your strategy has the structural integrity of soup.",
      "That move needs a loading screen and an apology.",
      "Your rook asked for a transfer. To checkers.",
      "I set a trap. You brought snacks and moved in.",
      "Your pieces aren't hanging. They're doing extreme yoga.",
      "You developed your pieces straight into my lunch break.",
      "Even the undo button needs a minute after that one.",
      "Your position has been rated E for Easily Captured.",
      "{pilot}, did you select hard mode for your own pieces?",
      "Your queen rage-quit. That's why she left the board.",
      "That move unlocked an achievement: Oh No, Again.",
      "Your combo is blunder, blunder, loading screen.",
      "I'd offer you a hint, but we'd need a bigger text box.",
      "Your strategy guide is just a picture of crossed fingers.",
      "Your king's health bar just filed a complaint.",
      "You found the secret level. It's underneath rock bottom.",
      "That move had a cutscene. Everyone skipped it.",
      "Your pieces keep respawning in my trophy cabinet.",
      "Even the attract mode is trying to look away.",
    ],
  },
  {
    icon: "🦈",
    color: "blue",
    taunts: [
      "{pilot}, you play like your mouse is unplugged.",
      "I could mate you with my eyes closed!",
      "Nice move. Did you borrow it from a pigeon?",
      "Your king's in more danger than a floppy in a magnet shop!",
      "{pilot}, your defense has a welcome mat.",
      "Your king went for a swim. I brought the shark music.",
      "I smell a tactic. Oh, wait. That's your position burning.",
      "Your opening book appears to be a takeaway menu.",
      "That pawn push had all the menace of a damp sock.",
      "You're playing the long game. The very, very wrong game.",
      "Your knight needs a satnav and a responsible adult.",
      "You left that piece undefended. I respect the buffet format.",
      "{pilot}, your king's escape route is a waterslide into my mouth.",
      "Your attack made a splash. Mostly from falling overboard.",
      "I circled your weakness. Then ran out of pencil.",
      "Your pawn chain is held together with wet spaghetti.",
      "That knight is less cavalry, more pony ride outside a supermarket.",
      "Your queen's on a fishing trip. Shame about the hook.",
      "You're in deep water. Your rook appears to be inflatable.",
      "Your defense is a lifeguard who's afraid of water.",
      "I didn't bait that trap. You brought your own worm.",
      "Your king packed a snorkel. I admire the optimism.",
      "Your pieces formed a school. Nobody's passing.",
      "That move was chum. Very thoughtful of you.",
    ],
  },
  {
    icon: "🤖",
    color: "orange",
    taunts: [
      "Calculating... {pilot} has zero chance.",
      "Your tactics are a rounding error, meatbag!",
      "I've seen better defense on a loading screen.",
      "Surrender now; save what's left of your dignity.",
      "Error 404: compensation for that sacrifice not found.",
      "{pilot}, I ran your plan through spellcheck. It suggested 'panic'.",
      "Your king's firewall is made of cardboard.",
      "Scanning for threats... found one mildly annoyed pawn.",
      "I put your tactics in the recycle bin. It spat them back.",
      "Your position requires a patch. Possibly a whole new board.",
      "Beep boop. That blunder is now backed up to the cloud.",
      "Your pieces have entered power-saving mode. Permanently.",
      "{pilot}, your king has requested two-factor protection.",
      "I simulated your victory. The program crashed from disbelief.",
      "Your plan fits in one byte. Seven bits are still available.",
      "Task failed successfully. Your queen is gone.",
      "Your knight has Bluetooth. Unfortunately, it's paired with checkers.",
      "I asked the printer for your winning chances. It sent a blank page.",
      "Your bishop is running diagonally on Windows 95.",
      "Your defense uses the password 'password'.",
      "I'm not overheating. I'm laughing in binary.",
      "Your king clicked 'accept all threats'.",
      "Your tactics are still buffering. I'll capture something while we wait.",
      "I benchmarked your opening. The toaster won.",
    ],
  },
  {
    icon: "🦹",
    color: "purple",
    taunts: [
      "{pilot}, your king is begging for an uninstall.",
      "I predicted that blunder before you were born!",
      "Your opening was an invitation to get crushed.",
      "This is the part where the hero loses, rookie.",
      "I prepared a villain speech. Your move was funnier.",
      "{pilot}, that castle has a revolving door.",
      "Your counterattack arrived with a tiny white flag.",
      "I was going to set a trap, but you dug your own.",
      "Your queen deserves a better supporting cast.",
      "That wasn't a gambit. That was a donation with extra steps.",
      "Your master plan has a suspicious number of question marks.",
      "I ordered an epic battle. This came with training wheels.",
      "{pilot}, even my evil cat thinks that was excessive.",
      "My henchmen built a death ray. Your moves are cheaper.",
      "I'd reveal my evil plan, but yours is doing all the work.",
      "Your rescue mission now requires a rescue mission.",
      "Your king's dramatic escape is just walking into another threat.",
      "That bishop has the energy of a substitute henchman.",
      "I practiced my evil laugh. Please stop making me snort.",
      "Your queen came to defeat me and stayed for the dental plan.",
      "Your plot armor appears to be made of tissue paper.",
      "The prophecy mentioned a worthy opponent. Are they parking?",
      "You stormed my fortress through the gift shop.",
      "Your heroic comeback has been postponed due to missing heroes.",
    ],
  },
  {
    icon: "🐉",
    color: "red",
    taunts: [
      "Bow down, {pilot}. The mainframe owns this board!",
      "I have more processing power in one pawn.",
      "Your best move is to pull the plug and run.",
      "Checkmate is coming. Try not to cry in 16-bit.",
      "{pilot}, your king is now accepting thoughts and prayers.",
      "I breathe fire. You blunder fuel. We make a great team.",
      "Your fortress is three pawns in a trench coat.",
      "That move will look lovely on my victory screen.",
      "Your endgame needs a sequel where you still have pieces.",
      "I hoard gold. Apparently you hoard positional problems.",
      "Your knight brought a wooden sword to a dragon fight.",
      "Insert another coin. This one's paying for my snacks.",
      "{pilot}, I sneezed and your kingside became a historical site.",
      "Your rook is crunchy. Is there another one?",
      "Your knight's brave speech lasted longer than your attack.",
      "I sleep on treasure. You'll be sleeping on that blunder.",
      "Your king offered me a pawn. I asked if it came in a family bucket.",
      "That castle isn't fireproof. It's barely chessproof.",
      "Your army brought marshmallows. Finally, a sensible plan.",
      "My hoard has gold, jewels, and all your missing pieces.",
      "You sent a knight to slay me. He asked for a selfie.",
      "Your attack tickled. Do the other wing.",
      "Your queen demanded a rematch. I admire her frequent-flyer spirit.",
      "The final boss music started. Your king asked to turn it down.",
    ],
  },
];
const BOSSES = Array.from({ length: 59 }, (_, index) => {
  const archetype = BOSS_ARCHETYPES[Math.min(5, Math.floor(index / 10))]!;
  return {
    name: BOSS_NAMES[index]!,
    elo: 100 + index * 50,
    icon: BOSS_MASCOTS[index % BOSS_MASCOTS.length]!,
    character: resolveBossCharacter(BOSS_NAMES[index]!, __BOSS_PORTRAITS__),
    color: archetype.color,
    chessColor: index % 2 === 0 ? ("w" as const) : ("b" as const),
    taunts: archetype.taunts,
  };
});
const BOSS_EXCUSES = [
  "That was supposed to be a sacrifice. Probably.",
  "The board lagged. I totally moved it first.",
  "That piece was a decoy. A very expensive decoy.",
  "I was testing whether you knew how to capture.",
  "My piece wandered off. It does that sometimes.",
  "A tactical retreat! ...In the wrong direction.",
];

const STORAGE_KEY = "neon-knights-progress-v1";
const SAVED_MATCH_KEY = "neon-knights-saved-match-v1";
const SOUND_KEY = "neon-knights-sound-v1";
const SOUND_THEME_KEY = "arcade-chess-sound-theme-v1";
const DEBUG_MODE_KEY = "arcade-chess-debug-mode-v1";
const IS_DEVELOPMENT_ENVIRONMENT = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const MUSIC_KEY = "neon-knights-music-v1";
const SFX_VOLUME_KEY = "neon-knights-sfx-volume-v1";
const MUSIC_VOLUME_KEY = "neon-knights-music-volume-v1";
const PIECE_THEME_KEY = "arcade-chess-piece-theme-v1";
const BOARD_COLORS_KEY = "arcade-chess-board-colors-v1";
const BOARD_SIZE_KEY = "arcade-chess-board-size-v1";
const CREDIT_COUNT_KEY = "arcade-chess-credit-count-v1";
const MAX_CREDITS = 99;
const BOARD_PALETTES = [
  { id: "classic", label: "CLASSIC", light: "#d8bd91", dark: "#352317" },
  { id: "ocean", label: "OCEAN", light: "#c4e1ea", dark: "#345b7e" },
  { id: "forest", label: "FOREST", light: "#d9e6b8", dark: "#456345" },
  { id: "violet", label: "VIOLET", light: "#e4d6f1", dark: "#61467c" },
  { id: "arcade", label: "ARCADE", light: "#a9dfd6", dark: "#286b78" },
  { id: "sunset", label: "SUNSET", light: "#f0c99d", dark: "#87483b" },
] as const;
type BoardPaletteId = (typeof BOARD_PALETTES)[number]["id"];
type BoardColors = { light: string; dark: string };
const DEFAULT_BOARD_PALETTE: BoardPaletteId = "forest";
const ACCOUNT_STORAGE_PREFIX = "neon-knights-account-v1:";
const PENDING_STORAGE_PREFIX = "neon-knights-pending-v1:";
const MERGE_STORAGE_PREFIX = "neon-knights-merge-v1:";

function readPieceTheme(): PieceStyle {
  try {
    const savedTheme = localStorage.getItem(PIECE_THEME_KEY);
    if (savedTheme === "granite") return "granite-3d";
    return (
      PIECE_CHOICES.find((choice) => choice.id === savedTheme)?.id ??
      "granite-3d"
    );
  } catch {
    return "granite-3d";
  }
}

function readBoardSize(): number | undefined {
  try {
    const width = Number(localStorage.getItem(BOARD_SIZE_KEY));
    return Number.isFinite(width) && width > 0 ? width : undefined;
  } catch {
    return undefined;
  }
}

function readCoinCount(): number {
  try {
    const savedCredits = Number(localStorage.getItem(CREDIT_COUNT_KEY));
    return Number.isFinite(savedCredits)
      ? Math.min(MAX_CREDITS, Math.max(0, Math.floor(savedCredits)))
      : 0;
  } catch {
    return 0;
  }
}

function readBoardPalette(): BoardPaletteId {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(BOARD_COLORS_KEY) ?? "null",
    );
    if (typeof saved === "string") {
      return (
        BOARD_PALETTES.find((palette) => palette.id === saved)?.id ??
        DEFAULT_BOARD_PALETTE
      );
    }
    if (saved && typeof saved === "object") {
      const colors = saved as Partial<BoardColors>;
      return (
        BOARD_PALETTES.find(
          (palette) =>
            palette.light === colors.light && palette.dark === colors.dark,
        )?.id ?? DEFAULT_BOARD_PALETTE
      );
    }
    return DEFAULT_BOARD_PALETTE;
  } catch {
    return DEFAULT_BOARD_PALETTE;
  }
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];
const PIECE_NAMES: Record<MedievalPieceType, string> = {
  p: "peasant",
  n: "knight",
  b: "bishop",
  r: "rook guard",
  q: "queen",
  k: "king",
};
const MATERIAL_POINTS: Record<MedievalPieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function getMaterialPoints(pieces: Record<MedievalPieceType, number>) {
  return (Object.keys(MATERIAL_POINTS) as MedievalPieceType[]).reduce(
    (total, piece) => total + MATERIAL_POINTS[piece] * pieces[piece],
    0,
  );
}

type BotMoveData = { from: Square; to: Square; promotion?: string };
type Premove = { from: Square; to: Square; position?: PromotionPosition };
type PromotionMove = { from: Square; to: Square; fen: string; matchId: string; position: PromotionPosition; queued?: boolean };
type SavedMatch = { bossIndex: number; pgn: string; tauntIndex: number; id?: string; startedAt?: string; debug?: boolean; moveTimesMs?: (number | null)[]; turnStartedAt?: number };
type OpponentLine = { label: "TAUNT" | "EXCUSE"; text: string };

function readProgress(key = STORAGE_KEY): Progress {
  try {
    const raw = localStorage.getItem(key);
    return raw
      ? normalizeProgress(JSON.parse(raw) as Partial<Progress>)
      : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
}

function newEventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
    },
  );
}

function pendingStorageKey(userId: string) {
  return `${PENDING_STORAGE_PREFIX}${userId}`;
}

function guestMergeStorageKey(userId: string) {
  return `${MERGE_STORAGE_PREFIX}${userId}`;
}

function getGuestMergeId(userId: string) {
  const key = guestMergeStorageKey(userId);
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = newEventId();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return newEventId();
  }
}

function readPendingResults(userId: string): PendingResult[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(pendingStorageKey(userId)) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    const events = (value as Partial<PendingResult>[]).flatMap((event) => {
      if (
        typeof event.id !== "string" ||
        (event.result !== "win" && event.result !== "loss") ||
        !Number.isInteger(event.bossIndex)
      )
        return [];
      const oldIndex = Math.max(0, Math.min(6, event.bossIndex ?? 0));
      return [
        {
          id: event.id,
          result: event.result,
          bossIndex:
            Number(event.progressionVersion) >= 2
              ? Math.max(0, Math.min(BOSSES.length - 1, event.bossIndex ?? 0))
              : (LEGACY_STAGE_TO_RUNG[oldIndex] ?? 0),
          progressionVersion: 3,
          mode: event.mode === "freestyle" ? "freestyle" as const : "standard" as const,
        },
      ];
    });
    writePendingResults(userId, events);
    return events;
  } catch {
    return [];
  }
}

function writePendingResults(userId: string, events: PendingResult[]) {
  try {
    localStorage.setItem(pendingStorageKey(userId), JSON.stringify(events));
  } catch {
    // The current session can continue even if offline events cannot be cached.
  }
}

type ArcadeSound =
  | "move"
  | "capture"
  | "lost"
  | "win"
  | "coin"
  | "coin-return"
  | "start"
  | "select"
  | "deselect"
  | "ui"
  | "navigate"
  | "drag";

function readSoundTheme(): SoundTheme {
  try { return resolveSoundTheme(localStorage.getItem(SOUND_THEME_KEY)); }
  catch { return resolveSoundTheme(null); }
}

let lastBoardSound: Promise<number> = Promise.resolve(0);
function playBoardSound(kind: BoardSound, enabled: boolean, theme: SoundTheme) {
  if (!enabled) return;
  try {
    const context = getAudioContext();
    if (context.state === "suspended") void context.resume();
    const asset = boardSoundAsset(theme, kind);
    const resultCue = kind === "win" || kind === "lose";
    const previous = resultCue ? lastBoardSound : Promise.resolve(0);
    lastBoardSound = Promise.all([loadBoardSoundBuffer(asset.url, context), previous]).then(async ([buffer, previousEnd]) => {
      if (context.state === "suspended") await context.resume();
      const start = resultCue ? Math.max(context.currentTime, previousEnd) : context.currentTime;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(asset.volume * arcadeSfxVolume, start);
      source.connect(gain);
      gain.connect(context.destination);
      source.start(start);
      return start + buffer.duration;
    }).catch(() => 0);
  } catch {
    // Audio is optional; gameplay remains available if the browser blocks it.
  }
}

let soundThemePreview: AudioBufferSourceNode | null = null;
let soundThemePreviewRequest = 0;
function previewSoundTheme(theme: SoundTheme, enabled: boolean) {
  if (!enabled) return;
  try {
    const asset = soundPreviewAsset(theme);
    const request = ++soundThemePreviewRequest;
    soundThemePreview?.stop();
    soundThemePreview = null;
    if (!asset) return;
    const context = getAudioContext();
    if (context.state === "suspended") void context.resume();
    void loadBoardSoundBuffer(asset.url, context).then((buffer) => {
      if (request !== soundThemePreviewRequest) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = asset.volume * arcadeSfxVolume;
      source.connect(gain);
      gain.connect(context.destination);
      soundThemePreview = source;
      source.start();
    }).catch(() => {});
  } catch {
    // Theme previews are optional; gameplay remains available if audio is blocked.
  }
}

function boardSoundForMove(move: {
  flags: string;
  san: string;
  color: Color;
  captured?: string;
}, game: Chess, playerColor: Color): BoardSound {
  if (game.isCheckmate()) return "checkmate";
  if (move.san.endsWith("+")) return "check";
  if (move.flags.includes("e")) return "en-passant";
  if (move.flags.includes("k") || move.flags.includes("q")) return "castling";
  if (move.captured) return move.color === playerColor ? "capture" : "lost";
  return "move";
}

let audioContext: AudioContext | null = null;
let musicAudio: HTMLAudioElement | null = null;
let musicTrack: MusicTrack = "home";
let arcadeSfxVolume = 0.85;
let arcadeMusicVolume = 0.7;

function readVolume(key: string, fallback: number) {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallback;
    const volume = Number(saved);
    return Number.isFinite(volume) ? Math.max(0, Math.min(100, volume)) : fallback;
  } catch {
    return fallback;
  }
}

function getAudioContext() {
  audioContext ??= new AudioContext();
  return audioContext;
}

const boardSoundBuffers = new Map<string, Promise<AudioBuffer>>();
function loadBoardSoundBuffer(url: string, context: AudioContext) {
  let buffer = boardSoundBuffers.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Sound file unavailable: ${url}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((decoded) => {
        // Quiet theme recordings need gain before the user's volume control.
        // Limit amplification and leave headroom for overlapping effects.
        let peak = 0;
        for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
          for (const sample of decoded.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
        }
        const boost = peak > 0 ? Math.max(1, Math.min(16, 0.75 / peak)) : 1;
        for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
          const samples = decoded.getChannelData(channel);
          for (let index = 0; index < samples.length; index++) samples[index] *= boost;
        }
        return decoded;
      })
      .catch((error: unknown) => {
        boardSoundBuffers.delete(url);
        throw error;
      });
    boardSoundBuffers.set(url, buffer);
  }
  return buffer;
}

function playArcadeSound(kind: ArcadeSound, enabled: boolean) {
  if (!enabled) return;
  try {
    const context = getAudioContext();
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    const notes =
      kind === "coin"
        ? [1318, 1760, 2349]
        : kind === "coin-return"
          ? [1047, 698, 392]
          : kind === "capture"
            ? [220, 680, 1040]
            : kind === "lost"
              ? [520, 310, 150]
              : kind === "win"
                ? [440, 660, 880, 1320]
                : kind === "start"
                  ? [330, 495, 660]
                  : kind === "select"
                    ? [760, 1020]
                    : kind === "deselect"
                      ? [640, 430]
                      : kind === "navigate"
                        ? [520, 780]
                        : kind === "drag"
                          ? [350, 510]
                          : kind === "ui"
                            ? [820]
                            : [430, 560];
    const duration =
      kind === "coin"
        ? 0.16
        : kind === "coin-return"
          ? 0.2
          : kind === "ui"
            ? 0.075
            : kind === "select" || kind === "deselect"
              ? 0.11
              : 0.2;
    const volume =
      kind === "coin" || kind === "coin-return"
        ? 0.055
        : kind === "move" ||
            kind === "ui" ||
            kind === "select" ||
            kind === "deselect"
          ? 0.035
          : kind === "navigate" || kind === "drag"
            ? 0.045
            : 0.075;
    notes.forEach((frequency, index) => {
      const start = now + index * 0.055;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type =
        kind === "capture" ||
        kind === "lost" ||
        kind === "coin-return" ||
        kind === "drag" ||
        kind === "ui"
          ? "square"
          : "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(70, frequency * (kind === "ui" ? 0.85 : 0.62)),
        start + duration * 0.65,
      );
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * arcadeSfxVolume), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    });
  } catch {
    // Audio is an enhancement; the game remains playable if the browser blocks it.
  }
}

type MusicTrack = "home" | "roster" | "battle";

const MUSIC_SOURCES: Record<MusicTrack, string> = {
  home: "/music/quiet-combo-preview.mp3",
  roster: "/music/choose-your-rival-loop.ogg",
  battle: "/music/opening-move-loop.ogg",
};

function startArcadeMusic(track: MusicTrack = musicTrack) {
  try {
    if (!musicAudio) {
      musicAudio = new Audio(MUSIC_SOURCES[track]);
      musicAudio.loop = true;
      musicAudio.preload = "auto";
      musicAudio.volume = 0.3 * arcadeMusicVolume;
    } else if (musicTrack !== track) {
      musicAudio.pause();
      musicAudio.src = MUSIC_SOURCES[track];
      musicAudio.load();
    }
    musicTrack = track;
    void musicAudio.play().catch(() => {});
  } catch {
    // Music is optional; interaction and gameplay remain available without audio.
  }
}

function stopArcadeMusic() {
  musicAudio?.pause();
}

function resultFor(
  game: Chess,
  bossColor: PieceColor,
): "win" | "loss" | "draw" | null {
  if (!game.isGameOver()) return null;
  if (game.isDraw()) return "draw";
  return game.turn() === bossColor ? "win" : "loss";
}

function readPageRoute() {
  const route = window.location.hash.slice(1);
  // Old anchor links and unknown routes should always land on a usable page.
  return /^(home|roster|battle|settings)$/.test(route) || /^(review|result)(\/[^/]+)?$/.test(route) || /^online(?:\/(?:review\/)?[\w-]+|\/new\/(?:3|5|10|15))?$/.test(route)
    ? route
    : "home";
}

function restoreGame(pgn: string) {
  const game = new Chess();
  if (pgn) game.loadPgn(pgn);
  return game;
}

function readSavedMatch(): SavedMatch | null {
  try {
    const raw = localStorage.getItem(SAVED_MATCH_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedMatch>;
    if (value.debug && !IS_DEVELOPMENT_ENVIRONMENT) return null;
    if (
      !Number.isInteger(value.bossIndex) ||
      value.bossIndex! < 0 ||
      value.bossIndex! >= BOSSES.length ||
      typeof value.pgn !== "string"
    )
      return null;
    const game = restoreGame(value.pgn);
    if (game.isGameOver()) return null;
    return {
      bossIndex: value.bossIndex!,
      pgn: value.pgn,
      id: typeof value.id === "string" ? value.id : undefined,
      startedAt: typeof value.startedAt === "string" && Number.isFinite(Date.parse(value.startedAt))
        ? value.startedAt : undefined,
      moveTimesMs: normalizeMoveTimes(value.moveTimesMs, game.history().length),
      turnStartedAt: typeof value.turnStartedAt === "number" && Number.isFinite(value.turnStartedAt) ? value.turnStartedAt : Date.now(),
      tauntIndex: Math.max(0, Math.floor(Number(value.tauntIndex) || 0)),
      debug: value.debug === true,
    };
  } catch {
    return null;
  }
}

function App() {
  const [cookieNoticeReset, setCookieNoticeReset] = useState(0);
  const [debugEnabled, setDebugMode] = useState(() => {
    if (!IS_DEVELOPMENT_ENVIRONMENT) return false;
    try { return localStorage.getItem(DEBUG_MODE_KEY) === "true"; } catch { return false; }
  });
  const debugMode = IS_DEVELOPMENT_ENVIRONMENT && debugEnabled;
  useEffect(() => {
    try { localStorage.setItem(DEBUG_MODE_KEY, String(debugMode)); } catch { /* Keep the session setting. */ }
  }, [debugMode]);
  const [guestProgress, setGuestProgress] = useState<Progress>(() =>
    readProgress(),
  );
  const [accountProgress, setAccountProgress] = useState<Progress | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [cloudSyncError, setCloudSyncError] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [signupTermsAccepted, setSignupTermsAccepted] = useState(false);
  const [signupPlan, setSignupPlan] = useState<SignupPlan>(readSignupPlan);
  useEffect(() => {
    if (!authOpen) setSignupTermsAccepted(false);
  }, [authOpen]);
  useEffect(() => {
    if (!user) return;
    let plan: string | null;
    try { plan = localStorage.getItem(PENDING_SIGNUP_PLAN_KEY); } catch { return; }
    if (plan !== "free" && plan !== "very-free") return;
    let active = true;
    // OAuth redirects back to this browser; attach its chosen tier to the account.
    void supabase?.auth.updateUser({ data: { arcade_plan: plan } }).then(({ data, error }) => {
      if (!active) return;
      if (error) { showToast("PLAN CHOICE COULD NOT SYNC — PLEASE TRY SIGNING IN AGAIN"); return; }
      if (data.user) setUser(data.user);
      try {
        if (localStorage.getItem(PENDING_SIGNUP_PLAN_KEY) === plan) localStorage.removeItem(PENDING_SIGNUP_PLAN_KEY);
      } catch { /* The saved account preference is already committed. */ }
    }).catch(() => { if (active) showToast("PLAN CHOICE COULD NOT SYNC — PLEASE TRY SIGNING IN AGAIN"); });
    return () => { active = false; };
  }, [user?.id]);
  const [authMessage, setAuthMessage] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [sfxVolume, setSfxVolume] = useState(() => readVolume(SFX_VOLUME_KEY, 85));
  const [soundTheme, setSoundTheme] = useState<SoundTheme>(() => readSoundTheme());
  const [musicEnabled, setMusicEnabled] = useState(() => {
    try {
      return localStorage.getItem(MUSIC_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [musicVolume, setMusicVolume] = useState(() => readVolume(MUSIC_VOLUME_KEY, 70));
  const [pieceTheme, setPieceTheme] = useState<PieceStyle>(() =>
    readPieceTheme(),
  );
  const [loadingPieceStyle, setLoadingPieceStyle] = useState(false);

  async function changePieceStyle(theme: PieceStyle) {
    if (theme === pieceTheme || loadingPieceStyle) return;
    setLoadingPieceStyle(true);
    try {
      await loadPieceStyle(theme);
      setPieceTheme(theme);
    } catch {
      showToast("PIECE STYLE COULD NOT LOAD — PLEASE TRY AGAIN");
    } finally {
      setLoadingPieceStyle(false);
    }
  }
  const [boardPaletteId, setBoardPaletteId] = useState<BoardPaletteId>(() =>
    readBoardPalette(),
  );
  const boardPalette =
    BOARD_PALETTES.find((palette) => palette.id === boardPaletteId) ??
    BOARD_PALETTES[0];
  const [opponentColumnCollapsed, setOpponentColumnCollapsed] = useState(false);
  const [playerColumnCollapsed, setPlayerColumnCollapsed] = useState(false);
  const [boardWidth, setBoardWidth] = useState<number | undefined>(readBoardSize);
  const { history, setHistory, historyError, historyCloudError } = useMatchHistory(user?.id ?? (authReady ? null : undefined));
  const [savedMatch, setSavedMatch] = useState<SavedMatch | null>(readSavedMatch);
  const matchId = useRef<string>(savedMatch?.id ?? crypto.randomUUID());
  const matchStarted = useRef(savedMatch?.startedAt ?? history.find((item) => item.id === savedMatch?.id)?.startedAt ?? new Date().toISOString());
  const matchSaveFailed = useRef(false);
  const [route, setRoute] = useState(readPageRoute);
  const screen = route.split("/")[0];
  const isReviewPage = screen === "review" || (screen === "online" && route.split("/")[1] === "review");
  const activeMusicTrack: MusicTrack = screen === "battle" || (screen === "online" && !!route.split("/")[1] && !route.startsWith("online/review/")) ? "battle" : screen === "roster" ? "roster" : "home";
  const musicTrackRef = useRef(activeMusicTrack); musicTrackRef.current = activeMusicTrack;
  function setScreen(page: string) { window.location.hash = page; setRoute(page); }
  useEffect(() => {
    const change = () => setRoute(readPageRoute());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const selectedMatch = history.find((match) => match.id === route.split("/")[1]);
  const [playMode, setPlayMode] = useState<PlayMode>(() => {
    const savedMode = savedMatch ? restoreGame(savedMatch.pgn).mode : "standard";
    if (screen === "battle") return savedMode;
    try {
      const mode = localStorage.getItem("arcade-chess-ladder-mode");
      return mode === "freestyle" || mode === "standard" ? mode : savedMode;
    } catch { return savedMode; }
  });
  const activeMode = useRef(playMode);
  activeMode.current = playMode;
  useEffect(() => {
    try { localStorage.setItem("arcade-chess-ladder-mode", playMode); } catch { /* Keep the selected ladder in memory. */ }
  }, [playMode]);
  const [bossIndex, setBossIndex] = useState(() =>
    savedMatch && restoreGame(savedMatch.pgn).mode === playMode ? savedMatch.bossIndex
      : Math.min(ladderClears(readProgress(), playMode), BOSSES.length - 1),
  );

  const [coinCount, setCoinCount] = useState(readCoinCount);
  const creditMessageRef = useRef<HTMLSpanElement>(null);
  const [coinAnimationReady, setCoinAnimationReady] = useState(false);
  const coinAnimation = useRef<CoinInsertAnimationHandle>(null);
  const markCoinAnimationReady = useCallback(() => setCoinAnimationReady(true), []);
  const [tauntIndex, setTauntIndex] = useState(savedMatch?.tauntIndex ?? 0);
  const [excuseIndex, setExcuseIndex] = useState(0);
  const [opponentLine, setOpponentLine] = useState<OpponentLine | null>(null);
  const [pgn, setPgn] = useState(savedMatch?.pgn ?? "");
  const moveTiming = useRef({ times: savedMatch?.moveTimesMs ?? [] as (number | null)[], turnStartedAt: savedMatch?.turnStartedAt ?? Date.now() });
  const [reviewPly, setReviewPly] = useState<number | null>(null);
  const { premoves, setPremoves, takePremove } = usePremoveQueue<Premove>();
  const [promotionMove, setPromotionMove] = useState<PromotionMove | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    () => {
      const moves = restoreGame(savedMatch?.pgn ?? "").history({ verbose: true });
      const move = moves[moves.length - 1];
      return move ? { from: move.from, to: move.to } : null;
    },
  );
  const [thinking, setThinking] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [engineRetry, setEngineRetry] = useState(0);
  const [resigned, setResigned] = useState(false);
  const [debugMatch, setDebugMatch] = useState(savedMatch ? savedMatch.debug === true : debugMode);
  const [debugCheckmate, setDebugCheckmate] = useState(false);
  const [opponentMood, setOpponentMood] = useState<"angry" | "happy" | null>(
    null,
  );
  const [toast, setToast] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const finishedFen = useRef("");
  const requestedUserId = useRef<string | null | undefined>(undefined);
  const loadSequence = useRef(0);
  const activeUserId = useRef<string | null>(null);
  const rosterListRef = useRef<HTMLDivElement | null>(null);
  const moveLogRef = useRef<HTMLDivElement | null>(null);
  const bossRowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const authDialogRef = useRef<HTMLElement | null>(null);
  const helpDialogRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const moodTimer = useRef<number | undefined>(undefined);

  const game = useMemo(() => restoreGame(pgn), [pgn]);
  const savedMode = useMemo(() => savedMatch ? restoreGame(savedMatch.pgn).mode : null, [savedMatch]);
  const canResumeSelectedMatch = savedMatch?.bossIndex === bossIndex && savedMode === playMode && (!savedMatch.debug || debugMode);
  useEffect(() => {
    if (!user || screen === "battle") return;
    const unfinished = history.find((match) => match.result === "unfinished" && (!match.debug || debugMode));
    setSavedMatch(unfinished ? { ...unfinished, tauntIndex: 0 } : null);
  }, [history, user, screen, debugMode]);
  const fen = game.fen();
  const moveHistory = useMemo(() => game.history({ verbose: true }), [game]);
  const reviewing = reviewPly !== null;
  const viewedMove = reviewing ? moveHistory[reviewPly - 1] : null;
  const viewedGame = useMemo(
    () => viewedMove ? new Chess(viewedMove.after) : game,
    [game, viewedMove],
  );
  const viewedLastMove = reviewing ? viewedMove : lastMove;
  const boss = BOSSES[bossIndex] ?? BOSSES[0]!;
  const playerColor: PieceColor = boss.chessColor === "w" ? "b" : "w";
  const premoveTurn =
    screen === "battle" &&
    !reviewing &&
    game.turn() === boss.chessColor &&
    !game.isGameOver() &&
    !resigned;
  const plannedBoard = useMemo(() => premoveBoard(game, promotionMove?.queued ? [promotionMove, ...premoves] : premoves, playerColor), [game, premoves, promotionMove, playerColor]);
  const queuingPremove = premoveTurn || premoves.length > 0;
  const boardFiles = playerColor === "w" ? FILES : [...FILES].reverse();
  const boardRanks = playerColor === "w" ? RANKS : [...RANKS].reverse();
  const capturedByColor = useMemo(() => {
    const counts: Record<PieceColor, Record<MedievalPieceType, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    };
    for (const move of moveHistory.slice(0, reviewPly ?? moveHistory.length)) {
      if (move.captured) {
        const capturedColor = move.color === "w" ? "b" : "w";
        counts[capturedColor][move.captured] += 1;
      }
    }
    return counts;
  }, [moveHistory, reviewPly]);
  const materialOnBoard = useMemo(() => {
    const totals: Record<PieceColor, number> = { w: 0, b: 0 };
    for (const rank of viewedGame.board()) {
      for (const piece of rank) {
        if (piece) totals[piece.color] += MATERIAL_POINTS[piece.type];
      }
    }
    return totals;
  }, [viewedGame]);
  const materialAdvantage =
    materialOnBoard[playerColor] - materialOnBoard[boss.chessColor];
  const materialLeadLabel =
    materialAdvantage > 0
      ? `YOU +${materialAdvantage}`
      : materialAdvantage < 0
        ? `BOSS +${Math.abs(materialAdvantage)}`
        : "EVEN";
  const materialLeadClass =
    materialAdvantage > 0
      ? "material-player-ahead"
      : materialAdvantage < 0
        ? "material-boss-ahead"
        : "material-even";
  const legalMoves = useMemo(() => {
    if (reviewing || !selectedSquare) return [];
    return queuingPremove
      ? plannedBoard.targets(selectedSquare)
      : legalTargets(fen, selectedSquare);
  }, [fen, plannedBoard, queuingPremove, reviewing, selectedSquare]);
  const currentResult = debugCheckmate ? "win" : resigned ? "loss" : resultFor(game, boss.chessColor);
  // Save both sides' moves, including positions where the bot still needs to play.
  useEffect(() => {
    if (screen === "battle" && !currentResult) persistCurrentMatch();
  }, [pgn, bossIndex, tauntIndex, screen, currentResult, matchId.current]);
  const bossExpression =
    currentResult === "win"
      ? "lost"
      : currentResult === "loss"
        ? "won"
        : opponentMood === "angry"
          ? "angry"
          : opponentMood === "happy"
            ? "taunting"
            : "focused";
  useEffect(() => {
    if (screen !== "battle") return;
    const record: ArchivedMatch = {
      id: matchId.current, startedAt: matchStarted.current, updatedAt: new Date().toISOString(),
      bossIndex, opponent: boss.name, playerName: user ? playerName : "Guest player", elo: boss.elo, color: playerColor, pgn,
      result: currentResult ?? "unfinished", debug: debugMatch, moveTimesMs: normalizeMoveTimes(moveTiming.current.times, moveHistory.length),
      reason: debugCheckmate ? "Debug auto checkmate (simulated)" : resigned ? "Resignation" : game.isCheckmate() ? "Checkmate" : game.isStalemate() ? "Stalemate" : game.isThreefoldRepetition() ? "Threefold repetition" : game.isInsufficientMaterial() ? "Insufficient material" : game.isDraw() ? "Draw by the fifty-move rule" : "Match in progress",
    };
    setHistory((previous) => {
      const existing = previous.find((item) => item.id === record.id);
      const next = [{ ...record, playerName: existing?.playerName ?? record.playerName }, ...previous.filter((item) => item.id !== record.id)];
      return next;
    });
    if (currentResult) setScreen(`result/${record.id}`);
  }, [pgn, currentResult, screen, bossIndex, debugMatch, setHistory]);
  const progress = user ? (accountProgress ?? EMPTY_PROGRESS) : guestProgress;
  const clearedBosses = ladderClears(progress, playMode);

  const playerName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "PLAYER ONE";
  const avatarInitial = playerName.trim().charAt(0).toUpperCase() || "P";
  const avatarUrl = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const playerAvatar = typeof avatarUrl === "string" && /^https?:\/\//i.test(avatarUrl) && failedAvatar !== avatarUrl
    ? <img className="player-avatar-image" src={avatarUrl} alt={`${playerName}'s avatar`} referrerPolicy="no-referrer" onError={() => setFailedAvatar(avatarUrl)} /> : avatarInitial;
  const currentTaunt = (
    boss.taunts[tauntIndex % boss.taunts.length] ?? "You're going down, rookie."
  ).replace("{pilot}", user ? playerName : "rookie");

  useEffect(() => {
    if (screen !== "roster") return;
    const list = rosterListRef.current;
    const row = bossRowRefs.current[bossIndex];
    if (!list || !row) return;
    const frame = window.requestAnimationFrame(() => {
      const listTop = list.getBoundingClientRect().top;
      const rowTop = row.getBoundingClientRect().top;
      const targetTop =
        list.scrollTop +
        rowTop -
        listTop -
        (list.clientHeight - row.clientHeight) / 2;
      list.scrollTo({
        top: Math.max(
          0,
          Math.min(targetTop, list.scrollHeight - list.clientHeight),
        ),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screen, bossIndex]);

  useEffect(() => {
    if (!debugMode && screen !== "battle" && bossIndex > clearedBosses && !canResumeSelectedMatch) {
      setBossIndex(Math.min(clearedBosses, BOSSES.length - 1));
    }
  }, [bossIndex, clearedBosses, canResumeSelectedMatch, debugMode, screen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guestProgress));
    } catch {
      /* Storage can be unavailable in private mode. */
    }
  }, [guestProgress]);

  useEffect(() => {
    if (!user || !accountProgress) return;
    try {
      localStorage.setItem(
        `${ACCOUNT_STORAGE_PREFIX}${user.id}`,
        JSON.stringify(accountProgress),
      );
    } catch {
      /* The remote account remains the source of truth if storage is unavailable. */
    }
  }, [accountProgress, user]);

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
    } catch {
      /* Ignore unavailable storage. */
    }
  }, [soundEnabled]);

  useEffect(() => {
    arcadeSfxVolume = sfxVolume / 100;
    try {
      localStorage.setItem(SFX_VOLUME_KEY, String(sfxVolume));
    } catch {
      /* The volume remains available for this session. */
    }
  }, [sfxVolume]);

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_THEME_KEY, soundTheme);
    } catch {
      /* The selected sound theme remains available for this session. */
    }
  }, [soundTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_KEY, musicEnabled ? "on" : "off");
    } catch {
      /* Ignore unavailable storage. */
    }
  }, [musicEnabled]);

  useEffect(() => {
    arcadeMusicVolume = musicVolume / 100;
    if (musicAudio) musicAudio.volume = 0.3 * arcadeMusicVolume;
    try {
      localStorage.setItem(MUSIC_VOLUME_KEY, String(musicVolume));
    } catch {
      /* The volume remains available for this session. */
    }
  }, [musicVolume]);

  useEffect(() => {
    try {
      localStorage.setItem(PIECE_THEME_KEY, pieceTheme);
    } catch {
      /* The style remains available for the current session. */
    }
  }, [pieceTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(BOARD_COLORS_KEY, JSON.stringify(boardPaletteId));
    } catch {
      /* The colors remain available for the current session. */
    }
  }, [boardPaletteId]);

  useEffect(() => {
    try {
      if (boardWidth === undefined) localStorage.removeItem(BOARD_SIZE_KEY);
      else localStorage.setItem(BOARD_SIZE_KEY, String(boardWidth));
    } catch {
      /* The board size remains available for the current session. */
    }
  }, [boardWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(CREDIT_COUNT_KEY, String(coinCount));
    } catch {
      /* Credits remain available for the current session. */
    }
  }, [coinCount]);

  useEffect(() => {
    if (!musicEnabled) {
      stopArcadeMusic();
      return;
    }

    const startMusicAfterInteraction = () => {
      if (!document.hidden) startArcadeMusic(musicTrackRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) stopArcadeMusic();
      else startMusicAfterInteraction();
    };

    window.addEventListener("pointerdown", startMusicAfterInteraction);
    window.addEventListener("keydown", startMusicAfterInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pointerdown", startMusicAfterInteraction);
      window.removeEventListener("keydown", startMusicAfterInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopArcadeMusic();
    };
  }, [musicEnabled]);

  useEffect(() => {
    if (musicEnabled && musicAudio && !musicAudio.paused && !document.hidden) {
      startArcadeMusic(activeMusicTrack);
    }
  }, [activeMusicTrack, musicEnabled]);

  useEffect(() => {
    const dialog = authOpen
      ? authDialogRef.current
      : helpOpen
        ? helpDialogRef.current
        : null;
    if (!dialog) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    getFocusable()[0]?.focus();

    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAuthOpen(false);
        setHelpOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKey);
    return () => {
      document.removeEventListener("keydown", handleDialogKey);
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
      restoreFocusRef.current = null;
    };
  }, [authOpen, helpOpen]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const loadAccount = async (session: Session | null) => {
      if (!supabase) return;
      const nextUser = session?.user ?? null;
      const userId = nextUser?.id ?? null;
      if (!active) return;
      if (requestedUserId.current === userId) { setUser(nextUser); return; }

      const previousUserId = requestedUserId.current;
      requestedUserId.current = userId;
      activeUserId.current = userId;
      const request = ++loadSequence.current;
      setAuthReady(false);
      setCloudSyncError(false);
      setUser(nextUser);
      setAccountProgress(null);
      // Stop an old account's active game before loading another account's saves.
      if (nextUser || previousUserId) {
        if (window.location.hash.startsWith("#battle")) { window.location.hash = "home"; setRoute("home"); }
        setSavedMatch(nextUser ? null : readSavedMatch());
        setPgn("");
        moveTiming.current = { times: [], turnStartedAt: Date.now() };
        setResigned(false);
        setDebugCheckmate(false);
      }

      if (!nextUser || !userId) {
        setAuthReady(true);
        return;
      }

      const { data, error } = await supabase
        .from("player_progress")
        .select("progress")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active || request !== loadSequence.current) return;
      if (error) {
        setCloudSyncError(true);
        const cachedProgress = readProgress(
          `${ACCOUNT_STORAGE_PREFIX}${userId}`,
        );
        setAccountProgress(cachedProgress);
        setBossIndex(
          Math.min(ladderClears(cachedProgress, activeMode.current), BOSSES.length - 1),
        );
        setAuthReady(true);
        return;
      }

      let syncedProgress = normalizeProgress(
        data?.progress as Partial<Progress> | undefined,
      );
      let pending = readPendingResults(userId);
      for (const event of pending) {
        const { data: updated, error: syncError } = await supabase.rpc(
          "record_game_result",
          {
            p_event_id: event.id,
            p_result: event.result,
            p_boss_index: event.bossIndex,

            p_mode: event.mode,
          },
        );
        if (!active || request !== loadSequence.current) return;
        if (syncError) {
          setCloudSyncError(true);
          break;
        }
        syncedProgress = normalizeProgress(updated as Partial<Progress>);
        pending = pending.filter((item) => item.id !== event.id);
        writePendingResults(userId, pending);
      }

      const guest = readProgress();
      if (hasProgress(guest)) {
        const mergeKey = guestMergeStorageKey(userId);
        const mergeId = getGuestMergeId(userId);
        const { data: merged, error: mergeError } = await supabase.rpc(
          "merge_guest_progress",
          {
            p_event_id: mergeId,
            p_wins: guest.wins,
            p_losses: guest.losses,
            p_streak: guest.streak,
            p_best_streak: guest.bestStreak,
            p_bosses_defeated: guest.bossesDefeated,

            p_freestyle_bosses_defeated: guest.freestyleBossesDefeated,
          },
        );
        if (!active || request !== loadSequence.current) return;
        if (mergeError) {
          setCloudSyncError(true);
          syncedProgress = mergeProgress(syncedProgress, guest);
          showToast("GUEST PROGRESS WILL RETRY ON YOUR NEXT SIGN-IN");
        } else {
          syncedProgress = normalizeProgress(merged as Partial<Progress>);
          setGuestProgress(EMPTY_PROGRESS);
          try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(mergeKey);
          } catch {
            /* Guest state was merged remotely; unavailable storage is harmless. */
          }
        }
      }

      if (pending.length > 0) {
        syncedProgress = pending.reduce(applyResult, syncedProgress);
      }
      setAccountProgress(syncedProgress);
      setBossIndex(Math.min(ladderClears(syncedProgress, activeMode.current), BOSSES.length - 1));
      setAuthReady(true);
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => loadAccount(data.session))
      .catch(() => {
        if (active) {
          setCloudSyncError(true);
          setAuthReady(true);
        }
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        setAuthOpen(true);
      }
      // Run database calls after the auth callback releases its session lock.
      window.setTimeout(() => { void loadAccount(session); }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      loadSequence.current += 1;
    };
  }, []);

  const progressRetryInFlight = useRef(false);
  const progressLastRefresh = useRef(Date.now());
  async function retryPendingProgress(userId: string) {
    if (progressRetryInFlight.current) return;
    progressRetryInFlight.current = true;
    progressLastRefresh.current = Date.now();
    try { await syncPendingProgress(userId); }
    finally { progressRetryInFlight.current = false; }
  }

  async function syncPendingProgress(userId: string) {
    if (!supabase || activeUserId.current !== userId) return;
    let pending = readPendingResults(userId);
    const guest = readProgress();
    let latest: Progress | null = null;
    let readFailed = false;
    try {
      const { data, error } = await supabase.from("player_progress").select("progress").eq("user_id", userId).maybeSingle();
      if (activeUserId.current !== userId) return;
      if (error) readFailed = true;
      else latest = normalizeProgress(data?.progress);
    } catch { readFailed = true; }

    for (const event of [...pending]) {
      try {
        const { data, error } = await supabase.rpc("record_game_result", {
          p_event_id: event.id,
          p_result: event.result,
          p_boss_index: event.bossIndex,

          p_mode: event.mode,
        });
        if (activeUserId.current !== userId) return;
        if (error) break;
        latest = normalizeProgress(data as Partial<Progress>);
        pending = readPendingResults(userId).filter((item) => item.id !== event.id);
        writePendingResults(userId, pending);
      } catch {
        break;
      }
    }

    let guestMerged = false;
    let mergeFailed = false;
    if (hasProgress(guest)) {
      const mergeKey = guestMergeStorageKey(userId);
      try {
        const { data, error } = await supabase.rpc("merge_guest_progress", {
          p_event_id: getGuestMergeId(userId),
          p_wins: guest.wins,
          p_losses: guest.losses,
          p_streak: guest.streak,
          p_best_streak: guest.bestStreak,
          p_bosses_defeated: guest.bossesDefeated,

          p_freestyle_bosses_defeated: guest.freestyleBossesDefeated,
        });
        if (activeUserId.current !== userId) return;
        if (error) {
          mergeFailed = true;
        } else {
          latest = normalizeProgress(data as Partial<Progress>);
          guestMerged = true;
          setGuestProgress(EMPTY_PROGRESS);
          try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(mergeKey);
          } catch {
            /* The merge is already committed remotely. */
          }
        }
      } catch {
        mergeFailed = true;
      }
    }

    if (latest) {
      let displayProgress = pending.reduce(applyResult, latest);
      if (!guestMerged && hasProgress(guest)) {
        displayProgress = mergeProgress(displayProgress, guest);
      }
      setAccountProgress(displayProgress);
    }
    const syncFailed =
      (readFailed && !latest) || pending.length > 0 || mergeFailed || (!guestMerged && hasProgress(guest));
    setCloudSyncError(syncFailed);
    if (pending.length > 0) showToast("CLOUD SAVE QUEUED — LOCAL COPY KEPT");
    else if (mergeFailed) showToast("GUEST PROGRESS WILL RETRY WHEN ONLINE");
  }

  async function saveAccountResult(
    userId: string,
    result: "win" | "loss",
    bossIndex: number,
  ) {
    if (!supabase) return;
    const pending = readPendingResults(userId);
    pending.push({
      id: newEventId(),
      result,
      bossIndex,
      progressionVersion: 3,
      mode: game.mode,
    });
    writePendingResults(userId, pending);
    await retryPendingProgress(userId);
  }

  useEffect(() => {
    const retryPending = () => {
      const userId = activeUserId.current;
      if (!document.hidden && navigator.onLine && userId &&
        (readPendingResults(userId).length > 0 || hasProgress(readProgress()))) void retryPendingProgress(userId);
    };
    const handleOnline = () => {
      const userId = activeUserId.current;
      if (!document.hidden && userId) void retryPendingProgress(userId);
    };
    const focus = () => { if (Date.now() - progressLastRefresh.current >= 60000 && navigator.onLine) handleOnline(); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", focus);
    const retryTimer = window.setInterval(retryPending, 30000);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("focus", focus); window.clearInterval(retryTimer); };
  }, []);

  useEffect(() => {
    if (!currentResult || finishedFen.current === fen) return;
    finishedFen.current = fen;
    if (savedMatch?.bossIndex === bossIndex) clearSavedMatch(bossIndex);
    if (debugMatch) {
      playBoardSound(currentResult === "win" ? "win" : currentResult === "loss" ? "lose" : "move", soundEnabled, soundTheme);
      showToast("DEBUG MATCH COMPLETE");
      return;
    }
    if (currentResult === "win") {
      const update = (previous: Progress): Progress => ({
        ...previous,
        wins: previous.wins + 1,
        streak: previous.streak + 1,
        bestStreak: Math.max(previous.bestStreak, previous.streak + 1),
        [game.mode === "freestyle" ? "freestyleBossesDefeated" : "bossesDefeated"]:
          Math.max(ladderClears(previous, game.mode), bossIndex + 1),
      });
      if (user && supabase) {
        setAccountProgress((previous) =>
          update(
            previous ?? readProgress(`${ACCOUNT_STORAGE_PREFIX}${user.id}`),
          ),
        );
        void saveAccountResult(user.id, currentResult, bossIndex);
      } else {
        setGuestProgress(update);
      }
      playBoardSound("win", soundEnabled, soundTheme);
      showToast("STAGE CLEAR! BOSS DEFEATED");
    } else if (currentResult === "loss") {
      const update = (previous: Progress): Progress => ({
        ...previous,
        losses: previous.losses + 1,
        streak: 0,
      });
      if (user && supabase) {
        setAccountProgress((previous) =>
          update(
            previous ?? readProgress(`${ACCOUNT_STORAGE_PREFIX}${user.id}`),
          ),
        );
        void saveAccountResult(user.id, currentResult, bossIndex);
      } else {
        setGuestProgress(update);
      }
      playBoardSound("lose", soundEnabled, soundTheme);
      showToast("CONTINUE? YOUR RUN ENDS HERE");
    } else {
      showToast("DRAW GAME — NO CONTINUE LOST");
    }
  }, [currentResult, fen, soundEnabled, user, bossIndex, savedMatch, debugMatch]);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(moodTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (
      screen !== "battle" ||
      reviewing ||
      currentResult ||
      game.turn() !== boss.chessColor ||
      game.isGameOver()
    ) {
      setThinking(false);
      setEngineError("");
      return;
    }
    setThinking(true);
    setEngineError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => {
        void requestStockfishMove(fen, pgn, boss.elo, controller.signal).then(move => {
          if (!controller.signal.aborted) commitBotMove(move, fen);
        }).catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setThinking(false);
          setEngineError(error instanceof Error ? error.message : "Stockfish could not load. Please retry.");
        });
      },
      520 + Math.random() * 420,
    );

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    fen,
    game,
    boss.elo,
    boss.chessColor,
    screen,
    soundEnabled,
    soundTheme,
    currentResult,
    reviewing,
    engineRetry,
  ]);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }

  function handleHomePlay(mode: PlayMode) {
    if (coinCount < 1) return;
    setCoinCount((count) => Math.max(0, count - 1));
    changePlayMode(mode);
    setScreen("roster");
    playArcadeSound("start", soundEnabled);
  }

  function insertCoin() {
    if (coinCount >= MAX_CREDITS) {
      playArcadeSound("coin-return", soundEnabled);
      const message = creditMessageRef.current;
      if (message && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        message.getAnimations().forEach((animation) => animation.cancel());
        message.animate([
          { transform: "scale(1) rotate(0deg)" },
          { transform: "scale(1.08) rotate(-3deg)", offset: 0.3 },
          { transform: "scale(1.05) rotate(2deg)", offset: 0.65 },
          { transform: "scale(1) rotate(0deg)" },
        ], { duration: 420, easing: "ease-out" });
      }
      return;
    }
    setCoinCount((count) => Math.min(MAX_CREDITS, count + 1));
    if (!coinAnimation.current?.play()) playArcadeSound("coin", soundEnabled);
  }

  function toggleMusic() {
    if (musicEnabled) {
      stopArcadeMusic();
      setMusicEnabled(false);
    } else {
      startArcadeMusic(activeMusicTrack);
      setMusicEnabled(true);
    }
  }

  function tauntBoss() {
    if (screen !== "battle" || currentResult) return;
    setOpponentMood("angry");
    setOpponentLine({ label: "TAUNT", text: currentTaunt });
    setTauntIndex((index) => index + 1);
    window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setOpponentMood(null), 2500);
  }

  function showCaptureReaction(capturingColor: PieceColor) {
    const bossCaptured = capturingColor === boss.chessColor;
    setOpponentMood(bossCaptured ? "happy" : "angry");
    if (bossCaptured) {
      setOpponentLine({ label: "TAUNT", text: currentTaunt });
      setTauntIndex((index) => index + 1);
    } else {
      setOpponentLine({
        label: "EXCUSE",
        text: BOSS_EXCUSES[excuseIndex % BOSS_EXCUSES.length]!,
      });
      setExcuseIndex((index) => index + 1);
    }
    window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setOpponentMood(null), 1500);
  }

  function chooseSoundTheme(theme: SoundTheme) {
    setSoundTheme(theme);
    previewSoundTheme(theme, soundEnabled);
  }

  function recordMoveTime() {
    const now = Date.now();
    moveTiming.current = { times: appendMoveTime(moveTiming.current.times, moveHistory.length, now - moveTiming.current.turnStartedAt), turnStartedAt: now };
  }

  function commitBotMove(move: BotMoveData | null, positionFen: string) {
    if (!move) {
      setThinking(false);
      return;
    }
    const next = restoreGame(pgn);
    if (next.fen() !== positionFen) {
      setThinking(false);
      return;
    }
    try {
      const result = next.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? "q",
      });
      const finishMove = () => {
        setOpponentLine(null);
        setLastMove({ from: move.from, to: move.to });
        setSelectedSquare((selected) =>
          selected && plannedBoard.get(selected)?.color === playerColor ? selected : null,
        );
        recordMoveTime();
        setPgn(next.pgn());
        setThinking(false);
        if (result.captured) showCaptureReaction(result.color);
        playBoardSound(boardSoundForMove(result, next, playerColor), soundEnabled, soundTheme);
      };
      finishMove();
    } catch {
      showToast("BOT SENT AN INVALID MOVE — RESET THE MATCH");
      setThinking(false);
    }
  }

  function makeMove(from: Square, to: Square, promotion?: PromotionPiece, position?: PromotionPosition, executeQueued = false) {
    if (currentResult || reviewing || (promotionMove && !promotion)) return false;
    if (!executeQueued && queuingPremove) {
      if (
        plannedBoard.get(from)?.color !== playerColor ||
        !plannedBoard.targets(from).includes(to)
      )
        return false;
      setPremoves(previous => [...previous, { from, to, position }]);
      setSelectedSquare(null);
      playBoardSound("select", soundEnabled, soundTheme);
      return true;
    }
    if (thinking || game.turn() === boss.chessColor) return false;
    const next = restoreGame(pgn);
    if (!promotion && next.moves({ square: from, verbose: true }).some(move => move.to === to && move.promotion)) {
      const target = document.querySelector(`[data-square="${to}"]`)?.getBoundingClientRect();
      const anchor = position ?? { x: target ? target.x + target.width / 2 : window.innerWidth / 2,
        y: target ? target.y + target.height / 2 : window.innerHeight / 2 };
      setPromotionMove({ from, to, fen, matchId: matchId.current, position: anchor, queued: executeQueued });
      setSelectedSquare(null);
      return true;
    }
    try {
      const move = next.move({ from, to, promotion });
      const finishMove = () => {
        setOpponentLine(null);
        recordMoveTime();
        setPgn(next.pgn());
        setLastMove({ from, to });
        if (!executeQueued) setSelectedSquare(null);
        if (move.captured) showCaptureReaction(move.color);
        playBoardSound(boardSoundForMove(move, next, playerColor), soundEnabled, soundTheme);
      };
      finishMove();
      return true;
    } catch {
      playBoardSound("invalid", soundEnabled, soundTheme);
      return false;
    }
  }

  function handleSquareClick(square: Square, position?: PromotionPosition) {
    if (promotionMove || reviewing || currentResult || (thinking && !premoveTurn)) return;
    const piece = plannedBoard.get(square);
    if (selectedSquare && legalMoves.includes(square)) {
      makeMove(selectedSquare, square, undefined, position);
      return;
    }
    if (piece?.color === playerColor) {
      const isDeselecting = square === selectedSquare;
      if (!isDeselecting) playBoardSound("select", soundEnabled, soundTheme);
      setSelectedSquare(isDeselecting ? null : square);
      return;
    }
    setSelectedSquare(null);
  }

  function clearSavedMatch(matchBossIndex?: number) {
    if (
      matchBossIndex !== undefined &&
      savedMatch?.bossIndex !== matchBossIndex
    )
      return;
    try {
      localStorage.removeItem(user ? `${SAVED_MATCH_KEY}:${user.id}` : SAVED_MATCH_KEY);
    } catch {
      /* The in-memory match state can still be cleared. */
    }
    setSavedMatch(null);
  }

  function persistCurrentMatch() {
    const match = { bossIndex, pgn, tauntIndex, id: matchId.current, startedAt: matchStarted.current, debug: debugMatch, moveTimesMs: normalizeMoveTimes(moveTiming.current.times, moveHistory.length), turnStartedAt: moveTiming.current.turnStartedAt };
    try {
      localStorage.setItem(user ? `${SAVED_MATCH_KEY}:${user.id}` : SAVED_MATCH_KEY, JSON.stringify(match));
    } catch {
      if (!matchSaveFailed.current) showToast("MATCH COULD NOT BE SAVED — KEEP PLAYING");
      matchSaveFailed.current = true;
      return false;
    }
    matchSaveFailed.current = false;
    setSavedMatch(match);
    return true;
  }

  function saveMatchForLater() {
    if (currentResult || !persistCurrentMatch()) return;
    setPremoves([]);
    setSelectedSquare(null);
    setThinking(false);
    setOpponentMood(null);
    setOpponentLine(null);
    window.clearTimeout(moodTimer.current);
    setScreen("roster");
    showToast("MATCH SAVED — RESUME IT FROM THE ROSTER");
  }

  function resumeSavedMatch(match: SavedMatch) {
    if (match.debug && !debugMode) {
      showToast("ENABLE DEBUG MODE TO RESUME THIS TEST MATCH");
      return;
    }
    setReviewPly(null);
    matchId.current = match.id ?? crypto.randomUUID();
    matchStarted.current = match.startedAt ?? history.find((item) => item.id === matchId.current)?.startedAt ?? new Date().toISOString();
    const restored = restoreGame(match.pgn);
    const restoredMoves = restored.history({ verbose: true });
    moveTiming.current = { times: normalizeMoveTimes(match.moveTimesMs, restoredMoves.length), turnStartedAt: match.turnStartedAt ?? Date.now() };
    const lastMove = restoredMoves[restoredMoves.length - 1];
    setBossIndex(match.bossIndex);
    setPgn(match.pgn);
    setPlayMode(restored.mode);
    setTauntIndex(match.tauntIndex);
    setPremoves([]);
    setSelectedSquare(null);
    setLastMove(lastMove ? { from: lastMove.from, to: lastMove.to } : null);
    setThinking(false);
    setResigned(false);
    setDebugMatch(match.debug === true);
    setDebugCheckmate(false);
    setOpponentMood(null);
    setOpponentLine(null);
    window.clearTimeout(moodTimer.current);
    finishedFen.current = "";
    setScreen("battle");
  }

  function resignMatch() {
    if (currentResult) return;
    setResigned(true);
    setPremoves([]);
    setSelectedSquare(null);
    setThinking(false);
  }

  function changePlayMode(mode: PlayMode) {
    setPlayMode(mode);
    setBossIndex(Math.min(ladderClears(progress, mode), BOSSES.length - 1));
  }

  function autoCheckmate() {
    if (!debugMode || screen !== "battle" || reviewing || currentResult) return;
    setDebugMatch(true);
    setDebugCheckmate(true);
    setPremoves([]);
    setPromotionMove(null);
    setSelectedSquare(null);
    setThinking(false);
  }

  function fightBoss(index: number) {
    if (index < 0 || index >= BOSSES.length || (!debugMode && index > clearedBosses)) return;
    if (savedMatch?.bossIndex === index && savedMode === playMode) {
      resumeSavedMatch(savedMatch);
    } else {
      newGame(index);
      setScreen("battle");
    }
  }

  function newGame(index = bossIndex) {
    setReviewPly(null);
    matchId.current = crypto.randomUUID();
    matchStarted.current = new Date().toISOString();
    if (savedMatch?.bossIndex === index) clearSavedMatch(index);
    setBossIndex(index);
    setPgn(playMode === "freestyle" ? new Chess(freestyleFen()).pgn() : "");
    moveTiming.current = { times: [], turnStartedAt: Date.now() };
    setPremoves([]);
    setSelectedSquare(null);
    setLastMove(null);
    setThinking(false);
    setResigned(false);
    setDebugMatch(debugMode);
    setDebugCheckmate(false);
    setTauntIndex(0);
    setExcuseIndex(0);
    setOpponentMood(null);
    setOpponentLine(null);
    window.clearTimeout(moodTimer.current);
    finishedFen.current = "";
    playArcadeSound("start", soundEnabled);
  }

  async function signIn(provider: "google") {
    if (!signupTermsAccepted) {
      setAuthMessage("Please read and accept the terms of use before continuing.");
      return;
    }
    if (!supabase) {
      setAuthMessage(
        supabaseConfiguration.error,
      );
      return;
    }
    setAuthMessage("");
    try { localStorage.setItem(PENDING_SIGNUP_PLAN_KEY, signupPlan); }
    catch { setAuthMessage("Your browser could not save your plan choice. Allow site storage and try again."); return; }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthMessage(error.message);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setAuthOpen(false);
    showToast("SIGNED OUT — GUEST MODE ACTIVE");
  }

  function viewHistoryMove(ply: number) {
    setReviewPly(ply === moveHistory.length ? null : ply);
    setPremoves([]);
    setSelectedSquare(null);
  }

  useEffect(() => {
    if (promotionMove && (screen !== "battle" || reviewing || currentResult ||
      promotionMove.fen !== fen || promotionMove.matchId !== matchId.current)) {
      setPromotionMove(null);
    }
  }, [promotionMove, screen, reviewing, currentResult, fen]);

  useEffect(() => {
    setSelectedSquare(selected => selected && plannedBoard.get(selected)?.color === playerColor ? selected : null);
  }, [plannedBoard, playerColor]);

  useEffect(() => {
    if (!premoves.length) return;
    if (reviewing || screen !== "battle" || currentResult) {
      setPremoves([]);
      return;
    }
    if (premoveTurn || thinking || promotionMove) return;
    const queuedMove = takePremove(`${matchId.current}:${fen}`);
    if (!queuedMove) return;
    if (!makeMove(queuedMove.from, queuedMove.to, undefined, queuedMove.position, true)) {
      setPremoves([]);
      showToast("PREMOVE CANCELED - MOVE IS NO LONGER LEGAL");
    }
  }, [fen, currentResult, premoves, premoveTurn, screen, thinking, reviewing, promotionMove]);

  useEffect(() => {
    const moveLog = moveLogRef.current;
    if (reviewing || screen !== "battle" || !moveLog) return;
    moveLog.scrollTop = moveLog.scrollHeight;
  }, [moveHistory.length, screen, reviewing]);

  const battleAppearance = <>
                      <section
                        className="piece-theme-picker"
                        aria-label="Piece designs"
                      >
                        <h3 className="piece-theme-heading">PIECE SET</h3>
                        <div
                          className="piece-theme-options piece-set-options"
                          role="group"
                          aria-label="Choose a chess piece design"
                        >
                          {PIECE_CHOICES.map((choice) => (
                            <button
                              className="piece-theme-option"
                              type="button"
                              key={choice.id}
                              aria-label={`Use ${choice.label} piece design`}
                              aria-pressed={pieceTheme === choice.id}
                              disabled={loadingPieceStyle}
                              onClick={() => void changePieceStyle(choice.id)}
                            >
                              <span
                                className="piece-theme-icon"
                                aria-hidden="true"
                              >
                                <PieceArtwork
                                  type="q"
                                  color="w"
                                  theme={choice.id}
                                />
                              </span>
                              <span>{choice.label}</span>
                            </button>
                          ))}
                        </div>
                      </section>
                      <section
                        className="piece-theme-picker board-color-picker"
                        aria-label="Board color layouts"
                      >
                        <h3 className="piece-theme-heading">BOARD COLORS</h3>
                        <div
                          className="board-palette-options"
                          role="group"
                          aria-label="Choose a board color layout"
                        >
                          {BOARD_PALETTES.map((palette) => (
                            <button
                              className="piece-theme-option board-palette-option"
                              type="button"
                              key={palette.id}
                              aria-label={`Use the ${palette.label.toLowerCase()} board colors`}
                              aria-pressed={boardPaletteId === palette.id}
                              onClick={() => setBoardPaletteId(palette.id)}
                            >
                              <span
                                className="board-palette-preview"
                                aria-hidden="true"
                                style={
                                  {
                                    "--palette-light": palette.light,
                                    "--palette-dark": palette.dark,
                                  } as CSSProperties &
                                    Record<`--${string}`, string>
                                }
                              >
                                <i />
                                <i />
                                <i />
                                <i />
                              </span>
                              <span>{palette.label}</span>
                            </button>
                          ))}
                        </div>
                      </section>
                      <section
                        className="piece-theme-picker sound-theme-picker"
                        aria-label="Board sound theme"
                      >
                        <h3 className="piece-theme-heading">SOUND THEME</h3>
                        <div
                          className="sound-theme-options"
                          role="group"
                          aria-label="Choose board sound effects"
                        >
                          {SOUND_THEMES.map((theme) => (
                            <button
                              className="piece-theme-option sound-theme-option"
                              type="button"
                              key={theme.id}
                              aria-pressed={soundTheme === theme.id}
                              aria-label={`Use ${theme.name} sound theme`}
                              title={theme.description}
                              onClick={() => chooseSoundTheme(theme.id)}
                            >
                              {theme.name}
                            </button>
                          ))}
                        </div>
                      </section>
  </>;

  return (
    <div
      className={`app-shell ${screen === "battle" ? "app-shell-battle" : ""} ${
        ((screen === "review" || screen === "result") && selectedMatch
          ? selectedMatch.pgn.includes('[Variant "Chess960"]')
          : screen === "battle" ? game.mode === "freestyle" : playMode === "freestyle")
          ? "app-shell-freestyle" : ""
      }`}
      onClickCapture={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const control = target.closest("button, a");
        if (
          !control ||
          control.closest(".square") ||
          control.matches(
            ".hero-cta, .boss-card, .boss-line-locked, .fight-button, .arcade-coin-button, .try-again-action, .result-overlay button",
          )
        )
          return;
        playArcadeSound(
          control.tagName === "A" ? "navigate" : "ui",
          soundEnabled,
        );
      }}
    >
      <div className="crt-overlay" aria-hidden="true" />
      {screen === "home" && <DancingBosses bosses={BOSSES} playerName={user ? playerName : "rookie"} />}
      <header className="topbar">
        <a
          className="brand"
          href="#home"
          aria-label="Arcade Gambit home"
        >
          <img
            className="brand-logo"
            src="/brand/arcade-gambit-logo.png"
            alt="Arcade Gambit"
          />
        </a>
        <nav className="top-nav" aria-label="Game flow">
          <span className="nav-link nav-active" aria-current="step">
            <span className="nav-pip" />
            {screen === "battle"
              ? "MATCH // 02"
              : screen === "roster"
                ? "CHOOSE A BOSS // 01"
                : "ARCADE // READY"}
          </span>
        </nav>
        <div className="top-actions">
          <button
            className={`sound-button settings-button ${screen === "settings" ? "sound-on" : ""}`}
            type="button"
            onClick={() => setScreen(screen === "settings" ? "home" : "settings")}
            aria-label={screen === "settings" ? "Close settings" : "Open settings"}
            title="Settings"
            aria-current={screen === "settings" ? "page" : undefined}
          >
            <Settings size={17} />
            <span>SETTINGS</span>
          </button>
          <button
            className={`sound-button ${musicEnabled ? "sound-on" : ""}`}
            onClick={toggleMusic}
            aria-label={musicEnabled ? "Mute music" : "Enable music"}
            title={musicEnabled ? "Music on" : "Music off"}
          >
            <Music2 size={17} />
            <span>MUSIC {musicEnabled ? "ON" : "OFF"}</span>
          </button>
          <button
            className={`sound-button ${soundEnabled ? "sound-on" : ""}`}
            onClick={() => setSoundEnabled((value) => !value)}
            aria-label={
              soundEnabled ? "Mute sound effects" : "Enable sound effects"
            }
            title={soundEnabled ? "Sound effects on" : "Sound effects off"}
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            <span>SFX {soundEnabled ? "ON" : "OFF"}</span>
          </button>
          {user ? (
            <button
              className="profile-chip"
              onClick={() => setAuthOpen(true)}
              aria-label={`Account for ${playerName}`}
            >
              <span className="avatar">{playerAvatar}</span>
              <span className="profile-name">{playerName}</span>
              <ChevronRight size={14} />
            </button>
          ) : (
            <button className="login-button" onClick={() => setAuthOpen(true)}>
              <LogIn size={15} /> <span>LOG IN</span>
            </button>
          )}
        </div>
      </header>

      <main id="top" className={screen === "home" ? "home-main" : isReviewPage ? "review-main" : screen === "online" ? "online-main" : undefined}>
        {screen === "online" && (user && supabase ? <OnlinePlay key={`${user.id}:${route}`} userId={user.id} route={route} navigate={setScreen} theme={pieceTheme} light={boardPalette.light} dark={boardPalette.dark} appearance={battleAppearance} boardWidth={boardWidth} onBoardResize={setBoardWidth} loadingPieceStyle={loadingPieceStyle} onSound={(sound) => playBoardSound(sound, soundEnabled, soundTheme)} onMoveSound={(move, position, side) => playBoardSound(boardSoundForMove(move, position, side), soundEnabled, soundTheme)} /> : <section className="game-review"><h2>Play against human</h2><p>Sign in to find an opponent and save your online rating.</p><button onClick={() => setAuthOpen(true)}>Log in</button><button onClick={() => setScreen("home")}>Back to home</button></section>)}
        {screen === "settings" && (
          <section className="settings-page" aria-labelledby="settings-title">
            <div className="settings-page-heading">
              <div>
                <span className="settings-eyebrow"><i /> ARCADE // OPTIONS</span>
                <h1 id="settings-title">Game <em>settings</em></h1>
                <p>Choose your board, pieces, and arcade sound.</p>
              </div>
              <button className="settings-back" type="button" onClick={() => setScreen("home")}>
                <ChevronLeft size={15} /> BACK TO ARCADE
              </button>
            </div>

            <div className="settings-grid">
              <section className="settings-card" aria-label="Piece themes">
                <h2>Piece set</h2>
                <p>Choose the look of your chess pieces.</p>
                <div className="piece-theme-options piece-set-options" role="group" aria-label="Choose a chess piece design">
                  {PIECE_CHOICES.map((choice) => (
                    <button className="piece-theme-option" type="button" key={choice.id} aria-label={`Use ${choice.label} piece design`} aria-pressed={pieceTheme === choice.id} disabled={loadingPieceStyle} onClick={() => void changePieceStyle(choice.id)}>
                      <span className="piece-theme-icon" aria-hidden="true"><PieceArtwork type="q" color="w" theme={choice.id} /></span>
                      <span>{choice.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-card" aria-label="Board themes">
                <h2>Board colors</h2>
                <p>Pick a palette for the chessboard.</p>
                <div className="board-palette-options" role="group" aria-label="Choose a board color layout">
                  {BOARD_PALETTES.map((palette) => (
                    <button className="piece-theme-option board-palette-option" type="button" key={palette.id} aria-label={`Use the ${palette.label.toLowerCase()} board colors`} aria-pressed={boardPaletteId === palette.id} onClick={() => setBoardPaletteId(palette.id)}>
                      <span className="board-palette-preview" aria-hidden="true" style={{ "--palette-light": palette.light, "--palette-dark": palette.dark } as CSSProperties & Record<`--${string}`, string>}><i /><i /><i /><i /></span>
                      <span>{palette.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-card" aria-label="Sound theme">
                <h2>Sound theme</h2>
                <p>Choose a soft sound palette for every chess action.</p>
                <div className="sound-theme-options" role="group" aria-label="Choose board sound effects">
                  {SOUND_THEMES.map((theme) => (
                    <button className="piece-theme-option sound-theme-option" type="button" key={theme.id} aria-pressed={soundTheme === theme.id} aria-label={`Use ${theme.name} sound theme`} title={theme.description} onClick={() => chooseSoundTheme(theme.id)}>
                      {theme.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-card settings-audio-card" aria-label="Audio settings">
                <h2>Audio</h2>
                <p>Control music and sound effects independently.</p>
                <button className="settings-toggle" type="button" aria-pressed={musicEnabled} onClick={toggleMusic}>
                  <span><Music2 size={17} /> Arcade music</span><b>{musicEnabled ? "ON" : "OFF"}</b>
                </button>
                <label className="settings-range-label settings-volume-label" htmlFor="settings-music-volume"><span>MUSIC VOLUME</span><strong>{musicVolume}%</strong></label>
                <input id="settings-music-volume" className="settings-range" type="range" min="0" max="100" step="1" value={musicVolume} aria-label="Music volume" onChange={(event) => setMusicVolume(Number(event.currentTarget.value))} />
                <button className="settings-toggle" type="button" aria-pressed={soundEnabled} onClick={() => setSoundEnabled((value) => !value)}>
                  <span>{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />} Sound effects</span><b>{soundEnabled ? "ON" : "OFF"}</b>
                </button>
                <label className="settings-range-label settings-volume-label" htmlFor="settings-sfx-volume"><span>SFX VOLUME</span><strong>{sfxVolume}%</strong></label>
                <input id="settings-sfx-volume" className="settings-range" type="range" min="0" max="100" step="1" value={sfxVolume} aria-label="Sound effects volume" onChange={(event) => setSfxVolume(Number(event.currentTarget.value))} />
              </section>

              <section className="settings-card settings-size-card" aria-label="Board size">
                <h2>Board size</h2>
                <p>Adjust the chessboard width during a match.</p>
                <label className="settings-range-label" htmlFor="settings-board-size"><span>SIZE</span><strong>{boardWidth ?? 520}px</strong></label>
                <input id="settings-board-size" className="settings-range" type="range" min="300" max="760" step="10" value={boardWidth ?? 520} onChange={(event) => setBoardWidth(Number(event.currentTarget.value))} />
                <button className="settings-reset" type="button" onClick={() => setBoardWidth(undefined)}>RESET TO AUTO SIZE</button>
              </section>
              <section className="settings-card" aria-label="Cookies and storage">
                <h2>Cookies & storage</h2>
                <p>Reset the saved cookie notice acknowledgement to test the first-visit popup. Your game saves and settings stay intact.</p>
                <button className="settings-reset" type="button" onClick={() => setCookieNoticeReset(value => value + 1)}>
                  RESET COOKIE ACKNOWLEDGEMENT
                </button>
              </section>
              {IS_DEVELOPMENT_ENVIRONMENT && <section className="settings-card" aria-label="Debug settings">
                <h2>Debug mode</h2>
                <p>Unlock every boss in both ladders and enable Auto checkmate during matches. Debug games are marked as tests and do not count toward stats or ladder progress.</p>
                <button className="settings-toggle" type="button" aria-label="Debug mode" aria-pressed={debugMode} onClick={() => setDebugMode(value => !value)}>
                  <span>Debug mode</span><b>{debugMode ? "ON" : "OFF"}</b>
                </button>
              </section>}
            </div>
          </section>
        )}
        {screen === "home" && (
          <section className="arcade-cabinet" aria-labelledby="hero-title">
            <div className="arcade-cabinet-topline">
              <span className="arcade-cabinet-brand">
                <Gamepad2 size={17} /> ARCADE GAMBIT
              </span>
              <span className="arcade-cabinet-status">
                <i /> PLAYER ONE — READY
              </span>
            </div>

            <div className="arcade-screen-bezel">
              <div className="arcade-screen">
                <CoinInsertAnimation ref={coinAnimation} volume={0.55 * sfxVolume / 100} muted={!soundEnabled} onReady={markCoinAnimationReady} />
                <div className="arcade-screen-copy">
                  <span className="arcade-screen-kicker">
                    59 CHALLENGERS · ONE CHAMPION
                  </span>
                  <h1 id="hero-title">
                    MEET YOUR
                    <br />
                    <span>MATCH.</span>
                  </h1>
                  <p>Choose a challenger. Make your move.</p>
                  <span className="arcade-screen-prompt">
                    INSERT COIN TO CONTINUE <b>▶</b>
                  </span>
                </div>
                <div className="arcade-screen-art" aria-hidden="true">
                  <span className="arcade-screen-star arcade-star-one">✦</span>
                  <span className="arcade-screen-star arcade-star-two">✦</span>
                  <img
                    className="arcade-screen-piece"
                    src="/brand/arcade-gambit-knight-solid.png"
                    alt=""
                    width={1254}
                    height={1254}
                  />
                </div>
              </div>
            </div>

            <div className="arcade-control-deck">
              <div className="arcade-credit-display">
                <span className="arcade-control-label">CREDITS</span>
                <output aria-live="polite" aria-label={`${coinCount} credits`}>
                  <SegmentedCredits value={coinCount} />
                </output>
                <span ref={creditMessageRef} className={`arcade-credit-hint${coinCount >= MAX_CREDITS ? " arcade-credit-maximum" : ""}`} aria-live="polite">
                  {coinCount >= MAX_CREDITS ? "Maximum credits achieved!" : coinCount > 0 ? "READY TO PLAY" : "INSERT COIN TO START"}
                </span>
              </div>

              <div className="arcade-coin-control">
              <button
                className="arcade-coin-button"
                type="button"
                onClick={insertCoin}
                disabled={!coinAnimationReady}
                aria-label={`Insert one coin. ${coinCount} ${coinCount === 1 ? "credit" : "credits"} available`}
              >
                <span className="arcade-slot" aria-hidden="true">
                  <i />
                </span>
                <span>INSERT COIN</span>
                <small>
                  {coinCount >= MAX_CREDITS ? "MAX CREDITS" : "+1 CREDIT"}
                </small>
              </button>
              <p className="arcade-coin-note">Coins are free for now</p>
              </div>

              <section className="boss-run-card" aria-labelledby="boss-run-title">
                <div className="boss-run-heading">
                  <h2 id="boss-run-title"><Trophy size={16} aria-hidden="true" /> Boss Run</h2>
                  <span>1 CREDIT PER RUN</span>
                </div>
                <div className="boss-run-options">
                  {(["standard", "freestyle"] as const).map((mode) => (
                    <div className={`boss-run-mode boss-run-${mode}`} key={mode}>
                      <button className="boss-run-button" type="button"
                        onClick={() => handleHomePlay(mode)} disabled={coinCount < 1}>
                        <span>{mode === "standard" ? "Standard" : "Freestyle"}</span>
                        <ArrowRight size={17} aria-hidden="true" />
                      </button>
                      {savedMatch && savedMode === mode && (
                        <button
                          className="resume-match-button"
                          type="button"
                          onClick={() => resumeSavedMatch(savedMatch)}
                          aria-label={`Resume saved match against ${BOSSES[savedMatch.bossIndex]!.name}`}
                        >
                          RESUME <ArrowRight size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <div className="arcade-cabinet-base" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </section>
        )}

        {screen === "home" && user && <OnlineHomeCard key={user.id} userId={user.id} navigate={setScreen} />}
        {screen === "home" && (
          <section className="hud-row" aria-label="Player stats">
            <div className="hud-player">
              <div className="hud-avatar">
                <span>{playerAvatar}</span>
                <i />
              </div>
              <div className="hud-player-info">
                <div className="hud-player-name-row">
                  <strong>{user ? playerName : "GUEST PLAYER"}</strong>
                </div>
                <HumanElo key={user?.id ?? "guest"} userId={user?.id} />
                {!savedMatch && user && (
                  <span className="pilot-status">
                    <span />{" "}
                    {user
                      ? cloudSyncError
                        ? "SYNC PENDING — LOCAL COPY"
                        : authReady
                          ? "CLOUD SAVE ACTIVE"
                          : "SYNCING ACCOUNT..."
                      : null}
                  </span>
                )}
              </div>
            </div>
            <div className="hud-stat hud-stat-standard">
              <span className="stat-icon stat-cyan">
                <Trophy size={16} />
              </span>
              <div>
                <span className="hud-label">STANDARD BOSSES BEATEN</span>
                <strong>
                  {String(progress.bossesDefeated).padStart(2, "0")}
                  <small> / {BOSSES.length}</small>
                </strong>
              </div>
            </div>
            <div className="hud-stat hud-stat-freestyle">
              <span className="stat-icon">
                <Trophy size={16} />
              </span>
              <div>
                <span className="hud-label">FREESTYLE BOSSES BEATEN</span>
                <strong>
                  {String(progress.freestyleBossesDefeated).padStart(2, "0")}
                  <small> / {BOSSES.length}</small>
                </strong>
              </div>
            </div>
            <div className="hud-stat">
              <span className="stat-icon stat-pink">
                <Flame size={16} />
              </span>
              <div>
                <span className="hud-label">Days playing a game in a row streak</span>
                <strong>
                  {String(progress.streak).padStart(2, "0")}
                  <small> W</small>
                </strong>
              </div>
            </div>
          </section>
        )}

        {historyError && <p role="alert">Game history could not be saved on this device. Keep this page open to retain your review.</p>}
        {user && historyCloudError && <p className="review-note" role="status">Game history is saved on this device. Cloud sync will retry automatically.</p>}
        {screen === "home" && <MatchHistory key={`history:${user?.id ?? "guest"}`} matches={history} userId={user?.id} onOnline={setScreen} onReview={(id) => setScreen(`review/${id}`)} onResume={(match) => resumeSavedMatch({ ...match, tauntIndex: 0 })} />}
        {(screen === "result" || screen === "review") && (selectedMatch ? (
          screen === "result" ? <MatchResult match={selectedMatch} onReview={() => setScreen(`review/${selectedMatch.id}`)} onHome={() => setScreen("home")} /> :
          <GameReview key={selectedMatch.id} opponent={selectedMatch.opponent} opponentElo={selectedMatch.elo} playerName={selectedMatch.playerName ?? "Player"} pgn={selectedMatch.pgn} moveTimesMs={selectedMatch.moveTimesMs} timingSource="device" theme={pieceTheme} color={selectedMatch.color} light={boardPalette.light} dark={boardPalette.dark} onClose={() => setScreen("home")}
            onMoveSound={(move, position) => playBoardSound(boardSoundForMove(move, position, selectedMatch.color), soundEnabled, soundTheme)} />
        ) : <section className="game-review"><h2>Game not found</h2><p>This game is not available in your history.</p><button onClick={() => setScreen("home")}>Back to home</button></section>)}
        {(screen === "roster" || screen === "battle") && (
          <section
            className={`flow-stage ${screen === "battle" ? "battle-stage" : ""}`}
            id="arena"
          >
            {screen === "roster" && (
              <section
                className="boss-select-page"
                id="challenger-ladder"
                aria-labelledby="boss-select-title"
              >
                <div className="roster-heading">
                  <div>
                    <div className="section-kicker">CHOOSE AN OPPONENT</div>
                    <h1 id="boss-select-title">
                      {playMode === "freestyle" ? "FREESTYLE" : "STANDARD"} <em>LADDER</em>
                    </h1>
                    <p>Beat each challenger to unlock the next in this ladder. Standard and Freestyle progress independently.</p>
                    <p>Ratings are strength targets. Beginner bosses below 1320 Elo use approximate difficulty.</p>
                    {debugMode && <p role="status">DEBUG MODE · All bosses unlocked · Test matches</p>}
                    <div className="play-mode-picker">
                      <label htmlFor="play-mode">PLAY MODE</label>
                      <select id="play-mode" value={playMode} onChange={(event) => changePlayMode(event.target.value as PlayMode)}>
                        <option value="standard">Standard chess</option>
                        <option value="freestyle">Freestyle chess (Chess960)</option>
                      </select>
                      <p>{playMode === "freestyle"
                        ? "A random starting position with matching back ranks, opposite-color bishops, and the king between the rooks. Normal chess rules apply. To castle, move your king onto your rook; they finish on g/f or c/d."
                        : "The traditional starting position and standard chess rules."}</p>
                      {savedMatch && <small>Resume keeps the saved position. Earlier unfinished games remain available in Historic games.</small>}
                    </div>
                  </div>
                </div>

                <div
                  className="boss-select-list"
                  ref={rosterListRef}
                  role="group"
                  aria-label={`${playMode === "freestyle" ? "Freestyle" : "Standard"} ladder. Select an unlocked row to start a match.`}
                >
                  <div className="roster-fight-dock">
                    <div className="roster-fight-target">
                      <span>
                        {canResumeSelectedMatch
                          ? "SAVED MATCH"
                          : "NEXT CHALLENGER"}
                      </span>
                      <strong>{boss.name}</strong>
                      <small>
                        {canResumeSelectedMatch
                          ? "Resume your saved game"
                          : `${boss.elo} ELO`}
                      </small>
                    </div>
                    <button
                      className="fight-button"
                      type="button"
                      onClick={() => fightBoss(bossIndex)}
                      aria-label={`${canResumeSelectedMatch ? "Resume saved match" : "Fight"} against ${boss.name}, ${boss.elo} Elo`}
                    >
                      <Zap size={16} fill="currentColor" />
                      <span>
                        {canResumeSelectedMatch
                          ? "Resume"
                          : "Fight!"}
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  {BOSSES.map((entry, index) => {
                    const locked = !debugMode && index > clearedBosses;
                    const cleared = index < clearedBosses;
                    const selected = index === bossIndex;
                    return (
                      <button
                        key={entry.name}
                        ref={(node) => {
                          bossRowRefs.current[index] = node;
                        }}
                        type="button"
                        className={`boss-line boss-${entry.color} ${selected ? "boss-line-selected" : ""} ${locked ? "boss-line-locked" : ""} ${cleared ? "boss-line-cleared" : ""}`}
                        style={
                          {
                            "--boss-color": `hsl(${(index * 137.508 + 24) % 360} 64% 39%)`,
                          } as CSSProperties & Record<`--${string}`, string>
                        }
                        onClick={() => {
                          if (!locked) setBossIndex(index);
                        }}
                        onDoubleClick={() => fightBoss(index)}
                        aria-disabled={locked}
                        aria-pressed={selected}
                        aria-label={`Rung ${index + 1}: ${entry.name}, ${entry.elo} Elo${locked ? ", locked" : ""}`}
                      >
                        <span className="boss-line-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="boss-line-portrait" aria-hidden="true">
                          {portraitFor(entry.character, __BOSS_PORTRAITS__) ? (
                            <img
                              className="boss-character-image"
                              src={portraitFor(entry.character, __BOSS_PORTRAITS__)}
                              alt=""
                            />
                          ) : (
                            <span className="boss-portrait-mascot">
                              {entry.icon}
                            </span>
                          )}
                        </span>
                        <span className="boss-line-name">
                          <strong>{entry.name}</strong>
                        </span>
                        <span className="boss-line-rating" title={bossStrengthDescription(entry.elo)}>
                          {entry.elo}
                          <small>ELO</small>
                        </span>
                        <span className="boss-line-status">
                          {locked ? (
                            <>
                              <LockKeyhole size={12} /> LOCKED
                            </>
                          ) : cleared ? (
                            <>
                              <Check size={12} /> CLEARED
                            </>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {screen === "battle" && (
              <section
                className="battle-page"
                aria-label={`Battle against ${boss.name}`}
              >
                <div
                  className={`game-layout${opponentColumnCollapsed ? " opponent-column-collapsed" : ""}${playerColumnCollapsed ? " player-column-collapsed" : ""}`}
                >
                  <aside
                    className={`opponent-column${opponentColumnCollapsed ? " is-collapsed" : ""}`}
                    aria-label="Opponent information"
                  >
                    <button
                      className="column-toggle"
                      type="button"
                      aria-expanded={!opponentColumnCollapsed}
                      aria-controls="opponent-panel-content"
                      aria-label={`${opponentColumnCollapsed ? "Expand" : "Collapse"} opponent panel`}
                      onClick={() =>
                        setOpponentColumnCollapsed((collapsed) => !collapsed)
                      }
                    >
                      {opponentColumnCollapsed ? (
                        <ChevronRight size={15} aria-hidden="true" />
                      ) : (
                        <ChevronLeft size={15} aria-hidden="true" />
                      )}
                      <span className="column-toggle-label">
                        {opponentColumnCollapsed ? "SHOW PANEL" : "HIDE PANEL"}
                      </span>
                    </button>
                    <div
                      className="side-column-content"
                      id="opponent-panel-content"
                    >
                      <section className="player-bar opponent-bar">
                        <div className="opponent-summary">
                          <button
                            type="button"
                            className={`opponent-portrait boss-${boss.color}`}
                            onClick={tauntBoss}
                            aria-label={`Provoke ${boss.name}`}
                            title="Click to provoke the boss"
                            disabled={Boolean(currentResult)}
                          >
                            {portraitFor(boss.character, __BOSS_PORTRAITS__, bossExpression) ? (
                              <img
                                src={portraitFor(boss.character, __BOSS_PORTRAITS__, bossExpression)}
                                alt=""
                              />
                            ) : (
                              <span>
                                {opponentMood === "angry"
                                  ? "😠"
                                  : opponentMood === "happy"
                                    ? "😄"
                                    : boss.icon}
                              </span>
                            )}
                            <i />
                          </button>
                          <div className="opponent-info">
                            <span className="hud-label">OPPONENT</span>
                            <strong>{boss.name}</strong>
                            <span className="opponent-elo" title={bossStrengthDescription(boss.elo)}>
                              <b>{boss.elo}</b>
                              <small>ELO</small>
                            </span>
                            {engineError && <div role="alert"><p>{engineError}</p><button type="button" onClick={() => setEngineRetry(retry => retry + 1)}>Retry engine</button></div>}
                          </div>
                        </div>
                        {opponentLine && (
                          <div className="quip-box" aria-live="polite">
                            <span className="quip-mark">“</span>
                            <div>
                              <span className="quip-label">
                                {opponentLine.label}
                              </span>
                              <p>{opponentLine.text}</p>
                            </div>
                          </div>
                        )}
                      </section>
                      <div className="opponent-actions opponent-actions-stacked">
                        {debugMode && <div className="debug-match-tools">
                          <strong>DEBUG MODE</strong>
                          <p>Simulate a checkmate win to test the victory screen.</p>
                          <button className="opponent-action-button" type="button" onClick={autoCheckmate} disabled={Boolean(currentResult) || reviewing}>AUTO CHECKMATE</button>
                        </div>}
                        <button
                          className="opponent-action-button resign-action"
                          type="button"
                          onClick={resignMatch}
                          disabled={Boolean(currentResult)}
                        >
                          <Flag size={15} /> RESIGN
                        </button>
                        <button
                          className="opponent-action-button resign-action try-again-action"
                          type="button"
                          onClick={() => newGame()}
                          disabled={thinking}
                        >
                          <RotateCcw size={15} /> TRY AGAIN
                        </button>
                        <button
                          className="opponent-action-button save-later-action"
                          type="button"
                          onClick={saveMatchForLater}
                          disabled={Boolean(currentResult)}
                        >
                          <Bookmark size={15} /> SAVE FOR LATER
                        </button>
                      </div>
                      {battleAppearance}
                    </div>
                  </aside>
                  <article className="cabinet" aria-label="Chess game">
                    {game.mode === "freestyle" && <p className="freestyle-notice">FREESTYLE · CHESS960 — To castle, move your king onto your rook.</p>}
                    <div className="cabinet-body">
                      <div className="board-stage">
                        <div
                          className="board-frame"
                          style={
                            {
                              "--board-square-light": boardPalette.light,
                              "--board-square-dark": boardPalette.dark,
                              "--board-width": boardWidth === undefined ? undefined : `${boardWidth}px`,
                            } as CSSProperties & Record<`--${string}`, string>
                          }
                        >
                          <div className="board-coordinates board-files-top">
                            {boardFiles.map((file) => (
                              <span key={file}>{file}</span>
                            ))}
                          </div>
                          <div className="board-wrap">
                            <div className="board-coordinates board-ranks">
                              {boardRanks.map((rank) => (
                                <span key={rank}>{rank}</span>
                              ))}
                            </div>
                            <div
                              className="chessboard"
                              role="group"
                              onContextMenu={event => { event.preventDefault(); setPremoves([]); setSelectedSquare(null); setPromotionMove(null); }}
                              onKeyDown={event => { if (event.key === "Escape") { setPremoves([]); setSelectedSquare(null); setPromotionMove(null); } }}
                              aria-label={`Chess board. ${reviewing ? `Reviewing after move ${Math.ceil(reviewPly / 2)} ${viewedMove?.san}.` : `You are playing as ${playerColor === "w" ? "white" : "black"}.`}`}
                            >
                              {boardRanks.map((rank) =>
                                boardFiles.map((file) => {
                                  const square = `${file}${rank}` as Square;
                                  const piece = reviewing ? viewedGame.get(square) : plannedBoard.get(square);
                                  const isLight =
                                    (rank + FILES.indexOf(file)) % 2 === 0;
                                  const isLegal = legalMoves.includes(square);
                                  const isPremoveTarget =
                                    queuingPremove && isLegal;
                                  const isSelected = selectedSquare === square;
                                  const isLast =
                                    viewedLastMove?.from === square ||
                                    viewedLastMove?.to === square;
                                  const pieceName = piece
                                    ? `${piece.color === playerColor ? "Your" : "Boss"} ${PIECE_NAMES[piece.type]}`
                                    : "empty square";
                                  return (
                                    <DragSquare
                                      key={square}
                                      className={`square ${isLight ? "square-light" : "square-dark"} ${isSelected ? "square-selected" : ""} ${isLast ? "square-last" : ""} ${isLegal ? "square-target" : ""} ${isPremoveTarget ? "square-premove-target" : ""} ${premoves.some(move => move.from === square) ? "square-premove-from" : ""} ${premoves.some(move => move.to === square) ? "square-premove-to" : ""} ${piece?.color === "w" ? "piece-white" : "piece-black"}`}
                                      aria-label={`${square}, ${pieceName}${isLegal ? `, ${queuingPremove ? "premove" : "legal"} destination` : ""}${premoves.some(move => move.from === square) ? ", premove origin" : ""}${premoves.some(move => move.to === square) ? ", premove target" : ""}${isSelected ? ", selected" : ""}`}
                                      aria-pressed={isSelected}
                                      onClick={(event) => handleSquareClick(square, event.detail === 0 ? undefined : { x: event.clientX, y: event.clientY })}
                                      square={square}
                                      canDrag={!promotionMove && !reviewing && piece?.color === playerColor && !currentResult && (!thinking || premoveTurn)}
                                      positionKey={`${matchId.current}:${piece?.color}:${piece?.type}`}
                                      artwork={piece && <PieceArtwork type={piece.type} color={piece.color} theme={pieceTheme} fitToSquare />}
                                      onPickUp={() => {
                                        playBoardSound("select", soundEnabled, soundTheme);
                                        setSelectedSquare(square);
                                      }}
                                      onMovePiece={(from, to, position) => makeMove(from, to, undefined, position)}
                                    >
                                      {piece && (
                                        <span
                                          className={`chess-piece ${piece.color === "w" ? "white-piece-glyph" : "black-piece-glyph"}`}
                                        >
                                          <PieceArtwork
                                            type={piece.type}
                                            color={piece.color}
                                            theme={pieceTheme}
                                            fitToSquare
                                          />
                                        </span>
                                      )}
                                      {isLegal && (
                                        <span
                                          className={`move-dot ${piece ? "move-capture" : ""}`}
                                        />
                                      )}
                                    </DragSquare>
                                  );
                                }),
                              )}
                            </div>
                          </div>
                          <div className="board-coordinates board-files-bottom">
                            {boardFiles.map((file) => (
                              <span key={file}>{file}</span>
                            ))}
                          </div>

                          {loadingPieceStyle && (
                            <div className="piece-style-loading" role="status" aria-live="polite">
                              <span className="piece-style-spinner" aria-hidden="true" />
                              <span>Please wait</span>
                            </div>
                          )}
                          <BoardResizeHandle onResize={setBoardWidth} />

                        </div>
                      </div>
                    </div>
                  </article>

                  <aside
                    className={`side-panel${playerColumnCollapsed ? " is-collapsed" : ""}`}
                    aria-label="Player status and game history"
                  >
                    <button
                      className="column-toggle"
                      type="button"
                      aria-expanded={!playerColumnCollapsed}
                      aria-controls="player-panel-content"
                      aria-label={`${playerColumnCollapsed ? "Expand" : "Collapse"} player panel`}
                      onClick={() =>
                        setPlayerColumnCollapsed((collapsed) => !collapsed)
                      }
                    >
                      {playerColumnCollapsed ? (
                        <ChevronLeft size={15} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={15} aria-hidden="true" />
                      )}
                      <span className="column-toggle-label">
                        {playerColumnCollapsed ? "SHOW PANEL" : "HIDE PANEL"}
                      </span>
                    </button>
                    <div
                      className="side-column-content"
                      id="player-panel-content"
                    >
                      <section className="player-bar player-bottom">
                        <div className="player-portrait">
                          <span>{avatarInitial}</span>
                          <i />
                        </div>
                        <div className="opponent-info">
                          <span className="hud-label">YOU</span>
                          <strong>{user ? playerName : "GUEST PLAYER"}</strong>
                          <span className="opponent-quip">
                            {reviewing
                              ? "Reviewing an earlier position."
                              : currentResult === "win"
                              ? "Boss down. Next challenger?"
                              : "Your move, challenger."}
                          </span>
                          <span className="player-turn">
                            <span
                              className={`turn-light ${thinking ? "turn-thinking" : ""}`}
                            />
                            <span>
                              {reviewing
                                ? "REVIEWING MOVE"
                                : currentResult
                                ? "MATCH OVER"
                                : thinking
                                  ? "BOT THINKING"
                                  : premoveTurn
                                    ? "BOSS TURN"
                                    : "YOUR TURN"}
                            </span>
                          </span>
                        </div>
                      </section>
                      {premoves.length > 0 && (
                        <button
                          className="premove-cancel"
                          onClick={() => {
                            setPremoves([]);
                            setSelectedSquare(null);
                            setPromotionMove(null);
                          }}
                          aria-label={premoves.length === 1 ? "Cancel premove" : `Cancel all ${premoves.length} premoves`}
                        >
                          <span>{premoves.length} PREMOVE{premoves.length === 1 ? "" : "S"} QUEUED</span>
                          <b>
                            {premoves.map(move => `${move.from}\u2192${move.to}`).join(" / ")}
                          </b>
                          <X size={13} />
                        </button>
                      )}
                      <div
                        className="captured-army"
                        aria-label="Captured pieces"
                      >
                        <div
                          className="material-advantage"
                          role="status"
                          aria-label={
                            materialAdvantage === 0
                              ? "Material is even"
                              : `${materialAdvantage > 0 ? "You" : "Boss"} ahead by ${Math.abs(materialAdvantage)} material points`
                          }
                        >
                          <span>MATERIAL LEAD</span>
                          <strong className={materialLeadClass}>
                            {materialLeadLabel}
                          </strong>
                        </div>
                        {(
                          [
                            {
                              color: boss.chessColor,
                              label: "OPPONENT PIECES LOST",
                            },
                            {
                              color: playerColor,
                              label: "YOUR PIECES LOST",
                            },
                          ] as const
                        ).map(({ color, label }) => {
                          const piecesLost = capturedByColor[color];
                          const losses = Object.entries(piecesLost).flatMap(
                            ([type, count]) =>
                              Array.from(
                                { length: count },
                                (_, pieceIndex) => ({
                                  type: type as MedievalPieceType,
                                  count,
                                  pieceIndex,
                                }),
                              ),
                          );
                          const pointsLost = getMaterialPoints(piecesLost);
                          return (
                            <div className="capture-group" key={color}>
                              <span className="capture-group-label">
                                <span>{label}</span>
                                <b>{pointsLost} PTS LOST</b>
                              </span>
                              <div className="capture-group-pieces">
                                {losses.length === 0 ? (
                                  <small>— NONE —</small>
                                ) : (
                                  losses.map(({ type, count, pieceIndex }) => {
                                    const pieceName = PIECE_NAMES[type];
                                    return (
                                      <span
                                        className={`captured-piece ${color === "w" ? "captured-white" : "captured-black"}`}
                                        key={`${color}-${type}-${pieceIndex}`}
                                        role="img"
                                        aria-label={`${pieceName} captured, ${pieceIndex + 1} of ${count}`}
                                        title={`${pieceName} captured`}
                                      >
                                        <PieceArtwork
                                          type={type}
                                          color={color}
                                          theme={pieceTheme}
                                        />
                                      </span>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="side-divider">
                        <span>MOVE HISTORY</span>
                        <i />
                      </div>
                      {reviewing && (
                        <div className="history-review-controls" role="status">
                          <span>VIEWING {Math.ceil(reviewPly / 2)}{viewedMove?.color === "w" ? "." : "..."} {viewedMove?.san}</span>
                          <button type="button" onClick={() => setReviewPly(null)}>
                            RESUME
                          </button>
                        </div>
                      )}
                      <div
                        className="move-log"
                        ref={moveLogRef}
                        role="log"
                        aria-label="Move history"
                      >
                        {moveHistory.length === 0 ? (
                          <div className="log-empty">
                            <span className="log-crosshair">⌖</span>
                            <span>Your moves will appear here.</span>
                            <i />
                          </div>
                        ) : (
                          moveHistory.map((move, index) => (
                            <button
                              type="button"
                              className={`move-log-row ${index === (reviewPly ?? moveHistory.length) - 1 ? "move-log-current" : ""}`}
                              key={`${move.color}-${move.from}-${move.to}-${index}`}
                              onClick={() => viewHistoryMove(index + 1)}
                              aria-pressed={index === (reviewPly ?? moveHistory.length) - 1}
                              aria-label={`${index === moveHistory.length - 1 ? "Resume at" : "View"} move ${Math.floor(index / 2) + 1}${move.color === "w" ? "." : "..."} ${move.san}`}
                            >
                              <span className="move-turn">
                                {String(Math.floor(index / 2) + 1).padStart(
                                  2,
                                  "0",
                                )}
                                {move.color === "w" ? "a" : "b"}
                              </span>
                              <span
                                className={`move-player ${move.color === "w" ? "move-player-white" : ""}`}
                              />{" "}
                              <strong>{move.san}</strong>
                              <span className="move-coords">
                                {move.from}→{move.to}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </aside>
                </div>
              </section>
            )}
          </section>
        )}
      </main>

      <footer className="site-footer">
        <span>Arcade Gambit</span>
        <CookieNotice resetRequest={cookieNoticeReset} />
        <span className="footer-right">© {new Date().getFullYear()}</span>
      </footer>

      {toast && (
        <div className="arcade-toast" role="status">
          <span className="toast-icon">
            <Zap size={14} fill="currentColor" />
          </span>
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {promotionMove && screen === "battle" && !reviewing && !currentResult && promotionMove.fen === fen && promotionMove.matchId === matchId.current && (
        <PromotionMenu position={promotionMove.position} color={playerColor} theme={pieceTheme}
          onCancel={() => { setPromotionMove(null); setPremoves([]); }}
          onChoose={(piece) => {
            const pending = promotionMove;
            setPromotionMove(null);
            if (pending.fen === fen && pending.matchId === matchId.current) {
              makeMove(pending.from, pending.to, piece, undefined, pending.queued);
            }
          }} />
      )}

      {authOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAuthOpen(false);
          }}
        >
          <section
            ref={authDialogRef}
            className="modal-card auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <button
              className="modal-close"
              onClick={() => setAuthOpen(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="modal-emblem">
              <Gamepad2 size={25} />
            </div>
            {passwordRecovery ? (
              <>
                <h2 id="auth-title">RESET YOUR PASSWORD</h2>
                <EmailAuth termsAccepted={signupTermsAccepted} plan={signupPlan} recovery onComplete={() => {
                  setPasswordRecovery(false);
                  setAuthMessage("");
                  showToast("PASSWORD UPDATED");
                }} />
              </>
            ) : user ? (
              <>
                <div className="modal-eyebrow">
                  <span /> PLAYER PROFILE
                </div>
                <h2 id="auth-title">
                  WELCOME BACK,
                  <br />
                  <em>{playerName.toUpperCase()}</em>
                </h2>
                <p className="modal-description">
                  {cloudSyncError
                    ? "Some progress is saved locally and will retry when connectivity returns."
                    : "Your arcade run is synced. Keep climbing the leaderboard."}
                </p>
                <div className="account-stats">
                  <span>PLAN: {user.user_metadata?.arcade_plan === "very-free" ? "VERY FREE" : "FREE"}</span>
                  <span>
                    <Trophy size={14} /> {progress.wins} WINS
                  </span>
                  <span>
                    <Flame size={14} /> {progress.bestStreak} BEST STREAK
                  </span>
                </div>
                <button
                  className="social-button guest-button"
                  onClick={() => void signOut()}
                >
                  <LogIn size={16} /> SIGN OUT
                </button>
              </>
            ) : (
              <>
                <div className="modal-eyebrow">
                  <span /> ARCADE ID // OPTIONAL
                </div>
                <h2 id="auth-title">
                  SAVE YOUR
                  <br />
                  <em>HIGH SCORE</em>
                </h2>
                <p className="modal-description">
                  Sign in to sync progress between machines. Or keep playing as
                  a guest — your run saves on this device.
                </p>
                <SignupPlans value={signupPlan} onChange={setSignupPlan} />
                <SignupDisclaimer />
                <label className="signup-terms-acceptance">
                  <input
                    type="checkbox"
                    checked={signupTermsAccepted}
                    onChange={(event) => setSignupTermsAccepted(event.target.checked)}
                  />
                  <span>I have read and agree to the terms of use, code of conduct, and liability disclaimer for all signup methods and free or paid tiers. My mandatory legal rights remain protected.</span>
                </label>
                <div className="social-login-list">
                  <button
                    className="social-button google-button"
                    onClick={() => void signIn("google")}
                    disabled={!signupTermsAccepted}
                  >
                    <span className="google-g">G</span> CONTINUE WITH GOOGLE{" "}
                    <ArrowRight size={15} />
                  </button>
                </div>
                <EmailAuth termsAccepted={signupTermsAccepted} plan={signupPlan} onComplete={() => {
                  setAuthMessage("");
                  setAuthOpen(false);
                }} />
                {authMessage && (
                  <p className="auth-message" role="alert">
                    {authMessage}
                  </p>
                )}
                {!authReady && (
                  <p className="auth-message">Checking your arcade ID…</p>
                )}
                <button
                  className="guest-link"
                  onClick={() => setAuthOpen(false)}
                >
                  <ArrowDownToLine size={14} /> KEEP PLAYING AS GUEST
                </button>
              </>
            )}
          </section>
        </div>
      )}

      {helpOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false);
          }}
        >
          <section
            ref={helpDialogRef}
            className="modal-card help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <button
              className="modal-close"
              onClick={() => setHelpOpen(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="modal-emblem help-emblem">
              <Menu size={23} />
            </div>
            <div className="modal-eyebrow">
              <span /> PLAYER MANUAL
            </div>
            <h2 id="help-title">
              HOW TO <em>PLAY</em>
            </h2>
            <div className="help-steps">
              <p>
                <b>01</b>
                <span>
                  Choose an unlocked boss from the roster. Each rung adds 50
                  Elo, from 100 to 3000.
                </span>
              </p>
              <p>
                <b>02</b>
                <span>
                  Move your side’s pieces by clicking a figure, then a glowing
                  square—or drag it. Bosses alternate between white and black.
                </span>
              </p>
              <p>
                <b>03</b>
                <span>
                  Checkmate the boss to clear it and unlock the next 50-Elo
                  challenger.
                </span>
              </p>
              <p>
                <b>04</b>
                <span>Turn on the soundtrack and chunky capture effects.</span>
              </p>
            </div>
            <div className="help-footnote">
              <Music2 size={13} /> Progress saves locally as a guest. Sign in
              with an Arcade ID to sync it.
            </div>
            <button
              className="help-close-button"
              onClick={() => setHelpOpen(false)}
            >
              GOT IT <Check size={15} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
