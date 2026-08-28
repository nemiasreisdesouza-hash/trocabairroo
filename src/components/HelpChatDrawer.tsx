"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ArrowLeft, MessageCircleQuestion } from "lucide-react";
import {
  HELP_TOPICS,
  getSupportWhatsappLink,
  getDefaultHelpTeam,
  type HelpTopic,
  type HelpTeamMember,
} from "@/lib/help-content";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

function HelpBubble({ member }: { member: HelpTeamMember }) {
  const isViolet = member.accent !== 'amber';
  const hasAvatar = !!member.avatarUrl;
  const name = member.displayName?.trim();
  const role = member.roleTitle || (member.id === 'admin' ? 'Admin TrocaES 🛡️' : 'Fundadora 💜');
  const above = member.namePosition === 'above_role';
  const [imgError, setImgError] = useState(false);

  // [FIX] Reset erro quando avatar muda (novo upload)
  useEffect(() => {
    setImgError(false);
  }, [member.avatarUrl]);

  const showAvatar = hasAvatar && !imgError;

  return (
    <div className={`${isViolet ? 'bg-white border-violet-100' : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'} rounded-2xl p-4 shadow-sm border flex gap-3`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden font-bold ${isViolet ? 'bg-violet-600 text-white' : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white'}`}>
        {showAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatarUrl!}
            alt={role}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span>{isViolet ? '🛡️' : '💜'}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {above ? (
          <>
            {name && <p className={`text-xs font-bold ${isViolet ? 'text-gray-900' : 'text-amber-900'} mb-0.5`}>{name}</p>}
            <p className={`text-xs font-black ${isViolet ? 'text-gray-900' : 'text-amber-900'} mb-1`}>{role}</p>
          </>
        ) : (
          <>
            <p className={`text-xs font-black ${isViolet ? 'text-gray-900' : 'text-amber-900'} mb-0.5`}>{role}</p>
            {name && <p className={`text-[11px] font-semibold ${isViolet ? 'text-violet-600' : 'text-amber-700'} mb-1`}>{name}</p>}
          </>
        )}
        <p className={`text-sm leading-relaxed whitespace-pre-line ${isViolet ? 'text-gray-700' : 'text-amber-900'}`}>
          {member.message}
        </p>
      </div>
    </div>
  );
}

export default function HelpChatDrawer({ isOpen, onClose }: Props) {
  const [selected, setSelected] = useState<HelpTopic | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [team, setTeam] = useState<HelpTeamMember[]>(getDefaultHelpTeam());

  useEffect(() => {
    setWhatsappLink(getSupportWhatsappLink());
  }, []);

  // Carrega equipe dinâmica ao abrir
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      try {
        const mod = await import('@/lib/help-content');
        const t = await mod.getHelpTeam();
        if (!cancelled && Array.isArray(t) && t.length === 2) {
          setTeam(t);
        }
      } catch {}
    };
    load();
    // Escuta atualização realtime do admin
    const handler = (e: any) => {
      const detail = e?.detail || {};
      if (detail.entity === 'helpTeam') {
        load();
      }
    };
    window.addEventListener('trocabairro:store' as any, handler);
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === 'trocabairro:demo:signal') {
        load();
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      cancelled = true;
      window.removeEventListener('trocabairro:store' as any, handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      try {
        localStorage.setItem("trocaes_help_seen", "1");
      } catch {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const topicsToShow = HELP_TOPICS.filter((t) => {
    if (t.id === "whatsapp") return !!whatsappLink;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative bg-white w-full sm:w-[420px] h-screen flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 max-w-full sm:max-w-[420px]`}
      >
        <div className="bg-violet-600 text-white p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircleQuestion className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm">Central de Ajuda TrocaES</h2>
              <p className="text-[11px] text-violet-100">Suporte inteligente • Online</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#FAF9FB]">
          {!selected ? (
            <>
              {team.map((member) => (
                <HelpBubble key={member.id} member={member} />
              ))}

              <div className="flex flex-col gap-2.5 mt-1">
                {topicsToShow.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => setSelected(topic)}
                    className="w-full text-left bg-white rounded-2xl p-3.5 border border-violet-100 hover:border-violet-300 hover:bg-violet-50/50 transition-all flex items-center gap-3 shadow-sm active:scale-[0.98]"
                  >
                    <span className="text-xl flex-shrink-0">{topic.icon}</span>
                    <span className="text-sm font-bold text-gray-900 flex-1">{topic.label}</span>
                    <span className="text-violet-400">→</span>
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-gray-400 text-center mt-2">
                Chat de ajuda com botões clicáveis • Sem dados sensíveis • Seguro
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelected(null)}
                className="self-start flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-900 bg-white border border-violet-200 rounded-full px-3 py-1.5 shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao menu
              </button>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-violet-100">
                <h3 className="font-black text-gray-900 text-base mb-3 flex items-center gap-2">
                  <span>{selected.icon}</span> {selected.title}
                </h3>
                <div className="flex flex-col gap-2.5">
                  {selected.steps.map((step, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-700 leading-relaxed flex-1">{step}</p>
                    </div>
                  ))}
                </div>

                {selected.extra && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-3">
                    {selected.extra}
                  </p>
                )}

                {selected.ctaHref && selected.ctaLabel && selected.id !== "whatsapp" && (
                  <div className="mt-4">
                    <Link
                      href={selected.ctaHref}
                      onClick={onClose}
                      className="w-full inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-sm"
                    >
                      {selected.ctaLabel}
                    </Link>
                  </div>
                )}

                {selected.id === "whatsapp" && whatsappLink && (
                  <div className="mt-3">
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-sm"
                    >
                      {selected.ctaLabel || "Abrir WhatsApp →"}
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0">
          <p className="text-[10px] text-gray-400 text-center">
            TrocaES • Feito com 💜 para o seu bairro
          </p>
        </div>
      </div>
    </div>
  );
}
