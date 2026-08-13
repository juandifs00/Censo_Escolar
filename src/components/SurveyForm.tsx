import { useState, useEffect } from "react";
import { Sede, RectorInfo, DeviceSedeResponse, CustomQuestion, SurveySubmission, DeviceCounts } from "../types";
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
  Cpu
} from "lucide-react";

interface SurveyFormProps {
  rector: RectorInfo;
  sedes: Sede[];
  onSurveySubmitted: (submission: SurveySubmission) => void;
}

export default function SurveyForm({ rector, sedes, onSurveySubmitted }: SurveyFormProps) {
  // Navigation: index of the active branch, or -1 for the final global questions/summary screen
  const [activeSedeIndex, setActiveSedeIndex] = useState(0);
  
  // Custom questions loaded from server
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(true);

  // Core Survey state: Map of responses indexed by Sede Code
  const [sedeResponses, setSedeResponses] = useState<{ [codigoSede: string]: DeviceSedeResponse }>({});
  
  // Answers to global custom questions
  const [globalAnswers, setGlobalAnswers] = useState<{ [questionId: string]: string }>({});

  // Submission loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch custom questions on mount
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch("/api/questions");
        if (res.ok) {
          const data = await res.json();
          setCustomQuestions(data);
        }
      } catch (err) {
        console.error("Error fetching custom questions:", err);
      } finally {
        setIsQuestionsLoading(false);
      }
    }
    fetchQuestions();
  }, []);

  // Initialize survey responses for all sedes
  useEffect(() => {
    const initialResponses: { [codigoSede: string]: DeviceSedeResponse } = {};
    sedes.forEach((sede) => {
      initialResponses[sede.codigoSede] = {
        codigoSede: sede.codigoSede,
        nombreSede: sede.nombreSede,
        zona: sede.zona,
        dispositivos: {
          tablets: 0,
          portatiles: 0,
          escritorio: 0,
          smartTv: 0,
          pantallasInteractivas: 0,
          proyectores: 0,
          otrosCantidad: 0,
          otrosDescripcion: ""
        },
        dispositivosMalEstado: {
          tablets: 0,
          portatiles: 0,
          escritorio: 0,
          smartTv: 0,
          pantallasInteractivas: 0,
          proyectores: 0,
          otrosCantidad: 0,
          otrosDescripcion: ""
        },
        origenAdquisicion: [],
        origenOtroDetalle: "",
        respuestasPreguntasAdicionales: {}
      };
    });
    setSedeResponses(initialResponses);
  }, [sedes]);

  const activeSede = activeSedeIndex >= 0 ? sedes[activeSedeIndex] : null;
  const activeRes = activeSede ? sedeResponses[activeSede.codigoSede] : null;

  // Modify device numbers
  const handleDeviceChange = (field: keyof DeviceCounts, value: any, isMalEstado = false) => {
    if (!activeSede || !activeRes) return;

    let parsedVal = value;
    if (field !== "otrosDescripcion") {
      parsedVal = parseInt(value, 10);
      if (isNaN(parsedVal) || parsedVal < 0) parsedVal = 0;
    }

    const groupKey = isMalEstado ? "dispositivosMalEstado" : "dispositivos";

    setSedeResponses((prev) => {
      const currentRes = prev[activeSede.codigoSede];
      const currentGroup = currentRes[groupKey] || {
        tablets: 0,
        portatiles: 0,
        escritorio: 0,
        smartTv: 0,
        pantallasInteractivas: 0,
        proyectores: 0,
        otrosCantidad: 0,
        otrosDescripcion: ""
      };

      return {
        ...prev,
        [activeSede.codigoSede]: {
          ...currentRes,
          [groupKey]: {
            ...currentGroup,
            [field]: parsedVal
          }
        }
      };
    });
  };

  // Modify acquisition origin checkboxes
  const handleOriginToggle = (origin: string) => {
    if (!activeSede) return;

    setSedeResponses((prev) => {
      const currentOrigins = [
        ...(prev[activeSede.codigoSede]?.origenAdquisicion || [])
      ];
      const index = currentOrigins.indexOf(origin);

      if (index > -1) {
        currentOrigins.splice(index, 1);
      } else {
        currentOrigins.push(origin);
      }

      return {
        ...prev,
        [activeSede.codigoSede]: {
          ...prev[activeSede.codigoSede],
          origenAdquisicion: currentOrigins
        }
      };
    });
  };

  const handleOriginOtherText = (text: string) => {
    if (!activeSede || !activeRes) return;
    setSedeResponses((prev) => ({
      ...prev,
      [activeSede.codigoSede]: {
        ...prev[activeSede.codigoSede],
        origenOtroDetalle: text
      }
    }));
  };

  // Modify branch-specific custom question answers
  const handleCustomSedeAnswer = (questionId: string, value: string) => {
    if (!activeSede || !activeRes) return;
    setSedeResponses((prev) => ({
      ...prev,
      [activeSede.codigoSede]: {
        ...prev[activeSede.codigoSede],
        respuestasPreguntasAdicionales: {
          ...prev[activeSede.codigoSede].respuestasPreguntasAdicionales,
          [questionId]: value
        }
      }
    }));
  };

  // Modify global custom question answers
  const handleCustomGlobalAnswer = (questionId: string, value: string) => {
    setGlobalAnswers((prev) => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Check if a sede has been answered (we assume it's "answered" if at least one device category is filled or acquisition source is checked)
  const isSedeComplete = (codigoSede: string) => {
    const res = sedeResponses[codigoSede];
    if (!res) return false;
    
    // Checked if any device > 0 or has acquisition details or has answers to required questions
    const hasDevices = Object.entries(res.dispositivos)
      .some(([k, v]) => k !== "otrosDescripcion" && typeof v === "number" && v > 0);
      
    const hasOrigins = res.origenAdquisicion.length > 0;

    // Check required custom questions for this sede
    const reqSedeQuestions = customQuestions.filter(q => q.categoria === "sede" && q.requerida);
    const answersRequiredAllFilled = reqSedeQuestions.every(q => {
      const ans = res.respuestasPreguntasAdicionales[q.id];
      return ans !== undefined && ans.trim() !== "";
    });

    return (hasDevices || hasOrigins) && answersRequiredAllFilled;
  };

  const countCompletedSedes = () => {
    return sedes.filter((s) => isSedeComplete(s.codigoSede)).length;
  };

  const isFormComplete = () => {
    // All sedes should ideally be complete (or at least we should have filled out info)
    const reqGlobalQuestions = customQuestions.filter(q => q.categoria === "global" && q.requerida);
    const globalRequiredFilled = reqGlobalQuestions.every(q => {
      const ans = globalAnswers[q.id];
      return ans !== undefined && ans.trim() !== "";
    });

    return countCompletedSedes() === sedes.length && globalRequiredFilled;
  };

  const handleNext = () => {
    if (activeSedeIndex < sedes.length - 1) {
      setActiveSedeIndex(activeSedeIndex + 1);
    } else {
      // Go to global page
      setActiveSedeIndex(-1);
    }
  };

  const handlePrev = () => {
    if (activeSedeIndex === -1) {
      setActiveSedeIndex(sedes.length - 1);
    } else if (activeSedeIndex > 0) {
      setActiveSedeIndex(activeSedeIndex - 1);
    }
  };

  const handleFinalSubmit = async () => {
    // Collect and format survey payload
    setIsSubmitting(true);
    try {
      const surveyPayload: Omit<SurveySubmission, "id" | "fecha"> = {
        rector,
        codigoEstablecimiento: rector.codigoEstablecimiento,
        nombreEstablecimiento: sedes[0].nombreEstablecimiento,
        municipio: sedes[0].municipio,
        respuestasSedes: Object.values(sedeResponses),
        respuestasGlobales: globalAnswers
      };

      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(surveyPayload),
      });

      if (res.ok) {
        const savedSubmission = await res.json();
        onSurveySubmitted(savedSubmission);
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

  const completedCount = countCompletedSedes();
  const progressPercent = Math.round((completedCount / sedes.length) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Rector summary header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 rounded-lg text-[#006837]">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 tracking-tight uppercase text-sm md:text-base">
              {sedes[0]?.nombreEstablecimiento}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Municipio: <span className="font-bold text-slate-600">{sedes[0]?.municipio}</span> • Sede Principal DANE: <span className="font-mono text-slate-600 font-bold">{rector.codigoEstablecimiento}</span>
            </p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 py-1.5 px-3 rounded text-xs font-sans text-slate-700">
          <strong>Rector:</strong> {rector.nombre} ({rector.cargo}) | 📞 {rector.telefono}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-slate-600 font-semibold flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-[#006837]" />
            Progreso del Censo por Sede: <span className="text-[#006837] font-bold">{completedCount} de {sedes.length} completadas</span>
          </span>
          <span className="font-bold text-[#006837]">{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-[#006837] h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Grid: Sidebar (Sedes List) + Active Survey Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar: Sedes list navigation */}
        <aside className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-[calc(100vh-280px)] overflow-y-auto flex flex-col custom-scrollbar">
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
                  <div className="truncate max-w-[220px] md:max-w-[250px]">
                    <span className={`block font-bold ${isSelected ? "text-white" : "text-slate-800"} truncate`}>
                      {idx + 1}. {sede.nombreSede}
                    </span>
                    <span className={`text-[10px] block mt-0.5 font-mono ${isSelected ? "text-slate-200" : "text-slate-400"}`}>
                      DANE Sede: {sede.codigoSede} • {sede.zona}
                    </span>
                  </div>
                  
                  {isDone ? (
                    <span className={`p-1 rounded-full shrink-0 ${isSelected ? "bg-white text-[#006837]" : "bg-emerald-50 text-[#006837]"}`}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-150 shrink-0" title="Pendiente" />
                  )}
                </button>
              );
            })}
          </div>

          {/* End/Global Questions navigation node */}
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

        {/* Core Form Area */}
        <main className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-280px)]">
          {activeSedeIndex !== -1 && activeSede && activeRes ? (
            /* ACTIVE BRANCH FORM */
            <div className="flex-1 flex flex-col">
              {/* Header block for current branch */}
              <div className="bg-[#006837]/5 p-5 border-b border-slate-150 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold bg-[#006837] text-white py-0.5 px-2 rounded uppercase tracking-wider font-sans">
                    Sede {activeSedeIndex + 1} de {sedes.length} — Zona {activeSede.zona}
                  </span>
                  <h4 className="text-base md:text-lg font-bold text-[#006837] tracking-tight mt-1">
                    {activeSede.nombreSede}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    DANE Sede Educativa: {activeSede.codigoSede}
                  </p>
                </div>
                {isSedeComplete(activeSede.codigoSede) && (
                  <div className="bg-[#006837]/10 text-[#006837] text-xs py-1 px-3 rounded font-bold flex items-center gap-1.5 border border-[#006837]/20">
                    <CheckCircle className="w-4 h-4" />
                    <span>Sede Registrada</span>
                  </div>
                )}
              </div>

              {/* Form questions list */}
              <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto">
                
                {/* PREGUNTA 1: Devices good condition count */}
                <div className="space-y-4">
                  <div>
                    <h5 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight flex items-start gap-2 leading-snug">
                      <span className="bg-[#006837] text-white w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      Describa por favor la cantidad de dispositivos que estén en buen estado de esta sede educativa:
                    </h5>
                    <p className="text-xs text-slate-500 mt-1 pl-7">
                      Registre valores numéricos enteros correspondientes al inventario funcional en buen estado. Si no cuenta con alguno, deje el valor en 0.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-0 md:pl-7">
                    
                    {/* Tablets */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-[#006837]/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Tablet className="w-5 h-5 text-[#006837]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tablets</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Tablets</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivos.tablets}
                          onChange={(e) => handleDeviceChange("tablets", e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Portatiles */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-[#006837]/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Laptop className="w-5 h-5 text-[#006837]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Portátiles</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Laptops</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivos.portatiles}
                          onChange={(e) => handleDeviceChange("portatiles", e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Escritorio */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-[#006837]/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Monitor className="w-5 h-5 text-[#006837]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Escritorio</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Computadores PC</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivos.escritorio}
                          onChange={(e) => handleDeviceChange("escritorio", e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Smart TV */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-[#006837]/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Tv className="w-5 h-5 text-[#006837]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Smart TV</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Smart TV</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivos.smartTv}
                          onChange={(e) => handleDeviceChange("smartTv", e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Pantallas interactivas */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-[#006837]/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Presentation className="w-5 h-5 text-[#006837]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pantallas I.</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Interactivas</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivos.pantallasInteractivas}
                          onChange={(e) => handleDeviceChange("pantallasInteractivas", e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Proyectores */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-[#006837]/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Projector className="w-5 h-5 text-[#006837]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Proyectores</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Proyectores</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivos.proyectores}
                          onChange={(e) => handleDeviceChange("proyectores", e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Otros Cantidad */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-[#006837]/30 transition-all col-span-2">
                      <div className="flex items-center justify-between text-slate-600">
                        <Cpu className="w-5 h-5 text-[#006837]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Otros Elementos</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Cantidad</label>
                          <input
                            type="number"
                            min="0"
                            value={activeRes.dispositivos.otrosCantidad}
                            onChange={(e) => handleDeviceChange("otrosCantidad", e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Describa qué son</label>
                          <input
                            type="text"
                            disabled={activeRes.dispositivos.otrosCantidad === 0}
                            value={activeRes.dispositivos.otrosDescripcion}
                            onChange={(e) => handleDeviceChange("otrosDescripcion", e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-350 rounded text-xs focus:ring-1 focus:ring-[#006837] focus:border-[#006837] disabled:bg-slate-100 text-slate-850 font-medium"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* PREGUNTA 2: Devices in bad condition count */}
                <div className="space-y-4 pt-6 border-t border-slate-150">
                  <div>
                    <h5 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight flex items-start gap-2 leading-snug">
                      <span className="bg-[#006837] text-white w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      Describa por favor la cantidad de dispositivos que estén en mal estado de esta sede educativa, tales como: Tablets, computadores portátiles o de escritorio, Smart TV, pantallas interactivas, proyectores o demás elementos:
                    </h5>
                    <p className="text-xs text-slate-500 mt-1 pl-7">
                      Registre valores numéricos enteros correspondientes al inventario obsoleto, dañado o en mal estado. Si no cuenta con alguno, deje el valor en 0.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-0 md:pl-7">
                    
                    {/* Tablets */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Tablet className="w-5 h-5 text-amber-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tablets</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Tablets (Mal Estado)</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivosMalEstado?.tablets ?? 0}
                          onChange={(e) => handleDeviceChange("tablets", e.target.value, true)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Portatiles */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Laptop className="w-5 h-5 text-amber-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Portátiles</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Laptops (Mal Estado)</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivosMalEstado?.portatiles ?? 0}
                          onChange={(e) => handleDeviceChange("portatiles", e.target.value, true)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Escritorio */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Monitor className="w-5 h-5 text-amber-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Escritorio</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Computadores PC (Mal Estado)</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivosMalEstado?.escritorio ?? 0}
                          onChange={(e) => handleDeviceChange("escritorio", e.target.value, true)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Smart TV */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Tv className="w-5 h-5 text-amber-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Smart TV</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Smart TV (Mal Estado)</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivosMalEstado?.smartTv ?? 0}
                          onChange={(e) => handleDeviceChange("smartTv", e.target.value, true)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Pantallas interactivas */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Presentation className="w-5 h-5 text-amber-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pantallas I.</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Interactivas (Mal Estado)</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivosMalEstado?.pantallasInteractivas ?? 0}
                          onChange={(e) => handleDeviceChange("pantallasInteractivas", e.target.value, true)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Proyectores */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-all">
                      <div className="flex items-center justify-between text-slate-600">
                        <Projector className="w-5 h-5 text-amber-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Proyectores</span>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">Proyectores (Mal Estado)</label>
                        <input
                          type="number"
                          min="0"
                          value={activeRes.dispositivosMalEstado?.proyectores ?? 0}
                          onChange={(e) => handleDeviceChange("proyectores", e.target.value, true)}
                          className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Otros Cantidad */}
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-200 flex flex-col justify-between space-y-2 hover:border-amber-500/30 transition-all col-span-2">
                      <div className="flex items-center justify-between text-slate-600">
                        <Cpu className="w-5 h-5 text-amber-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Otros (Mal Estado)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Cantidad</label>
                          <input
                            type="number"
                            min="0"
                            value={activeRes.dispositivosMalEstado?.otrosCantidad ?? 0}
                            onChange={(e) => handleDeviceChange("otrosCantidad", e.target.value, true)}
                            className="w-full px-3 py-1.5 border border-slate-350 rounded text-sm focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Describa qué son</label>
                          <input
                            type="text"
                            placeholder="Ej: Impresoras, UPS"
                            disabled={(activeRes.dispositivosMalEstado?.otrosCantidad ?? 0) === 0}
                            value={activeRes.dispositivosMalEstado?.otrosDescripcion ?? ""}
                            onChange={(e) => handleDeviceChange("otrosDescripcion", e.target.value, true)}
                            className="w-full px-3 py-1.5 border border-slate-350 rounded text-xs focus:ring-1 focus:ring-[#006837] focus:border-[#006837] disabled:bg-slate-100 text-slate-850 font-medium"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* PREGUNTA 3: Acquisition origins */}
                <div className="space-y-4 pt-6 border-t border-slate-150">
                  <div>
                    <h5 className="font-extrabold text-slate-850 text-sm md:text-base tracking-tight flex items-start gap-2 leading-snug">
                      <span className="bg-[#006837] text-white w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      Indique de qué forma o con qué recursos fueron adquiridos los dispositivos mencionados anteriormente:
                    </h5>
                    <p className="text-xs text-slate-500 mt-1 pl-7">
                      Seleccione todas las opciones que apliquen para el equipamiento de esta sede.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-0 md:pl-7">
                    
                    <label className="flex items-center gap-3 p-3 rounded border border-slate-200 hover:bg-[#006837]/5 cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={activeRes.origenAdquisicion.includes("recursos_propios")}
                        onChange={() => handleOriginToggle("recursos_propios")}
                        className="w-4.5 h-4.5 rounded text-[#006837] border-slate-300 focus:ring-[#006837]"
                      />
                      <span className="text-xs font-semibold text-slate-700">Recursos propios de la sede educativa (Matrícula/Fondos de Servicios Educativos)</span>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded border border-slate-200 hover:bg-[#006837]/5 cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={activeRes.origenAdquisicion.includes("donacion_fundacion")}
                        onChange={() => handleOriginToggle("donacion_fundacion")}
                        className="w-4.5 h-4.5 rounded text-[#006837] border-slate-300 focus:ring-[#006837]"
                      />
                      <span className="text-xs font-semibold text-slate-700">Donados por alguna fundación privada o empresa nacional/internacional</span>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded border border-slate-200 hover:bg-[#006837]/5 cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={activeRes.origenAdquisicion.includes("recursos_gobernacion")}
                        onChange={() => handleOriginToggle("recursos_gobernacion")}
                        className="w-4.5 h-4.5 rounded text-[#006837] border-slate-300 focus:ring-[#006837]"
                      />
                      <span className="text-xs font-semibold text-slate-700">Dotaciones directas de la Gobernación de Antioquia / Alcaldía Municipal</span>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded border border-slate-200 hover:bg-[#006837]/5 cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={activeRes.origenAdquisicion.includes("computadores_para_educar")}
                        onChange={() => handleOriginToggle("computadores_para_educar")}
                        className="w-4.5 h-4.5 rounded text-[#006837] border-slate-300 focus:ring-[#006837]"
                      />
                      <span className="text-xs font-semibold text-slate-700">Ministerio de las TIC / Programa "Computadores para Educar"</span>
                    </label>

                    {/* Other with specification */}
                    <div className="p-3 rounded border border-slate-200 hover:bg-[#006837]/5 transition-all col-span-1 md:col-span-2 space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeRes.origenAdquisicion.includes("otro")}
                          onChange={() => handleOriginToggle("otro")}
                          className="w-4.5 h-4.5 rounded text-[#006837] border-slate-300 focus:ring-[#006837]"
                        />
                        <span className="text-xs font-bold text-slate-700">Otra forma de adquisición</span>
                      </label>
                      {activeRes.origenAdquisicion.includes("otro") && (
                        <input
                          type="text"
                          required
                          placeholder="Mencione por favor de qué forma o programa alterno se adquirieron"
                          value={activeRes.origenOtroDetalle || ""}
                          onChange={(e) => handleOriginOtherText(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#006837] focus:border-[#006837] font-medium text-slate-800 mt-1.5"
                        />
                      )}
                    </div>

                  </div>
                </div>

                {/* SECTION 3: Dynamic Custom Sede-Level Questions */}
                {customQuestions.filter(q => q.categoria === "sede").length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <h5 className="font-extrabold text-slate-850 text-sm md:text-base tracking-tight flex items-center gap-2">
                      <PlusCircle className="w-5 h-5 text-[#F27D26] shrink-0" />
                      Preguntas específicas adicionales (Sede Educativa)
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-7">
                      {customQuestions.filter(q => q.categoria === "sede").map((q) => {
                        const ans = activeRes.respuestasPreguntasAdicionales[q.id] || "";
                        return (
                          <div key={q.id} className="space-y-2 bg-slate-50/50 p-4 rounded border border-slate-200">
                            <label className="block text-xs font-bold text-slate-700 leading-tight">
                              {q.pregunta} {q.requerida && <span className="text-red-500">*</span>}
                            </label>
                            
                            {/* Text Input */}
                            {(q.tipo === "text" || q.tipo === "number") && (
                              <input
                                type={q.tipo}
                                required={q.requerida}
                                value={ans}
                                onChange={(e) => handleCustomSedeAnswer(q.id, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-850 bg-white"
                              />
                            )}

                            {/* Textarea */}
                            {q.tipo === "textarea" && (
                              <textarea
                                required={q.requerida}
                                value={ans}
                                onChange={(e) => handleCustomSedeAnswer(q.id, e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-850 bg-white"
                              />
                            )}

                            {/* Select */}
                            {q.tipo === "select" && (
                              <select
                                required={q.requerida}
                                value={ans}
                                onChange={(e) => handleCustomSedeAnswer(q.id, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-850 bg-white cursor-pointer"
                              >
                                <option value="">-- Seleccione una opción --</option>
                                {q.opciones?.map((o) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            )}

                            {/* Radios */}
                            {q.tipo === "radio" && (
                              <div className="flex flex-wrap gap-3 mt-1.5">
                                {q.opciones?.map((o) => (
                                  <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700">
                                    <input
                                      type="radio"
                                      name={`custom_${q.id}_sede_${activeSede.codigoSede}`}
                                      value={o}
                                      checked={ans === o}
                                      onChange={() => handleCustomSedeAnswer(q.id, o)}
                                      className="w-4 h-4 text-[#006837] focus:ring-[#006837]"
                                    />
                                    <span>{o}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {/* Checkbox (Single Boolean / Custom check) */}
                            {q.tipo === "checkbox" && (
                              <div className="flex flex-wrap gap-3 mt-1.5">
                                {q.opciones && q.opciones.length > 0 ? (
                                  // Multi selection saved as comma joined
                                  q.opciones.map((o) => {
                                    const checkedList = ans ? ans.split(",").map(i => i.trim()) : [];
                                    const isChecked = checkedList.includes(o);
                                    return (
                                      <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                                        <input
                                          type="checkbox"
                                          value={o}
                                          checked={isChecked}
                                          onChange={() => {
                                            let newList;
                                            if (isChecked) {
                                              newList = checkedList.filter(item => item !== o);
                                            } else {
                                              newList = [...checkedList, o];
                                            }
                                            handleCustomSedeAnswer(q.id, newList.join(", "));
                                          }}
                                          className="w-4 h-4 text-[#006837] rounded focus:ring-[#006837]"
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
                                      onChange={(e) => handleCustomSedeAnswer(q.id, e.target.checked ? "SI" : "NO")}
                                      className="w-4 h-4 text-[#006837] rounded focus:ring-[#006837]"
                                    />
                                    <span>Cumple / Sí</span>
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

              {/* Bottom footer buttons */}
              <div className="bg-slate-50 border-t border-slate-250 p-4 flex justify-between items-center">
                <button
                   onClick={handlePrev}
                   disabled={activeSedeIndex === 0}
                   className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded font-bold text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior Sede</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">
                    Información guardada localmente de forma temporal.
                  </span>
                  
                  <button
                    onClick={handleNext}
                    className="px-5 py-2 bg-[#006837] hover:bg-emerald-800 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <span>Guardar y Siguiente</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          ) : (
            /* FINAL STEP: GLOBAL QUESTIONS AND SUMMARY SUBMIT */
            <div className="flex-1 flex flex-col">
              <div className="bg-[#F27D26]/10 p-5 border-b border-[#F27D26]/30">
                <span className="text-[10px] font-bold bg-[#F27D26] text-white py-0.5 px-2 rounded uppercase tracking-wider font-sans">
                  Paso Final de Cierre
                </span>
                <h4 className="text-base md:text-lg font-bold text-[#006837] tracking-tight mt-1">
                  Preguntas Institucionales y Envío
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Responda los cuestionamientos globales del establecimiento y revise que todas las sedes estén correctamente registradas antes de consolidar el reporte.
                </p>
              </div>

              <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto">
                
                {/* Global Custom Questions Section */}
                {customQuestions.filter(q => q.categoria === "global").length > 0 ? (
                  <div className="space-y-4">
                    <h5 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-[#006837] shrink-0" />
                      Preguntas globales del Establecimiento Educativo
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-0 md:pl-7">
                      {customQuestions.filter(q => q.categoria === "global").map((q) => {
                        const ans = globalAnswers[q.id] || "";
                        return (
                          <div key={q.id} className="space-y-2 bg-[#F27D26]/5 p-4 rounded border border-[#F27D26]/20">
                            <label className="block text-xs font-bold text-slate-800 leading-tight">
                              {q.pregunta} {q.requerida && <span className="text-red-500">*</span>}
                            </label>
                            
                            {/* Text Input */}
                            {(q.tipo === "text" || q.tipo === "number") && (
                              <input
                                type={q.tipo}
                                required={q.requerida}
                                value={ans}
                                onChange={(e) => handleCustomGlobalAnswer(q.id, e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 bg-white"
                              />
                            )}

                            {/* Textarea */}
                            {q.tipo === "textarea" && (
                              <textarea
                                required={q.requerida}
                                value={ans}
                                onChange={(e) => handleCustomGlobalAnswer(q.id, e.target.value)}
                                rows={2.5}
                                className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 bg-white"
                              />
                            )}

                            {/* Select */}
                            {q.tipo === "select" && (
                              <select
                                required={q.requerida}
                                value={ans}
                                onChange={(e) => handleCustomGlobalAnswer(q.id, e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 bg-white cursor-pointer"
                              >
                                <option value="">-- Seleccione una opción --</option>
                                {q.opciones?.map((o) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            )}

                            {/* Radios */}
                            {q.tipo === "radio" && (
                              <div className="flex flex-wrap gap-3 mt-1.5">
                                {q.opciones?.map((o) => (
                                  <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                                    <input
                                      type="radio"
                                      name={`custom_${q.id}_global`}
                                      value={o}
                                      checked={ans === o}
                                      onChange={() => handleCustomGlobalAnswer(q.id, o)}
                                      className="w-4 h-4 text-[#006837] focus:ring-[#006837]"
                                    />
                                    <span>{o}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {/* Checkbox */}
                            {q.tipo === "checkbox" && (
                              <div className="flex flex-wrap gap-3 mt-1.5">
                                {q.opciones && q.opciones.length > 0 ? (
                                  q.opciones.map((o) => {
                                    const checkedList = ans ? ans.split(",").map(i => i.trim()) : [];
                                    const isChecked = checkedList.includes(o);
                                    return (
                                      <label key={o} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                                        <input
                                          type="checkbox"
                                          value={o}
                                          checked={isChecked}
                                          onChange={() => {
                                            let newList;
                                            if (isChecked) {
                                              newList = checkedList.filter(item => item !== o);
                                            } else {
                                              newList = [...checkedList, o];
                                            }
                                            handleCustomGlobalAnswer(q.id, newList.join(", "));
                                          }}
                                          className="w-4 h-4 text-[#006837] rounded focus:ring-[#006837]"
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
                                      onChange={(e) => handleCustomGlobalAnswer(q.id, e.target.checked ? "SI" : "NO")}
                                      className="w-4 h-4 text-[#006837] rounded focus:ring-[#006837]"
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
                ) : (
                  <div className="bg-[#006837]/5 border border-[#006837]/20 p-5 rounded text-xs flex gap-3 text-[#006837]">
                    <AlertCircle className="w-5 h-5 text-[#006837] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[#006837] font-bold mb-1">Sin preguntas de cierre globales</strong>
                      No se han configurado preguntas adicionales a nivel institucional global por parte de la Secretaría de Educación. Puede proceder con la revisión de sedes y el envío del censo.
                    </div>
                  </div>
                )}

                {/* Audit summary table of branches completeness */}
                <div className="space-y-3">
                  <h5 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight">
                    Resumen de Validación de Sedes
                  </h5>
                  <div className="border border-slate-200 rounded overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="p-3">Sede Educativa</th>
                          <th className="p-3 font-mono">DANE Sede</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3 text-right">Buen Estado</th>
                          <th className="p-3 text-right text-amber-700">Mal Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sedes.map((sede) => {
                          const res = sedeResponses[sede.codigoSede];
                          const isDone = isSedeComplete(sede.codigoSede);
                          
                          // Sum total devices registered for this branch
                          const devSum = res 
                            ? (res.dispositivos.tablets + res.dispositivos.portatiles + res.dispositivos.escritorio + res.dispositivos.smartTv + res.dispositivos.pantallasInteractivas + res.dispositivos.proyectores + res.dispositivos.otrosCantidad)
                            : 0;

                          const devMalSum = res && res.dispositivosMalEstado
                            ? (res.dispositivosMalEstado.tablets + res.dispositivosMalEstado.portatiles + res.dispositivosMalEstado.escritorio + res.dispositivosMalEstado.smartTv + res.dispositivosMalEstado.pantallasInteractivas + res.dispositivosMalEstado.proyectores + res.dispositivosMalEstado.otrosCantidad)
                            : 0;

                          return (
                            <tr key={sede.codigoSede} className="hover:bg-slate-50/50">
                              <td className="p-3 font-bold text-slate-800">{sede.nombreSede}</td>
                              <td className="p-3 font-mono text-slate-500">{sede.codigoSede}</td>
                              <td className="p-3">
                                {isDone ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-[#006837] font-bold px-2 py-0.5 rounded text-[10px] uppercase font-sans">
                                    <Check className="w-3 h-3 stroke-[3]" /> Completo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase font-sans">
                                    <AlertCircle className="w-3 h-3" /> Sin registrar
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-bold text-[#006837]">{devSum} disp.</td>
                              <td className="p-3 text-right font-bold text-amber-700">{devMalSum} disp.</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Submit footer actions */}
              <div className="bg-slate-50 border-t border-slate-200 p-5 flex justify-between items-center">
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded font-bold text-xs flex items-center gap-1 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Volver a las Sedes</span>
                </button>

                {progressPercent < 100 ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 py-2.5 px-4 rounded text-xs flex items-center gap-2 max-w-sm">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>
                      Faltan registrar sedes para poder finalizar. Por favor revise el listado lateral y complete todas las sedes educativas ({completedCount} de {sedes.length}).
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-3.5 bg-[#F27D26] hover:bg-[#d96a1a] text-white font-bold uppercase tracking-wider rounded text-xs shadow transition-all flex items-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Enviando Censo...</span>
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
