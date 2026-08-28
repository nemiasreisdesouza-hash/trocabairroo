"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import * as backend from "@/lib/backend";
import {
  SITE_CONTENT_GROUPS,
  DEFAULT_SITE_CONTENT,
} from "@/lib/site-content";
import toast from "react-hot-toast";
import { Save, RotateCcw, Search } from "lucide-react";
import HelpTeamEditor from "./HelpTeamEditor";

/**
 * Editor do CMS · tabela site_content (key, value) + help_team
 * Permite ao admin alterar Hero, Como Funciona, Por que usar,
 * Depoimentos e CTA da Home — sem tocar em código.
 * + Nova aba Central de Ajuda / Equipe com edição de bolhas e fotos.
 */
export default function CmsEditor() {
  const [activeTab, setActiveTab] = useState<'site' | 'help'>('site');
  const [values, setValues] = useState<Record<string, string>>(
    DEFAULT_SITE_CONTENT
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openGroup, setOpenGroup] = useState<string>(SITE_CONTENT_GROUPS[0].id);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (activeTab !== 'site') {
      setLoading(false);
      return;
    }
    setLoading(true);
    backend
      .getSiteContent()
      .then((content) => setValues(content))
      .catch(() => toast.error("Erro ao carregar conteúdo"))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const setValue = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const managed = new Set(
      SITE_CONTENT_GROUPS.flatMap((g) => g.fields.map((f) => f.key))
    );
    const entries: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (managed.has(k)) entries[k] = v;
    }

    setSaving(true);
    try {
      await backend.saveSiteContent(entries);
      toast.success("Conteúdo do site salvo! 🎉 A Home já mostra as mudanças.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setValues({ ...DEFAULT_SITE_CONTENT });
    toast.success("Campos restaurados ao padrão (clique em Salvar para aplicar)");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="bg-white rounded-2xl p-1.5 shadow-sm flex gap-1.5">
        <button
          onClick={() => setActiveTab('site')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'site' ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          🟣 Conteúdo Site
        </button>
        <button
          onClick={() => setActiveTab('help')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'help' ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          💬 Central Ajuda / Equipe
        </button>
      </div>

      {activeTab === 'help' ? (
        <HelpTeamEditor />
      ) : (
        <>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Barra de ações */}
              <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar campo (ex: hero, depoimento, passo 2...)"
                      className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-purple-600"
                    />
                  </div>
                  <button
                    onClick={handleReset}
                    className="p-2.5 rounded-xl border-2 border-gray-200 text-gray-500 hover:border-gray-300"
                    title="Restaurar padrão"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-500 flex-1">
                    Edite os textos e salve — a Home é atualizada na hora (tabela{" "}
                    <code className="bg-gray-100 px-1 rounded">site_content</code>).
                  </p>
                  <Button onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4" />}>
                    Salvar tudo
                  </Button>
                </div>
              </div>

              {/* Grupos de campos */}
              {SITE_CONTENT_GROUPS.map((g) => ({
                ...g,
                fields: g.fields.filter(
                  (f) =>
                    !busca ||
                    f.label.toLowerCase().includes(busca.toLowerCase()) ||
                    f.key.includes(busca.toLowerCase())
                ),
              }))
                .filter((g) => g.fields.length > 0)
                .map((group) => (
                  <div key={group.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <button
                      onClick={() =>
                        setOpenGroup(openGroup === group.id ? "" : group.id)
                      }
                      className="w-full flex items-center gap-3 p-4 text-left"
                    >
                      <span className="text-2xl">{group.icon}</span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{group.label}</p>
                        <p className="text-xs text-gray-500">{group.description}</p>
                      </div>
                      <span className="text-xs font-semibold text-purple-700">
                        {group.fields.length} campos
                      </span>
                      <span
                        className={`text-gray-400 transition-transform ${
                          openGroup === group.id ? "rotate-90" : ""
                        }`}
                      >
                        ›
                      </span>
                    </button>

                    {openGroup === group.id && (
                      <div className="px-4 pb-4 flex flex-col gap-4 border-t border-gray-50 pt-4">
                        {group.fields.map((field) => {
                          const isDefault = values[field.key] === DEFAULT_SITE_CONTENT[field.key];
                          return (
                            <div key={field.key} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-gray-700">
                                  {field.label}
                                </label>
                                {isDefault ? (
                                  <span className="text-xs text-gray-300">padrão</span>
                                ) : (
                                  <span className="text-xs text-purple-600 font-semibold">
                                    ● editado
                                  </span>
                                )}
                              </div>
                              {field.type === "textarea" ? (
                                <textarea
                                  value={values[field.key] ?? ""}
                                  onChange={(e) => setValue(field.key, e.target.value)}
                                  rows={2}
                                  placeholder={field.placeholder}
                                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-600 resize-none"
                                />
                              ) : (
                                <input
                                  type={field.type === "number" ? "number" : "text"}
                                  value={values[field.key] ?? ""}
                                  onChange={(e) => setValue(field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-600"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
