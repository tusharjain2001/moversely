import type { Metadata } from "next";
import AdminApp from "@/components/AdminApp";

export const metadata: Metadata = { title: "Leads · MOVERSLY", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminApp />;
}
