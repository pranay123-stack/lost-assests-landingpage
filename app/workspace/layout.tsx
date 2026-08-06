import type { Metadata } from "next";
import "./workspace.css";

export const metadata: Metadata = {
  title: "Case Workspace | Lost Assets",
  description: "A private, browser-based workspace for reviewing and organizing heir-recovery CSV files.",
};

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
