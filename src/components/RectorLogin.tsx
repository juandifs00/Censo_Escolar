import React, { useState, useEffect } from "react";
import { Sede, RectorInfo } from "../types";
import { Search, MapPin, School, Phone, User, Award, ShieldAlert, CheckCircle2, Mail } from "lucide-react";

interface RectorLoginProps {
  onLoginSuccess: (rector: RectorInfo, matchedSedes: Sede[]) => void;
}

export default function RectorLogin({ onLoginSuccess }: RectorLoginProps) {
  const [nombre, setNombre]                               = useState("");
  const [cargo, setCargo]                                 = useState("Rector(a)");
  const [telefono, setTelefono]                           = useState("");
  const [correo, setCorreo]                               = useState("");
  const [codigoEstablecimiento, setCodigoEstablecimiento] = useState("");

  const [matchedSedes, setMatchedSedes] = useState<Sede[]>([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [hasSearched, setHasSearched]   = useState(false);
  const [schoolName, setSchoolName]     = useState("");
  const [municipio, setMunicipio]       = useState("");
  const [phoneError, setPhoneError]     = useState("");

  // Búsqueda automática por código DANE con debounce
  useEffect(() => {
    const code = codigoEstablecimiento.trim();
    if (code.length >= 6) {
      const timer = setTimeout(() => searchDANE(code), 400);
      return () => clearTimeout(timer);
    } else {
      setMatchedSedes([]);
      setSchoolName("");
      setMunicipio("");
      setHasSearched(false);
    }
  }, [codigoEstablecimiento]);

  const searchDANE = async (code: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/institutions/${code}`);
      if (res.ok) {
        const data: Sede[] = await res.json();
        setMatchedSedes(data);
        if (data.length > 0) {
          setSchoolName(data[0].nombreEstablecimiento);
          setMunicipio(data[0].municipio);
        } else {
          setSchoolName("");
          setMunicipio("");
        }
      }
      setHasSearched(true);
    } catch (err) {
      console.error("Error al buscar establecimiento:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Validación del número de teléfono ─────────────────────────────────
  // Acepta solo dígitos, mínimo 10, máximo 10 (estándar internacional ITU-T E.164)
  const validatePhone = (value: string): boolean => {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("El número debe tener al menos 10 dígitos.");
      return false;
    }
    if (digits.length > 10) {
      setPhoneError("El número no puede superar los 10 dígitos.");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permite solo dígitos, espacios, guiones y paréntesis (formatos comunes de teléfono)
    const raw = e.target.value.replace(/[^\d\s\-().+]/g, "");
    setTelefono(raw);
    if (raw.length > 0) validatePhone(raw);
    else setPhoneError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !telefono || !codigoEstablecimiento || !correo) {
      alert("Por favor diligencie todos los campos requeridos.");
      return;
    }
    if (!validatePhone(telefono)) return;
    if (matchedSedes.length === 0) {
      alert("No se puede iniciar la encuesta sin un código DANE válido y sedes asociadas.");
      return;
    }

    const rector: RectorInfo = {
      nombre:                nombre.trim(),
      cargo,
      telefono:              telefono.trim(),
      correo:                correo.trim(),
      codigoEstablecimiento: codigoEstablecimiento.trim(),
    };

    onLoginSuccess(rector, matchedSedes);
  };

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
              Bienvenido, señor rector o director educativo. Registre su información de contacto y cargue las sedes asociadas a su cargo para reportar el estado del parque tecnológico.
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

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">

          {/* Sección 1: Información de contacto */}
          <div>
            <h3 className="text-sm font-bold text-[#006837] uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#006837]/10 text-[#006837] flex items-center justify-center text-xs font-bold">1</span>
              Información de Identificación
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nombre */}
              <div>
                <label className="block text-[14px] font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
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
                <label className="block text-[14px] font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#006837]" />
                  Cargo <span className="text-red-500">*</span>
                </label>
                <select
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#006837] focus:border-[#006837] text-slate-800 cursor-pointer"
                >
                  <option value="Rector(a)">Rector(a)</option>
                  <option value="Secretaria">Secretaria</option>
                  <option value="Coordinador(a)">Coordinador(a)</option>
                  <option value="Docente">Docente</option>
                </select>
              </div>

              {/* Teléfono — CORRECCIÓN: validación real de formato */}
              <div>
                <label className="block text-[14px] font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
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
                  // Valida mínimo 10 y máximo 10 dígitos (estándar ITU-T E.164)
                  pattern="[\d\s\-().+]{10,10}"
                  title="Ingrese un número de teléfono válido (mínimo 10 dígitos)"
                  maxLength={10}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#006837] text-slate-800 placeholder-slate-400 ${
                    phoneError
                      ? "border-red-400 focus:border-red-400 focus:ring-red-300"
                      : "border-slate-200 focus:border-[#006837]"
                  }`}
                />
                {phoneError && (
                  <p className="text-[10px] text-red-500 font-semibold mt-1">{phoneError}</p>
                )}
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="block text-[14px] font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
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

          {/* Sección 2: Búsqueda por código DANE */}
          <div>
            <h3 className="text-sm font-bold text-[#006837] uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#006837]/10 text-[#006837] flex items-center justify-center text-xs font-bold">2</span>
              Código DANE del Establecimiento Principal
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[14px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-[#006837]" />
                  Código DANE de la Sede Principal <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Escriba el código DANE de la Sede Principal (Ej: 105002000047)"
                    value={codigoEstablecimiento}
                    onChange={(e) => setCodigoEstablecimiento(e.target.value.replace(/\D/g, ""))}
                    maxLength={14}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-[#006837] rounded text-sm font-mono tracking-wider focus:outline-none focus:border-[#006837] text-slate-800 placeholder-slate-400"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <School className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 p-2.5 rounded flex items-start gap-1.5">
                  <span className="font-semibold text-[#006837]">Nota de ayuda:</span>
                  <span>
                    Puede probar ingresando:{" "}
                    <button type="button" onClick={() => setCodigoEstablecimiento("105002000047")} className="text-[#006837] font-mono font-bold underline hover:text-[#004d29]">
                      105002000047
                    </button>{" "}
                    (Abejorral Celia Duque)
                  </span>
                </div>
              </div>

              {/* Cargando */}
              {isLoading && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#006837] border-t-transparent" />
                  <span className="text-xs text-slate-600 font-medium">Buscando en la base de datos de Antioquia...</span>
                </div>
              )}

              {/* Resultado de búsqueda */}
              {hasSearched && !isLoading && (
                <div className="animate-fadeIn">
                  {matchedSedes.length > 0 ? (
                    <div className="bg-[#006837]/5 border border-[#006837]/20 rounded p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#006837] shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-[#006837] text-sm leading-tight">Establecimiento Encontrado</h4>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold flex items-center gap-2.5">
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Municipio: {municipio}</span>
                            <span className="text-slate-300">|</span>
                            <span>DANE: {codigoEstablecimiento}</span>
                          </p>
                          <p className="text-sm font-extrabold text-slate-800 mt-1.5 italic">{schoolName}</p>
                        </div>
                      </div>
                      <div className="border-t border-slate-200 pt-4">
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                          Sedes encontradas ({matchedSedes.length})
                        </h5>
                        <div className="max-h-44 overflow-y-auto pr-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            {matchedSedes.map((sede, idx) => (
                              <div
                                key={sede.codigoSede}
                                className="bg-white p-2.5 rounded border border-slate-200 flex justify-between items-center"
                              >
                                <div>
                                  <span className="font-bold text-slate-700 block text-[11px] truncate max-w-[200px]">
                                    {idx + 1}. {sede.nombreSede}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">DANE: {sede.codigoSede}</span>
                                </div>
                                <span className="text-[9px] font-bold bg-[#006837]/10 text-[#006837] py-0.5 px-2 rounded-full uppercase">
                                  {sede.zona}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded p-5 flex items-start gap-3.5">
                      <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-amber-950 text-sm">Establecimiento no encontrado</h4>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          El código DANE <span className="font-mono font-bold text-slate-900">{codigoEstablecimiento}</span> no tiene sedes asignadas en la base de datos de Antioquia.
                        </p>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          Si usted es el administrador, puede importar el archivo Excel oficial en el <strong className="text-[#006837]">Panel de Administración</strong> para cargar la base de datos escolar.
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
              <span>Comenzar Diligenciamiento de Encuesta</span>
              <span>→</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
