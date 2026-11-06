import type { ReactNode } from "react";
import "./historyPage.css";

export function HistoryPage({ children, navigate }: {
  children: ReactNode; navigate: (route: string) => void;
}) {
  return <div className="history-library">
    <header className="history-library-heading"><div><h1>Game history</h1><p>Your played games and saved battles.</p></div><button onClick={() => navigate("home")}>Back to arcade</button></header>
    {children}
  </div>;
}
