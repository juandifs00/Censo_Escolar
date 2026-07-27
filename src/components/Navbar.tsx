import { Shield, BookOpen, Settings, ClipboardList } from "lucide-react";

interface NavbarProps {
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  onExitSurvey: () => void;
  isInSurvey: boolean;
  showAdminButton: boolean;
}

export default function Navbar({ isAdmin, setIsAdmin, onExitSurvey, isInSurvey, showAdminButton }: NavbarProps) {
  return (
    <header className="w-full bg-[#006837] text-white shadow-md border-b border-slate-200">
      {/* Top micro-banner */}
      <div className="bg-[#004d29] text-[10px] py-1 px-4 flex justify-between items-center text-slate-100 font-sans tracking-wide">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-[#F27D26]" />
          <span>República de Colombia — Departamento de Antioquia</span>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <span>Secretaría de Educación Departamental</span>
          <span className="text-[#F27D26] font-extrabold">PIENSA EN GRANDE</span>
        </div>
      </div>

      {/* Main navigation */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Logo and brand title */}
        <div className="flex items-center gap-3.5 cursor-pointer" onClick={onExitSurvey}>
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-[#006837] border-2 border-white shadow-sm shrink-0">
            A
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold leading-tight text-white tracking-tight">
              Secretaría de Educación de Antioquia
            </h1>
            <p className="text-xs text-slate-200 font-sans opacity-95">
              Sistema de Gestión de Infraestructura Tecnológica — Censo
            </p>
          </div>
        </div>

        {/* Dynamic actions */}
        <div className="flex items-center gap-3">
          {isInSurvey && (
            <button
              onClick={onExitSurvey}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-medium border border-white/20 transition-all"
            >
              Salir de la Encuesta
            </button>
          )}

          {showAdminButton && (
            <button
              onClick={() => setIsAdmin(!isAdmin)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                isAdmin
                  ? "bg-[#F27D26] hover:bg-[#d96a1a] text-white border-[#F27D26] shadow-sm"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/20"
              }`}
            >
              {isAdmin ? (
                <>
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Ir al Portal del Rector</span>
                </>
              ) : (
                <>
                  <Settings className="w-3.5 h-3.5" />
                  <span>Panel de Administración</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
