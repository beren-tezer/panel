import type { ReactNode } from "react";

export type IconName = "ara" | "bildirim" | "asagi" | "sol" | "sag" | "dosya" | "yorum" | "nokta" | "filtre" | "arti" | "kapat" | "baglanti" | "yukle" | "menu" | "takvim" | "onay";

const paths: Record<IconName, ReactNode> = {
  ara: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  bildirim: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  asagi: <path d="m7 9 5 5 5-5" />, sol: <path d="m15 18-6-6 6-6" />, sag: <path d="m9 18 6-6-6-6" />,
  dosya: <><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  yorum: <path d="M20 15a4 4 0 0 1-4 4H8l-4 3V7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4Z" />,
  nokta: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  filtre: <path d="M4 6h16M7 12h10M10 18h4" />, arti: <path d="M12 5v14M5 12h14" />, kapat: <path d="m6 6 12 12M18 6 6 18" />,
  baglanti: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1" /></>,
  yukle: <><path d="M12 16V4M8 8l4-4 4 4" /><path d="M4 15v5h16v-5" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  takvim: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  onay: <path d="m5 12 4 4L19 6" />,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Button({ children, variant = "secondary", icon, onClick, disabled, type = "button", className = "" }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: IconName; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; className?: string }) {
  return <button type={type} className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled}>{icon && <Icon name={icon} />}{children}</button>;
}

export function Avatar({ name, color = "blue" }: { name: string; color?: string }) {
  const initials = name.split(" ").map((part) => part[0]).join("");
  return <span className={`avatar av-${color}`}>{initials}</span>;
}

export function Modal({ children, onClose, className = "" }: { children: ReactNode; onClose: () => void; className?: string }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className={`modal ${className}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>{children}</div></div>;
}

export function Toast({ text, tone = "success", onClose }: { text: string; tone?: "success" | "error"; onClose: () => void }) {
  return <div className={`toast toast-${tone}`} role="status"><span>{tone === "success" ? "✓" : "!"}</span><div><strong>{text}</strong><small>{tone === "success" ? "İşlem başarıyla tamamlandı." : "Lütfen tekrar deneyin."}</small></div><button onClick={onClose} aria-label="Bildirimi kapat"><Icon name="kapat" size={14} /></button></div>;
}
