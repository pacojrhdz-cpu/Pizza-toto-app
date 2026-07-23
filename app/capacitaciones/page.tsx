import Link from "next/link";
import Header from "@/components/Header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface Material { id: string; titulo: string; contenido: string | null; recurso_url: string | null; orden: number; }
interface Examen { id: string; titulo: string; calif_minima: number; competencia: string | null; }
interface Cap { id: string; titulo: string; descripcion: string | null; capacitacion_materiales: Material[]; examenes: Examen[]; }
interface Intento { examen_id: string; estado: string; calificacion: number | null; }

export default async function CapacitacionesPage() {
  const profile = await requireProfile();
  const supabase = createClient();
  const periodo = new Date().toISOString().slice(0, 7);

  const { data: caps } = await supabase
    .from("capacitaciones")
    .select(
      "id, titulo, descripcion, capacitacion_materiales(id, titulo, contenido, recurso_url, orden), examenes(id, titulo, calif_minima, competencia)"
    )
    .eq("activa", true)
    .or(`rol_objetivo.is.null,rol_objetivo.eq.${profile.rol}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: intentos } = await supabase
    .from("intentos_examen")
    .select("examen_id, estado, calificacion")
    .eq("usuario_id", user?.id ?? "")
    .eq("periodo", periodo);

  const intentosPorExamen = new Map<string, Intento[]>();
  for (const it of (intentos ?? []) as Intento[]) {
    const a = intentosPorExamen.get(it.examen_id) ?? [];
    a.push(it);
    intentosPorExamen.set(it.examen_id, a);
  }

  const lista = (caps ?? []) as unknown as Cap[];

  return (
    <div className="min-h-screen">
      <Header profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 text-xl font-semibold">Capacitaciones</h1>
        <p className="mb-6 text-sm text-gray-500">
          Estudia el material y presenta tu examen del mes
        </p>

        {lista.length === 0 && (
          <p className="text-gray-500">No hay capacitaciones asignadas por ahora.</p>
        )}

        <div className="space-y-4">
          {lista.map((c) => {
            const examen = c.examenes?.[0];
            const its = examen ? intentosPorExamen.get(examen.id) ?? [] : [];
            const aprobado = its.some((i) => i.estado === "aprobado");
            const materiales = [...(c.capacitacion_materiales ?? [])].sort(
              (a, b) => a.orden - b.orden
            );
            return (
              <section key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="text-lg font-semibold">{c.titulo}</h2>
                {c.descripcion && <p className="mt-1 text-sm text-gray-600">{c.descripcion}</p>}
                {materiales.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {materiales.map((m) => (
                      <div key={m.id} className="rounded-lg bg-gray-50 p-3">
                        <p className="text-sm font-medium">{m.titulo}</p>
                        {m.contenido && <p className="mt-1 text-sm text-gray-600">{m.contenido}</p>}
                        {m.recurso_url && (
                          <a href={m.recurso_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-toto-red">
                            Ver recurso
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {examen && (
                  <div className="mt-4 flex items-center gap-3">
                    {aprobado ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                        ✓ Aprobado este mes
                      </span>
                    ) : (
                      <Link href={`/examen/${examen.id}`} className="rounded-lg bg-toto-red px-4 py-2 text-sm font-medium text-white">
                        Presentar examen
                      </Link>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
