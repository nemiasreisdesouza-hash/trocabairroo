// ═══════════════════════════════════════════════════════════
// 🔠 LOGO · TrocaES — ícone + logotipo com tagline
//   Troca (laranja #FF6500) + ES (roxo #7C3AED)
//   "TROQUE • CONECTE • TRANSFORME"
// Use onDark em fundos roxos (login/cadastro) p/ contraste.
// ═══════════════════════════════════════════════════════════
import LogoIcon from "./LogoIcon";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
};

export default function Logo({ size = "md", onDark = false }: LogoProps) {
  const iconCls =
    size === "lg" ? "w-10 h-10" : size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const titleCls =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";

  return (
    <span className="inline-flex items-center gap-2 select-none">
      <LogoIcon className={`${iconCls} flex-shrink-0`} />
      <span className="flex flex-col leading-none">
        <span className={`${titleCls} font-extrabold tracking-tight`}>
          <span style={{ color: "#FF6500" }}>Troca</span>
          <span className={onDark ? "text-purple-200" : "text-purple-600"}>
            ES
          </span>
        </span>
        <span
          className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-widest mt-0.5 ${
            onDark ? "text-purple-200/80" : "text-purple-900/70"
          }`}
        >
          Troque • Conecte • Transforme
        </span>
      </span>
    </span>
  );
}
