"use client";

import { useState } from "react";
import { LoadingPopup } from "@/components/loading-popup";

// All visible text sits here so it can be translated later.
const text = {
  preparing: (kind: string) => `Preparing ${kind}... please wait`,
  failed: "The file could not be prepared. Try again.",
} as const;

export type FileKind = "PDF" | "Excel";

// Downloads a PDF or Excel file the server builds, and shows a popup while it is
// being prepared, because building a long file takes a few seconds.
export function useDownload() {
  const [kind, setKind] = useState<FileKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(url: string, as: FileKind) {
    if (kind) return;
    setError(null);
    setKind(as);
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) {
        const message = (await response.text()).trim();
        setError(message && message.length < 200 ? message : text.failed);
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const name =
        /filename="?([^";]+)"?/.exec(disposition)?.[1] ??
        `download.${as === "PDF" ? "pdf" : "xlsx"}`;
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
    } catch {
      setError(text.failed);
    } finally {
      setKind(null);
    }
  }

  const popup = kind ? <LoadingPopup message={text.preparing(kind)} /> : null;
  return { download, popup, error };
}
