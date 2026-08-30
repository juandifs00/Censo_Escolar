import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { INITIAL_INSTITUTIONS } from "./src/data/initialInstitutions.js";
import { Sede, SurveySubmission, CustomQuestion } from "./src/types.js";

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

// ── Sistema de sesiones de administrador ─────────────────────────────────
const adminSessions = new Map<string, number>();
const SESSION_DURATION = 8 * 60 * 60 * 1000;

app.post("/api/auth/login", (req, res) => {
  const { password } = req.body as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("[auth] ADMIN_PASSWORD no definido en variables de entorno.");
    return res
      .status(500)
      .json({ error: "El servidor no está configurado correctamente." });
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

// Conteo total de sedes para el panel de administración
app.get("/api/institutions", (_req, res) => {
  res.json({ count: institutions.length });
});

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

// Progreso del censo: establecimientos respondidos vs pendientes
app.get("/api/progress", (_req, res) => {
  // Construir mapa: codigoEstablecimiento → total de sedes que tiene
  const sedesPorEst = new Map<string, number>();
  for (const inst of institutions) {
    sedesPorEst.set(
      inst.codigoEstablecimiento,
      (sedesPorEst.get(inst.codigoEstablecimiento) || 0) + 1,
    );
  }

  // Para cada establecimiento con submissions, contar cuántas sedes únicas reportó
  const sedesReporPorEst = new Map<string, number>();
  for (const sub of submissions) {
    const cod = sub.codigoEstablecimiento;
    const yaReportadas = sedesReporPorEst.get(cod) || 0;
    // Contar sedes únicas (por si hay duplicados de envíos)
    const sedesEnEsteEnvio = new Set(
      sub.respuestasSedes.map((s) => s.codigoSede),
    ).size;
    sedesReporPorEst.set(cod, Math.max(yaReportadas, sedesEnEsteEnvio));
  }

  let completos = 0; // todas sus sedes respondidas
  let parciales = 0; // al menos una sede, pero no todas
  let pendientes = 0; // ninguna sede respondida

  for (const [cod, totalSedes] of sedesPorEst) {
    const reportadas = sedesReporPorEst.get(cod) || 0;
    if (reportadas === 0) pendientes++;
    else if (reportadas >= totalSedes) completos++;
    else parciales++;
  }

  const totalEst = sedesPorEst.size;
  const respondidos = completos + parciales; // tienen al menos algo
  // Contar sedes únicas reportadas (sin duplicar por múltiples submissions)
  const sedesUnicas = new Set<string>();
  for (const sub of submissions) {
    for (const sede of sub.respuestasSedes) {
      sedesUnicas.add(`${sub.codigoEstablecimiento}__${sede.codigoSede}`);
    }
  }
  const sedesResp = sedesUnicas.size;

  res.json({
    establecimientos: {
      total: totalEst,
      completos,
      parciales,
      pendientes,
      respondidos,
      porcentaje: totalEst > 0 ? Math.round((completos / totalEst) * 100) : 0,
    },
    sedes: {
      total: institutions.length,
      respondidas: sedesResp,
      pendientes: institutions.length - sedesResp,
      porcentaje:
        institutions.length > 0
          ? Math.round((sedesResp / institutions.length) * 100)
          : 0,
    },
  });
});

// Reporte de cobertura: qué instituciones han respondido, de forma parcial o no han respondido
app.get("/api/progress/report", async (_req, res) => {
  try {
    // Construir mapa de sedes esperadas por establecimiento
    const estMap = new Map<
      string,
      {
        nombre: string;
        municipio: string;
        sedes: Set<string>;
      }
    >();
    for (const inst of institutions) {
      if (!estMap.has(inst.codigoEstablecimiento)) {
        estMap.set(inst.codigoEstablecimiento, {
          nombre: inst.nombreEstablecimiento,
          municipio: inst.municipio,
          sedes: new Set(),
        });
      }
      estMap.get(inst.codigoEstablecimiento)!.sedes.add(inst.codigoSede);
    }

    // Construir mapa de sedes ya respondidas por establecimiento
    const respMap = new Map<
      string,
      {
        sedes: Set<string>;
        fecha: string;
        rector: string;
      }
    >();
    for (const sub of submissions) {
      if (!respMap.has(sub.codigoEstablecimiento)) {
        respMap.set(sub.codigoEstablecimiento, {
          sedes: new Set(),
          fecha: sub.fecha,
          rector: sub.rector.nombre,
        });
      }
      const entry = respMap.get(sub.codigoEstablecimiento)!;
      sub.respuestasSedes.forEach((s) => entry.sedes.add(s.codigoSede));
      if (sub.fecha > entry.fecha) {
        entry.fecha = sub.fecha;
        entry.rector = sub.rector.nombre;
      }
    }

    // Construir filas del reporte
    const ORDEN_ESTADO: Record<string, number> = {
      PENDIENTE: 0,
      PARCIAL: 1,
      COMPLETO: 2,
    };

    const rows = [];
    for (const [cod, est] of estMap) {
      const resp = respMap.get(cod);
      const totalSedes = est.sedes.size;
      const sedesResp = resp ? resp.sedes.size : 0;
      const sedesFalt = Math.max(0, totalSedes - sedesResp);
      const estado =
        sedesResp === 0
          ? "PENDIENTE"
          : sedesResp >= totalSedes
            ? "COMPLETO"
            : "PARCIAL";

      // Sedes que faltan (códigos)
      const codigosFaltantes = resp
        ? [...est.sedes].filter((s) => !resp.sedes.has(s)).join(", ")
        : [...est.sedes].join(", ");

      rows.push({
        ESTADO: estado,
        MUNICIPIO: est.municipio,
        CODIGO_ESTABLECIMIENTO: cod,
        NOMBRE_ESTABLECIMIENTO: est.nombre,
        TOTAL_SEDES: totalSedes,
        SEDES_RESPONDIDAS: sedesResp,
        SEDES_FALTANTES: sedesFalt,
        "COBERTURA_%":
          totalSedes > 0 ? Math.round((sedesResp / totalSedes) * 100) : 0,
        FECHA_ULTIMO_ENVIO: resp
          ? new Date(resp.fecha).toLocaleString("es-CO", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
        RECTOR_RESPONSABLE: resp ? resp.rector : "—",
        CODIGOS_SEDES_FALTANTES: codigosFaltantes,
      });
    }

    // Ordenar: Pendientes → Parciales → Completos; dentro de cada grupo por municipio
    rows.sort(
      (a, b) =>
        ORDEN_ESTADO[a.ESTADO] - ORDEN_ESTADO[b.ESTADO] ||
        a.MUNICIPIO.localeCompare(b.MUNICIPIO),
    );

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cobertura Censo");

    ws["!cols"] = [
      { wch: 11 }, // ESTADO
      { wch: 15 }, // MUNICIPIO
      { wch: 23 }, // CODIGO_ESTABLECIMIENTO
      { wch: 46 }, // NOMBRE_ESTABLECIMIENTO
      { wch: 13 }, // TOTAL_SEDES
      { wch: 18 }, // SEDES_RESPONDIDAS
      { wch: 16 }, // SEDES_FALTANTES
      { wch: 12 }, // COBERTURA_%
      { wch: 20 }, // FECHA_ULTIMO_ENVIO
      { wch: 32 }, // RECTOR_RESPONSABLE
      { wch: 60 }, // CODIGOS_SEDES_FALTANTES
    ];

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Reporte_Cobertura_Censo.xlsx",
    );
    res.status(200).send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ENCUESTAS ─────────────────────────────────────────────────────────────

app.get("/api/surveys", (_req, res) => res.json(submissions));

// FASE 2: datos completos de encuesta existente para pre-poblar el formulario
app.get("/api/surveys/data/:codigo", (req, res) => {
  const todas = submissions.filter(
    (s) => s.codigoEstablecimiento === req.params.codigo,
  );
  if (todas.length === 0) return res.json({ exists: false });

  // Construir una submission consolidada: la más reciente gana por sede
  const sedesMap = new Map<string, any>();
  let globalAnswers: Record<string, string> = {};

  // Ordenar de más antigua a más reciente para que la más reciente sobreescriba
  const ordenadas = [...todas].sort((a, b) => a.fecha.localeCompare(b.fecha));

  for (const sub of ordenadas) {
    for (const sede of sub.respuestasSedes) {
      sedesMap.set(sede.codigoSede, sede);
    }
    globalAnswers = { ...globalAnswers, ...(sub.respuestasGlobales || {}) };
  }

  const masReciente = ordenadas[ordenadas.length - 1];

  res.json({
    exists: true,
    submission: {
      ...masReciente,
      respuestasSedes: Array.from(sedesMap.values()),
      respuestasGlobales: globalAnswers,
    },
  });
});

// FASE 1: endpoint de estado (qué sedes ya tienen datos)
app.get("/api/surveys/status/:codigo", (req, res) => {
  // Buscar TODAS las submissions del establecimiento, no solo la primera
  const todas = submissions.filter(
    (s) => s.codigoEstablecimiento === req.params.codigo,
  );
  if (todas.length === 0) return res.json({ exists: false, sedesConDatos: [] });

  // Unión de todas las sedes reportadas en cualquier submission
  const sedesMap = new Map<string, string>(); // codigoSede → ultimaMod
  for (const sub of todas) {
    const mod = (sub as any).ultimaModificacion || sub.fecha;
    for (const s of sub.respuestasSedes) {
      // Si la sede ya está, quedarse con la fecha más reciente
      if (
        !sedesMap.has(s.codigoSede) ||
        mod > (sedesMap.get(s.codigoSede) ?? "")
      ) {
        sedesMap.set(s.codigoSede, mod);
      }
    }
  }

  // Tomar el rector del envío más reciente
  const masReciente = todas.reduce((a, b) => (a.fecha > b.fecha ? a : b));

  res.json({
    exists: true,
    rector: masReciente.rector.nombre,
    ultimaModificacion: masReciente.fecha,
    sedesConDatos: [...sedesMap.entries()].map(
      ([codigoSede, ultimaModificacion]) => ({
        codigoSede,
        ultimaModificacion,
      }),
    ),
  });
});

// Export CSV — DEBE estar antes de DELETE /:id
app.get("/api/surveys/export/csv", async (_req, res) => {
  try {
    const QUESTION_ALIASES: Record<string, string[]> = {
      q_mt36953m: ["q_mrl9obm0"],
      q_mt369tkz: ["q_mrl9sd4k"],
    };
    const getAnswer = (dic: Record<string, string>, qId: string): string => {
      if (dic?.[qId]) return dic[qId];
      for (const alias of QUESTION_ALIASES[qId] || []) {
        if (dic?.[alias]) return dic[alias];
      }
      return "";
    };

    const sq = customQuestions.filter((q) => q.categoria === "sede");
    const gq = customQuestions.filter((q) => q.categoria === "global");

    const headers = [
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

    const dataRows: any[][] = [];
    for (const sub of submissions) {
      for (const sr of sub.respuestasSedes) {
        const row: any[] = [
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
          ...sq.map((q) =>
            getAnswer(sr.respuestasPreguntasAdicionales || {}, q.id),
          ),
          ...gq.map((q) => getAnswer(sub.respuestasGlobales || {}, q.id)),
        ];
        dataRows.push(row);
      }
    }

    // Importar xlsx (ya está instalado como dependencia)
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Ancho de columnas automático basado en el contenido
    const colWidths = headers.map((h, colIdx) => {
      const maxLen = Math.max(
        h.length,
        ...dataRows.map((r) => String(r[colIdx] ?? "").length).slice(0, 100),
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
    });
    ws["!cols"] = colWidths;

    // Congelar la primera fila (encabezados siempre visibles)
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, "Censo 2026");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Encuestas_Antioquia_Tecnologia.xlsx",
    );
    res.status(200).send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/surveys", (req, res) => {
  try {
    const survey = req.body as SurveySubmission;
    if (
      !survey.rector ||
      !survey.codigoEstablecimiento ||
      !survey.respuestasSedes
    ) {
      return res.status(400).json({ error: "Datos de encuesta incompletos." });
    }
    const newSubmission: SurveySubmission = {
      ...survey,
      id:
        "sub_" +
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).substring(2, 6),
      fecha: new Date().toISOString(),
    };
    submissions.push(newSubmission);
    writeJSONFile(SUBMISSIONS_FILE, submissions);
    res.status(201).json(newSubmission);
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
