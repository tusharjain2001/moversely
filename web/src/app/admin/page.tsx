import type { Metadata } from "next";
import AdminApp from "@/components/AdminApp";

export const metadata: Metadata = { title: "Leads · AI Move Survey", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminApp />;
}
