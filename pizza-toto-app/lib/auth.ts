import { redirect } from "next/navigation";
import { createClient } from "./supabase-server";
import type { Profile } from "./types";

// Obtiene el perfil del usuario autenticado o redirige a /login.
export async function requireProfile(): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nombre, rol, sucursal_id, activo")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  return profile as Profile;
}
