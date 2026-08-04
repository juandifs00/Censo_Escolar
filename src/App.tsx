import { useState, useEffect } from "react";
import Navbar from "./components/Navbar.tsx";
import RectorLogin from "./components/RectorLogin.tsx";
import SurveyForm from "./components/SurveyForm.tsx";
import AdminPanel from "./components/AdminPanel.tsx";
import { Sede, RectorInfo, SurveySubmission } from "./types.ts";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle,
  FileText,
  Download,
  ArrowLeft,
  Award,
  MapPin,
  Calendar,
  Building2,
  Phone,
  Settings,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export default function App() {
  const [isAdmin, setIsAdmin]                       = useState(false);
  const [showAdminButton, setShowAdminButton]       = useState(false);
  const [showPasswordModal, setShowPasswordModal]   = useState(false);
  const [passwordInput, setPasswordInput]           = useState("");
  const [passwordError, setPasswordError]           = useState("");
  const [isAuthLoading, setIsAuthLoading]           = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params    = new URLSearchParams(window.location.search);
      const adminParam = params.get("admin");
      if (adminParam === "true") {
        setShowAdminButton(true);
        localStorage.setItem("showAdminButton", "true");
      } else if (adminParam === "false") {
        setShowAdminButton(false);
        localStorage.removeItem("showAdminButton");
        setIsAdmin(false);
      } else if (localStorage.getItem("showAdminButton") === "true") {
        setShowAdminButton(true);
      }
    }
  }, []);

  // ── Admin toggle ──────────────────────────────────────────────────────
  const handleToggleAdminClick = async (val: boolean) => {
    if (val) {
      setPasswordInput("");
      setPasswordError("");
      setShowPasswordModal(true);
    } else {
      // Cerrar sesión: invalidar token en el servidor
      const token = sessionStorage.getItem("adminToken");
      if (token) {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // Si falla la red al cerrar sesión, igual limpiamos localmente
        }
        sessionStorage.removeItem("adminToken");
      }
      setIsAdmin(false);
    }
  };

  // ── Validación de contraseña contra el servidor ───────────────────────
  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) return;
    setIsAuthLoading(true);
    setPasswordError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });

      if (res.ok) {
        const { token } = await res.json();
        sessionStorage.setItem("adminToken", token);
        setIsAdmin(true);
        setShowPasswordModal(false);
        setPasswordInput("");
      } else {
        setPasswordError("Contraseña incorrecta. Por favor intente de nuevo.");
      }
    } catch {
      setPasswordError("Error de conexión con el servidor. Intente de nuevo.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // ── Sesión del rector ─────────────────────────────────────────────────
  const [activeRector, setActiveRector]       = useState<RectorInfo | null>(null);
  const [activeSedes, setActiveSedes]         = useState<Sede[]>([]);
  const [completedSubmission, setCompletedSubmission] = useState<SurveySubmission | null>(null);

  const handleLoginSuccess = (rector: RectorInfo, sedes: Sede[]) => {
    setActiveRector(rector);
    setActiveSedes(sedes);
    setCompletedSubmission(null);
  };

  const handleSurveySubmitted = (submission: SurveySubmission) => {
    setCompletedSubmission(submission);
    setActiveRector(null);
    setActiveSedes([]);
  };

  const handleExitSurveyRequest = () => {
    if (activeRector !== null) {
      setShowExitConfirmModal(true);
    } else {
      handleExitSurvey();
    }
  };

  const handleExitSurvey = () => {
    setActiveRector(null);
    setActiveSedes([]);
    setCompletedSubmission(null);
    setShowExitConfirmModal(false);
  };

  // ── Descarga de soporte en texto plano ───────────────────────────────
  const handleDownloadReceipt = (sub: SurveySubmission) => {
    try {
      const dateStr = new Date(sub.fecha).toLocaleDateString("es-CO", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

      let content = `======================================================
     GOBERNACIÓN DE ANTIOQUIA - SECRETARÍA DE EDUCACIÓN
          RECIBO DE RADICADO - CENSO TECNOLÓGICO
======================================================

CÓDIGO DE RADICADO: ${sub.id}
FECHA DE ENVÍO: ${dateStr}

INFORMACIÓN DE LA INSTITUCIÓN:
---------------------------------------------
Establecimiento Principal: ${sub.nombreEstablecimiento}
Código DANE Principal:    ${sub.codigoEstablecimiento}
Municipio:                ${sub.municipio}
Total de Sedes Reportadas: ${sub.respuestasSedes.length}

INFORMACIÓN DEL DIRECTIVO RESPONSABLE:
---------------------------------------------
Nombre Completo: ${sub.rector.nombre}
Cargo:           ${sub.rector.cargo}
Teléfono:        ${sub.rector.telefono}
Correo:          ${sub.rector.correo}

RESUMEN DE HARDWARE EN BUEN ESTADO:
---------------------------------------------
`;

      let totalTablets = 0, totalPortatiles = 0, totalEscritorios = 0;
      let totalTVs = 0, totalPantallas = 0, totalProyectores = 0;

      sub.respuestasSedes.forEach((r, idx) => {
        const d = r.dispositivos;
        totalTablets     += d.tablets;
        totalPortatiles  += d.portatiles;
        totalEscritorios += d.escritorio;
        totalTVs         += d.smartTv;
        totalPantallas   += d.pantallasInteractivas;
        totalProyectores += d.proyectores;

        content += `\nSede #${idx + 1}: ${r.nombreSede} (DANE: ${r.codigoSede})
   - Tablets: ${d.tablets}
   - Portátiles: ${d.portatiles}
   - Escritorio PC: ${d.escritorio}
   - Smart TV: ${d.smartTv}
   - Pantallas Interactivas: ${d.pantallasInteractivas}
   - Proyectores: ${d.proyectores}
   - Otros: ${d.otrosCantidad} (${d.otrosDescripcion || "Ninguno"})
   - Origen Adquisición: ${(r.origenAdquisicion || []).join(", ") || "No registrado"}\n`;
      });

      content += `\n---------------------------------------------
CONSOLIDADO TOTAL INSTITUCIONAL:
---------------------------------------------
- Total Tablets: ${totalTablets}
- Total Portátiles: ${totalPortatiles}
- Total PCs de Escritorio: ${totalEscritorios}
- Total Smart TVs: ${totalTVs}
- Total Pantallas Interactivas: ${totalPantallas}
- Total Proyectores: ${totalProyectores}
- Total de Dispositivos Reportados: ${totalTablets + totalPortatiles + totalEscritorios + totalTVs + totalPantallas + totalProyectores}

======================================================
Este documento sirve como soporte oficial de radicación
ante la Secretaría de Educación de Antioquia.
======================================================`;

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.download = `Soporte_Radicado_${sub.codigoEstablecimiento}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error al descargar soporte: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800 selection:bg-emerald-700 selection:text-white">
      <Navbar
        isAdmin={isAdmin}
        setIsAdmin={handleToggleAdminClick}
        onExitSurvey={handleExitSurveyRequest}
        isInSurvey={activeRector !== null}
        showAdminButton={showAdminButton}
      />

      <div className="flex-1">
        <AnimatePresence mode="wait">
          {isAdmin ? (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <AdminPanel />
            </motion.div>
          ) : completedSubmission ? (
            <motion.div
              key="receipt"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="max-w-3xl mx-auto px-4 py-12"
            >
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-150">
                <div className="bg-[#006C3E] text-white p-8 text-center space-y-3 relative border-b-4 border-[#D4AF37]">
                  <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/35 flex items-center justify-center mx-auto text-amber-400">
                    <CheckCircle className="w-10 h-10 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="bg-[#D4AF37] text-emerald-950 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                      Censo Enviado Exitosamente
                    </span>
                    <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">
                      ¡Formulario Radicado con Éxito!
                    </h3>
                    <p className="text-xs text-emerald-100 max-w-md mx-auto mt-1">
                      El reporte consolidado de su establecimiento educativo ha sido guardado de forma permanente en el sistema central de la gobernación.
                    </p>
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border bg-gray-50/50 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-gray-700">
                        <Building2 className="w-4 h-4 text-emerald-700" />
                        <span>INFORMACIÓN INSTITUCIONAL</span>
                      </div>
                      <p className="font-extrabold text-[#006C3E] uppercase">{completedSubmission.nombreEstablecimiento}</p>
                      <p className="text-gray-500">Municipio: <span className="font-bold text-gray-700">{completedSubmission.municipio}</span></p>
                      <p className="text-gray-500">DANE Principal: <span className="font-mono text-gray-700 font-bold">{completedSubmission.codigoEstablecimiento}</span></p>
                    </div>
                    <div className="p-4 rounded-xl border bg-gray-50/50 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-gray-700">
                        <Award className="w-4 h-4 text-emerald-700" />
                        <span>DIRECTIVO RESPONSABLE</span>
                      </div>
                      <p className="font-extrabold text-gray-800">{completedSubmission.rector.nombre}</p>
                      <p className="text-gray-500">Cargo: <span className="font-bold text-gray-700 uppercase">{completedSubmission.rector.cargo}</span></p>
                      <p className="text-gray-500">Teléfono: <span className="font-mono text-gray-700 font-bold">{completedSubmission.rector.telefono}</span></p>
                      <p className="text-gray-500">Correo: <span className="font-mono text-gray-700 font-bold">{completedSubmission.rector.correo}</span></p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 space-y-2 text-xs">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="space-y-0.5">
                        <span className="font-bold text-emerald-950 block">CÓDIGO DE RADICADO SEGURO</span>
                        <span className="font-mono text-[11px] bg-white border border-emerald-100 py-0.5 px-2 rounded text-emerald-800 font-bold">
                          {completedSubmission.id}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Fecha Registro</span>
                        <span className="font-bold text-gray-700 flex items-center gap-1 justify-end mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          {new Date(completedSubmission.fecha).toLocaleDateString("es-CO", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                    <button
                      onClick={handleExitSurvey}
                      className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto justify-center"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Volver al Portal de Inicio</span>
                    </button>
                    <button
                      onClick={() => handleDownloadReceipt(completedSubmission)}
                      className="px-6 py-3 bg-[#D4AF37] hover:bg-amber-500 text-emerald-950 font-extrabold text-xs rounded-xl flex items-center gap-2 shadow transition-all cursor-pointer w-full sm:w-auto justify-center"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar Soporte Físico (TXT)</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeRector ? (
            <motion.div
              key="survey"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <SurveyForm
                rector={activeRector}
                sedes={activeSedes}
                onSurveySubmitted={handleSurveySubmitted}
              />
            </motion.div>
          ) : (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <RectorLogin onLoginSuccess={handleLoginSuccess} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer institucional */}
      <footer className="w-full bg-gray-900 text-gray-400 text-xs py-8 border-t border-gray-800 font-sans mt-auto">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h5 className="font-bold text-gray-200">Gobernación de Antioquia</h5>
            <p className="text-[11px] leading-relaxed">
              Secretaría de Educación Departamental • Calle 42B Número 52-106 • Centro Administrativo Departamental "La Alpujarra" • Medellín, Colombia.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-gray-200">Soporte Tecnológico</h5>
            <p className="text-[11px] leading-relaxed">
              Para inconvenientes con el código DANE de su establecimiento principal, ingrese al Panel de Administración para verificar o cargar la base de datos de Excel correspondiente.
            </p>
          </div>
          <div className="space-y-1 md:text-right flex flex-col justify-center">
            <span className="text-emerald-500 font-bold tracking-wide uppercase text-[10px]">Censo de Tecnología 2026</span>
            <span className="text-[10px] text-gray-600">© Todos los derechos reservados • República de Colombia</span>
          </div>
        </div>
      </footer>

      {/* ── Modal: contraseña de administrador ── */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="bg-[#006837] text-white p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center text-[#F27D26] shrink-0">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm tracking-tight">Acceso Administrativo</h4>
                  <p className="text-[10px] text-slate-200">Se requiere contraseña de seguridad</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Para ingresar al Panel de Administración y gestionar la base de datos de sedes o exportar los reportes, ingrese la clave de seguridad institucional.
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Contraseña de Acceso
                  </label>
                  <input
                    type="password"
                    placeholder="Ingrese la contraseña"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handlePasswordSubmit();
                    }}
                    disabled={isAuthLoading}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#006837] focus:border-[#006837] text-slate-800 disabled:opacity-60"
                    autoFocus
                  />
                  {passwordError && (
                    <span className="text-[10px] text-red-500 font-bold block mt-1">
                      {passwordError}
                    </span>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setShowPasswordModal(false)}
                    disabled={isAuthLoading}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded transition-all disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePasswordSubmit}
                    disabled={isAuthLoading}
                    className="px-4 py-2 text-xs font-bold bg-[#006837] hover:bg-emerald-800 text-white rounded shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isAuthLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <span>Ingresar</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ── Modal: confirmación de salida de encuesta ── */}
        {showExitConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="bg-[#006837] text-white p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm tracking-tight">¿Salir de la Encuesta?</h4>
                  <p className="text-[10px] text-slate-100 font-sans">Confirmación de salida</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  ¿Está seguro que desea salir de la encuesta? Las respuestas que no hayan sido enviadas{" "}
                  <span className="font-bold text-red-600">se perderán de manera definitiva</span>.
                </p>
                <p className="text-[11px] text-slate-400">
                  Para guardar de manera permanente la información, asegúrese de diligenciar todas las sedes y hacer clic en el botón de "Enviar Censo Completo" al finalizar.
                </p>
                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-150">
                  <button
                    onClick={() => setShowExitConfirmModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                  >
                    Continuar diligenciando
                  </button>
                  <button
                    onClick={handleExitSurvey}
                    className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Sí, salir de la encuesta
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
