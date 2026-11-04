import type { ButtonHTMLAttributes } from "react";
import { Play } from "lucide-react";
import "./gameStartButton.css";

type GameStartButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "small" | "medium" | "large";
  tone?: "default" | "resume";
};

/** Shared circular, glowing control for starting or resuming play. */
export function GameStartButton({ children, className = "", type = "button", size = "medium", tone = "default", ...props }: GameStartButtonProps) {
  return <button {...props} type={type} className={`game-start-button game-start-${size} game-start-${tone} ${className}`}>
    <span className="game-start-content">{children}</span>
    <Play className="game-start-icon" size={18} fill="currentColor" aria-hidden="true" />
  </button>;
}
