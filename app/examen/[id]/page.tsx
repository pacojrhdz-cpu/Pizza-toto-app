import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ExamenForm from "@/components/ExamenForm";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface Opcion { id: string; texto: string; orden: number; }
interface Pregunta { id: string; enunciado: string; orden: number; opciones: Opcion[]; }

export default async function ExamenPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();
  const periodo = new Date().toISOString().slice(0, 7);

  const { data: examen } = await supabase
    .from("examenes")
    .select("id, titulo, calif_minima, max_intentos")
    .eq("id", params.id)
    .single();
  if (!examen) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: intentos } = await supabase
    .from("intentos_examen")
    .select("estado, calificacion")
    .eq("examen_id", params.id)
    .eq("usuario_id", user?.id ?? "")
    .eq("periodo", periodo);

  const its = intentos ?? [];
  const aprobado = its.some((i: any) => i.estado === "aprobado");
  const restantes = (examen as any).max_intentos - its.length;

  const { data: preguntas } = await supabase
    .from("preguntas")
    .select("id, enunciado, orden, opciones(id, texto, orden)")
    .eq("examen_id", params.id)
    .order("orden");

  const lista = ((preguntas ?? []) as unknown as Pregunta[]).map((p) => ({
    ...p,
    opciones: [...(p.opciones ?? [])].sort((a, b) => a.orden - b.orden),
  }));

  return (
    <div className="min-h-screen">
      <Header profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/capacitaciones" className="text-sm text-gray-500 hover:text-toto-red">
          ← Volver
        </Link>
        <h1 className="mb-1 mt-2 text-xl font-semibold">{(examen as any).titulo}</h1>
        <p className="mb-5 text-sm text-gray-500">
          Calificación mínima: {(examen as any).calif_minima}% · Intentos restantes este mes:{" "}
          {Math.max(restantes, 0)}
        </p>

        {aprobado ? (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            Ya aprobaste este examen este mes.{" "}
            <Link href="/constancias" className="underline">Ver mis constancias</Link>
          </div>
        ) : restantes <= 0 ? (
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Ya usaste todos tus intentos de este mes. Vuelve el próximo mes.
          </div>
        ) : (
          <ExamenForm examenId={params.id} preguntas={lista} />
        )}
      </main>
    </div>
  );
}
