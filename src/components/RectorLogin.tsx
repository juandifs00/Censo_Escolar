import React, { useState, useEffect } from "react";
import {
  Sede,
  RectorInfo,
  InstitutionSearchResult,
  EncuestaStatus,
  SurveySubmission,
} from "../types";
import {
  Search,
  MapPin,
  School,
  Phone,
  User,
  Award,
  ShieldAlert,
  CheckCircle2,
  CheckCircle,
  Clock,
  Mail,
  AlertTriangle,
} from "lucide-react";

interface RectorLoginProps {
  onLoginSuccess: (
    rector: RectorInfo,
    matchedSedes: Sede[],
    existingSubmission?: SurveySubmission,
  ) => void;
}

export default function RectorLogin({ onLoginSuccess }: RectorLoginProps) {
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("Rector(a)");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [codigoEstablecimiento, setCodigoEstablecimiento] = useState("");

  const [matchedSedes, setMatchedSedes] = useState<Sede[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [existingFullSubmission, setExistingFullSubmission] = useState<
    SurveySubmission | undefined
  >(undefined);

  // ── Fase 1: estado del establecimiento ────────────────────────────────
  const [encuestaStatus, setEncuestaStatus] = useState<EncuestaStatus | null>(
    null,
  );
  const [busquedaEsSecundaria, setBusquedaEsSecundaria] = useState(false);
  const [codigoPrincipalSugerido, setCodigoPrincipalSugerido] = useState("");

  // Búsqueda automática con debounce
  useEffect(() => {
    const code = codigoEstablecimiento.trim();
    if (code.length >= 6) {
      const timer = setTimeout(() => searchDANE(code), 400);
      return () => clearTimeout(timer);
    } else {
      resetSearchState();
    }
  }, [codigoEstablecimiento]);

  const resetSearchState = () => {
    setMatchedSedes([]);
    setSchoolName("");
    setMunicipio("");
    setHasSearched(false);
    setEncuestaStatus(null);
    setBusquedaEsSecundaria(false);
    setCodigoPrincipalSugerido("");
  };

  const searchDANE = async (code: string) => {
    setIsLoading(true);
    try {
      // 1. Buscar sedes del establecimiento
      const instRes = await fetch(`/api/institutions/${code}`);
      if (!instRes.ok) {
        setHasSearched(true);
        return;
      }
      const instData: InstitutionSearchResult = await instRes.json();

      setMatchedSedes(instData.sedes);
      setBusquedaEsSecundaria(instData.busquedaEsSecundaria);
      setCodigoPrincipalSugerido(instData.codigoPrincipalSugerido ?? "");

      if (instData.sedes.length > 0) {
        setSchoolName(instData.nombreEstablecimiento);
        setMunicipio(instData.municipio);

        // 2. Consultar estado de la encuesta
        const statusRes = await fetch(
          `/api/surveys/status/${instData.codigoEstablecimientoPrincipal}`,
        );

        if (statusRes.ok) {
          const statusData = await statusRes.json(); // ← parsear PRIMERO
          setEncuestaStatus(statusData);

          // 3. FASE 2: si existe, cargar datos completos para pre-poblar
          if (statusData.exists) {
            const dataRes = await fetch(
              `/api/surveys/data/${instData.codigoEstablecimientoPrincipal}`,
            );
            if (dataRes.ok) {
              const data = await dataRes.json();
              setExistingFullSubmission(data.submission);
            }
          } else {
            setExistingFullSubmission(undefined);
          }
        }
      } else {
        setSchoolName("");
        setMunicipio("");
        setEncuestaStatus(null);
      }
    } catch (err) {
      console.error("Error al buscar establecimiento:", err);
    } finally {
      // Siempre marcar como buscado y parar el loader,
      // incluso si hubo un error a mitad del proceso
      setIsLoading(false);
      setHasSearched(true);
    }
  };

  // ── Validación del teléfono ────────────────────────────────────────────
  const validatePhone = (value: string): boolean => {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("El número debe tener 10 dígitos.");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d\s\-().+]/g, "");
    setTelefono(raw);
    if (raw.length > 0) validatePhone(raw);
    else setPhoneError("");
  };

  // ── Envío del formulario ───────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !telefono || !correo || !codigoEstablecimiento) {
      alert("Por favor diligencie todos los campos requeridos.");
      return;
    }
    if (!validatePhone(telefono)) return;
    if (matchedSedes.length === 0) {
      alert(
        "No se puede iniciar la encuesta sin un código DANE válido y sedes asociadas.",
      );
      return;
    }

    const rector: RectorInfo = {
      nombre: nombre.trim(),
      cargo,
      telefono: telefono.trim(),
      correo: correo.trim(),
      codigoEstablecimiento: matchedSedes[0].codigoEstablecimiento,
    };

    if (busquedaEsSecundaria) {
      const sedesAMostrar = matchedSedes.filter(
        (s) => s.codigoSede === codigoEstablecimiento,
      );
      const sedesToShow =
        sedesAMostrar.length > 0 ? sedesAMostrar : [matchedSedes[0]];

      // Filtrar el submission existente para que solo incluya la sede del docente
      const submissionFiltrado = existingFullSubmission
        ? {
            ...existingFullSubmission,
            respuestasSedes: existingFullSubmission.respuestasSedes.filter(
              (s) =>
                sedesToShow.some((sede) => sede.codigoSede === s.codigoSede),
            ),
          }
        : undefined;

      onLoginSuccess(rector, sedesToShow, submissionFiltrado);
    } else {
      onLoginSuccess(rector, matchedSedes, existingFullSubmission);
    }
  };

  // ── Helper: saber si una sede ya tiene datos ───────────────────────────
  const sedeYaTieneDatos = (codigoSede: string): string | null => {
    if (!encuestaStatus?.exists) return null;
    const found = encuestaStatus.sedesConDatos.find(
      (s) => s.codigoSede === codigoSede,
    );
    return found ? found.ultimaModificacion : null;
  };

  const sedesConDatosCount = encuestaStatus?.sedesConDatos.length ?? 0;
  const totalSedes = matchedSedes.length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
        {/* Banner de bienvenida */}
        <div className="bg-[#006837] text-white p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="bg-[#F27D26] text-white text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider">
              Acceso Directivos
            </span>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              Portal de Registro de Encuesta
            </h2>
            <p className="text-xs text-slate-100 max-w-xl opacity-90 leading-relaxed">
              Bienvenido, señor rector o director educativo. Registre su
              información de contacto y cargue las sedes asociadas a su cargo
              para reportar el estado del parque tecnológico.
            </p>
          </div>
          <div className="block">
            <div className="w-50 h-25 bg-white/10 flex items-center justify-center text-[#F27D26] border-2 border-[#F27D26]/45">
              <img
                src="/logo_gobant.png"
                alt="Logo institucional"
                className="w-full h-full object-contain p-1"
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* Sección 1: Datos de contacto */}
          <div>
            <h3 className="text-sm font-bold text-[#006837] uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#006837]/10 text-[#006837] flex items-center justify-center text-xs font-bold">
                1
              </span>
              Información de Identificación
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nombre */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#006837]" />
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pedro Nel Gómez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#006837] focus:border-[#006837] text-slate-800 placeholder-slate-400"
                />
              </div>

              {/* Cargo */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#006837]" />
                  Cargo del Directivo <span className="text-red-500">*</span>
                </label>
                <select
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#006837] focus:border-[#006837] text-slate-800 cursor-pointer"
                >
                  <option value="Rector(a)">Rector(a)</option>
                  <option value="Coordinador(a)">Coordinador(a)</option>
                  <option value="Secretaria">Secretaria</option>
                  <option value="Docente">Docente</option>
                </select>
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#006837]" />
                  Número Telefónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ej: 3123456789"
                  value={telefono}
                  onChange={handlePhoneChange}
                  onBlur={() => telefono.length > 0 && validatePhone(telefono)}
                  pattern="[\d\s\-().+]{7,20}"
                  title="Ingrese un número de teléfono válido"
                  maxLength={10}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#006837] text-slate-800 placeholder-slate-400 ${
                    phoneError
                      ? "border-red-400 focus:border-red-400"
                      : "border-slate-200 focus:border-[#006837]"
                  }`}
                />
                {phoneError && (
                  <p className="text-[10px] text-red-500 font-semibold mt-1">
                    {phoneError}
                  </p>
                )}
              </div>

              {/* Correo */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#006837]" />
                  Correo Electrónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="Ej: rector@institucion.edu.co"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#006837] focus:border-[#006837] text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Búsqueda DANE */}
          <div>
            <h3 className="text-sm font-bold text-[#006837] uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#006837]/10 text-[#006837] flex items-center justify-center text-xs font-bold">
                2
              </span>
              Código DANE del Establecimiento Principal
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-[#006837]" />
                  Código DANE <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Código DANE de la sede principal (Ej: 105002000047)"
                    value={codigoEstablecimiento}
                    onChange={(e) => {
                      setCodigoEstablecimiento(
                        e.target.value.replace(/\D/g, ""),
                      );
                      resetSearchState();
                    }}
                    maxLength={14}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-[#006837] rounded text-sm font-mono tracking-wider focus:outline-none focus:border-[#006837] text-slate-800 placeholder-slate-400"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <School className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 p-2.5 rounded flex items-start gap-1.5">
                  <span className="font-semibold text-[#006837]">
                    Nota de ayuda:
                  </span>
                  <span>
                    Puede probar ingresando:{" "}
                    <button
                      type="button"
                      onClick={() => setCodigoEstablecimiento("105002000047")}
                      className="text-[#006837] font-mono font-bold underline hover:text-[#004d29]"
                    >
                      105002000047
                    </button>{" "}
                    (Abejorral)
                  </span>
                </div>
              </div>

              {/* Cargando */}
              {isLoading && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#006837] border-t-transparent" />
                  <span className="text-xs text-slate-600 font-medium">
                    Buscando en la base de datos...
                  </span>
                </div>
              )}

              {/* Resultados */}
              {hasSearched && !isLoading && (
                <div>
                  {matchedSedes.length > 0 ? (
                    <div className="space-y-3">
                      {/* Aviso: búsqueda por sede secundaria */}
                      {busquedaEsSecundaria && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-4 flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                          <div className="text-xs text-blue-900 space-y-1">
                            <p className="font-bold">
                              Código de sede secundaria detectado
                            </p>
                            <p className="leading-relaxed">
                              El código ingresado pertenece a una sede
                              secundaria. El sistema cargó automáticamente{" "}
                              <strong>todas las sedes</strong> del
                              establecimiento principal para que pueda
                              diligenciar el censo completo.
                            </p>
                            {codigoPrincipalSugerido && (
                              <p className="text-blue-700">
                                Código del establecimiento principal:{" "}
                                <span className="font-mono font-bold">
                                  {codigoPrincipalSugerido}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Card principal del establecimiento */}
                      <div className="bg-[#006837]/5 border border-[#006837]/20 rounded p-5 space-y-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-[#006837] shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-[#006837] text-sm">
                              Establecimiento Encontrado
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold flex items-center gap-2.5">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" /> {municipio}
                              </span>
                              <span className="text-slate-300">|</span>
                              <span>
                                DANE Principal:{" "}
                                {matchedSedes[0].codigoEstablecimiento}
                              </span>
                            </p>
                            <p className="text-sm font-extrabold text-slate-800 mt-1.5 italic">
                              {schoolName}
                            </p>
                          </div>
                        </div>

                        {/* Resumen de estado */}
                        {encuestaStatus?.exists && (
                          <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-2.5 text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-amber-900 space-y-0.5">
                              <p className="font-bold">
                                Este establecimiento ya tiene datos registrados
                                — {sedesConDatosCount} de {totalSedes}{" "}
                                {sedesConDatosCount === 1
                                  ? "sede tiene"
                                  : "sedes tienen"}{" "}
                                información.
                              </p>
                              <p className="leading-relaxed text-amber-800">
                                Las sedes con datos previos están marcadas en
                                verde. Puede diligenciar las sedes faltantes o
                                actualizar la información de las que ya tienen
                                registros.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Lista de sedes con indicadores de estado */}
                        <div className="border-t border-slate-200 pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              Sedes del establecimiento ({totalSedes})
                            </h5>
                            {encuestaStatus?.exists && (
                              <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-wide">
                                <span className="flex items-center gap-1 text-emerald-700">
                                  <CheckCircle className="w-3 h-3" /> Con datos:{" "}
                                  {sedesConDatosCount}
                                </span>
                                <span className="flex items-center gap-1 text-slate-400">
                                  <Clock className="w-3 h-3" /> Pendientes:{" "}
                                  {totalSedes - sedesConDatosCount}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="max-h-56 overflow-y-auto pr-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {matchedSedes.map((sede, idx) => {
                                const fechaDatos = sedeYaTieneDatos(
                                  sede.codigoSede,
                                );
                                const tieneDatos = fechaDatos !== null;
                                return (
                                  <div
                                    key={sede.codigoSede}
                                    className={`p-2.5 rounded border flex justify-between items-center ${
                                      tieneDatos
                                        ? "bg-emerald-50 border-emerald-200"
                                        : "bg-white border-slate-200"
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <span className="font-bold text-slate-700 block text-[11px] truncate max-w-[180px]">
                                        {idx + 1}. {sede.nombreSede}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono block">
                                        {sede.codigoSede}
                                      </span>
                                      {tieneDatos && fechaDatos && (
                                        <span className="text-[9px] text-emerald-700 font-semibold block mt-0.5">
                                          Registrado:{" "}
                                          {new Date(
                                            fechaDatos,
                                          ).toLocaleDateString("es-CO", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                          })}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                      <span
                                        className={`text-[9px] font-bold py-0.5 px-2 rounded-full uppercase ${
                                          tieneDatos
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-slate-100 text-slate-500"
                                        }`}
                                      >
                                        {sede.zona}
                                      </span>
                                      {tieneDatos ? (
                                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-700">
                                          <CheckCircle className="w-3 h-3" />{" "}
                                          Con datos
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-slate-400">
                                          <Clock className="w-3 h-3" />{" "}
                                          Pendiente
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded p-5 flex items-start gap-3.5">
                      <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-amber-950 text-sm">
                          Establecimiento no encontrado
                        </h4>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          El código DANE{" "}
                          <span className="font-mono font-bold text-slate-900">
                            {codigoEstablecimiento}
                          </span>{" "}
                          no tiene sedes asignadas en la base de datos de
                          Antioquia.
                        </p>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          Si usted es el administrador, puede importar el
                          archivo Excel oficial desde el{" "}
                          <strong className="text-[#006837]">
                            Panel de Administración
                          </strong>{" "}
                          para actualizar la base de datos escolar.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Botón de acción */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={matchedSedes.length === 0}
              className={`px-5 py-2.5 rounded text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 ${
                matchedSedes.length > 0
                  ? "bg-[#F27D26] hover:bg-[#d96a1a] text-white cursor-pointer"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              }`}
            >
              <span>
                {encuestaStatus?.exists && totalSedes - sedesConDatosCount > 0
                  ? `Diligenciar ${totalSedes - sedesConDatosCount} sede${totalSedes - sedesConDatosCount !== 1 ? "s" : ""} pendiente${totalSedes - sedesConDatosCount !== 1 ? "s" : ""}`
                  : encuestaStatus?.exists
                    ? "Actualizar información de sedes"
                    : "Comenzar Diligenciamiento de Encuesta"}
              </span>
              <span>→</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
