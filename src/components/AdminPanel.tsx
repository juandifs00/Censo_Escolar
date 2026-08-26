import React, { useState, useEffect } from "react";
import { Sede, SurveySubmission, CustomQuestion } from "../types";
import * as XLSX from "xlsx";
import {
  Download,
  Upload,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Database,
  HelpCircle,
  FileSpreadsheet,
  BarChart3,
  Tablet,
  Laptop,
  Monitor,
  Tv,
  Presentation,
  Projector,
  FileText,
} from "lucide-react";

// ── Helper: cabeceras de autenticación para rutas de administrador ─────────
const getAdminHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("adminToken") ?? ""}`,
});

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<
    "responses" | "import" | "questions"
  >("responses");

  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [institutionsCount, setInstitutionsCount] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");

  // Formulario de nueva pregunta
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] =
    useState<CustomQuestion["tipo"]>("text");
  const [newQuestionCategory, setNewQuestionCategory] =
    useState<CustomQuestion["categoria"]>("sede");
  const [newQuestionOptions, setNewQuestionOptions] = useState("");
  const [newQuestionRequired, setNewQuestionRequired] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // ── Carga inicial de datos ───────────────────────────────────────────
  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const headers = getAdminHeaders();
      const [surveysRes, questionsRes, instsRes] = await Promise.all([
        fetch("/api/surveys", { headers }),
        fetch("/api/questions"), // pública, sin auth
        fetch("/api/institutions", { headers }),
      ]);

      // Detectar sesión expirada en cualquiera de las llamadas protegidas
      if (surveysRes.status === 401 || instsRes.status === 401) {
        setErrorMsg(
          "Su sesión de administrador ha expirado. Recargue la página e ingrese de nuevo al panel.",
        );
        setIsLoading(false);
        return;
      }

      if (surveysRes.ok) {
        setSubmissions(await surveysRes.json());
      }
      if (questionsRes.ok) {
        setCustomQuestions(await questionsRes.json());
      }
      if (instsRes.ok) {
        // El servidor ahora devuelve { count: number } en lugar del array completo
        const instsData = await instsRes.json();
        setInstitutionsCount(instsData.count ?? 0);
      }
    } catch (err: any) {
      setErrorMsg("Error al cargar datos del servidor: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const showTemporarySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4500);
  };

  // ── Exportar CSV con autenticación ───────────────────────────────────
  // NOTA: No se puede usar <a href="/api/surveys/export/csv"> porque
  // los links nativos no pueden enviar el header Authorization.
  // Se descarga vía fetch y se genera un objeto URL temporal.
  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/surveys/export/csv", {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("adminToken") ?? ""}`,
        },
      });
      if (res.status === 401) {
        setErrorMsg("Sesión expirada. Recargue la página e ingrese de nuevo.");
        return;
      }
      if (!res.ok) throw new Error("Error del servidor al generar el CSV.");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Encuestas_Antioquia_Tecnologia.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg("Error al exportar: " + err.message);
    }
  };

  // ── Preguntas ────────────────────────────────────────────────────────
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) {
      alert("Por favor escriba la pregunta.");
      return;
    }
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          pregunta: newQuestionText.trim(),
          tipo: newQuestionType,
          categoria: newQuestionCategory,
          opciones: ["select", "radio", "checkbox"].includes(newQuestionType)
            ? newQuestionOptions
            : undefined,
          requerida: newQuestionRequired,
        }),
      });
      if (response.status === 401) {
        setErrorMsg("Sesión expirada. Recargue la página e ingrese de nuevo.");
        return;
      }
      if (response.ok) {
        const added = await response.json();
        setCustomQuestions((prev) => [...prev, added]);
        setNewQuestionText("");
        setNewQuestionOptions("");
        setNewQuestionRequired(false);
        showTemporarySuccess("Pregunta adicional agregada exitosamente.");
      } else {
        const err = await response.json();
        alert("Error al agregar pregunta: " + err.error);
      }
    } catch (err: any) {
      alert("Fallo de red: " + err.message);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (
      !confirm(
        "¿Está seguro de eliminar esta pregunta? Las respuestas registradas se conservarán en la base de datos.",
      )
    )
      return;
    try {
      const response = await fetch(`/api/questions/${id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      if (response.status === 401) {
        setErrorMsg("Sesión expirada. Recargue la página e ingrese de nuevo.");
        return;
      }
      if (response.ok) {
        setCustomQuestions((prev) => prev.filter((q) => q.id !== id));
        showTemporarySuccess("Pregunta eliminada exitosamente.");
      } else {
        alert("No se pudo eliminar la pregunta.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // ── Encuestas ────────────────────────────────────────────────────────
  const handleDeleteSubmission = async (id: string) => {
    if (
      !confirm(
        "¿Está seguro de eliminar esta encuesta? Esta acción es irreversible.",
      )
    )
      return;
    try {
      const response = await fetch(`/api/surveys/${id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      if (response.status === 401) {
        setErrorMsg("Sesión expirada. Recargue la página e ingrese de nuevo.");
        return;
      }
      if (response.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
        showTemporarySuccess("Encuesta eliminada exitosamente.");
      } else {
        alert("No se pudo eliminar la encuesta.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // ── Importación de Excel (SheetJS) ───────────────────────────────────
  // CORRECCIÓN: readAsBinaryString() está deprecado en navegadores modernos.
  // Se usa readAsArrayBuffer() + XLSX.read(buffer, { type: "array" }) en su lugar.
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress("Leyendo archivo de Excel...");
    setErrorMsg("");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: "array" });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        });

        if (rawRows.length === 0)
          throw new Error("El archivo de Excel está vacío.");

        setUploadProgress(`Procesando ${rawRows.length} filas del archivo...`);

        const mappedSedes: Sede[] = rawRows
          .map((row: any) => {
            const findValue = (keys: string[]) => {
              const normalize = (str: string) =>
                String(str || "")
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "");
              const matchKey = Object.keys(row).find((k) =>
                keys.some((key) => normalize(k) === normalize(key)),
              );
              return matchKey ? row[matchKey] : "";
            };

            const municipio = findValue([
              "MUNICIPIO",
              "MUNICIPIO_DANE",
              "CIUDAD",
            ]);
            const codigoEstablecimiento = String(
              findValue([
                "CODIGOESTABLECIMIENTO",
                "CODIGOESTABLECIMIENTODANE",
                "CODIGO_IE",
                "CODIGO ESTABLECIMIENTO",
              ]),
            ).trim();
            const nombreEstablecimiento = findValue([
              "NOMBREESTABLECIMIENTO",
              "NOMBRE_IE",
              "NOMBRE ESTABLECIMIENTO",
            ]);
            const establecimientoPrincipal = findValue([
              "ESTABLECIMIENTOPRINCIPAL",
              "ES_PRINCIPAL",
              "PRINCIPAL",
              "ESTABLECIMIENTO PRINCIPAL",
            ]);
            const codigoSede = String(
              findValue([
                "CODIGOSEDE",
                "CODIGOSEDEDANE",
                "CODIGO_SEDE",
                "CODIGO SEDE",
              ]),
            ).trim();
            const nombreSede = findValue([
              "NOMBRESEDES",
              "NOMBRE_SEDE",
              "NOMBRE SEDES",
              "NOMBRESEDE",
            ]);
            const zona = findValue(["ZONA", "SECTOR", "AREA"]);

            const esPrincipal = ["SI", "YES", "VERDADERO", "TRUE"].includes(
              String(establecimientoPrincipal).trim().toUpperCase(),
            );

            return {
              municipio: String(municipio || "ANTIOQUIA")
                .trim()
                .toUpperCase(),
              codigoEstablecimiento,
              nombreEstablecimiento: String(
                nombreEstablecimiento || "ESTABLECIMIENTO SIN NOMBRE",
              )
                .trim()
                .toUpperCase(),
              establecimientoPrincipal: esPrincipal ? "SI" : "NO",
              codigoSede: codigoSede || codigoEstablecimiento,
              nombreSede: String(
                nombreSede || nombreEstablecimiento || "SEDE ÚNICA",
              )
                .trim()
                .toUpperCase(),
              zona: String(zona || "RURAL")
                .trim()
                .toUpperCase(),
            } as Sede;
          })
          .filter((item) => item.codigoEstablecimiento && item.codigoSede);

        if (mappedSedes.length === 0) {
          throw new Error(
            "No se pudo identificar una estructura compatible de sedes. Verifique que el archivo tenga las columnas: 'CÓDIGO ESTABLECIMIENTO', 'CÓDIGO SEDE', 'NOMBRE SEDES'.",
          );
        }

        setUploadProgress(
          `Guardando ${mappedSedes.length} sedes en el servidor...`,
        );

        const response = await fetch("/api/institutions/import", {
          method: "POST",
          headers: getAdminHeaders(),
          body: JSON.stringify(mappedSedes),
        });

        if (response.status === 401) {
          setErrorMsg(
            "Sesión expirada. Recargue la página e ingrese de nuevo.",
          );
          return;
        }
        if (response.ok) {
          const result = await response.json();
          setInstitutionsCount(result.count);
          showTemporarySuccess(
            `Se importaron exitosamente ${result.count} sedes educativas.`,
          );
        } else {
          const err = await response.json();
          throw new Error(
            err.error || "Fallo en el servidor al procesar los datos.",
          );
        }
      } catch (err: any) {
        setErrorMsg("Error al importar Excel: " + err.message);
      } finally {
        setUploadProgress("");
        e.target.value = "";
      }
    };
    reader.onerror = () => {
      setErrorMsg("Fallo al leer el archivo desde el computador.");
      setUploadProgress("");
    };
    // ✅ Usar readAsArrayBuffer (no readAsBinaryString que está deprecado)
    reader.readAsArrayBuffer(file);
  };

  const handleResetDatabase = async () => {
    if (
      !confirm(
        "¿Está seguro de restablecer el listado de colegios? Se reestablecerá el archivo de muestra eliminando cualquier Excel cargado previamente.",
      )
    )
      return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/institutions/reset", {
        method: "POST",
        headers: getAdminHeaders(),
      });
      if (response.status === 401) {
        setErrorMsg("Sesión expirada. Recargue la página e ingrese de nuevo.");
        return;
      }
      if (response.ok) {
        const result = await response.json();
        setInstitutionsCount(result.count);
        showTemporarySuccess(
          "Base de datos escolar reestablecida a los valores iniciales.",
        );
      } else {
        alert("Error al reestablecer base de datos.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Estadísticas consolidadas ─────────────────────────────────────────
  const calculateTotalDevices = () => {
    let tablets = 0,
      portatiles = 0,
      escritorio = 0,
      smartTv = 0,
      pantallas = 0,
      proyectores = 0,
      otros = 0;
    let tabletsMal = 0,
      portatilesMal = 0,
      escritorioMal = 0,
      smartTvMal = 0,
      pantallasMal = 0,
      proyectoresMal = 0,
      otrosMal = 0;

    submissions.forEach((sub) => {
      sub.respuestasSedes.forEach((sede) => {
        const d = sede.dispositivos;
        if (d) {
          tablets += d.tablets || 0;
          portatiles += d.portatiles || 0;
          escritorio += d.escritorio || 0;
          smartTv += d.smartTv || 0;
          pantallas += d.pantallasInteractivas || 0;
          proyectores += d.proyectores || 0;
          otros += d.otrosCantidad || 0;
        }
        const dm = sede.dispositivosMalEstado;
        if (dm) {
          tabletsMal += dm.tablets || 0;
          portatilesMal += dm.portatiles || 0;
          escritorioMal += dm.escritorio || 0;
          smartTvMal += dm.smartTv || 0;
          pantallasMal += dm.pantallasInteractivas || 0;
          proyectoresMal += dm.proyectores || 0;
          otrosMal += dm.otrosCantidad || 0;
        }
      });
    });

    return {
      tablets,
      portatiles,
      escritorio,
      smartTv,
      pantallas,
      proyectores,
      otros,
      total:
        tablets +
        portatiles +
        escritorio +
        smartTv +
        pantallas +
        proyectores +
        otros,
      tabletsMal,
      portatilesMal,
      escritorioMal,
      smartTvMal,
      pantallasMal,
      proyectoresMal,
      otrosMal,
      totalMal:
        tabletsMal +
        portatilesMal +
        escritorioMal +
        smartTvMal +
        pantallasMal +
        proyectoresMal +
        otrosMal,
    };
  };

  const stats = calculateTotalDevices();

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Encabezado del panel */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <span className="bg-[#006837] text-white text-xs font-semibold px-2.5 py-1 rounded uppercase tracking-wider">
            Portal de Control
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight mt-1">
            Panel de Administración
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestione la base de datos de instituciones, personalice las
            preguntas y descargue los reportes consolidados.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-[#006837]/10 border border-[#006837]/20 py-2 px-4 rounded text-center">
            <span className="text-[10px] font-bold text-[#006837] uppercase block tracking-wider">
              Base Escolar
            </span>
            <span className="text-lg font-extrabold text-[#006837]">
              {institutionsCount} sedes
            </span>
          </div>
          <div className="bg-[#F27D26]/10 border border-[#F27D26]/20 py-2 px-4 rounded text-center">
            <span className="text-[10px] font-bold text-[#F27D26] uppercase block tracking-wider">
              Respuestas
            </span>
            <span className="text-lg font-extrabold text-[#F27D26]">
              {submissions.length} censos
            </span>
          </div>
        </div>
      </div>

      {/* Mensajes de estado */}
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-[#006837] text-emerald-950 text-xs rounded-r flex items-center gap-2.5">
          <CheckCircle className="w-5 h-5 text-[#006837] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 text-red-950 text-xs rounded-r flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 space-x-1 bg-slate-100 p-1 rounded-lg">
        {(["responses", "import", "questions"] as const).map((tab) => {
          const labels: Record<
            typeof tab,
            { icon: React.ReactNode; label: string }
          > = {
            responses: {
              icon: <BarChart3 className="w-4 h-4" />,
              label: "Respuestas Recibidas y Métricas",
            },
            import: {
              icon: <Database className="w-4 h-4" />,
              label: "Cargar Colegios (Excel/CSV)",
            },
            questions: {
              icon: <HelpCircle className="w-4 h-4" />,
              label: "Preguntas Adicionales",
            },
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded text-xs font-bold transition-all ${
                activeTab === tab
                  ? "bg-white text-[#006837] shadow-sm font-extrabold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {labels[tab].icon}
              <span>{labels[tab].label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB: RESPUESTAS ── */}
      {activeTab === "responses" && (
        <div className="space-y-8">
          {/* Dispositivos en buen estado */}
          <div className="space-y-3">
            <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#006837]" />
              Consolidado de Hardware en Buen Estado
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
              {[
                { icon: <Tablet />, label: "Tablets", val: stats.tablets },
                { icon: <Laptop />, label: "Laptops", val: stats.portatiles },
                {
                  icon: <Monitor />,
                  label: "Deskt. PC",
                  val: stats.escritorio,
                },
                { icon: <Tv />, label: "Smart TV", val: stats.smartTv },
                {
                  icon: <Presentation />,
                  label: "P. Interactivas",
                  val: stats.pantallas,
                },
                {
                  icon: <Projector />,
                  label: "Proyectores",
                  val: stats.proyectores,
                },
              ].map(({ icon, label, val }) => (
                <div
                  key={label}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 text-center flex flex-col justify-between"
                >
                  <div className="w-5 h-5 text-[#006837] mx-auto mb-1">
                    {icon}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    {label}
                  </span>
                  <span className="text-xl font-extrabold text-gray-800 block mt-1">
                    {val}
                  </span>
                </div>
              ))}
              <div className="bg-[#006837]/5 p-3.5 rounded-xl border border-[#006837]/20 text-center flex flex-col justify-between col-span-2 md:col-span-1">
                <Database className="w-5 h-5 text-[#006837] mx-auto mb-1" />
                <span className="text-[10px] font-bold text-[#006837] uppercase tracking-wide">
                  Total
                </span>
                <span className="text-lg font-bold text-[#006837] block mt-1">
                  {stats.total}
                </span>
              </div>
            </div>
          </div>

          {/* Dispositivos en mal estado */}
          <div className="space-y-3">
            <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-600" />
              Consolidado de Hardware en Mal Estado
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
              {[
                { icon: <Tablet />, label: "Tablets", val: stats.tabletsMal },
                {
                  icon: <Laptop />,
                  label: "Laptops",
                  val: stats.portatilesMal,
                },
                {
                  icon: <Monitor />,
                  label: "Deskt. PC",
                  val: stats.escritorioMal,
                },
                { icon: <Tv />, label: "Smart TV", val: stats.smartTvMal },
                {
                  icon: <Presentation />,
                  label: "P. Interactivas",
                  val: stats.pantallasMal,
                },
                {
                  icon: <Projector />,
                  label: "Proyectores",
                  val: stats.proyectoresMal,
                },
              ].map(({ icon, label, val }) => (
                <div
                  key={label}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 text-center flex flex-col justify-between"
                >
                  <div className="w-5 h-5 text-amber-600 mx-auto mb-1">
                    {icon}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    {label}
                  </span>
                  <span className="text-xl font-extrabold text-gray-800 block mt-1">
                    {val}
                  </span>
                </div>
              ))}
              <div className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-200 text-center flex flex-col justify-between col-span-2 md:col-span-1">
                <Database className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                  Total
                </span>
                <span className="text-lg font-bold text-amber-800 block mt-1">
                  {stats.totalMal}
                </span>
              </div>
            </div>
          </div>

          {/* Tabla de encuestas + botón de exportar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50">
              <div>
                <h4 className="font-extrabold text-slate-800 text-xs md:text-sm uppercase tracking-wider">
                  Censos Recibidos
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rectores que han enviado su encuesta al sistema central.
                </p>
              </div>

              {/* CORRECCIÓN: botón en lugar de <a href> para poder enviar el header de auth */}
              {submissions.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-[#F27D26] hover:bg-[#d96a1a] text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-all cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar Consolidado a CSV (Excel)</span>
                </button>
              )}
            </div>

            {submissions.length === 0 ? (
              <div className="p-12 text-center text-gray-400 space-y-3">
                <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto" />
                <div>
                  <h5 className="font-bold text-gray-700 text-xs uppercase tracking-wider">
                    Aún no hay respuestas registradas
                  </h5>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Las encuestas que respondan los rectores aparecerán aquí en
                    tiempo real.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold">
                      <th className="p-3.5">Fecha Envío</th>
                      <th className="p-3.5">Establecimiento Principal</th>
                      <th className="p-3.5">Municipio</th>
                      <th className="p-3.5">Rector Responsable</th>
                      <th className="p-3.5">Contacto</th>
                      <th className="p-3.5 text-center">Sedes</th>
                      <th className="p-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50/40">
                        <td className="p-3.5 font-mono text-gray-500 whitespace-nowrap">
                          {new Date(sub.fecha).toLocaleDateString("es-CO", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-3.5">
                          <span
                            className="font-bold text-gray-800 block max-w-[250px] truncate"
                            title={sub.nombreEstablecimiento}
                          >
                            {sub.nombreEstablecimiento}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 block mt-0.5">
                            DANE: {sub.codigoEstablecimiento}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-gray-700">
                          {sub.municipio}
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-gray-800 block">
                            {sub.rector.nombre}
                          </span>
                          <span className="text-[10px] text-gray-500 uppercase">
                            {sub.rector.cargo}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-gray-500">
                          📞 {sub.rector.telefono}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                            {sub.respuestasSedes.length} Sedes
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleDeleteSubmission(sub.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar encuesta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: IMPORTAR EXCEL ── */}
      {activeTab === "import" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-gray-800 tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#006C3E]" />
                Actualizar la Base Escolar desde Excel
              </h3>
              <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
                <p>
                  Suba un archivo <strong>.xlsx</strong> o <strong>.csv</strong>{" "}
                  con las sedes educativas de Antioquia. El archivo debe
                  contener las siguientes columnas:
                </p>
                <div className="bg-gray-50 p-4 rounded-xl border font-mono text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-700">
                  <div>• MUNICIPIO</div>
                  <div>• CÓDIGO ESTABLECIMIENTO (12 dgt)</div>
                  <div>• NOMBRE ESTABLECIMIENTO</div>
                  <div>• ¿ESTABLECIMIENTO PRINCIPAL? (SI/NO)</div>
                  <div>• CÓDIGO SEDE (12 dgt)</div>
                  <div>• NOMBRE SEDES</div>
                  <div>• ZONA (RURAL/URBANA)</div>
                </div>
                <p className="text-gray-400 text-[10px]">
                  * Las columnas no requieren un orden estricto; el importador
                  asocia los encabezados por aproximación.
                </p>
              </div>
              <div className="pt-2">
                <div className="border-2 border-dashed border-gray-300 hover:border-[#006C3E] rounded-2xl p-8 text-center bg-gray-50/50 hover:bg-emerald-50/10 cursor-pointer transition-all relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelImport}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={!!uploadProgress}
                  />
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <span className="font-bold text-gray-700 text-xs block">
                    {uploadProgress ||
                      "Seleccione o arrastre el archivo de Excel aquí"}
                  </span>
                  <span className="text-[11px] text-gray-400 block mt-1">
                    Formatos: .xlsx, .xls, .csv
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <div>
                <h4 className="font-extrabold text-gray-900 text-sm">
                  Restaurar Valores de Muestra
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Vuelva al archivo base original para realizar pruebas
                  controladas.
                </p>
                <button
                  onClick={handleResetDatabase}
                  disabled={isLoading}
                  className="mt-4 w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Restaurar Base Muestra</span>
                </button>
              </div>
              <div className="pt-6 border-t border-gray-100 space-y-2 text-xs">
                <h5 className="font-bold text-gray-700 uppercase tracking-wide">
                  Ayuda
                </h5>
                <p className="text-gray-500 leading-relaxed">
                  Para pruebas, ingrese el código{" "}
                  <span className="font-mono font-semibold text-gray-900">
                    105002000047
                  </span>{" "}
                  que desplegará las 16 sedes rurales de Abejorral.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PREGUNTAS ADICIONALES ── */}
      {activeTab === "questions" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm h-fit">
            <div className="border-b pb-3 mb-4">
              <h3 className="font-extrabold text-gray-900 text-sm">
                Crear Pregunta Adicional
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Se mostrarán a los rectores durante el diligenciamiento.
              </p>
            </div>
            <form onSubmit={handleAddQuestion} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Pregunta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: ¿La sede cuenta con red wifi en las aulas?"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#006C3E] text-gray-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={newQuestionType}
                    onChange={(e) =>
                      setNewQuestionType(
                        e.target.value as CustomQuestion["tipo"],
                      )
                    }
                    className="w-full px-3 py-2 border rounded-lg text-gray-800 bg-white cursor-pointer"
                  >
                    <option value="text">Texto Corto</option>
                    <option value="number">Número</option>
                    <option value="textarea">Párrafo</option>
                    <option value="select">Lista (Select)</option>
                    <option value="radio">Selección Única</option>
                    <option value="checkbox">Opción Múltiple</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Ámbito
                  </label>
                  <select
                    value={newQuestionCategory}
                    onChange={(e) =>
                      setNewQuestionCategory(
                        e.target.value as CustomQuestion["categoria"],
                      )
                    }
                    className="w-full px-3 py-2 border rounded-lg text-gray-800 bg-white cursor-pointer"
                  >
                    <option value="sede">Por cada Sede</option>
                    <option value="global">Global de la IE</option>
                  </select>
                </div>
              </div>
              {["select", "radio", "checkbox"].includes(newQuestionType) && (
                <div className="bg-amber-50/40 p-3 rounded-lg border border-amber-100">
                  <label className="block font-bold text-amber-950 mb-1">
                    Opciones (separadas por coma){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Excelente, Bueno, Regular, Deficiente"
                    value={newQuestionOptions}
                    onChange={(e) => setNewQuestionOptions(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 bg-white"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="req_check"
                  checked={newQuestionRequired}
                  onChange={(e) => setNewQuestionRequired(e.target.checked)}
                  className="w-4 h-4 text-[#006C3E] rounded"
                />
                <label
                  htmlFor="req_check"
                  className="font-bold text-gray-700 cursor-pointer select-none"
                >
                  Pregunta obligatoria
                </label>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-[#006C3E] hover:bg-emerald-800 text-white font-extrabold rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar al Censo</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="border-b pb-3 mb-4 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">
                  Cuestionario Adicional Activo
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Preguntas configuradas en el aplicativo.
                </p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                {customQuestions.length} adicionales
              </span>
            </div>
            {customQuestions.length === 0 ? (
              <div className="p-12 text-center text-gray-400 space-y-2">
                <FileText className="w-12 h-12 text-gray-200 mx-auto" />
                <h5 className="font-bold text-gray-700 text-xs uppercase tracking-wider">
                  Sin preguntas adicionales
                </h5>
                <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">
                  Solo se mostrarán las preguntas base sobre hardware.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {customQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border flex justify-between items-start gap-4 hover:border-gray-300 transition-all text-xs bg-gray-50/50"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="font-extrabold text-gray-800">
                          {q.pregunta}
                        </span>
                        {q.requerida && (
                          <span className="bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wide">
                            Requerida
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500">
                        <span>
                          Tipo:{" "}
                          <strong className="text-gray-700 uppercase">
                            {q.tipo}
                          </strong>
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>
                          Ámbito:{" "}
                          <strong className="text-gray-700 uppercase">
                            {q.categoria === "sede" ? "Por Sede" : "Global IE"}
                          </strong>
                        </span>
                        {q.opciones && q.opciones.length > 0 && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span className="max-w-[250px] truncate">
                              Opciones:{" "}
                              <strong className="text-emerald-800">
                                {q.opciones.join(", ")}
                              </strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
