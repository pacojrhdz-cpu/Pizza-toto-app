import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface Persona { id: string; nombre: string; rol: string; }
interface Intento { usuario_id: string; calificacion: number | null; estado: string; periodo: string; examenes: { titulo: string } | null; }
interface Constancia { usuario_id: string; competencia: string; vence_en: string | null; }

export default async function EquipoPage() {
  const profile = await requireProfile();
  if (profile.rol === "colaborador") redirect("/dashboard");

  const supabase = createClient();

  let q = supabase.from("profiles").select("id, nombre, rol").neq("rol", "gerente").order("nombre");
  if (profile.rol === "encargado") {
    q = q.eq("sucursal_id", profile.sucursal_id ?? "");
  }
  const { data: personas } = await q;
  const lista = (personas ?? []) as Persona[];
  const ids = lista.map((p) => p.id);

  const intentosPorUsuario = new Map<string, Intento[]>();
  const constanciasPorUsuario = new Map<string, Constancia[]>();

  if (ids.length > 0) {
    const { data: intentos } = await supabase
      .from("intentos_examen")
      .select("usuario_id, calificacion, estado, periodo, examenes(titulo)")
      .in("usuario_id", ids)
      .order("periodo", { ascending: false });
    for (const it of (intentos ?? []) as unknown as Intento[]) {
      const a = intentosPorUsuario.get(it.usuario_id) ?? [];
      a.push(it);
      intentosPorUsuario.set(it.usuario_id, a);
    }

    const { data: constancias } = await supabase
      .from("constancias")
      .select("usuario_id, competencia, vence_en")
      .in("usuario_id", ids);
    for (const c of (constancias ?? []) as Constancia[]) {
      const a = constanciasPorUsuario.get(c.usuario_id) ?? [];
      a.push(c);
      constanciasPorUsuario.set(c.usuario_id, a);
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen">
      <Header profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 text-xl font-semibold">Equipo</h1>
        <p className="mb-6 text-sm text-gray-500">
          Calificaciones y constancias de tu equipo
        </p>

        {lista.length === 0 && (
          <p className="text-gray-500">No hay colaboradores registrados todavía.</p>
        )}

        <div className="space-y-4">
          {lista.map((p) => {
            const intentos = intentosPorUsuario.get(p.id) ?? [];
            const constancias = constanciasPorUsuario.get(p.id) ?? [];
            return (
              <section key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">{p.nombre}</h2>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {p.rol === "encargado" ? "Encargado" : "Colaborador"}
                  </span>
                </div>

                {intentos.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin exámenes presentados.</p>
                ) : (
                  <ul className="space-y-1">
                    {intentos.map((it, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">
                          {it.examenes?.titulo ?? "Examen"}{" "}
                          <span className="text-gray-400">· {it.periodo}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{it.calificacion ?? 0}%</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              it.estado === "aprobado"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {it.estado === "aprobado" ? "Aprobado" : "Reprobado"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {constancias.length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Constancias
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {constancias.map((c, i) => {
                        const vencida = c.vence_en != null && c.vence_en < hoy;
                        return (
                          <span
                            key={i}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              vencida ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            }`}
                          >
                            {c.competencia}
                            {vencida ? " (vencida)" : ""}
                          </span>
                        );
                      })}
                    </div>
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
