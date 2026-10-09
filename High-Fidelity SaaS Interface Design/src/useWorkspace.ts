import { useCallback, useEffect, useState } from "react";
import { createDemoData } from "./demoData";
import type { Attachment, Brand, Comment, Content, Status, WorkspaceData } from "./models";

const STORAGE_KEY = "agency-workspace-v2";

function readInitial(): WorkspaceData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as WorkspaceData : createDemoData();
  } catch {
    return createDemoData();
  }
}

export function useWorkspace() {
  const [data, setData] = useState<WorkspaceData>(readInitial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 280);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setError("");
    } catch {
      setError("Değişiklikler tarayıcıya kaydedilemedi.");
    }
  }, [data]);

  const addBrand = useCallback((brand: Brand) => setData((current) => ({ ...current, brands: [...current.brands, brand] })), []);
  const saveBrand = useCallback((brand: Brand) => setData((current) => ({ ...current, brands: current.brands.map((item) => item.id === brand.id ? brand : item) })), []);
  const saveContent = useCallback((content: Content) => setData((current) => {
    const exists = current.contents.some((item) => item.id === content.id);
    return { ...current, contents: exists ? current.contents.map((item) => item.id === content.id ? content : item) : [...current.contents, content] };
  }), []);
  const deleteContent = useCallback((id: string) => setData((current) => ({ ...current, contents: current.contents.filter((item) => item.id !== id) })), []);
  const setStatus = useCallback((id: string, status: Status) => setData((current) => ({ ...current, contents: current.contents.map((item) => item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item) })), []);
  const setAssignee = useCallback((id: string, assigneeId: string) => setData((current) => ({ ...current, contents: current.contents.map((item) => item.id === id ? { ...item, assigneeId, updatedAt: new Date().toISOString() } : item) })), []);
  const addComment = useCallback((id: string, comment: Comment) => setData((current) => ({ ...current, contents: current.contents.map((item) => item.id === id ? { ...item, comments: [...item.comments, comment], updatedAt: new Date().toISOString() } : item) })), []);
  const setFiles = useCallback((id: string, files: Attachment[]) => setData((current) => ({ ...current, contents: current.contents.map((item) => item.id === id ? { ...item, files, updatedAt: new Date().toISOString() } : item) })), []);
  const markNotificationsRead = useCallback(() => setData((current) => ({ ...current, notifications: current.notifications.map((item) => ({ ...item, read: true })) })), []);
  const reset = useCallback(() => { setData(createDemoData()); setError(""); }, []);

  return { data, loading, error, addBrand, saveBrand, saveContent, deleteContent, setStatus, setAssignee, addComment, setFiles, markNotificationsRead, reset };
}
