import React, { useState, useEffect } from "react";
import { Sede, RectorInfo } from "../types";
import { Search, MapPin, School, Phone, User, Award, ShieldAlert, CheckCircle2 } from "lucide-react";

interface RectorLoginProps {
  onLoginSuccess: (rector: RectorInfo, matchedSedes: Sede[]) => void;
}

export default function RectorLogin({ onLoginSuccess }: RectorLoginProps) {
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("Rector(a)");
  const [telefono, setTelefono] = useState("");
  const [codigoEstablecimiento, setCodigoEstablecimiento] = useState("");
  
  const [matchedSedes, setMatchedSedes] = useState<Sede[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [municipio, setMunicipio] = useState("");

  // Search establishments when DANE code changes
  useEffect(() => {
    const code = codigoEstablecimiento.trim();
    if (code.length >= 6) {
      const delayDebounce = setTimeout(() => {
        searchDANE(code);
      }, 400);
      return () => clearTimeout(delayDebounce);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !telefono || !codigoEstablecimiento) {
      alert("Por favor diligencie todos los campos requeridos.");
      return;
    }
    if (matchedSedes.length === 0) {
      alert("No se puede iniciar la encuesta sin un código DANE válido y sedes asociadas.");
      return;
    }

    const rector: RectorInfo = {
      nombre: nombre.trim(),
      cargo,
      telefono: telefono.trim(),
      codigoEstablecimiento: codigoEstablecimiento.trim()
    };

    onLoginSuccess(rector, matchedSedes);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
        
        {/* Top welcome banner */}
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
          <div className="hidden lg:block">
            {/* Outline of school/cap */}
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-[#F27D26] border-2 border-[#F27D26]/45">
              <School className="w-10 h-10" />
            </div>
          </div>
        </div>

        {/* Access Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          
          {/* Section 1: Contact Info */}
          <div>
            <h3 className="text-sm font-bold text-[#006837] uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#006837]/10 text-[#006837] flex items-center justify-center text-xs font-bold">1</span>
              Información de Identificación
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <option value="Secretaria">Secretaria</option>
                  <option value="Coordinador(a)">Coordinador(a)</option>
                </select>
              </div>

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
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#006837] focus:border-[#006837] text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Section 2: School DANE Lookup */}
          <div>
            <h3 className="text-sm font-bold text-[#006837] uppercase tracking-wider border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#006837]/10 text-[#006837] flex items-center justify-center text-xs font-bold">2</span>
              Código DANE del Establecimiento Principal
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
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
                  <span>Puede probar ingresando el código de ejemplo provisto por la Secretaría de Educación: <button type="button" onClick={() => setCodigoEstablecimiento("105002000047")} className="text-[#006837] font-mono font-bold underline hover:text-[#004d29] transition-colors">105002000047</button> (Abejorral Celia Duque) o el <button type="button" onClick={() => setCodigoEstablecimiento("105003000012")} className="text-[#006837] font-mono font-bold underline hover:text-[#004d29] transition-colors">105003000012</button> (Yarumal Mariano de Jesús).</span>
                </div>
              </div>

              {/* Loader */}
              {isLoading && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#006837] border-t-transparent"></div>
                  <span className="text-xs text-slate-600 font-medium">Buscando establecimiento en la base de datos de Antioquia...</span>
                </div>
              )}

              {/* Matched School Results */}
              {hasSearched && !isLoading && (
                <div className="animate-fadeIn">
                  {matchedSedes.length > 0 ? (
                    <div className="bg-[#006837]/5 border border-[#006837]/20 rounded p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#006837] shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-[#006837] text-sm leading-tight">
                            Establecimiento Encontrado
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold flex items-center gap-2.5">
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Municipio: {municipio}</span>
                            <span className="text-slate-300">|</span>
                            <span>Código DANE: {codigoEstablecimiento}</span>
                          </p>
                          <p className="text-sm font-extrabold text-slate-800 mt-1.5 italic">
                            {schoolName}
                          </p>
                        </div>
                      </div>

                      {/* Associated branches list summary */}
                      <div className="border-t border-slate-200 pt-4">
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                          Sedes asociadas encontradas ({matchedSedes.length})
                        </h5>
                        <div className="max-h-44 overflow-y-auto pr-2 custom-scrollbar">
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
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    DANE: {sede.codigoSede}
                                  </span>
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
                        <h4 className="font-bold text-amber-950 text-sm">
                          Establecimiento no encontrado
                        </h4>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          El código DANE principal <span className="font-mono font-bold text-slate-900">{codigoEstablecimiento}</span> no tiene sedes asignadas en la base de datos de Antioquia.
                        </p>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          Si usted es el administrador, puede importar el archivo de Excel oficial en el <strong className="text-[#006837]">Panel de Administración</strong> (esquina superior derecha) para cargar toda la base de datos escolar de la gobernación.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action button */}
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
              <span className="text-xs">→</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
