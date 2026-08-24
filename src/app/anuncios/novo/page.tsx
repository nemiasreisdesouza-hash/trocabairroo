import { redirect } from "next/navigation";

// Alias amigável → tela de criar anúncio
export default function NovoAnuncioAliasPage() {
  redirect("/anuncio/criar");
}
