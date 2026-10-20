import type { Metadata } from "next";
import Quotation from "@/components/Quotation";

export const metadata: Metadata = { title: "Your quotation · MOVERSLY" };

export default function QuotationPage() {
  return <Quotation />;
}
