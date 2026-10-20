import type { Metadata } from "next";
import ChatApp from "@/components/ChatApp";

export const metadata: Metadata = { title: "Talk to AI · MOVERSLY" };

export default function ChatPage() {
  return <ChatApp />;
}
