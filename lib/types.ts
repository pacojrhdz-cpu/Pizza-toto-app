// Tipos de dominio compartidos

export type Rol = "gerente" | "encargado" | "colaborador";
export type Frecuencia = "diario" | "semanal" | "mensual";
export type TipoItem = "booleano" | "valor" | "texto";
export type EstadoRespuesta = "cumple" | "no_cumple" | "na" | "pendiente";

export interface Profile {
  id: string;
  nombre: string;
  rol: Rol;
  sucursal_id: string | null;
  activo: boolean;
}

export interface Sucursal {
  id: string;
  nombre: string;
}

export interface ChecklistItem {
  id: string;
  plantilla_id: string;
  descripcion: string;
  tipo: TipoItem;
  requiere_foto: boolean;
  unidad: string | null;
  critico: boolean;
  orden: number;
}

export interface ChecklistInstancia {
  id: string;
  plantilla_id: string;
  sucursal_id: string;
  fecha: string;
  completada: boolean;
  checklist_plantillas?: {
    nombre: string;
    frecuencia: Frecuencia;
    categoria_id: string | null;
  };
}

export interface ChecklistRespuesta {
  id: string;
  instancia_id: string;
  item_id: string;
  estado: EstadoRespuesta;
  valor_num: number | null;
  nota: string | null;
  foto_url: string | null;
  fotos: string[] | null;
}
