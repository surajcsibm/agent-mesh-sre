import type { Metadata } from "next";
import "./globals.css";
import "@xyflow/react/dist/style.css";

export const metadata: Metadata = {
  title: "Agent Mesh SRE — MCP-Governed Kafka Ops",
  description:
    "Self-healing, MCP-governed AI workflows on Apache Kafka. API Days demo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
