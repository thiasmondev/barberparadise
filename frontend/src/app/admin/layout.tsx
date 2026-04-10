"use client";

import { ReactNode } from "react";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import AdminShell from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
