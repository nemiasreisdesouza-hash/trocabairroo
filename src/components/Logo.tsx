// ═══════════════════════════════════════════════════════════
// 🔠 LOGO · TrocaES — SVG oficial + logotipo com tagline colorida
//   Troca (laranja #FF6500) + ES (roxo #7C3AED)
//   TROQUE (roxo) • (laranja) CONECTE (laranja) • (roxo) TRANSFORME (roxo)
// • MOBILE: tagline OCULTA (hidden sm:flex) — header sem vazamento
// • DESKTOP: tagline visível e elegante
// Use onDark em fundos roxos (login/cadastro) p/ contraste.
// ═══════════════════════════════════════════════════════════
import LogoIcon from "./LogoIcon";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
};

export default function Logo({ size = "md", onDark = false }: LogoProps) {
  // Header: w-8 h-8 sm:w-10 sm:h-10 · telas de login: um pouco maior
  const iconCls =
    size === "lg"
      ? "w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0"
      : "w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0";
  const titleCls =
    size === "lg"
      ? "text-2xl sm:text-3xl"
      : "text-lg sm:text-2xl";

  const roxo = onDark ? "#A78BFA" : "#7C3AED"; // ES · TROQUE/TRANSFORME
  const laranja = "#FF6500"; // Troca · CONECTE · pontos alternados

  return (
    <span className="inline-flex items-center gap-2 select-none min-w-0">
      <LogoIcon className={iconCls} />
      <span className="flex flex-col leading-none min-w-0">
        <span
          className={`${titleCls} font-black tracking-tight leading-none whitespace-nowrap`}
        >
          <span style={{ color: laranja }}>Troca</span>
          <span style={{ color: roxo }}>ES</span>
        </span>
        {/* Tagline: oculta no mobile para não empurrar botões para fora */}
        <span className="hidden sm:flex text-[9px] font-extrabold uppercase tracking-widest leading-tight pt-0.5 whitespace-nowrap">
          <span style={{ color: roxo }}>Troque</span>
          <span style={{ color: laranja }}> • </span>
          <span style={{ color: laranja }}>Conecte</span>
          <span style={{ color: roxo }}> • </span>
          <span style={{ color: roxo }}>Transforme</span>
        </span>
      </span>
    </span>
  );
}
