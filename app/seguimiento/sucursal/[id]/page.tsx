import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import Header from "@/components/Header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface InstRow {
  id: string;
  fecha: string;
  completada: boolean;
  completada_en: string | null;
  checklist_plantillas: { nombre: string; frecuencia: string } | null;
}

export default async function SeguimientoSucursal({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  if (profile.rol !== "gerente") redirect("/dashboard");
  const supabase = createClient();

  const { data: sucursal } = await supabase
    .from("sucursales").select("nombre").eq("id", params.id).single();
  if (!sucursal) notFound();

  const { data } = await supabase
    .from("checklist_instancias")
    .select("id, fecha, completada, completada_en, checklist_plantillas(nombre, frecuencia)")
    .eq("sucursal_id", params.id)
    .order("fecha", { ascending: false })
    .limit(90);

  const instancias = (data ?? []) as unknown as InstRow[];

  const porFecha = new Map<string, InstRow[]>();
  for (const i of instancias) {
    const arr = porFecha.get(i.fecha) ?? [];
    arr.push(i);
    porFecha.set(i.fecha, arr);
  }

  return (
    <div className="min-h-screen">
      <Header profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/panel" className="text-sm text-gray-500 hover:text-toto-red">← Volver al panel</Link>
        <h1 className="mb-1 mt-2 text-xl font-semibold">{(sucursal as any).nombre}</h1>
        <p className="mb-5 text-sm text-gray-500">Historial de checklists</p>

        {[...porFecha.entries()].map(([fecha, lista]) => (
          <section key={fecha} className="mb-5">
            <h2 className="mb-2 text-sm font-semibold text-gray-600">{fecha}</h2>
            <ul className="space-y-2">
              {lista.map((i) => (
                <li key={i.id}>
                  <Link href={`/seguimiento/instancia/${i.id}`} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-toto-red">
                    <span className="font-medium">{i.checklist_plantillas?.nombre}</span>
                    {i.completada ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Completado</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pendiente</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {instancias.length === 0 && <p className="text-gray-500">Aún no hay checklists registrados.</p>}
      </main>
    </div>
  );
}
