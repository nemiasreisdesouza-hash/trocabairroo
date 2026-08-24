import { redirect } from "next/navigation";

// Antiga rota de interesses → novo Sistema de Trocas (/trocas)
export default function InteressesPage() {
  redirect("/trocas");
}
