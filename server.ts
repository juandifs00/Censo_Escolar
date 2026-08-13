import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { INITIAL_INSTITUTIONS } from "./src/data/initialInstitutions.js";
import { Sede, SurveySubmission, CustomQuestion } from "./src/types.js";

const app  = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// ══════════════════════════════════════════════════════════════════════════
// AUTH — sesiones de administrador en memoria
// ══════════════════════════════════════════════════════════════════════════
const adminSessions   = new Map<string, number>(); // token → timestamp de expiración
const SESSION_DURATION = 8 * 60 * 60 * 1000;       // 8 horas

function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado. Sesión de administrador requerida." });
  }
  const token  = auth.slice(7);
  const expiry = adminSessions.get(token);
  if (!expiry || Date.now() > expiry) {
    adminSessions.delete(token);
    return res.status(401).json({ error: "Sesión expirada. Ingrese de nuevo al panel." });
  }
  next();
}

// ══════════════════════════════════════════════════════════════════════════
// RATE LIMITER — sin dependencias externas
// ══════════════════════════════════════════════════════════════════════════
const ipCounts = new Map<string, { count: number; until: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const ip    = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now   = Date.now();
    const entry = ipCounts.get(ip);

    if (!entry || now > entry.until) {
      ipCounts.set(ip, { count: 1, until: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({ error: "Demasiadas solicitudes. Espere un momento e intente de nuevo." });
    }
    entry.count++;
    next();
  };
}

// ══════════════════════════════════════════════════════════════════════════
// DIRECTORIO DE DATOS Y RUTAS DE ARCHIVOS
// ══════════════════════════════════════════════════════════════════════════
const DATA_DIR        = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const SUBMISSIONS_FILE  = path.join(DATA_DIR, "submissions.json");
const QUESTIONS_FILE    = path.join(DATA_DIR, "custom_questions.json");
const INSTITUTIONS_FILE = path.join(DATA_DIR, "institutions.json");

// ══════════════════════════════════════════════════════════════════════════
// HELPERS JSON SEGUROS
// ══════════════════════════════════════════════════════════════════════════
function readJSONFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as T;
    }
  } catch (error) {
    console.error(`[readJSONFile] Archivo dañado o ilegible: ${filePath}`, error);
    // Crear respaldo antes de perder el archivo corrupto
    const backup = filePath + ".bak." + Date.now();
    try { fs.copyFileSync(filePath, backup); } catch {}
    console.warn(`[readJSONFile] Respaldo creado en: ${backup}`);
  }
  return defaultValue;
}

function writeJSONFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`[writeJSONFile] Error al escribir: ${filePath}`, error);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ESTADO EN MEMORIA
// ══════════════════════════════════════════════════════════════════════════
let customQuestions: CustomQuestion[] = readJSONFile<CustomQuestion[]>(QUESTIONS_FILE, []);
let submissions: SurveySubmission[]   = readJSONFile<SurveySubmission[]>(SUBMISSIONS_FILE, []);
let institutions: Sede[]              = readJSONFile<Sede[]>(INSTITUTIONS_FILE, []);

if (institutions.length === 0) {
  institutions = INITIAL_INSTITUTIONS;
  writeJSONFile(INSTITUTIONS_FILE, institutions);
}

// ══════════════════════════════════════════════════════════════════════════
// MIDDLEWARES GLOBALES
// ══════════════════════════════════════════════════════════════════════════
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ══════════════════════════════════════════════════════════════════════════
// RUTAS DE AUTENTICACIÓN
// ══════════════════════════════════════════════════════════════════════════
app.post("/api/auth/login", rateLimit(10, 60_000), (req, res) => {
  const { password } = req.body as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("[auth] ADMIN_PASSWORD no está definido en las variables de entorno.");
    return res.status(500).json({ error: "El servidor no está configurado correctamente. Contacte al administrador del sistema." });
  }
  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }

  const token = crypto.randomUUID();
  adminSessions.set(token, Date.now() + SESSION_DURATION);
  res.json({ token });
});

app.post("/api/auth/logout", (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    adminSessions.delete(auth.slice(7));
  }
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
// RUTAS DE INSTITUCIONES
// ══════════════════════════════════════════════════════════════════════════

// Pública: búsqueda por código DANE (usada por el login del rector)
app.get("/api/institutions/:codigo", (req, res) => {
  const { codigo } = req.params;
  const filtered = institutions.filter(
    (i) => i.codigoEstablecimiento === codigo || i.codigoSede === codigo
  );
  res.json(filtered);
});

// Admin: retorna solo el conteo para evitar enviar miles de registros al cliente
app.get("/api/institutions", requireAdmin, (_req, res) => {
  res.json({ count: institutions.length });
});

// Admin: importar desde Excel procesado en el cliente
app.post("/api/institutions/import", requireAdmin, (req, res) => {
  try {
    const data = req.body as Sede[];
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Formato de datos inválido. Debe ser una lista de sedes." });
    }
    const sample   = data[0];
    const required = ["municipio", "codigoEstablecimiento", "nombreEstablecimiento", "codigoSede", "nombreSede"];
    const missing  = required.filter((k) => !(k in sample));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Las columnas no coinciden. Faltan: ${missing.join(", ")}` });
    }

    institutions = data.map((item) => ({
      municipio:                String(item.municipio || "").trim().toUpperCase(),
      codigoEstablecimiento:    String(item.codigoEstablecimiento || "").trim(),
      nombreEstablecimiento:    String(item.nombreEstablecimiento || "").trim().toUpperCase(),
      establecimientoPrincipal: String(item.establecimientoPrincipal || "NO").trim().toUpperCase(),
      codigoSede:               String(item.codigoSede || "").trim(),
      nombreSede:               String(item.nombreSede || "").trim().toUpperCase(),
      zona:                     String(item.zona || "RURAL").trim().toUpperCase(),
    }));

    writeJSONFile(INSTITUTIONS_FILE, institutions);
    res.json({ success: true, count: institutions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error al importar los datos." });
  }
});

// Admin: restaurar base de datos al estado inicial
app.post("/api/institutions/reset", requireAdmin, (_req, res) => {
  institutions = INITIAL_INSTITUTIONS;
  writeJSONFile(INSTITUTIONS_FILE, institutions);
  res.json({ success: true, count: institutions.length });
});

// ══════════════════════════════════════════════════════════════════════════
// RUTAS DE PREGUNTAS ADICIONALES
// ══════════════════════════════════════════════════════════════════════════

// Pública: el formulario del rector necesita ver las preguntas activas
app.get("/api/questions", (_req, res) => {
  res.json(customQuestions);
});

// Admin: crear nueva pregunta
app.post("/api/questions", requireAdmin, (req, res) => {
  try {
    const { pregunta, tipo, categoria, opciones, requerida } = req.body;
    if (!pregunta || !tipo || !categoria) {
      return res.status(400).json({ error: "Los campos 'pregunta', 'tipo' y 'categoria' son obligatorios." });
    }
    const newQuestion: CustomQuestion = {
      id:        "q_" + Date.now().toString(36),
      pregunta:  String(pregunta).trim(),
      tipo,
      categoria,
      opciones:  opciones
        ? String(opciones).split(",").map((o: string) => o.trim()).filter(Boolean)
        : undefined,
      requerida: !!requerida,
      createdAt: new Date().toISOString(),
    };
    customQuestions.push(newQuestion);
    writeJSONFile(QUESTIONS_FILE, customQuestions);
    res.status(201).json(newQuestion);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: eliminar pregunta por ID
app.delete("/api/questions/:id", requireAdmin, (req, res) => {
  const { id }    = req.params;
  const before    = customQuestions.length;
  customQuestions = customQuestions.filter((q) => q.id !== id);
  if (customQuestions.length === before) {
    return res.status(404).json({ error: "Pregunta no encontrada." });
  }
  writeJSONFile(QUESTIONS_FILE, customQuestions);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
// RUTAS DE ENCUESTAS
// IMPORTANTE: /export/csv debe declararse ANTES de /:id para evitar
// que Express lo interprete como un ID con valor "export".
// ══════════════════════════════════════════════════════════════════════════

// Admin: listar todas las encuestas
app.get("/api/surveys", requireAdmin, (_req, res) => {
  res.json(submissions);
});

// Admin: exportar encuestas a CSV (debe ir ANTES que DELETE /:id)
app.get("/api/surveys/export/csv", requireAdmin, (_req, res) => {
  try {
    const baseHeaders = [
      "ID_ENCUESTA", "FECHA_ENVIO", "MUNICIPIO",
      "CODIGO_ESTABLECIMIENTO", "NOMBRE_ESTABLECIMIENTO",
      "CODIGO_SEDE", "NOMBRE_SEDE", "ZONA",
      "NOMBRE_RECTOR", "CARGO_RECTOR", "TELEFONO_RECTOR", "CORREO_RECTOR",
      "CANT_TABLETS_BUEN_ESTADO", "CANT_PORTATILES_BUEN_ESTADO",
      "CANT_ESCRITORIO_BUEN_ESTADO", "CANT_SMART_TV_BUEN_ESTADO",
      "CANT_PANTALLAS_INTERACTIVAS_BUEN_ESTADO", "CANT_PROYECTORES_BUEN_ESTADO",
      "CANT_OTROS_BUEN_ESTADO", "DESCRIPCION_OTROS_BUEN_ESTADO",
      "CANT_TABLETS_MAL_ESTADO", "CANT_PORTATILES_MAL_ESTADO",
      "CANT_ESCRITORIO_MAL_ESTADO", "CANT_SMART_TV_MAL_ESTADO",
      "CANT_PANTALLAS_INTERACTIVAS_MAL_ESTADO", "CANT_PROYECTORES_MAL_ESTADO",
      "CANT_OTROS_MAL_ESTADO", "DESCRIPCION_OTROS_MAL_ESTADO",
      "ORIGEN_ADQUISICION", "DETALLES_ORIGEN_OTRO",
    ];

    const sedeQuestions   = customQuestions.filter((q) => q.categoria === "sede");
    const globalQuestions = customQuestions.filter((q) => q.categoria === "global");
    const customHeaders   = [
      ...sedeQuestions.map((q)   => `PREG_SEDE_${q.pregunta.toUpperCase().replace(/[^A-Z0-9]/g, "_").substring(0, 30)}`),
      ...globalQuestions.map((q) => `PREG_GLOBAL_${q.pregunta.toUpperCase().replace(/[^A-Z0-9]/g, "_").substring(0, 30)}`),
    ];
    const fullHeaders = [...baseHeaders, ...customHeaders];

    const field = (val: unknown): string => {
      if (val === undefined || val === null) return "";
      const str = String(val).replace(/"/g, '""');
      return `${str}`;
    };

    const rows = [fullHeaders.map(field).join(";")];

    for (const sub of submissions) {
      for (const sedeRes of sub.respuestasSedes) {
        const rowData: unknown[] = [
          sub.id, sub.fecha, sub.municipio,
          sub.codigoEstablecimiento, sub.nombreEstablecimiento,
          sedeRes.codigoSede, sedeRes.nombreSede, sedeRes.zona,
          sub.rector.nombre, sub.rector.cargo, sub.rector.telefono, sub.rector.correo,
          sedeRes.dispositivos?.tablets              || 0,
          sedeRes.dispositivos?.portatiles           || 0,
          sedeRes.dispositivos?.escritorio           || 0,
          sedeRes.dispositivos?.smartTv              || 0,
          sedeRes.dispositivos?.pantallasInteractivas|| 0,
          sedeRes.dispositivos?.proyectores          || 0,
          sedeRes.dispositivos?.otrosCantidad        || 0,
          sedeRes.dispositivos?.otrosDescripcion     || "",
          sedeRes.dispositivosMalEstado?.tablets              || 0,
          sedeRes.dispositivosMalEstado?.portatiles           || 0,
          sedeRes.dispositivosMalEstado?.escritorio           || 0,
          sedeRes.dispositivosMalEstado?.smartTv              || 0,
          sedeRes.dispositivosMalEstado?.pantallasInteractivas|| 0,
          sedeRes.dispositivosMalEstado?.proyectores          || 0,
          sedeRes.dispositivosMalEstado?.otrosCantidad        || 0,
          sedeRes.dispositivosMalEstado?.otrosDescripcion     || "",
          (sedeRes.origenAdquisicion || []).join(" | "),
          sedeRes.origenOtroDetalle || "",
        ];
        for (const q of sedeQuestions) {
          rowData.push((sedeRes.respuestasPreguntasAdicionales || {})[q.id] || "");
        }
        for (const q of globalQuestions) {
          rowData.push((sub.respuestasGlobales || {})[q.id] || "");
        }
        rows.push(rowData.map(field).join(";"));
      }
    }

    const csv = "\ufeff" + rows.join("\n"); // BOM para compatibilidad con Excel
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=Encuestas_Antioquia_Tecnologia.csv");
    res.status(200).send(csv);
  } catch (err: any) {
    res.status(500).json({ error: "Fallo al exportar CSV: " + err.message });
  }
});

// Pública (con rate limit): enviar encuesta desde el formulario del rector
app.post("/api/surveys", rateLimit(5, 60_000), (req, res) => {
  try {
    const survey = req.body as SurveySubmission;
    if (!survey.rector || !survey.codigoEstablecimiento || !survey.respuestasSedes) {
      return res.status(400).json({ error: "Datos de encuesta incompletos." });
    }
    const newSubmission: SurveySubmission = {
      ...survey,
      id:    "sub_" + Date.now().toString(36) + "_" + crypto.randomUUID().slice(0, 6),
      fecha: new Date().toISOString(),
    };
    submissions.push(newSubmission);
    writeJSONFile(SUBMISSIONS_FILE, submissions);
    res.status(201).json(newSubmission);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: eliminar una encuesta por ID
app.delete("/api/surveys/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const before = submissions.length;
  submissions  = submissions.filter((s) => s.id !== id);
  if (submissions.length === before) {
    return res.status(404).json({ error: "Encuesta no encontrada." });
  }
  writeJSONFile(SUBMISSIONS_FILE, submissions);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
// VITE / ARCHIVOS ESTÁTICOS
// ══════════════════════════════════════════════════════════════════════════
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  });
}

startServer();
