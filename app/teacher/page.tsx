import type { Metadata } from "next";
import { Teacher } from "@/components/Teacher";

export const metadata: Metadata = { title: "Мән · мұғалім" };

export default function TeacherPage() {
  return <Teacher />;
}
