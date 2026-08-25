export interface Sede {
  municipio: string;
  codigoEstablecimiento: string;
  nombreEstablecimiento: string;
  establecimientoPrincipal: string; // 'SI' | 'NO'
  codigoSede: string;
  nombreSede: string;
  zona: string;
}

export interface RectorInfo {
  nombre: string;
  cargo: string;
  telefono: string;
  correo: string;
  codigoEstablecimiento: string;
}

export interface DeviceCounts {
  tablets: number;
  portatiles: number;
  escritorio: number;
  smartTv: number;
  pantallasInteractivas: number;
  proyectores: number;
  otrosCantidad: number;
  otrosDescripcion: string;
}

export interface DeviceSedeResponse {
  codigoSede: string;
  nombreSede: string;
  zona: string;
  dispositivos: DeviceCounts;
  dispositivosMalEstado?: DeviceCounts;
  origenAdquisicion: string[];
  origenOtroDetalle?: string;
  respuestasPreguntasAdicionales: { [questionId: string]: string };
}

export interface SurveySubmission {
  id: string;
  rector: RectorInfo;
  codigoEstablecimiento: string;
  nombreEstablecimiento: string;
  municipio: string;
  fecha: string;
  ultimaModificacion?: string; // ← nuevo: fecha del último merge
  respuestasSedes: DeviceSedeResponse[];
  respuestasGlobales?: { [questionId: string]: string };
}

export interface CustomQuestion {
  id: string;
  pregunta: string;
  tipo: "text" | "number" | "textarea" | "select" | "radio" | "checkbox";
  categoria: "sede" | "global";
  opciones?: string[];
  requerida: boolean;
  createdAt: string;
}

// ── Fase 1: tipos para el estado de la encuesta por establecimiento ────────
export interface SedeStatusInfo {
  codigoSede: string;
  ultimaModificacion: string;
}

export interface EncuestaStatus {
  exists: boolean;
  rector?: string;
  ultimaModificacion?: string;
  sedesConDatos: SedeStatusInfo[];
}

// ── Respuesta del endpoint de búsqueda de instituciones ───────────────────
export interface InstitutionSearchResult {
  sedes: Sede[];
  codigoEstablecimientoPrincipal: string;
  nombreEstablecimiento: string;
  municipio: string;
  busquedaEsSecundaria: boolean;
  codigoPrincipalSugerido?: string;
}
