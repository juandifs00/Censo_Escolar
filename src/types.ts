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
  correo:                string;
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
  origenAdquisicion: string[]; // 'recursos_propios' | 'donaciones' | 'gobernacion' | 'computadores_educar' | 'otro'
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
  respuestasSedes: DeviceSedeResponse[];
  respuestasGlobales?: { [questionId: string]: string };
}

export interface CustomQuestion {
  id: string;
  pregunta: string;
  tipo: 'text' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox';
  categoria: 'sede' | 'global'; // asked per branch or once for the whole institution
  opciones?: string[]; // options split by comma
  requerida: boolean;
  createdAt: string;
}
