export type Format = "Reels" | "Gönderi" | "Hikâye" | "Karusel";
export type Status = "Başlanmamış" | "Üzerinde Çalışılıyor" | "Yönetici Onayında" | "Müşteri Onayında" | "Tamamlandı";

export type User = {
  id: string;
  name: string;
  color: string;
};

export type Comment = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
};

export type Attachment = {
  id: string;
  name: string;
  type: "Görsel" | "Video" | "PDF" | "Doküman";
  preview?: string;
  size: string;
};

export type Brand = {
  id: string;
  name: string;
  initials: string;
  target: number;
  logo?: string;
};

export type Content = {
  id: string;
  brandId: string;
  date: string;
  format: Format;
  title: string;
  brief: string;
  files: Attachment[];
  comments: Comment[];
  assigneeId: string;
  status: Status;
  week: number;
  createdAt: string;
  updatedAt: string;
};

export type Filters = {
  format: "Tümü" | Format;
  status: "Tümü" | Status;
  assigneeId: "Tümü" | string;
};

export type WorkspaceData = {
  brands: Brand[];
  contents: Content[];
  users: User[];
  notifications: { id: string; text: string; read: boolean; createdAt: string }[];
};

export const FORMATS: Format[] = ["Reels", "Gönderi", "Hikâye", "Karusel"];
export const STATUSES: Status[] = ["Başlanmamış", "Üzerinde Çalışılıyor", "Yönetici Onayında", "Müşteri Onayında", "Tamamlandı"];

export function weekOf(date: string) {
  const day = Number(date.slice(8, 10));
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
