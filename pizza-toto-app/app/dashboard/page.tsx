import Link from "next/link";
import Header from "@/components/Header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { asegurarInstancias, fechasVigentes } from "@/lib/checklists";
import { FRECUENCIAS, frecuenciaLabel } from "@/lib/periodos";
import type { Frecuencia } from "@/lib/types";

export const dynamic = "force-dynamic";

interface InstanciaRow {
  id: string;
  completada: boolean;
  fecha: string;
  checklist_plantillas: {
    nombre: string;
    frecuencia: Frecuencia;
  } | null;
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  // El gerente no opera una sucursal: lo mandamos al panel global.
  if (profile.rol === "gerente" || !profile.sucursal_id) {
    return (
      <div className="min-h-screen">
        <Header profile={profile} />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-xl font-semibold">Hola, {profile.nombre}</h1>
          <p className="mt-2 text-gray-600">
            Como gerente, revisa el cumplimiento de todas las sucursales en el
            panel.
          </p>
          <Link
            href="/panel"
            className="mt-4 inline-block rounded-lg bg-toto-red px-4 py-2 font-medium text-white"
          >
            Ir al panel
          </Link>
        </main>
      </div>
    );
  }

  // Genera (si faltan) las instancias del periodo actual y las trae.
  await asegurarInstancias(supabase, profile.sucursal_id);

  const { data } = await supabase
    .from("checklist_instancias")
    .select("id, completada, fecha, checklist_plantillas(nombre, frecuencia)")
    .eq("sucursal_id", profile.sucursal_id)
    .in("fecha", fechasVigentes())
    .order("fecha", { ascending: false });

  const instancias = (data ?? []) as unknown as InstanciaRow[];

  const porFrecuencia = (f: Frecuencia) =>
    instancias.filter((i) => i.checklist_plantillas?.frecuencia === f);

  return (
    <div className="min-h-screen">
      <Header profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 text-xl font-semibold">Checklists de hoy</h1>
        <p className="mb-6 text-sm text-gray-500">
          {profile.nombre} · tu sucursal
        </p>

        {FRECUENCIAS.map((f) => {
          const lista = porFrecuencia(f);
          if (!lista.length) return null;
          return (
            <section key={f} className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {frecuenciaLabel[f]}
              </h2>
              <ul className="space-y-2">
                {lista.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/checklist/${i.id}`}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-toto-red"
                    >
                      <span className="font-medium">
                        {i.checklist_plantillas?.nombre}
                      </span>
                      {i.completada ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Completado
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Pendiente
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {instancias.length === 0 && (
          <p className="text-gray-500">
            No hay checklists activos. Pide al gerente que active plantillas.
          </p>
        )}
      </main>
    </div>
  );
}
