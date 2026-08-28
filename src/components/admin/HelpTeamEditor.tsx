"use client";

import { useEffect, useState, useRef } from "react";
import Button from "@/components/ui/Button";
import * as backend from "@/lib/backend";
import type { HelpTeamMember } from "@/lib/help-content";
import { getDefaultHelpTeam } from "@/lib/help-content";
import toast from "react-hot-toast";
import { Save, Upload, Trash2, Eye } from "lucide-react";

function sanitizePreview(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

function AvatarCircle({
  url,
  fallback,
  className,
  alt,
}: {
  url: string | null;
  fallback: string;
  className: string;
  alt: string;
}) {
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [url]);
  const showImg = !!url && !error;
  return (
    <div className={`${className} rounded-full overflow-hidden flex items-center justify-center flex-shrink-0`}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span className="font-bold">{fallback}</span>
      )}
    </div>
  );
}

export default function HelpTeamEditor() {
  const [team, setTeam] = useState<HelpTeamMember[]>(getDefaultHelpTeam());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    backend
      .getHelpTeam()
      .then((t) => {
        if (Array.isArray(t) && t.length === 2) setTeam(t);
      })
      .catch(() => toast.error("Erro ao carregar equipe de ajuda"))
      .finally(() => setLoading(false));
  }, []);

  const updateLocal = (id: 'admin' | 'founder', patch: Partial<HelpTeamMember>) => {
    setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const handleSave = async (member: HelpTeamMember) => {
    if (member.displayName && member.displayName.length > 40) {
      toast.error("Nome deve ter no máximo 40 caracteres");
      return;
    }
    if (member.roleTitle && member.roleTitle.length > 40) {
      toast.error("Cargo deve ter no máximo 40 caracteres");
      return;
    }
    if (member.message && member.message.length > 800) {
      toast.error("Mensagem deve ter no máximo 800 caracteres");
      return;
    }
    const cleanDisplay = member.displayName?.replace(/<[^>]*>/g, '') ?? '';
    const cleanRole = member.roleTitle?.replace(/<[^>]*>/g, '') ?? '';
    const cleanMessage = member.message?.replace(/<[^>]*>/g, '') ?? '';

    setSaving(member.id);
    try {
      const updated = await backend.updateHelpTeamMember(member.id, {
        displayName: cleanDisplay,
        roleTitle: cleanRole,
        message: cleanMessage,
        namePosition: member.namePosition,
      });
      setTeam(updated);
      toast.success(`${member.id === 'admin' ? 'Admin' : 'Fundadora'} salvo! 🎉`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(null);
    }
  };

  const handleUpload = async (id: 'admin' | 'founder', file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error("Formato inválido. Use JPEG, PNG ou WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2MB");
      return;
    }
    setUploading(id);
    try {
      const res = await backend.uploadHelpTeamAvatar(file, id);
      if (!res.success) throw new Error(res.error || "Falha upload");
      const updated = await backend.getHelpTeam();
      setTeam(updated);
      toast.success("Foto atualizada! 📸 Agora renderiza no drawer.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro upload";
      toast.error(msg);
    } finally {
      setUploading(null);
    }
  };

  const handleRemovePhoto = async (id: 'admin' | 'founder') => {
    if (!confirm("Remover foto? Voltará ao ícone padrão.")) return;
    setUploading(id);
    try {
      await backend.removeHelpTeamAvatar(id);
      const updated = await backend.getHelpTeam();
      setTeam(updated);
      toast.success("Foto removida");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover";
      toast.error(msg);
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-violet-100">
        <h3 className="font-black text-gray-900 flex items-center gap-2">
          <Eye className="w-4 h-4 text-violet-600" /> Central de Ajuda / Equipe
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Edite as 2 bolhas de boas-vindas do chat de ajuda. Fotos vão para <code className="bg-gray-100 px-1 rounded">help/{'{id}'}/</code> com compressão WebP 500px e fallback ícone. Preview ao vivo abaixo de cada card.
        </p>
      </div>

      {team.map((member) => {
        const isViolet = member.accent !== 'amber';
        return (
          <div key={member.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <div className={`p-4 ${isViolet ? 'bg-violet-600' : 'bg-gradient-to-r from-amber-500 to-yellow-500'} text-white flex items-center justify-between`}>
              <div>
                <p className="font-black text-sm">{member.id === 'admin' ? '🛡️ Admin TrocaES' : '💜 Fundadora'}</p>
                <p className="text-[11px] opacity-90">ID: {member.id} • {isViolet ? 'violeta' : 'âmbar'}</p>
              </div>
              <AvatarCircle
                url={member.avatarUrl}
                fallback={isViolet ? '🛡️' : '💜'}
                alt={member.roleTitle}
                className={`w-12 h-12 bg-white/20 text-white ${isViolet ? 'bg-violet-700' : ''}`}
              />
            </div>

            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  ref={(el) => { fileInputs.current[member.id] = el; }}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(member.id, f);
                    if (e.target) e.target.value = '';
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Upload className="w-4 h-4" />}
                  loading={uploading === member.id}
                  onClick={() => fileInputs.current[member.id]?.click()}
                >
                  Trocar foto
                </Button>
                {member.avatarUrl && (
                  <button
                    onClick={() => handleRemovePhoto(member.id)}
                    className="text-xs text-red-600 font-bold flex items-center gap-1 hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </button>
                )}
                <span className="text-[11px] text-gray-400">JPEG/PNG/WebP • máx 2MB • WebP 500px</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-700">Nome real (opcional, 40 chars) - ex: &quot;João - Suporte&quot;</label>
                  <input
                    value={member.displayName}
                    onChange={(e) => updateLocal(member.id, { displayName: e.target.value.slice(0, 40) })}
                    placeholder={member.id === 'admin' ? 'Ex: Equipe TrocaES' : 'Ex: Michelle - Fundadora'}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-600"
                  />
                  <span className="text-[10px] text-gray-400">{member.displayName.length}/40</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-700">Cargo / Título (40 chars)</label>
                  <input
                    value={member.roleTitle}
                    onChange={(e) => updateLocal(member.id, { roleTitle: e.target.value.slice(0, 40) })}
                    placeholder="Ex: Admin TrocaES 🛡️"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-600"
                  />
                  <span className="text-[10px] text-gray-400">{member.roleTitle.length}/40</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-700">Posição do nome</label>
                  <select
                    value={member.namePosition || 'below_role'}
                    onChange={(e) => updateLocal(member.id, { namePosition: e.target.value as any })}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-600"
                  >
                    <option value="below_role">Abaixo do cargo (padrão)</option>
                    <option value="above_role">Acima do cargo</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-700">Mensagem de boas-vindas (800 chars)</label>
                  <textarea
                    value={member.message}
                    onChange={(e) => updateLocal(member.id, { message: e.target.value.slice(0, 800) })}
                    rows={4}
                    placeholder="Mensagem que aparece na bolha..."
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-600 resize-none"
                  />
                  <span className="text-[10px] text-gray-400">{member.message.length}/800</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-[11px] font-bold text-gray-500 mb-2">Preview ao vivo (igual drawer):</p>
                <div className={`${isViolet ? 'bg-white border-violet-100' : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'} rounded-2xl p-4 shadow-sm border flex gap-3`}>
                  <AvatarCircle
                    url={member.avatarUrl}
                    fallback={isViolet ? '🛡️' : '💜'}
                    alt={member.roleTitle}
                    className={`w-9 h-9 ${isViolet ? 'bg-violet-600 text-white' : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white'}`}
                  />
                  <div className="min-w-0 flex-1">
                    {member.namePosition === 'above_role' ? (
                      <>
                        {member.displayName && <p className={`text-xs font-bold ${isViolet ? 'text-gray-900' : 'text-amber-900'} mb-0.5`}>{sanitizePreview(member.displayName)}</p>}
                        <p className={`text-xs font-black ${isViolet ? 'text-gray-900' : 'text-amber-900'} mb-1`}>{sanitizePreview(member.roleTitle)}</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-xs font-black ${isViolet ? 'text-gray-900' : 'text-amber-900'} mb-0.5`}>{sanitizePreview(member.roleTitle)}</p>
                        {member.displayName && <p className={`text-[11px] font-semibold ${isViolet ? 'text-violet-600' : 'text-amber-700'} mb-1`}>{sanitizePreview(member.displayName)}</p>}
                      </>
                    )}
                    <p className={`text-sm leading-relaxed whitespace-pre-line ${isViolet ? 'text-gray-700' : 'text-amber-900'}`}>
                      {sanitizePreview(member.message)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSave(member)} loading={saving === member.id} icon={<Save className="w-4 h-4" />}>
                  Salvar {member.id === 'admin' ? 'Admin' : 'Fundadora'}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
