"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarChecklist, type RespuestaInput } from "@/app/checklist/[id]/actions";
import type { ChecklistItem, ChecklistRespuesta, EstadoRespuesta } from "@/lib/types";

interface Props {
  instanciaId: string;
  items: ChecklistItem[];
  respuestas: ChecklistRespuesta[];
}

interface Estado {
  estado: EstadoRespuesta;
  valor_num: string;
  nota: string;
}

const opciones: { value: EstadoRespuesta; label: string; clase: string }[] = [
  { value: "cumple", label: "Cumple", clase: "bg-green-600" },
  { value: "no_cumple", label: "No cumple", clase: "bg-red-600" },
  { value: "na", label: "N/A", clase: "bg-gray-500" },
];

export default function ChecklistForm({ instanciaId, items, respuestas }: Props) {
  const router = useRouter();
  const previas = new Map(respuestas.map((r) => [r.item_id, r]));

  const [estados, setEstados] = useState<Record<string, Estado>>(() => {
    const init: Record<string, Estado> = {};
    for (const it of items) {
      const prev = previas.get(it.id);
      init[it.id] = {
        estado: prev?.estado ?? "pendiente",
        valor_num: prev?.valor_num != null ? String(prev.valor_num) : "",
        nota: prev?.nota ?? "",
      };
    }
    return init;
  });

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  function set(itemId: string, patch: Partial<Estado>) {
    setEstados((s) => ({ ...s, [itemId]: { ...s[itemId], ...patch } }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);

    const payload: RespuestaInput[] = items.map((it) => ({
      item_id: it.id,
      estado: estados[it.id].estado,
      valor_num:
        estados[it.id].valor_num.trim() === ""
          ? null
          : Number(estados[it.id].valor_num),
      nota: estados[it.id].nota.trim() === "" ? null : estados[it.id].nota,
    }));

    const res = await guardarChecklist(instanciaId, payload);
    setGuardando(false);

    if (!res.ok) {
      setMensaje(res.error ?? "Error al guardar");
      return;
    }
    setMensaje("Guardado ✓");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {items.map((it) => {
        const est = estados[it.id];
        return (
          <div
            key={it.id}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="font-medium">
                {it.descripcion}
                {it.critico && (
                  <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">
                    crítico
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {opciones.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set(it.id, { estado: o.value })}
                  className={`rounded-lg px-3 py-1 text-sm font-medium text-white transition ${
                    est.estado === o.value ? o.clase : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {it.tipo === "valor" && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-gray-500">
                  Valor {it.unidad ? `(${it.unidad})` : ""}
                </label>
                <input
                  type="number"
                  step="any"
                  value={est.valor_num}
                  onChange={(e) => set(it.id, { valor_num: e.target.value })}
                  className="w-32 rounded-lg border border-gray-300 px-2 py-1"
                />
              </div>
            )}

            <input
              type="text"
              placeholder="Nota (opcional)"
              value={est.nota}
              onChange={(e) => set(it.id, { nota: e.target.value })}
              className="mt-3 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
            />
          </div>
        );
      })}

      <div className="sticky bottom-0 flex items-center gap-3 bg-gray-50 py-3">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-toto-red px-5 py-2 font-medium text-white disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar checklist"}
        </button>
        {mensaje && <span className="text-sm text-gray-600">{mensaje}</span>}
      </div>
    </form>
  );
}
