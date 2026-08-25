// ═══════════════════════════════════════════════════════════
// 🔠 LOGO · TrocaES — SVG oficial + logotipo com tagline colorida
//   Troca (laranja #FF6500) + ES (roxo #7C3AED)
//   TROQUE (roxo) • (laranja) CONECTE (laranja) • (roxo) TRANSFORME (roxo)
// Use onDark em fundos roxos (login/cadastro) p/ contraste.
// ═══════════════════════════════════════════════════════════
import LogoIcon from "./LogoIcon";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
};

export default function Logo({ size = "md", onDark = false }: LogoProps) {
  const iconCls =
    size === "lg"
      ? "w-11 h-11 sm:w-12 sm:h-12"
      : "w-10 h-10 sm:w-11 sm:h-11";

  const roxo = onDark ? "#A78BFA" : "#7C3AED"; // ES · TROQUE/TRANSFORME
  const laranja = "#FF6500"; // Troca · CONECTE · pontos alternados

  return (
    <span className="inline-flex items-center gap-2 select-none">
      <LogoIcon className={`${iconCls} flex-shrink-0`} />
      <span className="flex flex-col leading-none min-w-0">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">
          <span style={{ color: laranja }}>Troca</span>
          <span style={{ color: roxo }}>ES</span>
        </span>
        <span className="text-[9px] font-extrabold uppercase tracking-widest leading-tight pt-0.5 whitespace-nowrap">
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
