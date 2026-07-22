"use client";

import { useSearchParams } from "next/navigation";

import { ServerManageDashboard } from "@/components/admin/server-manage-dashboard";

export function AdminServersPanel() {
  const searchParams = useSearchParams();
  const wantsNew = searchParams.get("new") === "1";
  const editId = searchParams.get("edit")?.trim() || null;

  return (
    <ServerManageDashboard
      initialMode={wantsNew ? "create" : editId ? "edit" : undefined}
      initialEditId={editId}
    />
  );
}
