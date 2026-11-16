import { Children, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PagedItems({ children, pageSize = 6, mobilePageSize = 3, focusIndex, label = "Items", list }: {
  children: ReactNode; pageSize?: number; mobilePageSize?: number; focusIndex?: number; label?: string; list?: "ol" | "ul";
}) {
  const items = Children.toArray(children);
  const [compact, setCompact] = useState(() => innerWidth <= 760);
  const size = compact ? mobilePageSize : pageSize;
  const [page, setPage] = useState(() => focusIndex === undefined ? 0 : Math.floor(Math.max(0, focusIndex) / size));
  const total = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, total - 1);
  useEffect(() => {
    const media = matchMedia("(max-width: 760px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => { if (focusIndex !== undefined) setPage(Math.floor(Math.max(0, focusIndex) / size)); }, [focusIndex, size]);
  const Content = list ?? "div";
  return <div className="paged-items"><Content className="paged-items-content">{items.slice(current * size, (current + 1) * size)}</Content>{total > 1 && <nav className="history-pagination" aria-label={`${label} pages`}><button type="button" disabled={current === 0} aria-label={`Previous ${label.toLowerCase()}`} onClick={() => setPage(current - 1)}><ChevronLeft size={14} /></button><span>{current + 1} / {total}</span><button type="button" disabled={current + 1 === total} aria-label={`Next ${label.toLowerCase()}`} onClick={() => setPage(current + 1)}><ChevronRight size={14} /></button></nav>}</div>;
}
