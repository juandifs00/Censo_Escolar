import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { INITIAL_INSTITUTIONS } from "./src/data/initialInstitutions.js";
import {
  Sede,
  SurveySubmission,
  CustomQuestion,
  DeviceSedeResponse,
} from "./src/types.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const QUESTIONS_FILE = path.join(DATA_DIR, "custom_questions.json");
const INSTITUTIONS_FILE = path.join(DATA_DIR, "institutions.json");

function readJSONFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
    }
  } catch (error) {
    console.error(`[readJSONFile] Archivo dañado: ${filePath}`, error);
    const backup = filePath + ".bak." + Date.now();
    try {
      fs.copyFileSync(filePath, backup);
    } catch {}
  }
  return defaultValue;
}

function writeJSONFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`[writeJSONFile] Error: ${filePath}`, error);
  }
}

let customQuestions: CustomQuestion[] = readJSONFile<CustomQuestion[]>(
  QUESTIONS_FILE,
  [],
);
let submissions: SurveySubmission[] = readJSONFile<SurveySubmission[]>(
  SUBMISSIONS_FILE,
  [],
);
let institutions: Sede[] = readJSONFile<Sede[]>(INSTITUTIONS_FILE, []);
if (institutions.length === 0) {
  institutions = INITIAL_INSTITUTIONS;
  writeJSONFile(INSTITUTIONS_FILE, institutions);
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Modo mantenimiento — activa con MAINTENANCE_MODE=true en Railway Variables
app.use((req, res, next) => {
  if (
    process.env.MAINTENANCE_MODE === "true" &&
    req.method === "POST" &&
    req.path === "/api/surveys"
  ) {
    return res.status(503).json({
      error:
        "El sistema está temporalmente en mantenimiento. Por favor intente más tarde.",
    });
  }
  next();
});

// ── INSTITUCIONES ─────────────────────────────────────────────────────────

// FASE 1: siempre devuelve TODAS las sedes del establecimiento principal,
// aunque el codigo ingresado sea de una sede secundaria.
app.get("/api/institutions/:codigo", (req, res) => {
  const { codigo } = req.params;
  const match = institutions.find(
    (i) => i.codigoEstablecimiento === codigo || i.codigoSede === codigo,
  );
  if (!match) {
    return res.json({
      sedes: [],
      codigoEstablecimientoPrincipal: codigo,
      nombreEstablecimiento: "",
      municipio: "",
      busquedaEsSecundaria: false,
    });
  }
  const codigoPrincipal = match.codigoEstablecimiento;
  const allSedes = institutions.filter(
    (i) => i.codigoEstablecimiento === codigoPrincipal,
  );
  const enteredAsSecSede =
    match.codigoSede === codigo && match.codigoEstablecimiento !== codigo;
  const busquedaEsSecundaria =
    enteredAsSecSede && match.establecimientoPrincipal !== "SI";
  res.json({
    sedes: allSedes,
    codigoEstablecimientoPrincipal: codigoPrincipal,
    nombreEstablecimiento: match.nombreEstablecimiento,
    municipio: match.municipio,
    busquedaEsSecundaria,
    codigoPrincipalSugerido: busquedaEsSecundaria ? codigoPrincipal : undefined,
  });
});

app.post("/api/institutions/import", (req, res) => {
  try {
    const data = req.body as Sede[];
    if (!Array.isArray(data) || data.length === 0)
      return res.status(400).json({ error: "Formato de datos inválido." });
    const required = [
      "municipio",
      "codigoEstablecimiento",
      "nombreEstablecimiento",
      "codigoSede",
      "nombreSede",
    ];
    const missing = required.filter((k) => !(k in data[0]));
    if (missing.length > 0)
      return res
        .status(400)
        .json({ error: `Columnas faltantes: ${missing.join(", ")}` });
    institutions = data.map((item) => ({
      municipio: String(item.municipio || "")
        .trim()
        .toUpperCase(),
      codigoEstablecimiento: String(item.codigoEstablecimiento || "").trim(),
      nombreEstablecimiento: String(item.nombreEstablecimiento || "")
        .trim()
        .toUpperCase(),
      establecimientoPrincipal: String(item.establecimientoPrincipal || "NO")
        .trim()
        .toUpperCase(),
      codigoSede: String(item.codigoSede || "").trim(),
      nombreSede: String(item.nombreSede || "")
        .trim()
        .toUpperCase(),
      zona: String(item.zona || "RURAL")
        .trim()
        .toUpperCase(),
    }));
    writeJSONFile(INSTITUTIONS_FILE, institutions);
    res.json({ success: true, count: institutions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/institutions/reset", (_req, res) => {
  institutions = INITIAL_INSTITUTIONS;
  writeJSONFile(INSTITUTIONS_FILE, institutions);
  res.json({ success: true, count: institutions.length });
});

// ── PREGUNTAS ─────────────────────────────────────────────────────────────

app.get("/api/questions", (_req, res) => res.json(customQuestions));

app.post("/api/questions", (req, res) => {
  try {
    const { pregunta, tipo, categoria, opciones, requerida } = req.body;
    if (!pregunta || !tipo || !categoria)
      return res.status(400).json({
        error: "Campos 'pregunta', 'tipo' y 'categoria' obligatorios.",
      });
    const nq: CustomQuestion = {
      id: "q_" + Date.now().toString(36),
      pregunta: String(pregunta).trim(),
      tipo,
      categoria,
      opciones: opciones
        ? String(opciones)
            .split(",")
            .map((o: string) => o.trim())
            .filter(Boolean)
        : undefined,
      requerida: !!requerida,
      createdAt: new Date().toISOString(),
    };
    customQuestions.push(nq);
    writeJSONFile(QUESTIONS_FILE, customQuestions);
    res.status(201).json(nq);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/questions/:id", (req, res) => {
  const before = customQuestions.length;
  customQuestions = customQuestions.filter((q) => q.id !== req.params.id);
  if (customQuestions.length === before)
    return res.status(404).json({ error: "No encontrada." });
  writeJSONFile(QUESTIONS_FILE, customQuestions);
  res.json({ success: true });
});

// ── ENCUESTAS ─────────────────────────────────────────────────────────────

app.get("/api/surveys", (_req, res) => res.json(submissions));

// FASE 2: datos completos de encuesta existente para pre-poblar el formulario
app.get("/api/surveys/data/:codigo", (req, res) => {
  const existing = submissions.find(
    (s) => s.codigoEstablecimiento === req.params.codigo,
  );
  if (!existing) return res.json({ exists: false });
  res.json({ exists: true, submission: existing });
});

// FASE 1: endpoint de estado (qué sedes ya tienen datos)
app.get("/api/surveys/status/:codigo", (req, res) => {
  const existing = submissions.find(
    (s) => s.codigoEstablecimiento === req.params.codigo,
  );
  if (!existing) return res.json({ exists: false, sedesConDatos: [] });
  const ultimaMod = (existing as any).ultimaModificacion || existing.fecha;
  res.json({
    exists: true,
    rector: existing.rector.nombre,
    ultimaModificacion: ultimaMod,
    sedesConDatos: existing.respuestasSedes.map((s) => ({
      codigoSede: s.codigoSede,
      ultimaModificacion: ultimaMod,
    })),
  });
});

// Export CSV — DEBE estar antes de DELETE /:id
app.get("/api/surveys/export/csv", (_req, res) => {
  try {
    const baseHeaders = [
      "ID_ENCUESTA",
      "FECHA_ENVIO",
      "MUNICIPIO",
      "CODIGO_ESTABLECIMIENTO",
      "NOMBRE_ESTABLECIMIENTO",
      "CODIGO_SEDE",
      "NOMBRE_SEDE",
      "ZONA",
      "NOMBRE_RECTOR",
      "CARGO_RECTOR",
      "TELEFONO_RECTOR",
      "CORREO_RECTOR",
      "CANT_TABLETS_BUEN_ESTADO",
      "CANT_PORTATILES_BUEN_ESTADO",
      "CANT_ESCRITORIO_BUEN_ESTADO",
      "CANT_SMART_TV_BUEN_ESTADO",
      "CANT_PANTALLAS_INTERACTIVAS_BUEN_ESTADO",
      "CANT_PROYECTORES_BUEN_ESTADO",
      "CANT_OTROS_BUEN_ESTADO",
      "DESCRIPCION_OTROS_BUEN_ESTADO",
      "CANT_TABLETS_MAL_ESTADO",
      "CANT_PORTATILES_MAL_ESTADO",
      "CANT_ESCRITORIO_MAL_ESTADO",
      "CANT_SMART_TV_MAL_ESTADO",
      "CANT_PANTALLAS_INTERACTIVAS_MAL_ESTADO",
      "CANT_PROYECTORES_MAL_ESTADO",
      "CANT_OTROS_MAL_ESTADO",
      "DESCRIPCION_OTROS_MAL_ESTADO",
      "ORIGEN_ADQUISICION",
      "DETALLES_ORIGEN_OTRO",
    ];
    const sq = customQuestions.filter((q) => q.categoria === "sede");
    const gq = customQuestions.filter((q) => q.categoria === "global");

    // Correccion: eliminar saltos de linea y manejar comas en campos
    const field = (val: unknown): string => {
      if (val === undefined || val === null) return "";
      const str = String(val)
        .replace(/\r\n/g, " ")
        .replace(/\r/g, " ")
        .replace(/\n/g, " ")
        .trim();
      const esc = str.replace(/"/g, '""');
      return esc.includes(",") || esc.includes('"') ? `"${esc}"` : esc;
    };

    const headers = [
      ...baseHeaders,
      ...sq.map(
        (q) =>
          `PREG_SEDE_${q.pregunta
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "_")
            .substring(0, 30)}`,
      ),
      ...gq.map(
        (q) =>
          `PREG_GLOBAL_${q.pregunta
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "_")
            .substring(0, 30)}`,
      ),
    ];
    const rows = [headers.join(",")];

    for (const sub of submissions) {
      for (const sr of sub.respuestasSedes) {
        const row: unknown[] = [
          sub.id,
          sub.fecha,
          sub.municipio,
          sub.codigoEstablecimiento,
          sub.nombreEstablecimiento,
          sr.codigoSede,
          sr.nombreSede,
          sr.zona,
          sub.rector.nombre,
          sub.rector.cargo,
          sub.rector.telefono,
          (sub.rector as any).correo || "",
          sr.dispositivos?.tablets || 0,
          sr.dispositivos?.portatiles || 0,
          sr.dispositivos?.escritorio || 0,
          sr.dispositivos?.smartTv || 0,
          sr.dispositivos?.pantallasInteractivas || 0,
          sr.dispositivos?.proyectores || 0,
          sr.dispositivos?.otrosCantidad || 0,
          sr.dispositivos?.otrosDescripcion || "",
          sr.dispositivosMalEstado?.tablets || 0,
          sr.dispositivosMalEstado?.portatiles || 0,
          sr.dispositivosMalEstado?.escritorio || 0,
          sr.dispositivosMalEstado?.smartTv || 0,
          sr.dispositivosMalEstado?.pantallasInteractivas || 0,
          sr.dispositivosMalEstado?.proyectores || 0,
          sr.dispositivosMalEstado?.otrosCantidad || 0,
          sr.dispositivosMalEstado?.otrosDescripcion || "",
          (sr.origenAdquisicion || []).join("; "),
          sr.origenOtroDetalle || "",
        ];
        sq.forEach((q) =>
          row.push((sr.respuestasPreguntasAdicionales || {})[q.id] || ""),
        );
        gq.forEach((q) => row.push((sub.respuestasGlobales || {})[q.id] || ""));
        rows.push(row.map(field).join(","));
      }
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Encuestas_Antioquia_Tecnologia.csv",
    );
    res.status(200).send("\ufeff" + rows.join("\n"));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// FASE 1: merge en lugar de siempre crear nuevo registro
function sedeConDatos(s: DeviceSedeResponse): boolean {
  const d = s.dispositivos || ({} as any);
  const dm = s.dispositivosMalEstado || ({} as any);
  return (
    [
      d.tablets,
      d.portatiles,
      d.escritorio,
      d.smartTv,
      d.pantallasInteractivas,
      d.proyectores,
      d.otrosCantidad,
      dm.tablets,
      dm.portatiles,
      dm.escritorio,
      dm.smartTv,
      dm.pantallasInteractivas,
      dm.proyectores,
      dm.otrosCantidad,
    ].some((v) => (v || 0) > 0) ||
    !!(
      d.otrosDescripcion ||
      dm.otrosDescripcion ||
      (s.origenAdquisicion || []).length > 0 ||
      Object.values(s.respuestasPreguntasAdicionales || {}).some((v) => v)
    )
  );
}

app.post("/api/surveys", (req, res) => {
  try {
    const survey = req.body as SurveySubmission;
    if (
      !survey.rector ||
      !survey.codigoEstablecimiento ||
      !survey.respuestasSedes
    )
      return res.status(400).json({ error: "Datos de encuesta incompletos." });

    // Encontrar TODOS los registros del mismo establecimiento
    const indices = submissions
      .map((s, i) =>
        s.codigoEstablecimiento === survey.codigoEstablecimiento ? i : -1,
      )
      .filter((i) => i !== -1);

    if (indices.length === 0) {
      // Crear nuevo registro
      const newSub: SurveySubmission = {
        ...survey,
        id:
          "sub_" +
          Date.now().toString(36) +
          "_" +
          crypto.randomUUID().slice(0, 6),
        fecha: new Date().toISOString(),
      };
      submissions.push(newSub);
      writeJSONFile(SUBMISSIONS_FILE, submissions);
      return res.status(201).json(newSub);
    }

    // Consolidar todos los duplicados en uno solo
    const sedesMap = new Map<string, DeviceSedeResponse>();
    let globalAnswers: Record<string, string> = {};

    // Primero consolidar los existentes (el más reciente gana por sede)
    for (const idx of indices) {
      const existing = submissions[idx];
      existing.respuestasSedes.forEach((s) => sedesMap.set(s.codigoSede, s));
      globalAnswers = {
        ...globalAnswers,
        ...(existing.respuestasGlobales || {}),
      };
    }

    // Luego aplicar los datos nuevos encima
    for (const newSede of survey.respuestasSedes) {
      if (!sedeConDatos(newSede)) continue;
      sedesMap.set(newSede.codigoSede, newSede);
    }
    globalAnswers = { ...globalAnswers, ...survey.respuestasGlobales };

    // Conservar solo el primer registro y eliminar los duplicados
    const primaryIdx = indices[0];
    const merged = {
      ...submissions[primaryIdx],
      rector: survey.rector,
      respuestasSedes: Array.from(sedesMap.values()),
      respuestasGlobales: globalAnswers,
      ultimaModificacion: new Date().toISOString(),
    } as any;

    // Eliminar duplicados de atrás hacia adelante para no desplazar índices
    indices
      .slice(1)
      .reverse()
      .forEach((i) => submissions.splice(i, 1));
    submissions[primaryIdx] = merged;

    writeJSONFile(SUBMISSIONS_FILE, submissions);
    res.status(200).json(merged);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/surveys/:id", (req, res) => {
  const before = submissions.length;
  submissions = submissions.filter((s) => s.id !== req.params.id);
  if (submissions.length === before)
    return res.status(404).json({ error: "No encontrada." });
  writeJSONFile(SUBMISSIONS_FILE, submissions);
  res.json({ success: true });
});

// ── VITE / ESTÁTICOS ──────────────────────────────────────────────────────
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), "dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`✅ Servidor en http://localhost:${PORT}`),
  );
}

startServer();
