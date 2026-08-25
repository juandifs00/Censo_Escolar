import { useState, useEffect, useMemo } from "react";
import {
  Sede,
  RectorInfo,
  DeviceSedeResponse,
  CustomQuestion,
  SurveySubmission,
  DeviceCounts,
} from "../types";
import {
  Building2,
  ChevronRight,
  ChevronLeft,
  Check,
  HelpCircle,
  Save,
  AlertCircle,
  CheckCircle,
  PlusCircle,
  Tablet,
  Laptop,
  Monitor,
  Tv,
  Presentation,
  Projector,
  Cpu,
  RefreshCw,
} from "lucide-react";

interface SurveyFormProps {
  rector: RectorInfo;
  sedes: Sede[];
  existingSubmission?: SurveySubmission; // ← FASE 2: datos previos para pre-cargar
  onSurveySubmitted: (submission: SurveySubmission) => void;
}

const EMPTY_DEVICES: DeviceCounts = {
  tablets: 0,
  portatiles: 0,
  escritorio: 0,
  smartTv: 0,
  pantallasInteractivas: 0,
  proyectores: 0,
  otrosCantidad: 0,
  otrosDescripcion: "",
};

export default function SurveyForm({
  rector,
  sedes,
  existingSubmission,
  onSurveySubmitted,
}: SurveyFormProps) {
  const [activeSedeIndex, setActiveSedeIndex] = useState(0);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(true);
  const [sedeResponses, setSedeResponses] = useState<{
    [codigoSede: string]: DeviceSedeResponse;
  }>({});
  const [globalAnswers, setGlobalAnswers] = useState<{
    [questionId: string]: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── FASE 2: set de sedes con datos previos (para indicadores visuales) ──
  const sedesConDatosPrevios = useMemo(
    () =>
      new Set(
        existingSubmission?.respuestasSedes.map((s) => s.codigoSede) ?? [],
      ),
    [existingSubmission],
  );
  const esActualizacion = !!existingSubmission;

  // Cargar preguntas adicionales
  useEffect(() => {
    fetch("/api/questions")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCustomQuestions(data))
      .catch(() => {})
      .finally(() => setIsQuestionsLoading(false));
  }, []);

  // ── FASE 2: inicializar respuestas pre-cargando datos existentes ────────
  useEffect(() => {
    const initial: { [codigoSede: string]: DeviceSedeResponse } = {};
    sedes.forEach((sede) => {
      const prev = existingSubmission?.respuestasSedes.find(
        (s) => s.codigoSede === sede.codigoSede,
      );
      initial[sede.codigoSede] = prev
        ? { ...prev }
        : {
            codigoSede: sede.codigoSede,
            nombreSede: sede.nombreSede,
            zona: sede.zona,
            dispositivos: { ...EMPTY_DEVICES },
            dispositivosMalEstado: { ...EMPTY_DEVICES },
            origenAdquisicion: [],
            origenOtroDetalle: "",
            respuestasPreguntasAdicionales: {},
          };
    });
    setSedeResponses(initial);

    // Pre-cargar respuestas globales
    if (existingSubmission?.respuestasGlobales) {
      setGlobalAnswers(existingSubmission.respuestasGlobales);
    }
  }, [sedes, existingSubmission]);

  const activeSede = activeSedeIndex >= 0 ? sedes[activeSedeIndex] : null;
  const activeRes = activeSede ? sedeResponses[activeSede.codigoSede] : null;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDeviceChange = (
    field: keyof DeviceCounts,
    value: any,
    isMalEstado = false,
  ) => {
    if (!activeSede) return;
    let parsed = value;
    if (field !== "otrosDescripcion") {
      parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed < 0) parsed = 0;
    }
    const groupKey = isMalEstado ? "dispositivosMalEstado" : "dispositivos";
    setSedeResponses((prev) => {
      const cur = prev[activeSede.codigoSede];
      return {
        ...prev,
        [activeSede.codigoSede]: {
          ...cur,
          [groupKey]: { ...(cur[groupKey] || EMPTY_DEVICES), [field]: parsed },
        },
      };
    });
  };

  // CORRECCIÓN: usa la forma funcional para evitar stale closure
  const handleOriginToggle = (origin: string) => {
    if (!activeSede) return;
    setSedeResponses((prev) => {
      const origins = [
        ...(prev[activeSede.codigoSede]?.origenAdquisicion || []),
      ];
      const idx = origins.indexOf(origin);
      idx > -1 ? origins.splice(idx, 1) : origins.push(origin);
      return {
        ...prev,
        [activeSede.codigoSede]: {
          ...prev[activeSede.codigoSede],
          origenAdquisicion: origins,
        },
      };
    });
  };

  const handleOriginOtherText = (text: string) => {
    if (!activeSede) return;
    setSedeResponses((prev) => ({
      ...prev,
      [activeSede.codigoSede]: {
        ...prev[activeSede.codigoSede],
        origenOtroDetalle: text,
      },
    }));
  };

  const handleCustomSedeAnswer = (questionId: string, value: string) => {
    if (!activeSede) return;
    setSedeResponses((prev) => ({
      ...prev,
      [activeSede.codigoSede]: {
        ...prev[activeSede.codigoSede],
        respuestasPreguntasAdicionales: {
          ...prev[activeSede.codigoSede].respuestasPreguntasAdicionales,
          [questionId]: value,
        },
      },
    }));
  };

  const handleCustomGlobalAnswer = (questionId: string, value: string) => {
    setGlobalAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // ── Validación ────────────────────────────────────────────────────────────
  const isSedeComplete = (codigoSede: string) => {
    const res = sedeResponses[codigoSede];
    if (!res) return false;
    const hasDevices = Object.entries(res.dispositivos).some(
      ([k, v]) => k !== "otrosDescripcion" && typeof v === "number" && v > 0,
    );
    const hasOrigins = res.origenAdquisicion.length > 0;
    const reqFilled = customQuestions
      .filter((q) => q.categoria === "sede" && q.requerida)
      .every((q) => res.respuestasPreguntasAdicionales[q.id]?.trim());
    return (hasDevices || hasOrigins) && reqFilled;
  };

  const countCompleted = () =>
    sedes.filter((s) => isSedeComplete(s.codigoSede)).length;

  const reqGlobalFilled = () =>
    customQuestions
      .filter((q) => q.categoria === "global" && q.requerida)
      .every((q) => globalAnswers[q.id]?.trim());

  // FASE 2: si es actualización, permite enviar aunque no estén todas completas
  const canSubmit = () => {
    if (esActualizacion) return reqGlobalFilled();
    return countCompleted() === sedes.length && reqGlobalFilled();
  };

  const handleNext = () => {
    if (activeSedeIndex < sedes.length - 1)
      setActiveSedeIndex(activeSedeIndex + 1);
    else setActiveSedeIndex(-1);
  };

  const handlePrev = () => {
    if (activeSedeIndex === -1) setActiveSedeIndex(sedes.length - 1);
    else if (activeSedeIndex > 0) setActiveSedeIndex(activeSedeIndex - 1);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload: Omit<SurveySubmission, "id" | "fecha"> = {
        rector,
        codigoEstablecimiento: rector.codigoEstablecimiento,
        nombreEstablecimiento: sedes[0].nombreEstablecimiento,
        municipio: sedes[0].municipio,
        respuestasSedes: Object.values(sedeResponses),
        respuestasGlobales: globalAnswers,
      };
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onSurveySubmitted(await res.json());
      } else {
        const err = await res.json();
        alert("Error al enviar encuesta: " + (err.error || "Desconocido"));
      }
    } catch (err: any) {
      alert("Error al conectar con el servidor: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const completed = countCompleted();
  const progressPercent = Math.round((completed / sedes.length) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header del rector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 rounded-lg text-[#006837]">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 tracking-tight uppercase text-sm md:text-base">
              {sedes[0]?.nombreEstablecimiento}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Municipio:{" "}
              <span className="font-bold text-slate-600">
                {sedes[0]?.municipio}
              </span>{" "}
              • DANE Principal:{" "}
              <span className="font-mono text-slate-600 font-bold">
                {rector.codigoEstablecimiento}
              </span>
            </p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 py-1.5 px-3 rounded text-xs text-slate-700">
          <strong>Rector:</strong> {rector.nombre} ({rector.cargo}) | 📞{" "}
          {rector.telefono}
        </div>
      </div>

      {/* FASE 2: Banner de actualización */}
      {esActualizacion && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-start gap-3 text-xs">
          <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-blue-900 space-y-0.5">
            <p className="font-bold">Actualizando encuesta existente</p>
            <p className="text-blue-700 leading-relaxed">
              Las sedes marcadas con{" "}
              <span className="font-bold text-blue-800">datos previos</span> ya
              tienen información registrada — se muestran pre-cargadas. Puede
              editar cualquier sede o agregar las que están pendientes. Los
              cambios se fusionarán con los datos existentes sin generar
              duplicados.
            </p>
          </div>
        </div>
      )}

      {/* Barra de progreso */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-slate-600 font-semibold flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-[#006837]" />
            Progreso:{" "}
            <span className="text-[#006837] font-bold ml-1">
              {completed} de {sedes.length} sedes con datos
            </span>
            {esActualizacion && sedesConDatosPrevios.size > 0 && (
              <span className="ml-2 text-blue-600 font-semibold">
                ({sedesConDatosPrevios.size} pre-cargadas)
              </span>
            )}
          </span>
          <span className="font-bold text-[#006837]">{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#006837] h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-[calc(100vh-280px)] overflow-y-auto flex flex-col">
          <div className="pb-3 border-b border-slate-100 mb-3">
            <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
              Sedes de la Institución
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Haga clic sobre una sede para registrar sus respuestas.
            </p>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto">
            {sedes.map((sede, idx) => {
              const isSelected = activeSedeIndex === idx;
              const isDone = isSedeComplete(sede.codigoSede);
              const tienePrevio = sedesConDatosPrevios.has(sede.codigoSede);
              return (
                <button
                  key={sede.codigoSede}
                  onClick={() => setActiveSedeIndex(idx)}
                  className={`w-full text-left p-3 rounded text-xs transition-all flex justify-between items-center border ${
                    isSelected
                      ? "bg-[#006837] text-white border-[#006837] font-medium shadow-sm"
                      : "hover:bg-[#006837]/5 border-slate-100 text-slate-750 bg-slate-50/50"
                  }`}
                >
                  <div className="truncate max-w-[220px]">
                    <span
                      className={`block font-bold ${isSelected ? "text-white" : "text-slate-800"} truncate`}
                    >
                      {idx + 1}. {sede.nombreSede}
                    </span>
                    <span
                      className={`text-[10px] block mt-0.5 font-mono ${isSelected ? "text-slate-200" : "text-slate-400"}`}
                    >
                      {sede.codigoSede} · {sede.zona}
                    </span>
                    {/* FASE 2: indicador de datos previos */}
                    {tienePrevio && !isSelected && (
                      <span className="text-[9px] font-bold text-blue-600 block mt-0.5">
                        ↩ Datos previos cargados
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0 ml-1">
                    {isDone ? (
                      <span
                        className={`p-1 rounded-full ${isSelected ? "bg-white text-[#006837]" : "bg-emerald-50 text-[#006837]"}`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-150 shrink-0" />
                    )}
                    {tienePrevio && (
                      <span
                        className={`text-[8px] font-bold px-1 rounded ${isSelected ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}
                      >
                        prev.
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4">
            <button
              onClick={() => setActiveSedeIndex(-1)}
              className={`w-full text-left p-3.5 rounded text-xs transition-all flex justify-between items-center border font-bold ${
                activeSedeIndex === -1
                  ? "bg-[#F27D26] text-white border-[#F27D26] shadow-sm"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <div>
                  <span className="block">Preguntas Generales</span>
                  <span className="text-[9px] font-medium opacity-80 uppercase">
                    Paso Final de Envío
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* Panel principal del formulario */}
        <main className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-280px)]">
          {activeSedeIndex !== -1 && activeSede && activeRes ? (
            <div className="flex-1 flex flex-col">
              {/* Header de la sede activa */}
              <div className="bg-[#006837]/5 p-5 border-b border-slate-150 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold bg-[#006837] text-white py-0.5 px-2 rounded uppercase tracking-wider">
                      Sede {activeSedeIndex + 1} de {sedes.length} — Zona{" "}
                      {activeSede.zona}
                    </span>
                    {/* FASE 2: badge de datos previos en el header */}
                    {sedesConDatosPrevios.has(activeSede.codigoSede) && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 py-0.5 px-2 rounded uppercase tracking-wider flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Editando datos previos
                      </span>
                    )}
                  </div>
                  <h4 className="text-base md:text-lg font-bold text-[#006837] tracking-tight mt-1">
                    {activeSede.nombreSede}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    DANE Sede: {activeSede.codigoSede}
                  </p>
                </div>
                {isSedeComplete(activeSede.codigoSede) && (
                  <div className="bg-[#006837]/10 text-[#006837] text-xs py-1 px-3 rounded font-bold flex items-center gap-1.5 border border-[#006837]/20">
                    <CheckCircle className="w-4 h-4" />
                    <span>Sede Registrada</span>
                  </div>
                )}
              </div>

              {/* Preguntas del formulario */}
              <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto">
                {/* Pregunta 1: Dispositivos en buen estado */}
                <div className="space-y-4">
                  <div>
                    <h5 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight flex items-start gap-2 leading-snug">
                      <span className="bg-[#006837] text-white w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      Describa la cantidad de dispositivos en{" "}
                      <strong>buen estado</strong> de esta sede:
                    </h5>
                    <p className="text-xs text-slate-500 mt-1 pl-7">
                      Valores numéricos enteros. Si no cuenta con alguno, deje
                      en 0.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-0 md:pl-7">
                    {[
                      { key: "tablets", label: "Tablets", Icon: Tablet },
                      { key: "portatiles", label: "Portátiles", Icon: Laptop },
                      {
                        key: "escritorio",
                        label: "PC Escritorio",
                        Icon: Monitor,
                      },
                      { key: "smartTv", label: "Smart TV", Icon: Tv },
                      {
                        key: "pantallasInteractivas",
                        label: "Interactivas",
                        Icon: Presentation,
                      },
                      {
                        key: "proyectores",
                        label: "Proyectores",
                        Icon: Projector,
                      },
                    ].map(({ key, label, Icon }) => (
                      <div
                        key={key}
                        className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-[#006837]/30 transition-all"
                      >
                        <div className="flex items-center justify-between text-slate-600">
                          <Icon className="w-5 h-5 text-[#006837]" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {label}
                          </span>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-1">
                            {label}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={(activeRes.dispositivos as any)[key]}
                            onChange={(e) =>
                              handleDeviceChange(
                                key as keyof DeviceCounts,
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                          />
                        </div>
                      </div>
                    ))}
                    {/* Otros */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-[#006837]/30 transition-all col-span-2">
                      <div className="flex items-center justify-between text-slate-600">
                        <Cpu className="w-5 h-5 text-[#006837]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Otros Elementos
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={activeRes.dispositivos.otrosCantidad}
                            onChange={(e) =>
                              handleDeviceChange(
                                "otrosCantidad",
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Describa qué son
                          </label>
                          <input
                            type="text"
                            disabled={
                              activeRes.dispositivos.otrosCantidad === 0
                            }
                            value={activeRes.dispositivos.otrosDescripcion}
                            onChange={(e) =>
                              handleDeviceChange(
                                "otrosDescripcion",
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-1.5 border border-slate-350 rounded text-xs focus:ring-1 focus:ring-[#006837] disabled:bg-slate-100 text-slate-850 font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pregunta 2: Dispositivos en mal estado */}
                <div className="space-y-4 pt-6 border-t border-slate-150">
                  <div>
                    <h5 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight flex items-start gap-2 leading-snug">
                      <span className="bg-[#006837] text-white w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      Describa la cantidad de dispositivos en{" "}
                      <strong>mal estado</strong> de esta sede:
                    </h5>
                    <p className="text-xs text-slate-500 mt-1 pl-7">
                      Inventario obsoleto, dañado o fuera de servicio. Si no
                      cuenta con alguno, deje en 0.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-0 md:pl-7">
                    {[
                      { key: "tablets", label: "Tablets", Icon: Tablet },
                      { key: "portatiles", label: "Portátiles", Icon: Laptop },
                      {
                        key: "escritorio",
                        label: "PC Escritorio",
                        Icon: Monitor,
                      },
                      { key: "smartTv", label: "Smart TV", Icon: Tv },
                      {
                        key: "pantallasInteractivas",
                        label: "Interactivas",
                        Icon: Presentation,
                      },
                      {
                        key: "proyectores",
                        label: "Proyectores",
                        Icon: Projector,
                      },
                    ].map(({ key, label, Icon }) => (
                      <div
                        key={key}
                        className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-all"
                      >
                        <div className="flex items-center justify-between text-slate-600">
                          <Icon className="w-5 h-5 text-amber-600" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {label}
                          </span>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-1">
                            {label} (Mal)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={
                              (activeRes.dispositivosMalEstado as any)?.[key] ??
                              0
                            }
                            onChange={(e) =>
                              handleDeviceChange(
                                key as keyof DeviceCounts,
                                e.target.value,
                                true,
                              )
                            }
                            className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] font-bold text-slate-800"
                          />
                        </div>
                      </div>
                    ))}
                    {/* Otros mal estado */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-all col-span-2">
                      <div className="flex items-center justify-between text-slate-600">
                        <Cpu className="w-5 h-5 text-amber-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Otros (Mal Estado)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={
                              activeRes.dispositivosMalEstado?.otrosCantidad ??
                              0
                            }
                            onChange={(e) =>
                              handleDeviceChange(
                                "otrosCantidad",
                                e.target.value,
                                true,
                              )
                            }
                            className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Describa qué son
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: Impresoras, UPS"
                            disabled={
                              (activeRes.dispositivosMalEstado?.otrosCantidad ??
                                0) === 0
                            }
                            value={
                              activeRes.dispositivosMalEstado
                                ?.otrosDescripcion ?? ""
                            }
                            onChange={(e) =>
                              handleDeviceChange(
                                "otrosDescripcion",
                                e.target.value,
                                true,
                              )
                            }
                            className="w-full px-3 py-1.5 border border-slate-350 rounded text-xs focus:ring-1 focus:ring-[#006837] disabled:bg-slate-100 text-slate-850 font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pregunta 3: Origen de adquisición */}
                <div className="space-y-4 pt-6 border-t border-slate-150">
                  <div>
                    <h5 className="font-extrabold text-slate-850 text-sm md:text-base tracking-tight flex items-start gap-2 leading-snug">
                      <span className="bg-[#006837] text-white w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      Indique de qué forma fueron adquiridos los dispositivos
                      mencionados:
                    </h5>
                    <p className="text-xs text-slate-500 mt-1 pl-7">
                      Seleccione todas las opciones que apliquen.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-0 md:pl-7">
                    {[
                      {
                        value: "recursos_propios",
                        label:
                          "Recursos propios de la sede educativa (Matrícula/Fondos de Servicios Educativos)",
                      },
                      {
                        value: "donacion_fundacion",
                        label:
                          "Donados por alguna fundación privada o empresa nacional/internacional",
                      },
                      {
                        value: "recursos_gobernacion",
                        label:
                          "Dotaciones directas de la Gobernación de Antioquia / Alcaldía Municipal",
                      },
                      {
                        value: "computadores_para_educar",
                        label:
                          'Ministerio de las TIC / Programa "Computadores para Educar"',
                      },
                    ].map(({ value, label }) => (
                      <label
                        key={value}
                        className="flex items-center gap-3 p-3 rounded border border-slate-200 hover:bg-[#006837]/5 cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={activeRes.origenAdquisicion.includes(value)}
                          onChange={() => handleOriginToggle(value)}
                          className="w-4 h-4 rounded text-[#006837] border-slate-300 focus:ring-[#006837]"
                        />
                        <span className="text-xs font-semibold text-slate-700">
                          {label}
                        </span>
                      </label>
                    ))}
                    <div className="p-3 rounded border border-slate-200 hover:bg-[#006837]/5 transition-all col-span-1 md:col-span-2 space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeRes.origenAdquisicion.includes("otro")}
                          onChange={() => handleOriginToggle("otro")}
                          className="w-4 h-4 rounded text-[#006837] border-slate-300 focus:ring-[#006837]"
                        />
                        <span className="text-xs font-bold text-slate-700">
                          Otra forma de adquisición
                        </span>
                      </label>
                      {activeRes.origenAdquisicion.includes("otro") && (
                        <input
                          type="text"
                          required
                          placeholder="Mencione por favor de qué forma o programa alterno"
                          value={activeRes.origenOtroDetalle || ""}
                          onChange={(e) =>
                            handleOriginOtherText(e.target.value)
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#006837] font-medium text-slate-800 mt-1.5"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Preguntas adicionales por sede */}
                {customQuestions.filter((q) => q.categoria === "sede").length >
                  0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <h5 className="font-extrabold text-slate-850 text-sm md:text-base tracking-tight flex items-center gap-2">
                      <PlusCircle className="w-5 h-5 text-[#F27D26] shrink-0" />
                      Preguntas adicionales (Sede)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-7">
                      {customQuestions
                        .filter((q) => q.categoria === "sede")
                        .map((q) => {
                          const ans =
                            activeRes.respuestasPreguntasAdicionales[q.id] ||
                            "";
                          return (
                            <div
                              key={q.id}
                              className="space-y-2 bg-slate-50/50 p-4 rounded border border-slate-200"
                            >
                              <label className="block text-xs font-bold text-slate-700 leading-tight">
                                {q.pregunta}{" "}
                                {q.requerida && (
                                  <span className="text-red-500">*</span>
                                )}
                              </label>
                              {(q.tipo === "text" || q.tipo === "number") && (
                                <input
                                  type={q.tipo}
                                  required={q.requerida}
                                  value={ans}
                                  onChange={(e) =>
                                    handleCustomSedeAnswer(q.id, e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-850 bg-white"
                                />
                              )}
                              {q.tipo === "textarea" && (
                                <textarea
                                  required={q.requerida}
                                  value={ans}
                                  rows={2}
                                  onChange={(e) =>
                                    handleCustomSedeAnswer(q.id, e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-850 bg-white"
                                />
                              )}
                              {q.tipo === "select" && (
                                <select
                                  required={q.requerida}
                                  value={ans}
                                  onChange={(e) =>
                                    handleCustomSedeAnswer(q.id, e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-gray-850 bg-white cursor-pointer"
                                >
                                  <option value="">-- Seleccione --</option>
                                  {q.opciones?.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {q.tipo === "radio" && (
                                <div className="flex flex-wrap gap-3 mt-1.5">
                                  {q.opciones?.map((o) => (
                                    <label
                                      key={o}
                                      className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700"
                                    >
                                      <input
                                        type="radio"
                                        name={`cq_${q.id}_${activeSede.codigoSede}`}
                                        value={o}
                                        checked={ans === o}
                                        onChange={() =>
                                          handleCustomSedeAnswer(q.id, o)
                                        }
                                        className="w-4 h-4 text-[#006837]"
                                      />
                                      <span>{o}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                              {q.tipo === "checkbox" && (
                                <div className="flex flex-wrap gap-3 mt-1.5">
                                  {q.opciones && q.opciones.length > 0 ? (
                                    q.opciones.map((o) => {
                                      const list = ans
                                        ? ans.split(",").map((i) => i.trim())
                                        : [];
                                      const checked = list.includes(o);
                                      return (
                                        <label
                                          key={o}
                                          className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700"
                                        >
                                          <input
                                            type="checkbox"
                                            value={o}
                                            checked={checked}
                                            onChange={() => {
                                              const nl = checked
                                                ? list.filter((i) => i !== o)
                                                : [...list, o];
                                              handleCustomSedeAnswer(
                                                q.id,
                                                nl.join(", "),
                                              );
                                            }}
                                            className="w-4 h-4 text-[#006837] rounded"
                                          />
                                          <span>{o}</span>
                                        </label>
                                      );
                                    })
                                  ) : (
                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={ans === "SI"}
                                        onChange={(e) =>
                                          handleCustomSedeAnswer(
                                            q.id,
                                            e.target.checked ? "SI" : "NO",
                                          )
                                        }
                                        className="w-4 h-4 text-[#006837] rounded"
                                      />
                                      <span>Sí / Aplica</span>
                                    </label>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer de navegación */}
              <div className="bg-slate-50 border-t border-slate-250 p-4 flex justify-between items-center">
                <button
                  onClick={handlePrev}
                  disabled={activeSedeIndex === 0}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded font-bold text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior Sede</span>
                </button>
                <button
                  onClick={handleNext}
                  className="px-5 py-2 bg-[#006837] hover:bg-emerald-800 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                >
                  <span>Guardar y Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Paso final: preguntas globales y envío */
            <div className="flex-1 flex flex-col">
              <div className="bg-[#F27D26]/10 p-5 border-b border-[#F27D26]/30">
                <span className="text-[10px] font-bold bg-[#F27D26] text-white py-0.5 px-2 rounded uppercase tracking-wider">
                  Paso Final de Cierre
                </span>
                <h4 className="text-base md:text-lg font-bold text-[#006837] tracking-tight mt-1">
                  Preguntas Institucionales y Envío
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {esActualizacion
                    ? "Revise las observaciones globales y confirme la actualización de los datos."
                    : "Responda las preguntas globales y revise que todas las sedes estén registradas."}
                </p>
              </div>

              <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto">
                {/* Preguntas globales */}
                {customQuestions.filter((q) => q.categoria === "global")
                  .length > 0 ? (
                  <div className="space-y-4">
                    <h5 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-[#006837] shrink-0" />
                      Preguntas globales del Establecimiento
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-0 md:pl-7">
                      {customQuestions
                        .filter((q) => q.categoria === "global")
                        .map((q) => {
                          const ans = globalAnswers[q.id] || "";
                          return (
                            <div
                              key={q.id}
                              className="space-y-2 bg-[#F27D26]/5 p-4 rounded border border-[#F27D26]/20"
                            >
                              <label className="block text-xs font-bold text-slate-800 leading-tight">
                                {q.pregunta}{" "}
                                {q.requerida && (
                                  <span className="text-red-500">*</span>
                                )}
                              </label>
                              {(q.tipo === "text" || q.tipo === "number") && (
                                <input
                                  type={q.tipo}
                                  required={q.requerida}
                                  value={ans}
                                  onChange={(e) =>
                                    handleCustomGlobalAnswer(
                                      q.id,
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 bg-white"
                                />
                              )}
                              {q.tipo === "textarea" && (
                                <textarea
                                  required={q.requerida}
                                  value={ans}
                                  rows={3}
                                  onChange={(e) =>
                                    handleCustomGlobalAnswer(
                                      q.id,
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 bg-white"
                                />
                              )}
                              {q.tipo === "select" && (
                                <select
                                  required={q.requerida}
                                  value={ans}
                                  onChange={(e) =>
                                    handleCustomGlobalAnswer(
                                      q.id,
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 bg-white cursor-pointer"
                                >
                                  <option value="">-- Seleccione --</option>
                                  {q.opciones?.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#006837]/5 border border-[#006837]/20 p-5 rounded text-xs flex gap-3 text-[#006837]">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold mb-1">
                        Sin preguntas globales configuradas
                      </strong>
                      Puede proceder con la revisión de sedes y el envío del
                      censo.
                    </div>
                  </div>
                )}

                {/* Tabla resumen de sedes */}
                <div className="space-y-3">
                  <h5 className="font-extrabold text-slate-800 text-sm tracking-tight">
                    Resumen de Validación de Sedes
                  </h5>
                  <div className="border border-slate-200 rounded overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="p-3">Sede</th>
                          <th className="p-3 font-mono">DANE</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3 text-right">Buen Estado</th>
                          <th className="p-3 text-right text-amber-700">
                            Mal Estado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sedes.map((sede) => {
                          const res = sedeResponses[sede.codigoSede];
                          const isDone = isSedeComplete(sede.codigoSede);
                          const tienePrevio = sedesConDatosPrevios.has(
                            sede.codigoSede,
                          );
                          const devSum = res
                            ? Object.entries(res.dispositivos).reduce(
                                (s, [k, v]) =>
                                  k !== "otrosDescripcion"
                                    ? s + (Number(v) || 0)
                                    : s,
                                0,
                              )
                            : 0;
                          const devMal = res?.dispositivosMalEstado
                            ? Object.entries(res.dispositivosMalEstado).reduce(
                                (s, [k, v]) =>
                                  k !== "otrosDescripcion"
                                    ? s + (Number(v) || 0)
                                    : s,
                                0,
                              )
                            : 0;
                          return (
                            <tr
                              key={sede.codigoSede}
                              className="hover:bg-slate-50/50"
                            >
                              <td className="p-3 font-bold text-slate-800">
                                {sede.nombreSede}
                                {tienePrevio && (
                                  <span className="ml-2 text-[9px] font-bold text-blue-600 bg-blue-50 px-1 rounded">
                                    prev.
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono text-slate-500">
                                {sede.codigoSede}
                              </td>
                              <td className="p-3">
                                {isDone ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-[#006837] font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                                    <Check className="w-3 h-3 stroke-[3]" />{" "}
                                    Completo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                                    <AlertCircle className="w-3 h-3" />{" "}
                                    {esActualizacion
                                      ? "Sin cambios"
                                      : "Sin registrar"}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-bold text-[#006837]">
                                {devSum} disp.
                              </td>
                              <td className="p-3 text-right font-bold text-amber-700">
                                {devMal} disp.
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer de envío */}
              <div className="bg-slate-50 border-t border-slate-200 p-5 flex justify-between items-center">
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded font-bold text-xs flex items-center gap-1 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Volver a las Sedes</span>
                </button>

                {!canSubmit() && !esActualizacion ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 py-2.5 px-4 rounded text-xs flex items-center gap-2 max-w-sm">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>
                      Faltan sedes por registrar ({completed} de {sedes.length}{" "}
                      completas).
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-3.5 bg-[#F27D26] hover:bg-[#d96a1a] text-white font-bold uppercase tracking-wider rounded text-xs shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span>Enviando...</span>
                      </>
                    ) : esActualizacion ? (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Actualizar Censo del Establecimiento</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Finalizar y Enviar Reporte del Censo</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
