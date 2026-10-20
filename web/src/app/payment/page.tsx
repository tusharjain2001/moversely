import type { Metadata } from "next";
import Payment from "@/components/Payment";

export const metadata: Metadata = { title: "Review & book · MOVERSLY" };

export default function PaymentPage() {
  return <Payment />;
}
