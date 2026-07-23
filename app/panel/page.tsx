import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { fechasVigentes } from "@/lib/checklists";

export const dynamic = "force-dynamic";

interface Sucursal { id: string; nombre: string; }
interface InstRow { sucursal_id: string; completada: boolean; }

export default async function PanelPage() {
  const profile = await requireProfile();
  if (profile.rol !== "gerente") redirect("/dashboard");
  const supabase = createClient();

  const { data: sucursales } = await supabase
    .from("sucursales").select("id, nombre").eq("activa", true).order("nombre");

  const { data: instancias } = await supabase
    .from("checklist_instancias").select("sucursal_id, completada").in("fecha", fechasVigentes());

  const rows = (instancias ?? []) as InstRow[];
  const resumen = (sucursales ?? []).map((s: Sucursal) => {
    const propias = rows.filter((r) => r.sucursal_id === s.id);
    const total = propias.length;
    const hechas = propias.filter((r) => r.completada).length;
    const pct = total ? Math.round((hechas / total) * 100) : 0;
    return { ...s, total, hechas, pct };
  });

  return (
    <div className="min-h-screen">
      <Header profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 text-xl font-semibold">Cumplimiento por sucursal</h1>
        <p className="mb-6 text-sm text-gray-500">Checklists vigentes · toca una sucursal para ver el detalle</p>
        {resumen.length === 0 && (<p className="text-gray-500">No hay sucursales activas.</p>)}
        <ul className="space-y-3">
          {resumen.map((s) => (
            <li key={s.id}>
              <Link href={`/seguimiento/sucursal/${s.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-toto-red">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{s.nombre}</span>
                  <span className="text-sm text-gray-500">{s.hechas}/{s.total} · {s.pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full ${s.pct >= 80 ? "bg-green-500" : s.pct >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${s.pct}%` }} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
