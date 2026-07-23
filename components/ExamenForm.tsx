"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { enviarExamen } from "@/app/examen/[id]/actions";

interface Opcion { id: string; texto: string; orden: number; }
interface Pregunta { id: string; enunciado: string; orden: number; opciones: Opcion[]; }

export default function ExamenForm({ examenId, preguntas }: { examenId: string; preguntas: Pregunta[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ aprobado: boolean; calificacion: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (Object.keys(sel).length < preguntas.length) {
      setError("Responde todas las preguntas.");
      return;
    }
    setEnviando(true);
    const respuestas = preguntas.map((p) => ({ pregunta_id: p.id, opcion_id: sel[p.id] }));
    const res = await enviarExamen(examenId, respuestas);
    setEnviando(false);
    if (!res.ok) {
      setError(res.error ?? "Error");
      return;
    }
    setResultado({ aprobado: !!res.aprobado, calificacion: res.calificacion ?? 0 });
    router.refresh();
  }

  if (resultado) {
    return (
      <div className={`rounded-xl border p-6 text-center ${resultado.aprobado ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
        <p className="text-3xl font-bold">{resultado.calificacion}%</p>
        <p className={`mt-2 font-medium ${resultado.aprobado ? "text-green-700" : "text-red-700"}`}>
          {resultado.aprobado
            ? "¡Aprobado! Se generó tu constancia."
            : "No aprobaste. Puedes intentar de nuevo si te quedan intentos."}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/capacitaciones" className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
            Volver
          </Link>
          {resultado.aprobado && (
            <Link href="/constancias" className="rounded-lg bg-toto-red px-4 py-2 text-sm text-white">
              Ver constancia
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {preguntas.map((p, idx) => (
        <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="font-medium">
            {idx + 1}. {p.enunciado}
          </p>
          <div className="mt-3 space-y-2">
            {p.opciones.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:border-toto-red">
                <input
                  type="radio"
                  name={p.id}
                  value={o.id}
                  checked={sel[p.id] === o.id}
                  onChange={() => setSel((s) => ({ ...s, [p.id]: o.id }))}
                />
                <span>{o.texto}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={enviando} className="rounded-lg bg-toto-red px-5 py-2 font-medium text-white disabled:opacity-50">
        {enviando ? "Enviando…" : "Enviar examen"}
      </button>
    </form>
  );
}
