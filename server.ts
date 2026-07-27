import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { INITIAL_INSTITUTIONS } from "./src/data/initialInstitutions.js";
import { Sede, SurveySubmission, CustomQuestion } from "./src/types.js";

const app = express();
const PORT = 3000;

// Setup directories for persistent storage
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const QUESTIONS_FILE = path.join(DATA_DIR, "custom_questions.json");
const INSTITUTIONS_FILE = path.join(DATA_DIR, "institutions.json");

// Helper functions for reading and writing files safely
function readJSONFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as T;
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
  }
  return defaultValue;
}

function writeJSONFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
  }
}

// Initialize persistent state
let customQuestions: CustomQuestion[] = readJSONFile<CustomQuestion[]>(QUESTIONS_FILE, []);
let submissions: SurveySubmission[] = readJSONFile<SurveySubmission[]>(SUBMISSIONS_FILE, []);

// Load institutions database, fall back to INITIAL_INSTITUTIONS if empty
let institutions: Sede[] = readJSONFile<Sede[]>(INSTITUTIONS_FILE, []);
if (institutions.length === 0) {
  institutions = INITIAL_INSTITUTIONS;
  writeJSONFile(INSTITUTIONS_FILE, institutions);
}

// Express middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- API ROUTES ---

// 1. Get all institutions or search by code
app.get("/api/institutions", (req, res) => {
  res.json(institutions);
});

app.get("/api/institutions/:codigo", (req, res) => {
  const { codigo } = req.params;
  const filtered = institutions.filter(
    (inst) => inst.codigoEstablecimiento === codigo || inst.codigoSede === codigo
  );
  res.json(filtered);
});

// 2. Import base database from Excel/CSV parsing on the client
app.post("/api/institutions/import", (req, res) => {
  try {
    const data = req.body as Sede[];
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Formato de datos inválido. Debe ser una lista de sedes." });
    }

    // Basic column validation
    const sample = data[0];
    const requiredKeys = ["municipio", "codigoEstablecimiento", "nombreEstablecimiento", "codigoSede", "nombreSede"];
    const missingKeys = requiredKeys.filter((key) => !(key in sample));

    if (missingKeys.length > 0) {
      return res.status(400).json({
        error: `Las columnas del archivo no coinciden. Faltan claves: ${missingKeys.join(", ")}`,
      });
    }

    institutions = data.map((item) => ({
      municipio: String(item.municipio || "").trim().toUpperCase(),
      codigoEstablecimiento: String(item.codigoEstablecimiento || "").trim(),
      nombreEstablecimiento: String(item.nombreEstablecimiento || "").trim().toUpperCase(),
      establecimientoPrincipal: String(item.establecimientoPrincipal || "NO").trim().toUpperCase(),
      codigoSede: String(item.codigoSede || "").trim(),
      nombreSede: String(item.nombreSede || "").trim().toUpperCase(),
      zona: String(item.zona || "RURAL").trim().toUpperCase(),
    }));

    writeJSONFile(INSTITUTIONS_FILE, institutions);
    res.json({ success: true, count: institutions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error al importar los datos." });
  }
});

// 3. Reset institutions database to the default initial ones
app.post("/api/institutions/reset", (req, res) => {
  institutions = INITIAL_INSTITUTIONS;
  writeJSONFile(INSTITUTIONS_FILE, institutions);
  res.json({ success: true, count: institutions.length });
});

// 4. Questions endpoints
app.get("/api/questions", (req, res) => {
  res.json(customQuestions);
});

app.post("/api/questions", (req, res) => {
  try {
    const { pregunta, tipo, categoria, opciones, requerida } = req.body;
    if (!pregunta || !tipo || !categoria) {
      return res.status(400).json({ error: "Campos 'pregunta', 'tipo' y 'categoria' son obligatorios." });
    }

    const newQuestion: CustomQuestion = {
      id: "q_" + Date.now().toString(36),
      pregunta: String(pregunta).trim(),
      tipo,
      categoria,
      opciones: opciones ? String(opciones).split(",").map((o) => o.trim()).filter(Boolean) : undefined,
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

app.delete("/api/questions/:id", (req, res) => {
  const { id } = req.params;
  const initialLength = customQuestions.length;
  customQuestions = customQuestions.filter((q) => q.id !== id);
  if (customQuestions.length === initialLength) {
    return res.status(404).json({ error: "Pregunta no encontrada." });
  }
  writeJSONFile(QUESTIONS_FILE, customQuestions);
  res.json({ success: true });
});

// 5. Surveys endpoints
app.get("/api/surveys", (req, res) => {
  res.json(submissions);
});

app.post("/api/surveys", (req, res) => {
  try {
    const survey = req.body as SurveySubmission;
    if (!survey.rector || !survey.codigoEstablecimiento || !survey.respuestasSedes) {
      return res.status(400).json({ error: "Datos de encuesta incompletos." });
    }

    // Add unique submission ID and safe date
    const newSubmission: SurveySubmission = {
      ...survey,
      id: "sub_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6),
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
  const { id } = req.params;
  const initialLength = submissions.length;
  submissions = submissions.filter((s) => s.id !== id);
  if (submissions.length === initialLength) {
    return res.status(404).json({ error: "Encuesta no encontrada." });
  }
  writeJSONFile(SUBMISSIONS_FILE, submissions);
  res.json({ success: true });
});

// 6. CSV Generation/Download Endpoint
app.get("/api/surveys/export/csv", (req, res) => {
  try {
    // Generate headers
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
      "DETALLES_ORIGEN_OTRO"
    ];

    // Gather all custom questions (both sede and global)
    const sedeQuestions = customQuestions.filter((q) => q.categoria === "sede");
    const globalQuestions = customQuestions.filter((q) => q.categoria === "global");

    const customHeaders = [
      ...sedeQuestions.map((q) => `PREG_SEDE_${q.pregunta.toUpperCase().replace(/[^A-Z0-9]/g, "_").substring(0, 30)}`),
      ...globalQuestions.map((q) => `PREG_GLOBAL_${q.pregunta.toUpperCase().replace(/[^A-Z0-9]/g, "_").substring(0, 30)}`)
    ];

    const fullHeaders = [...baseHeaders, ...customHeaders];

    // Format fields with quotes to prevent CSV injection and handle commas/newlines
    const formatCSVField = (val: any) => {
      if (val === undefined || val === null) return "";
      let str = String(val).replace(/"/g, '""'); // Escape inner quotes
      if (str.includes(",") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    };

    const csvRows = [fullHeaders.join(",")];

    // Build rows (one row per educational branch (Sede) response)
    for (const sub of submissions) {
      for (const sedeRes of sub.respuestasSedes) {
        const rowData = [
          sub.id,
          sub.fecha,
          sub.municipio,
          sub.codigoEstablecimiento,
          sub.nombreEstablecimiento,
          sedeRes.codigoSede,
          sedeRes.nombreSede,
          sedeRes.zona,
          sub.rector.nombre,
          sub.rector.cargo,
          sub.rector.telefono,
          sedeRes.dispositivos?.tablets || 0,
          sedeRes.dispositivos?.portatiles || 0,
          sedeRes.dispositivos?.escritorio || 0,
          sedeRes.dispositivos?.smartTv || 0,
          sedeRes.dispositivos?.pantallasInteractivas || 0,
          sedeRes.dispositivos?.proyectores || 0,
          sedeRes.dispositivos?.otrosCantidad || 0,
          sedeRes.dispositivos?.otrosDescripcion || "",
          sedeRes.dispositivosMalEstado?.tablets || 0,
          sedeRes.dispositivosMalEstado?.portatiles || 0,
          sedeRes.dispositivosMalEstado?.escritorio || 0,
          sedeRes.dispositivosMalEstado?.smartTv || 0,
          sedeRes.dispositivosMalEstado?.pantallasInteractivas || 0,
          sedeRes.dispositivosMalEstado?.proyectores || 0,
          sedeRes.dispositivosMalEstado?.otrosCantidad || 0,
          sedeRes.dispositivosMalEstado?.otrosDescripcion || "",
          (sedeRes.origenAdquisicion || []).join("; "),
          sedeRes.origenOtroDetalle || "",
        ];

        // Sede-specific custom questions answers
        for (const q of sedeQuestions) {
          const ans = (sedeRes.respuestasPreguntasAdicionales || {})[q.id] || "";
          rowData.push(ans);
        }

        // Global custom questions answers
        for (const q of globalQuestions) {
          const ans = (sub.respuestasGlobales || {})[q.id] || "";
          rowData.push(ans);
        }

        csvRows.push(rowData.map(formatCSVField).join(","));
      }
    }

    const csvContent = "\ufeff" + csvRows.join("\n"); // Prepend UTF-8 BOM for Excel compatibility

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=Encuestas_Antioquia_Tecnologia.csv");
    res.status(200).send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: "Fallo al exportar CSV: " + err.message });
  }
});

// --- VITE MIDDLEWARE SETUP ---

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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
