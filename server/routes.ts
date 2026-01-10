import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import { storage } from "./storage";
import { sendXmlToRndc, queryManifiestoDetails, queryTerceroDetails, queryVehiculoDetails, queryVehiculoExtraDetails } from "./rndc-service";
import { saveFormTemplate, listFormTemplates, getTemplateFields, fillFormPdfFromBase64, getDefaultQrPosition, type ManifiestoData } from "./pdf-form-service";
import QRCode from "qrcode";
import { insertRndcSubmissionSchema, loginSchema, updateUserProfileSchema, changePasswordSchema, insertTerceroSchema, insertVehiculoSchema, qrFieldConfigSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import multer from "multer";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const validationJobs = new Map<string, { 
  progress: number; 
  total: number; 
  current: string;
  completed: boolean;
  rows: any[];
}>();

const submitBatchSchema = z.object({
  submissions: z.array(z.object({
    ingresoidmanifiesto: z.string(),
    numidgps: z.string(),
    numplaca: z.string(),
    codpuntocontrol: z.string(),
    latitud: z.string(),
    longitud: z.string(),
    fechallegada: z.string(),
    horallegada: z.string(),
    fechasalida: z.string(),
    horasalida: z.string(),
    xmlRequest: z.string(),
  })),
  wsUrl: z.string().url().optional(),
});

const queryRndcSchema = z.object({
  xmlRequest: z.string(),
  wsUrl: z.string().url().optional(),
});

const cumplidoRemesaBatchSchema = z.object({
  submissions: z.array(z.object({
    consecutivoRemesa: z.string(),
    numNitEmpresa: z.string(),
    numPlaca: z.string(),
    origen: z.string().optional(),
    destino: z.string().optional(),
    fechaEntradaCargue: z.string(),
    horaEntradaCargue: z.string(),
    fechaEntradaDescargue: z.string(),
    horaEntradaDescargue: z.string(),
    cantidadCargada: z.string(),
    cantidadEntregada: z.string(),
    xmlQueryRequest: z.string().optional(),
    xmlCumplidoRequest: z.string(),
  })),
  wsUrl: z.string().url().optional(),
});

const cumplidoManifiestoBatchSchema = z.object({
  submissions: z.array(z.object({
    numManifiestoCarga: z.string(),
    numNitEmpresa: z.string(),
    numPlaca: z.string(),
    origen: z.string().optional(),
    destino: z.string().optional(),
    fechaEntregaDocumentos: z.string(),
    xmlCumplidoRequest: z.string(),
  })),
  wsUrl: z.string().url().optional(),
});

const manifiestoBatchSchema = z.object({
  submissions: z.array(z.object({
    consecutivoManifiesto: z.string(),
    numNitEmpresa: z.string(),
    numPlaca: z.string(),
    xmlRequest: z.string(),
  })),
  wsUrl: z.string().url().optional(),
});

const remesaBatchSchema = z.object({
  submissions: z.array(z.object({
    consecutivoRemesa: z.string(),
    numNitEmpresa: z.string(),
    numPlaca: z.string(),
    cantidadCargada: z.string(),
    fechaCargue: z.string(),
    horaCargue: z.string(),
    fechaDescargue: z.string(),
    horaDescargue: z.string(),
    sedeRemitente: z.string().optional(),
    sedeDestinatario: z.string().optional(),
    codMunicipioOrigen: z.string().optional(),
    codMunicipioDestino: z.string().optional(),
    tipoIdPropietario: z.string().optional(),
    numIdPropietario: z.string().optional(),
    cedula: z.string().optional(),
    valorFlete: z.number().optional(),
    xmlRequest: z.string(),
  })),
  wsUrl: z.string().url().optional(),
});

const rndcQuerySchema = z.object({
  queryType: z.string(),
  queryName: z.string(),
  numNitEmpresa: z.string().optional(),
  numIdTercero: z.string().optional(),
  xmlRequest: z.string(),
  wsUrl: z.string().url().optional(),
});

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "No autenticado" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const PgSession = connectPgSimple(session);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "rndc-connect-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Datos inválidos" });
      }

      const { username, password } = parsed.data;
      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos" });
      }

      req.session.userId = user.id;
      await storage.updateUserLastLogin(user.id);

      res.json({
        success: true,
        user: { id: user.id, username: user.username, name: user.name, email: user.email },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, message: "Error del servidor" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Error al cerrar sesión" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.json({ authenticated: false });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: { id: user.id, username: user.username, name: user.name, email: user.email },
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, name, email } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: "Usuario y contraseña requeridos" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ success: false, message: "El usuario ya existe" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name: name || null,
        email: email || null,
      });

      req.session.userId = user.id;

      res.json({
        success: true,
        user: { id: user.id, username: user.username, name: user.name, email: user.email },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ success: false, message: "Error del servidor" });
    }
  });

  app.put("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const parsed = updateUserProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Datos inválidos" });
      }

      if (parsed.data.username) {
        const existing = await storage.getUserByUsername(parsed.data.username);
        if (existing && existing.id !== req.session.userId) {
          return res.status(400).json({ success: false, message: "El usuario ya está en uso" });
        }
      }

      const user = await storage.updateUserProfile(req.session.userId!, parsed.data);
      if (!user) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }

      res.json({
        success: true,
        user: { id: user.id, username: user.username, name: user.name, email: user.email },
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ success: false, message: "Error del servidor" });
    }
  });

  app.put("/api/auth/password", requireAuth, async (req, res) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Datos inválidos" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }

      const isValid = await bcrypt.compare(parsed.data.currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Contraseña actual incorrecta" });
      }

      const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
      await storage.updateUserPassword(req.session.userId!, hashedPassword);

      res.json({ success: true, message: "Contraseña actualizada" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ success: false, message: "Error del servidor" });
    }
  });

  app.post("/api/system/restart", async (req, res) => {
    res.json({ success: true, message: "El servidor se reiniciará en 2 segundos..." });
    setTimeout(() => {
      console.log("Reiniciando servidor por solicitud del usuario...");
      process.exit(0);
    }, 2000);
  });

  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json({ success: true, stats });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al obtener estadísticas";
      res.status(500).json({ success: false, message });
    }
  });

  app.post("/api/rndc/ping", async (req, res) => {
    try {
      const { wsUrl } = req.body;
      const targetUrl = wsUrl || "http://rndcws2.mintransporte.gov.co:8080/ws";
      
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(targetUrl, { 
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const latency = Date.now() - startTime;
        const isOnline = response.ok || response.status === 405;
        
        res.json({
          success: true,
          status: isOnline ? "online" : "offline",
          latency,
          statusCode: response.status,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          res.json({ success: true, status: "timeout", latency, statusCode: 0 });
        } else {
          res.json({ success: true, status: "offline", latency, statusCode: 0 });
        }
      }
    } catch (error) {
      res.status(500).json({ success: false, status: "error", message: "Error al verificar RNDC" });
    }
  });

  app.post("/api/rndc/queries/execute", async (req, res) => {
    try {
      const parsed = rndcQuerySchema.parse(req.body);
      const { queryType, queryName, numNitEmpresa, numIdTercero, xmlRequest, wsUrl } = parsed;

      const query = await storage.createRndcQuery({
        queryType,
        queryName,
        numNitEmpresa,
        numIdTercero,
        xmlRequest,
        status: "processing",
      });

      const response = await sendXmlToRndc(xmlRequest, wsUrl);

      const updatedQuery = await storage.updateRndcQuery(query.id, {
        xmlResponse: response.rawXml,
        responseCode: response.code,
        responseMessage: response.message,
        responseData: null,
        status: response.success ? "success" : "error",
      });

      res.json({
        success: true,
        query: updatedQuery,
        response: {
          success: response.success,
          code: response.code,
          message: response.message,
          rawXml: response.rawXml,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al ejecutar consulta";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/rndc/queries", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const queryType = req.query.queryType as string | undefined;

      const queries = queryType 
        ? await storage.getRndcQueriesByType(queryType, limit)
        : await storage.getRndcQueries(limit);
      
      res.json({ success: true, queries });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener consultas" });
    }
  });

  app.get("/api/rndc/queries/:id", async (req, res) => {
    try {
      const query = await storage.getRndcQuery(req.params.id);
      if (!query) {
        return res.status(404).json({ success: false, message: "Consulta no encontrada" });
      }
      res.json({ success: true, query });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener consulta" });
    }
  });

  app.post("/api/rndc/submit-batch", async (req, res) => {
    try {
      const parsed = submitBatchSchema.parse(req.body);
      const { submissions, wsUrl } = parsed;

      const batch = await storage.createRndcBatch({
        totalRecords: submissions.length,
        successCount: 0,
        errorCount: 0,
        pendingCount: submissions.length,
        status: "processing",
      });

      const createdSubmissions = await Promise.all(
        submissions.map(sub =>
          storage.createRndcSubmission({
            batchId: batch.id,
            ...sub,
            status: "pending",
          })
        )
      );

      processSubmissionsAsync(batch.id, createdSubmissions.map(s => s.id), wsUrl);

      res.json({
        success: true,
        batchId: batch.id,
        message: `Lote creado con ${submissions.length} registros. Procesando...`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al crear lote";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/rndc/batches", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const batches = await storage.getRndcBatches(limit);
      res.json({ success: true, batches });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener lotes" });
    }
  });

  app.get("/api/rndc/batches/:id", async (req, res) => {
    try {
      const batch = await storage.getRndcBatch(req.params.id);
      if (!batch) {
        return res.status(404).json({ success: false, message: "Lote no encontrado" });
      }
      res.json({ success: true, batch });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener lote" });
    }
  });

  app.get("/api/rndc/submissions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const batchId = req.query.batchId as string | undefined;
      
      if (batchId) {
        const submissions = await storage.getRndcSubmissionsByBatch(batchId);
        res.json({ success: true, submissions });
      } else {
        const submissions = await storage.getRecentSubmissions(limit);
        res.json({ success: true, submissions });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener envíos" });
    }
  });

  app.get("/api/rndc/submission/:id", async (req, res) => {
    try {
      const submission = await storage.getRndcSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ success: false, message: "Envío no encontrado" });
      }
      res.json({ success: true, submission });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener envío" });
    }
  });

  app.get("/api/rndc/manifests/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ success: false, message: "Parámetro de búsqueda requerido" });
      }

      const manifest = await storage.searchRndcManifestByQuery(query.trim());
      if (!manifest) {
        return res.json({ success: false, message: "No se encontró el manifiesto" });
      }

      const controlPoints = await storage.getRndcControlPointsByManifest(manifest.id);
      res.json({ success: true, manifest, controlPoints });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al buscar manifiesto" });
    }
  });

  app.post("/api/rndc/submit-single", async (req, res) => {
    try {
      const { xmlRequest, wsUrl, metadata } = req.body;

      if (!xmlRequest) {
        return res.status(400).json({ success: false, message: "XML requerido" });
      }

      const batch = await storage.createRndcBatch({
        type: "control_points",
        totalRecords: 1,
        successCount: 0,
        errorCount: 0,
        pendingCount: 1,
        status: "processing",
      });

      const submission = await storage.createRndcSubmission({
        batchId: batch.id,
        ingresoidmanifiesto: metadata?.ingresoidmanifiesto || "",
        numidgps: metadata?.numidgps || "",
        numplaca: metadata?.numplaca || "",
        codpuntocontrol: metadata?.codpuntocontrol || "",
        latitud: metadata?.latitud || "",
        longitud: metadata?.longitud || "",
        fechallegada: metadata?.fechallegada || "",
        horallegada: metadata?.horallegada || "",
        fechasalida: metadata?.fechasalida || "",
        horasalida: metadata?.horasalida || "",
        xmlRequest,
        status: "pending",
      });

      const response = await sendXmlToRndc(xmlRequest, wsUrl);

      await storage.updateRndcSubmission(submission.id, {
        status: response.success ? "success" : "error",
        xmlResponse: response.rawXml,
        responseCode: response.code,
        responseMessage: response.message,
        processedAt: new Date(),
      });

      await storage.updateRndcBatch(batch.id, {
        status: "completed",
        completedAt: new Date(),
        successCount: response.success ? 1 : 0,
        errorCount: response.success ? 0 : 1,
        pendingCount: 0,
      });

      res.json({
        success: true,
        submissionId: submission.id,
        batchId: batch.id,
        response: {
          success: response.success,
          code: response.code,
          message: response.message,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al enviar reporte";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/rndc/query", async (req, res) => {
    try {
      const parsed = queryRndcSchema.parse(req.body);
      const { xmlRequest, wsUrl } = parsed;

      const response = await sendXmlToRndc(xmlRequest, wsUrl);

      if (response.success) {
        const { XMLParser } = await import("fast-xml-parser");
        const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
        
        let data: any = {};
        try {
          const parsedXml = parser.parse(response.rawXml);
          
          // Try to find data in different possible locations
          let rawData: any = null;
          if (parsedXml?.root?.documento) {
            rawData = parsedXml.root.documento;
          } else if (parsedXml?.root?.resultado) {
            rawData = parsedXml.root.resultado;
          }
          
          if (rawData) {
            if (Array.isArray(rawData)) {
              rawData = rawData[0] || {};
            }
            // Normalize field names to uppercase for consistent access
            for (const key of Object.keys(rawData)) {
              data[key.toUpperCase()] = rawData[key];
            }
          }
          
          console.log("[RNDC Query] Extracted data:", JSON.stringify(data, null, 2));
        } catch (parseError) {
          console.log("[RNDC Query] XML parse error:", parseError);
          data = {};
        }

        res.json({ success: true, data, rawXml: response.rawXml });
      } else {
        res.json({ success: false, message: response.message, rawXml: response.rawXml });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error en consulta";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/rndc/query-raw", requireAuth, async (req, res) => {
    try {
      const { xmlRequest } = req.body;
      
      if (!xmlRequest || typeof xmlRequest !== "string") {
        return res.status(400).json({ success: false, message: "Se requiere xmlRequest" });
      }

      console.log("[RNDC Raw Query] Enviando consulta XML directa...");
      const response = await sendXmlToRndc(xmlRequest);
      
      console.log("[RNDC Raw Query] Respuesta recibida. success:", response.success, "code:", response.code);
      
      res.json({
        success: response.success,
        code: response.code,
        message: response.message,
        rawXml: response.rawXml,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error en consulta directa";
      console.log("[RNDC Raw Query] Error:", message);
      res.status(400).json({ success: false, message });
    }
  });

  const monitoringQuerySchema = z.object({
    queryType: z.enum(["NUEVOS", "TODOS", "SPECIFIC"]),
    numIdGps: z.string(),
    manifestId: z.string().optional(),
    xmlRequest: z.string(),
    wsUrl: z.string().url().optional(),
  });

  app.post("/api/rndc/monitoring", async (req, res) => {
    try {
      const parsed = monitoringQuerySchema.parse(req.body);
      const { queryType, numIdGps, manifestId, xmlRequest, wsUrl } = parsed;

      const query = await storage.createMonitoringQuery({
        queryType,
        numIdGps,
        manifestId: manifestId || null,
        xmlRequest,
        status: "processing",
      });

      const response = await sendXmlToRndc(xmlRequest, wsUrl);

      let manifests: any[] = [];
      let manifestsCount = 0;

      if (response.success) {
        const { XMLParser } = await import("fast-xml-parser");
        const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
        
        try {
          const parsedXml = parser.parse(response.rawXml);
          
          let docs = parsedXml?.root?.documento;
          if (docs) {
            if (!Array.isArray(docs)) {
              docs = [docs];
            }
            manifests = docs.map((doc: any) => ({
              ingresoidmanifiesto: doc.ingresoidmanifiesto || doc.INGRESOIDMANIFIESTO || "",
              numnitempresatransporte: doc.numnitempresatransporte || doc.NUMNITEMPRESATRANSPORTE || "",
              nummanifiestocarga: doc.nummanifiestocarga || doc.NUMMANIFIESTOCARGA || "",
              fechaexpedicionmanifiesto: doc.fechaexpedicionmanifiesto || doc.FECHAEXPEDICIONMANIFIESTO || "",
              numplaca: doc.numplaca || doc.NUMPLACA || "",
              puntoscontrol: doc.puntoscontrol || doc.PUNTOSCONTROL || null,
            }));
            manifestsCount = manifests.length;
          }
        } catch (parseError) {
          console.log("[Monitoring] XML parse error:", parseError);
        }

        await storage.updateMonitoringQuery(query.id, {
          xmlResponse: response.rawXml,
          manifestsCount,
          manifestsData: JSON.stringify(manifests),
          status: "success",
          responseCode: response.code,
          responseMessage: response.message,
        });

        let savedCount = 0;
        for (const m of manifests) {
          try {
            const existing = await storage.getRndcManifestByIngresoId(m.ingresoidmanifiesto);
            if (!existing && m.ingresoidmanifiesto) {
              const savedManifest = await storage.createRndcManifest({
                queryId: query.id,
                ingresoIdManifiesto: m.ingresoidmanifiesto,
                numNitEmpresaTransporte: m.numnitempresatransporte || "",
                fechaExpedicionManifiesto: m.fechaexpedicionmanifiesto || null,
                codigoEmpresa: m.codigoempresa || null,
                numManifiestoCarga: m.nummanifiestocarga || "",
                numPlaca: m.numplaca || "",
              });

              if (m.puntoscontrol) {
                let puntos = m.puntoscontrol.puntocontrol || m.puntoscontrol;
                if (!Array.isArray(puntos)) {
                  puntos = [puntos];
                }
                for (const p of puntos) {
                  if (p && p.codpuntocontrol) {
                    await storage.createRndcControlPoint({
                      manifestId: savedManifest.id,
                      codPuntoControl: String(p.codpuntocontrol || ""),
                      codMunicipio: p.codmunicipio || null,
                      direccion: p.direccion || null,
                      fechaCita: p.fechacita || null,
                      horaCita: p.horacita || null,
                      latitud: p.latitud || null,
                      longitud: p.longitud || null,
                      tiempoPactado: p.tiempopactado || null,
                    });
                  }
                }
              }
              savedCount++;
            }
          } catch (saveError) {
            console.log("[Monitoring] Error saving manifest:", saveError);
          }
        }
        console.log(`[Monitoring] Saved ${savedCount} new manifests to database`);

        res.json({
          success: true,
          queryId: query.id,
          manifests,
          manifestsCount,
          savedCount,
          rawXml: response.rawXml,
        });
      } else {
        await storage.updateMonitoringQuery(query.id, {
          xmlResponse: response.rawXml,
          status: "error",
          responseCode: response.code,
          responseMessage: response.message,
        });

        res.json({
          success: false,
          queryId: query.id,
          message: response.message,
          rawXml: response.rawXml,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error en consulta de monitoreo";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/rndc/monitoring/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const queries = await storage.getMonitoringQueries(limit);
      res.json({ success: true, queries });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener historial de monitoreo" });
    }
  });

  app.get("/api/rndc/monitoring/:id", async (req, res) => {
    try {
      const query = await storage.getMonitoringQuery(req.params.id);
      if (!query) {
        return res.status(404).json({ success: false, message: "Consulta no encontrada" });
      }
      res.json({ success: true, query });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener consulta" });
    }
  });

  app.get("/api/rndc/manifests", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      
      const [manifests, total] = await Promise.all([
        storage.getRndcManifests(limit, offset),
        storage.getRndcManifestCount(),
      ]);
      
      res.json({
        success: true,
        manifests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener manifiestos" });
    }
  });

  app.get("/api/rndc/manifests/search", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      
      const filters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        numPlaca: req.query.numPlaca as string | undefined,
        ingresoIdManifiesto: req.query.ingresoIdManifiesto as string | undefined,
        numManifiestoCarga: req.query.numManifiestoCarga as string | undefined,
        codPuntoControl: req.query.codPuntoControl as string | undefined,
      };

      const { manifests, total } = await storage.searchRndcManifests(filters, limit, offset);
      
      res.json({
        success: true,
        manifests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al buscar manifiestos" });
    }
  });

  app.get("/api/rndc/manifests/export", async (req, res) => {
    try {
      const filters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        numPlaca: req.query.numPlaca as string | undefined,
        ingresoIdManifiesto: req.query.ingresoIdManifiesto as string | undefined,
        numManifiestoCarga: req.query.numManifiestoCarga as string | undefined,
        codPuntoControl: req.query.codPuntoControl as string | undefined,
      };

      const { manifests } = await storage.searchRndcManifests(filters, 10000, 0);
      
      const manifestsWithControlPoints = await Promise.all(
        manifests.map(async (m) => {
          const controlPoints = await storage.getRndcControlPointsByManifest(m.id);
          return { manifest: m, controlPoints };
        })
      );
      
      res.json({
        success: true,
        data: manifestsWithControlPoints,
        count: manifests.length,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al exportar manifiestos" });
    }
  });

  app.get("/api/rndc/manifests/:id/control-points", async (req, res) => {
    try {
      const controlPoints = await storage.getRndcControlPointsByManifest(req.params.id);
      res.json({ success: true, controlPoints });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener puntos de control" });
    }
  });

  app.post("/api/rndc/cumplido-remesa-batch", async (req, res) => {
    try {
      const parsed = cumplidoRemesaBatchSchema.parse(req.body);
      const { submissions, wsUrl } = parsed;

      const batch = await storage.createRndcBatch({
        type: "cumplido_remesa",
        totalRecords: submissions.length,
        successCount: 0,
        errorCount: 0,
        pendingCount: submissions.length,
        status: "processing",
      });

      const createdSubmissions = await Promise.all(
        submissions.map(sub =>
          storage.createCumplidoRemesaSubmission({
            batchId: batch.id,
            consecutivoRemesa: sub.consecutivoRemesa,
            numNitEmpresa: sub.numNitEmpresa,
            numPlaca: sub.numPlaca,
            origen: sub.origen || null,
            destino: sub.destino || null,
            fechaEntradaCargue: sub.fechaEntradaCargue,
            horaEntradaCargue: sub.horaEntradaCargue,
            fechaEntradaDescargue: sub.fechaEntradaDescargue,
            horaEntradaDescargue: sub.horaEntradaDescargue,
            cantidadCargada: sub.cantidadCargada,
            cantidadEntregada: sub.cantidadEntregada,
            xmlQueryRequest: sub.xmlQueryRequest || null,
            xmlCumplidoRequest: sub.xmlCumplidoRequest,
            status: "pending",
          })
        )
      );

      processCumplidoRemesaAsync(batch.id, createdSubmissions.map(s => s.id), wsUrl);

      res.json({
        success: true,
        batchId: batch.id,
        message: `Lote creado con ${submissions.length} cumplidos. Procesando...`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al crear lote de cumplidos";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/rndc/cumplido-remesa/:batchId", async (req, res) => {
    try {
      const submissions = await storage.getCumplidoRemesaSubmissionsByBatch(req.params.batchId);
      res.json({ success: true, submissions });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener cumplidos" });
    }
  });

  app.post("/api/rndc/cumplido-manifiesto-batch", async (req, res) => {
    try {
      const parsed = cumplidoManifiestoBatchSchema.parse(req.body);
      const { submissions, wsUrl } = parsed;

      const batch = await storage.createRndcBatch({
        type: "cumplido_manifiesto",
        totalRecords: submissions.length,
        successCount: 0,
        errorCount: 0,
        pendingCount: submissions.length,
        status: "processing",
      });

      const createdSubmissions = await Promise.all(
        submissions.map(sub =>
          storage.createCumplidoManifiestoSubmission({
            batchId: batch.id,
            numManifiestoCarga: sub.numManifiestoCarga,
            numNitEmpresa: sub.numNitEmpresa,
            numPlaca: sub.numPlaca,
            origen: sub.origen || null,
            destino: sub.destino || null,
            fechaEntregaDocumentos: sub.fechaEntregaDocumentos,
            xmlCumplidoRequest: sub.xmlCumplidoRequest,
            status: "pending",
          })
        )
      );

      processCumplidoManifiestoAsync(batch.id, createdSubmissions.map(s => s.id), wsUrl);

      res.json({
        success: true,
        batchId: batch.id,
        message: `Lote creado con ${submissions.length} manifiestos. Procesando...`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al crear lote de manifiestos";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/rndc/cumplido-manifiesto/:batchId", async (req, res) => {
    try {
      const submissions = await storage.getCumplidoManifiestoSubmissionsByBatch(req.params.batchId);
      res.json({ success: true, submissions });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener cumplidos manifiesto" });
    }
  });

  app.post("/api/rndc/remesa-batch", async (req, res) => {
    try {
      const parsed = remesaBatchSchema.parse(req.body);
      const { submissions, wsUrl } = parsed;

      const batch = await storage.createRndcBatch({
        type: "remesa",
        totalRecords: submissions.length,
        successCount: 0,
        errorCount: 0,
        pendingCount: submissions.length,
        status: "processing",
      });

      const createdSubmissions = await Promise.all(
        submissions.map(sub =>
          storage.createRemesaSubmission({
            batchId: batch.id,
            consecutivoRemesa: sub.consecutivoRemesa,
            numNitEmpresa: sub.numNitEmpresa,
            numPlaca: sub.numPlaca,
            cantidadCargada: sub.cantidadCargada,
            fechaCargue: sub.fechaCargue,
            horaCargue: sub.horaCargue,
            fechaDescargue: sub.fechaDescargue,
            horaDescargue: sub.horaDescargue,
            sedeRemitente: sub.sedeRemitente || null,
            sedeDestinatario: sub.sedeDestinatario || null,
            codMunicipioOrigen: sub.codMunicipioOrigen || null,
            codMunicipioDestino: sub.codMunicipioDestino || null,
            tipoIdPropietario: sub.tipoIdPropietario || null,
            numIdPropietario: sub.numIdPropietario || null,
            cedula: sub.cedula || null,
            valorFlete: sub.valorFlete || null,
            xmlRequest: sub.xmlRequest,
            status: "pending",
          })
        )
      );

      processRemesaAsync(batch.id, createdSubmissions.map(s => s.id), wsUrl);

      res.json({
        success: true,
        batchId: batch.id,
        message: `Lote creado con ${submissions.length} remesas. Procesando...`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al crear lote de remesas";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/rndc/remesa/:batchId", async (req, res) => {
    try {
      const submissions = await storage.getRemesaSubmissionsByBatch(req.params.batchId);
      res.json({ success: true, submissions });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener remesas" });
    }
  });

  app.get("/api/rndc/remesas/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const submissions = await storage.getAllRemesaSubmissions(limit);
      
      // Get manifiestos to find associations
      const manifiestos = await storage.getAllManifiestoSubmissions(limit);
      const manifiestoMap = new Map<string, any>();
      for (const m of manifiestos) {
        // Use consecutivo as key (remesa and manifiesto share same consecutivo)
        if (!manifiestoMap.has(m.consecutivoManifiesto) || m.status === "success") {
          manifiestoMap.set(m.consecutivoManifiesto, m);
        }
      }
      
      // Enrich remesas with manifiesto info
      const enrichedSubmissions = submissions.map(r => ({
        ...r,
        manifiesto: manifiestoMap.get(r.consecutivoRemesa) || null,
      }));
      
      res.json({ success: true, submissions: enrichedSubmissions });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener historial de remesas" });
    }
  });
  
  app.get("/api/rndc/manifiestos/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const submissions = await storage.getAllManifiestoSubmissions(limit);
      res.json({ success: true, submissions });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener historial de manifiestos" });
    }
  });

  // Query manifiesto details for PDF generation
  app.post("/api/rndc/manifiesto-details", async (req, res) => {
    try {
      const { username, password, companyNit, numManifiesto, wsUrl, companyName, companyAddress, companyPhone, companyCity } = req.body;
      
      if (!username || !password || !companyNit || !numManifiesto) {
        return res.status(400).json({ success: false, message: "Faltan parámetros requeridos" });
      }

      const result = await queryManifiestoDetails(username, password, companyNit, numManifiesto, wsUrl);
      
      if (!result.success || !result.details) {
        return res.json({ success: false, message: result.message, rawXml: result.rawXml });
      }

      // Return details enriched with company info for PDF
      res.json({ 
        success: true, 
        details: result.details,
        companyInfo: {
          name: companyName || "",
          nit: companyNit,
          address: companyAddress || "",
          phone: companyPhone || "",
          city: companyCity || "",
        },
        rawXml: result.rawXml,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al consultar manifiesto";
      res.status(500).json({ success: false, message });
    }
  });

  // Enhanced endpoint that queries all manifest-related data for PDF generation
  app.post("/api/rndc/manifiesto-details-enhanced", async (req, res) => {
    try {
      const { username, password, companyNit, numManifiesto, numPlaca, numIdConductor, numIdTitular, wsUrl, companyName, companyAddress, companyPhone, companyCity } = req.body;
      
      if (!username || !password || !companyNit || !numManifiesto) {
        return res.status(400).json({ success: false, message: "Faltan parámetros requeridos" });
      }

      // Query manifest details (procesoid=4)
      const manifestResult = await queryManifiestoDetails(username, password, companyNit, numManifiesto, wsUrl);
      
      if (!manifestResult.success || !manifestResult.details) {
        return res.json({ success: false, message: manifestResult.message, rawXml: manifestResult.rawXml });
      }

      const details = manifestResult.details;
      
      // Get conductor and titular IDs from response or parameters
      const conductorId = numIdConductor || details.NUMIDCONDUCTOR;
      const titularId = numIdTitular || details.NUMIDTITULARMANIFIESTO;
      const placa = numPlaca || details.NUMPLACA;

      console.log("[MANIFIESTO-ENHANCED] conductorId:", conductorId, "titularId:", titularId, "placa:", placa);

      // Query all data from RNDC in parallel
      // Always query titular separately even if same as conductor (to ensure we get the data)
      const [conductorResult, titularResult, vehiculoResult, vehiculoExtraResult] = await Promise.all([
        conductorId ? queryTerceroDetails(username, password, companyNit, conductorId, wsUrl) : Promise.resolve(null),
        titularId ? queryTerceroDetails(username, password, companyNit, titularId, wsUrl) : Promise.resolve(null),
        placa ? queryVehiculoDetails(username, password, companyNit, placa, wsUrl) : Promise.resolve(null),
        placa ? queryVehiculoExtraDetails(username, password, placa, wsUrl) : Promise.resolve(null),
      ]);

      console.log("[MANIFIESTO-ENHANCED] conductorResult success:", conductorResult?.success);
      console.log("[MANIFIESTO-ENHANCED] titularResult success:", titularResult?.success);
      if (titularResult?.success) {
        console.log("[MANIFIESTO-ENHANCED] titular data:", JSON.stringify(titularResult.details, null, 2));
      } else if (titularResult) {
        console.log("[MANIFIESTO-ENHANCED] titularResult message:", titularResult.message);
      }

      // Build enhanced response with all available data
      res.json({ 
        success: true, 
        details,
        conductor: conductorResult?.success ? conductorResult.details : null,
        titular: titularResult?.success ? titularResult.details : null,
        vehiculo: vehiculoResult?.success ? vehiculoResult.details : null,
        vehiculoExtra: vehiculoExtraResult?.success ? vehiculoExtraResult.details : null,
        companyInfo: {
          name: companyName || "",
          nit: companyNit,
          address: companyAddress || "",
          phone: companyPhone || "",
          city: companyCity || "",
        },
        rawXml: manifestResult.rawXml,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al consultar datos del manifiesto";
      res.status(500).json({ success: false, message });
    }
  });

  // Generate QR code data URL for manifiesto
  // Format matches RNDC official QR: MEC, Fecha, Placa, Config, Orig, Dest, Mercancia, Conductor, Empresa, Valor, Seguro
  app.post("/api/rndc/manifiesto-qr", async (req, res) => {
    try {
      const { 
        mec, fecha, placa, remolque, config, 
        orig, dest, mercancia, conductor, empresa, valor, obs, seguro 
      } = req.body;

      if (!mec || !fecha || !placa || !seguro) {
        return res.status(400).json({ success: false, message: "Faltan datos requeridos para el QR" });
      }

      // Convert date from DD/MM/YYYY or D/MM/YYYY to YYYY/MM/DD format for QR
      const convertDateFormat = (dateStr: string): string => {
        if (!dateStr) return "";
        // Check if already in YYYY/MM/DD or YYYY-MM-DD format
        if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(dateStr)) {
          const parts = dateStr.replace(/-/g, "/").split("/");
          return `${parts[0]}/${parts[1].padStart(2, "0")}/${parts[2].padStart(2, "0")}`;
        }
        // Convert from DD/MM/YYYY or D/MM/YYYY to YYYY/MM/DD with zero-padding
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          const day = parts[0].padStart(2, "0");
          const month = parts[1].padStart(2, "0");
          const year = parts[2];
          return `${year}/${month}/${day}`;
        }
        return dateStr;
      };
      const fechaFormatted = convertDateFormat(fecha);

      // Build QR data string according to RNDC official specs
      // IMPORTANT: Use CRLF (\r\n) line endings after each field EXCEPT the last one (Seguro)
      // Fields order: MEC, Fecha, Placa, Remolque(optional), Config, Orig(max 20), Dest(max 20), 
      // Mercancia(max 30), Conductor, Empresa(max 30), Valor(comma-formatted), Obs(optional), Seguro(28 chars)
      const CRLF = "\r\n";
      const lines: string[] = [];
      lines.push(`MEC:${mec}`);
      lines.push(`Fecha:${fechaFormatted}`);
      lines.push(`Placa:${placa}`);
      if (remolque) lines.push(`Remolque:${remolque}`);
      lines.push(`Config:${config || "2"}`);
      lines.push(`Orig:${(orig || "").substring(0, 20)}`);
      lines.push(`Dest:${(dest || "").substring(0, 20)}`);
      lines.push(`Mercancia:${(mercancia || "").substring(0, 30)}`);
      lines.push(`Conductor:${conductor || ""}`);
      lines.push(`Empresa:${(empresa || "").substring(0, 30)}`);
      lines.push(`Valor:${valor || "0"}`);
      // Obs: Only include if RNDC provides observations in the acceptance XML
      if (obs) lines.push(`Obs:${obs.substring(0, 120)}`);
      lines.push(`Seguro:${seguro}`);
      
      // Join with CRLF - no trailing newline after last field (Seguro)
      const qrData = lines.join(CRLF);

      // Generate QR as base64 data URL (29mm at 300dpi = 343px, rounded to 460px for quality)
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 460,
        margin: 1,
        errorCorrectionLevel: 'M',
      });

      res.json({ success: true, qrDataUrl, qrData });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al generar QR";
      res.status(500).json({ success: false, message });
    }
  });

  app.post("/api/rndc/manifiesto-batch", async (req, res) => {
    try {
      const parsed = manifiestoBatchSchema.parse(req.body);
      const { submissions, wsUrl } = parsed;

      const batch = await storage.createRndcBatch({
        type: "manifiesto",
        totalRecords: submissions.length,
        successCount: 0,
        errorCount: 0,
        pendingCount: submissions.length,
        status: "processing",
      });

      const createdSubmissions = await Promise.all(
        submissions.map(sub =>
          storage.createManifiestoSubmission({
            batchId: batch.id,
            consecutivoManifiesto: sub.consecutivoManifiesto,
            numNitEmpresa: sub.numNitEmpresa,
            numPlaca: sub.numPlaca,
            xmlRequest: sub.xmlRequest,
            status: "pending",
          })
        )
      );

      processManifiestoAsync(batch.id, createdSubmissions.map(s => s.id), wsUrl || "");

      res.json({
        success: true,
        batchId: batch.id,
        message: `Lote creado con ${submissions.length} manifiestos. Procesando...`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al crear lote de manifiestos";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/rndc/manifiesto-batch/:batchId/results", async (req, res) => {
    try {
      const submissions = await storage.getManifiestoSubmissionsByBatch(req.params.batchId);
      const allProcessed = submissions.every(s => s.status === "success" || s.status === "error");
      res.json({ 
        success: true, 
        completed: allProcessed,
        results: submissions.map(s => ({
          consecutivoManifiesto: s.consecutivoManifiesto,
          success: s.status === "success",
          responseCode: s.responseCode,
          responseMessage: s.responseMessage,
          idManifiesto: s.idManifiesto,
        }))
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener manifiestos" });
    }
  });

  app.get("/api/rndc/cumplidos/history", async (req, res) => {
    try {
      const type = req.query.type as string;
      const limit = parseInt(req.query.limit as string) || 50;
      
      if (!type || !["cumplido_remesa", "cumplido_manifiesto"].includes(type)) {
        return res.status(400).json({ success: false, message: "Tipo inválido. Use cumplido_remesa o cumplido_manifiesto" });
      }
      
      const batches = await storage.getRndcBatchesByType(type, limit);
      res.json({ success: true, batches });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener historial de cumplidos" });
    }
  });

  app.get("/api/terceros", requireAuth, async (req, res) => {
    try {
      const tipoTercero = req.query.tipo as string | undefined;
      const limit = parseInt(req.query.limit as string) || 500;
      const terceros = await storage.getTerceros(tipoTercero, limit);
      res.json({ success: true, terceros });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener terceros" });
    }
  });

  app.get("/api/terceros/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string;
      const tipoTercero = req.query.tipo as string | undefined;
      if (!query) {
        return res.status(400).json({ success: false, message: "Parámetro de búsqueda requerido" });
      }
      const terceros = await storage.searchTerceros(query, tipoTercero);
      res.json({ success: true, terceros });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al buscar terceros" });
    }
  });

  app.get("/api/terceros/:id", requireAuth, async (req, res) => {
    try {
      const tercero = await storage.getTercero(req.params.id);
      if (!tercero) {
        return res.status(404).json({ success: false, message: "Tercero no encontrado" });
      }
      res.json({ success: true, tercero });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener tercero" });
    }
  });

  app.post("/api/terceros", requireAuth, async (req, res) => {
    try {
      const parsed = insertTerceroSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Datos inválidos", errors: parsed.error.flatten() });
      }
      const tercero = await storage.createTercero(parsed.data);
      res.json({ success: true, tercero });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al crear tercero" });
    }
  });

  app.put("/api/terceros/:id", requireAuth, async (req, res) => {
    try {
      const tercero = await storage.updateTercero(req.params.id, req.body);
      if (!tercero) {
        return res.status(404).json({ success: false, message: "Tercero no encontrado" });
      }
      res.json({ success: true, tercero });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al actualizar tercero" });
    }
  });

  app.delete("/api/terceros/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTercero(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al eliminar tercero" });
    }
  });

  app.post("/api/terceros/bulk-import", requireAuth, async (req, res) => {
    try {
      const { rows } = req.body as { rows: any[] };
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: "No hay datos para importar" });
      }

      const results = { created: 0, updated: 0, errors: [] as string[] };

      for (const row of rows) {
        try {
          const terceroData = {
            tipoTercero: "GRANJA",
            tipoIdentificacion: "NIT",
            numeroIdentificacion: String(row.Granja || row.granja || ""),
            nombre: String(row.Nombre_Sede || row.nombreSede || row.nombre || ""),
            codigoGranja: String(row.Granja || row.granja || ""),
            sede: String(row.Cod_sede || row.codSede || row.sede || ""),
            nombreSede: String(row.Nombre_Sede || row.nombreSede || ""),
            latitud: String(row.Latitud || row.latitud || ""),
            longitud: String(row.longitud || row.Longitud || ""),
            municipio: String(row.Municipio_rndc || row.municipio || ""),
            codMunicipioRndc: String(row.CODMUNICIPIORNDC || row["Cod Municipio"] || row.codMunicipioRndc || ""),
            direccion: String(row.NOMENCLATURADIRECCION || row["Dirección"] || row.direccion || ""),
            flete: String(Math.round(Number(row.Flete || row.flete || 0)) || ""),
          };

          if (!terceroData.codigoGranja || !terceroData.nombre) {
            results.errors.push(`Fila sin datos requeridos: ${JSON.stringify(row)}`);
            continue;
          }

          const { isNew } = await storage.upsertTerceroByCodigoGranja(terceroData);
          if (isNew) {
            results.created++;
          } else {
            results.updated++;
          }
        } catch (err) {
          results.errors.push(`Error en fila: ${JSON.stringify(row)}`);
        }
      }

      res.json({
        success: true,
        message: `Importación completada: ${results.created} creados, ${results.updated} actualizados`,
        results,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al importar terceros" });
    }
  });

  // Destinos RNDC routes
  app.get("/api/destinos", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const destinos = await storage.getDestinos(limit);
      res.json({ success: true, destinos });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener destinos" });
    }
  });

  app.get("/api/destinos/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ success: false, message: "Parámetro de búsqueda requerido" });
      }
      const destinos = await storage.searchDestinos(query);
      res.json({ success: true, destinos });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al buscar destinos" });
    }
  });

  // Lookup municipality name by DANE code from destinos table
  app.get("/api/destinos/municipio/:codMunicipioRndc", requireAuth, async (req, res) => {
    try {
      const codMunicipioRndc = req.params.codMunicipioRndc;
      const municipioName = await storage.getMunicipioNameByCode(codMunicipioRndc);
      res.json({ success: true, codMunicipioRndc, municipioName });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al buscar municipio" });
    }
  });

  // Batch lookup multiple municipality names by DANE codes
  app.post("/api/destinos/municipios-batch", requireAuth, async (req, res) => {
    try {
      const { codes } = req.body as { codes: string[] };
      if (!codes || !Array.isArray(codes)) {
        return res.status(400).json({ success: false, message: "Se requiere un array de códigos" });
      }
      const results: Record<string, string> = {};
      for (const code of codes) {
        if (code) {
          results[code] = await storage.getMunicipioNameByCode(code);
        }
      }
      res.json({ success: true, municipios: results });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al buscar municipios" });
    }
  });

  app.get("/api/destinos/:id", requireAuth, async (req, res) => {
    try {
      const destino = await storage.getDestino(req.params.id);
      if (!destino) {
        return res.status(404).json({ success: false, message: "Destino no encontrado" });
      }
      res.json({ success: true, destino });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener destino" });
    }
  });

  app.post("/api/destinos", requireAuth, async (req, res) => {
    try {
      const destino = await storage.createDestino(req.body);
      res.json({ success: true, destino });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al crear destino" });
    }
  });

  app.put("/api/destinos/:id", requireAuth, async (req, res) => {
    try {
      const destino = await storage.updateDestino(req.params.id, req.body);
      if (!destino) {
        return res.status(404).json({ success: false, message: "Destino no encontrado" });
      }
      res.json({ success: true, destino });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al actualizar destino" });
    }
  });

  app.delete("/api/destinos/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteDestino(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al eliminar destino" });
    }
  });

  app.post("/api/destinos/bulk-import", requireAuth, async (req, res) => {
    try {
      const { rows } = req.body as { rows: any[] };
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: "No hay datos para importar" });
      }

      const results = { created: 0, updated: 0, errors: [] as string[] };

      for (const row of rows) {
        try {
          const destinoData = {
            tipoIdTercero: String(row.TIPOIDTERCERO || row.tipoIdTercero || "Nit"),
            nombreSede: String(row.NOMSEDETERCERO || row.nombreSede || ""),
            numIdTercero: String(row.NUMIDTERCERO || row.numIdTercero || ""),
            codSede: String(row.CODSEDETERCERO || row.codSede || ""),
            nombreTercero: String(row.NOMIDTERCERO || row.nombreTercero || ""),
            direccion: String(row.NOMENCLATURADIRECCION || row.direccion || ""),
            municipioRndc: String(row.MUNICIPIORNDC || row.municipioRndc || ""),
            codMunicipioRndc: String(row.CODMUNICIPIORNDC || row.codMunicipioRndc || ""),
            latitud: String(row.LATITUD || row.latitud || ""),
            longitud: String(row.LONGITUD || row.longitud || ""),
            regimenSimple: String(row.REGIMENSIMPLE || row.regimenSimple || "N"),
          };

          if (!destinoData.nombreSede || !destinoData.codMunicipioRndc) {
            results.errors.push(`Fila sin datos requeridos: ${JSON.stringify(row)}`);
            continue;
          }

          const { isNew } = await storage.upsertDestino(destinoData);
          if (isNew) {
            results.created++;
          } else {
            results.updated++;
          }
        } catch (err) {
          results.errors.push(`Error en fila: ${JSON.stringify(row)}`);
        }
      }

      res.json({
        success: true,
        message: `Importación completada: ${results.created} creados, ${results.updated} actualizados`,
        results,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al importar destinos" });
    }
  });

  // PDF Template routes
  app.get("/api/pdf-templates", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "No autenticado" });
      }
      const templates = await storage.getPdfTemplatesByUser(userId);
      res.json({ success: true, templates });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener plantillas" });
    }
  });

  app.get("/api/pdf-templates/default/:templateType", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "No autenticado" });
      }
      const template = await storage.getDefaultPdfTemplate(userId, req.params.templateType);
      res.json({ success: true, template });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener plantilla predeterminada" });
    }
  });

  app.get("/api/pdf-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getPdfTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ success: false, message: "Plantilla no encontrada" });
      }
      res.json({ success: true, template });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener plantilla" });
    }
  });

  app.post("/api/pdf-templates", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "No autenticado" });
      }
      const template = await storage.createPdfTemplate({ ...req.body, userId });
      res.json({ success: true, template });
    } catch (error) {
      console.error("Error creating PDF template:", error);
      res.status(500).json({ success: false, message: "Error al crear plantilla" });
    }
  });

  app.put("/api/pdf-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.updatePdfTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ success: false, message: "Plantilla no encontrada" });
      }
      res.json({ success: true, template });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al actualizar plantilla" });
    }
  });

  app.post("/api/pdf-templates/:id/set-default", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "No autenticado" });
      }
      await storage.setDefaultPdfTemplate(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al establecer plantilla predeterminada" });
    }
  });

  app.delete("/api/pdf-templates/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePdfTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al eliminar plantilla" });
    }
  });

  const upload = multer({ storage: multer.memoryStorage() });

  app.get("/api/pdf-form-templates", requireAuth, async (req, res) => {
    try {
      const templates = await listFormTemplates();
      res.json({ success: true, templates });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al listar plantillas de formulario" });
    }
  });

  app.post("/api/pdf-form-templates/upload", requireAuth, upload.single('template'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No se proporcionó archivo" });
      }
      const templateName = (req.body.name || 'formulario').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = await saveFormTemplate(req.file.buffer, templateName);
      res.json({ success: true, fileName });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al guardar plantilla de formulario" });
    }
  });

  app.get("/api/pdf-form-templates/:name/fields", requireAuth, async (req, res) => {
    try {
      const fields = await getTemplateFields(req.params.name);
      res.json({ success: true, fields });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener campos del formulario" });
    }
  });

  app.post("/api/pdf-form-templates/fill", requireAuth, async (req, res) => {
    try {
      const { templateName, data, qrDataUrl, qrPosition } = req.body;
      console.log(`[PDF-FILL] Template: ${templateName}`);
      console.log(`[PDF-FILL] QR DataUrl present: ${!!qrDataUrl}, length: ${qrDataUrl?.length || 0}`);
      console.log(`[PDF-FILL] QR Position from request:`, qrPosition);
      if (!templateName || !data) {
        return res.status(400).json({ success: false, message: "Faltan datos requeridos" });
      }
      const qrPos = qrPosition || getDefaultQrPosition();
      console.log(`[PDF-FILL] Final QR Position:`, qrPos);
      const pdfBytes = await fillFormPdfFromBase64(templateName, data as ManifiestoData, qrDataUrl, qrPos);
      const base64 = Buffer.from(pdfBytes).toString('base64');
      res.json({ success: true, pdfBase64: base64 });
    } catch (error) {
      console.error('Error filling PDF form:', error);
      res.status(500).json({ success: false, message: "Error al generar PDF" });
    }
  });

  app.get("/api/qr-config", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "No autenticado" });
      }
      const config = await storage.getQrConfig(userId);
      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener configuración QR" });
    }
  });

  app.post("/api/qr-config", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "No autenticado" });
      }
      const { fields } = req.body;
      const fieldsSchema = z.array(qrFieldConfigSchema);
      const validatedFields = fieldsSchema.parse(fields);
      const config = await storage.upsertQrConfig(userId, validatedFields);
      res.json({ success: true, config });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Datos de configuración inválidos", errors: error.errors });
      }
      res.status(500).json({ success: false, message: "Error al guardar configuración QR" });
    }
  });

  app.post("/api/generate-qr", requireAuth, async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ success: false, message: "Contenido requerido" });
      }
      const qrImage = await QRCode.toDataURL(content, {
        width: 354,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      res.json({ success: true, qrImage });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al generar código QR" });
    }
  });

  app.get("/api/conductores", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const conductores = await storage.getRndcConductores(limit);
      res.json({ success: true, conductores });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener conductores" });
    }
  });

  app.get("/api/conductores/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ success: false, message: "Parámetro de búsqueda requerido" });
      }
      const conductores = await storage.searchRndcConductores(query);
      res.json({ success: true, conductores });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al buscar conductores" });
    }
  });

  app.delete("/api/conductores/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteRndcConductor(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al eliminar conductor" });
    }
  });

  app.put("/api/conductores/:id", requireAuth, async (req, res) => {
    try {
      const { nombre, telefono, categoriaLicencia, venceLicencia, placa } = req.body;
      await storage.updateRndcConductor(req.params.id, {
        nombre: nombre || null,
        telefono: telefono || null,
        categoriaLicencia: categoriaLicencia || null,
        venceLicencia: venceLicencia || null,
        placa: placa || null,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al actualizar conductor" });
    }
  });

  app.post("/api/conductores/bulk-import", requireAuth, async (req, res) => {
    try {
      const { rows } = req.body as { rows: any[] };
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: "No hay datos para importar" });
      }

      const results = { created: 0, updated: 0, errors: [] as string[] };
      
      const excelDateToString = (excelDate: number | string): string => {
        if (typeof excelDate === "number") {
          const date = new Date((excelDate - 25569) * 86400 * 1000);
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        }
        return String(excelDate || "");
      };

      for (const row of rows) {
        try {
          const cedula = String(row.CC || row.cc || row.cedula || "").replace(/[\s.,]/g, "");
          const nombre = String(row.NOMBRE || row.nombre || "").trim();
          const venceLicencia = excelDateToString(row["VENCIMIENTO LICENCIA"] || row.vencimientoLicencia || "");
          const direccion = String(row.DIRECCION || row.direccion || "").trim();
          const telefono = String(row.TELEFONO || row.telefono || "").trim();
          const placa = String(row.PLACA || row.placa || "").toUpperCase().trim();
          const observaciones = String(row.OBSERVACIONES || row.observaciones || "").trim();

          if (!cedula || !nombre) {
            results.errors.push(`Fila sin cédula o nombre: ${JSON.stringify(row)}`);
            continue;
          }

          const existing = await storage.getRndcConductorByCedula(cedula);
          await storage.upsertRndcConductor({
            cedula,
            nombre,
            venceLicencia: venceLicencia || undefined,
            direccion: direccion || undefined,
            telefono: telefono || undefined,
            placa: placa || undefined,
            observaciones: observaciones || undefined,
            lastSyncedAt: new Date(),
          });

          if (existing) {
            results.updated++;
          } else {
            results.created++;
          }
        } catch (err) {
          results.errors.push(`Error en fila: ${JSON.stringify(row)}`);
        }
      }

      res.json({
        success: true,
        message: `Importación completada: ${results.created} creados, ${results.updated} actualizados`,
        results,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al importar conductores" });
    }
  });

  app.get("/api/vehiculos", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const vehiculos = await storage.getVehiculos(limit);
      res.json({ success: true, vehiculos });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener vehículos" });
    }
  });

  app.get("/api/vehiculos/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ success: false, message: "Parámetro de búsqueda requerido" });
      }
      const vehiculos = await storage.searchVehiculos(query);
      res.json({ success: true, vehiculos });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al buscar vehículos" });
    }
  });

  app.get("/api/vehiculos/:id", requireAuth, async (req, res) => {
    try {
      const vehiculo = await storage.getVehiculo(req.params.id);
      if (!vehiculo) {
        return res.status(404).json({ success: false, message: "Vehículo no encontrado" });
      }
      res.json({ success: true, vehiculo });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener vehículo" });
    }
  });

  app.post("/api/vehiculos", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, placa: req.body.placa?.toUpperCase() };
      const parsed = insertVehiculoSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Datos inválidos", errors: parsed.error.flatten() });
      }
      const existing = await storage.getVehiculoByPlaca(parsed.data.placa);
      if (existing) {
        return res.status(400).json({ success: false, message: "Ya existe un vehículo con esta placa" });
      }
      const vehiculo = await storage.createVehiculo(parsed.data);
      res.json({ success: true, vehiculo });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al crear vehículo" });
    }
  });

  app.put("/api/vehiculos/:id", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.placa) data.placa = data.placa.toUpperCase();
      const vehiculo = await storage.updateVehiculo(req.params.id, data);
      if (!vehiculo) {
        return res.status(404).json({ success: false, message: "Vehículo no encontrado" });
      }
      res.json({ success: true, vehiculo });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al actualizar vehículo" });
    }
  });

  app.delete("/api/vehiculos/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteVehiculo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al eliminar vehículo" });
    }
  });

  const despachosValidateSchema = z.object({
    rows: z.array(z.object({
      granja: z.string(),
      planta: z.string(),
      placa: z.string(),
      cedula: z.string(),
      toneladas: z.string(),
      fecha: z.string(),
      granjaValid: z.boolean().nullable(),
      granjaData: z.any().nullable(),
      plantaValid: z.boolean().nullable(),
      plantaData: z.any().nullable(),
      placaValid: z.boolean().nullable(),
      placaData: z.any().nullable(),
      cedulaValid: z.boolean().nullable(),
      cedulaData: z.any().nullable(),
      errors: z.array(z.string()),
    })),
    credentials: z.object({
      username: z.string(),
      password: z.string(),
      nitEmpresa: z.string(),
    }).optional(),
  });

  app.post("/api/despachos/validate", requireAuth, async (req, res) => {
    try {
      const parsed = despachosValidateSchema.parse(req.body);
      const { rows, credentials } = parsed;

      const { XMLParser } = await import("fast-xml-parser");
      const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

      res.status(400).json({ success: false, message: "Este endpoint ya no se usa. Use validate-internal, validate-placas, validate-cedulas" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error en validación";
      res.status(400).json({ success: false, message });
    }
  });

  const despachosRowsSchema = z.object({
    rows: z.array(z.object({
      granja: z.string(),
      planta: z.string(),
      placa: z.string(),
      cedula: z.string(),
      toneladas: z.string(),
      fecha: z.string(),
      granjaValid: z.boolean().nullable(),
      granjaData: z.object({ sede: z.string(), codMunicipio: z.string(), flete: z.string() }).nullable(),
      plantaValid: z.boolean().nullable(),
      plantaData: z.object({ sede: z.string(), codMunicipio: z.string() }).nullable(),
      placaValid: z.boolean().nullable(),
      placaData: z.object({ tipoIdPropietario: z.string().optional(), propietarioId: z.string(), venceSoat: z.string(), pesoVacio: z.string(), capacidad: z.string().optional() }).nullable(),
      cedulaValid: z.boolean().nullable(),
      cedulaData: z.object({ venceLicencia: z.string(), nombre: z.string().optional() }).nullable(),
      horaCargue: z.string().optional(),
      horaDescargue: z.string().optional(),
      errors: z.array(z.string()),
    })),
    credentials: z.object({
      username: z.string(),
      password: z.string(),
      nitEmpresa: z.string(),
    }).optional(),
    onlyMissing: z.boolean().optional(),
  });

  app.post("/api/despachos/validate-internal", requireAuth, async (req, res) => {
    try {
      const parsed = despachosRowsSchema.parse(req.body);
      const { rows } = parsed;
      console.log(`[DESPACHOS-A] Validando datos internos de ${rows.length} filas`);

      const granjaCache = new Map<string, { valid: boolean; data: { sede: string; codMunicipio: string; flete: string } | null }>();
      const plantaCache = new Map<string, { valid: boolean; data: { sede: string; codMunicipio: string } | null }>();

      const validatedRows = [];
      for (const row of rows) {
        const errors: string[] = [...row.errors.filter(e => !e.includes("Granja") && !e.includes("Planta"))];
        let granjaValid: boolean | null = null;
        let granjaData: { sede: string; codMunicipio: string; flete: string } | null = null;
        let plantaValid: boolean | null = null;
        let plantaData: { sede: string; codMunicipio: string } | null = null;

        if (row.granja) {
          const granjaKey = row.granja.toLowerCase().trim();
          if (granjaCache.has(granjaKey)) {
            const cached = granjaCache.get(granjaKey)!;
            granjaValid = cached.valid;
            granjaData = cached.data;
            if (!cached.valid) errors.push(`Granja '${row.granja}' no encontrada`);
          } else {
            const granjaBase = row.granja.replace(/\s*\d+\s*$/, "").trim();
            let tercero = await storage.getTerceroByCodigoGranja(row.granja);
            if (!tercero) {
              tercero = await storage.getTerceroByCodigoGranjaBase(granjaBase);
            }
            if (tercero) {
              granjaValid = true;
              granjaData = { sede: tercero.sede || "", codMunicipio: tercero.codMunicipioRndc || "", flete: tercero.flete || "" };
            } else {
              granjaValid = false;
              errors.push(`Granja '${row.granja}' no encontrada`);
            }
            granjaCache.set(granjaKey, { valid: granjaValid, data: granjaData });
          }
        }

        if (row.planta) {
          const plantaKey = row.planta.toLowerCase().trim();
          if (plantaCache.has(plantaKey)) {
            const cached = plantaCache.get(plantaKey)!;
            plantaValid = cached.valid;
            plantaData = cached.data;
            if (!cached.valid) errors.push(`Planta '${row.planta}' no encontrada`);
          } else {
            const tercero = await storage.getTerceroByNombreSede(row.planta);
            if (tercero) {
              plantaValid = true;
              plantaData = { sede: tercero.sede || "", codMunicipio: tercero.codMunicipioRndc || "" };
            } else {
              plantaValid = false;
              errors.push(`Planta '${row.planta}' no encontrada`);
            }
            plantaCache.set(plantaKey, { valid: plantaValid, data: plantaData });
          }
        }

        validatedRows.push({
          ...row,
          granjaValid,
          granjaData,
          plantaValid,
          plantaData,
          errors,
        });
      }

      const horasCargue = ["05:00", "06:00", "07:00", "08:00", "09:00", "10:00"];
      const finalRows = validatedRows.map((row, idx) => {
        const groupIndex = Math.floor(idx / 10) % horasCargue.length;
        const horaCargue = horasCargue[groupIndex];
        const [h, m] = horaCargue.split(":").map(Number);
        const horaDescargueNum = h + 7;
        const horaDescargue = `${String(horaDescargueNum).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        return { ...row, horaCargue, horaDescargue };
      });

      console.log(`[DESPACHOS-A] Completado. Granjas únicas: ${granjaCache.size}, Plantas únicas: ${plantaCache.size}`);
      res.json({ success: true, rows: finalRows });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error en validación interna";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/despachos/progress/:jobId", requireAuth, (req, res) => {
    const { jobId } = req.params;
    
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    const sendProgress = () => {
      const job = validationJobs.get(jobId);
      if (job) {
        res.write(`data: ${JSON.stringify({ progress: job.progress, total: job.total, current: job.current, completed: job.completed })}\n\n`);
        if (job.completed) {
          res.write(`data: ${JSON.stringify({ done: true, rows: job.rows })}\n\n`);
          res.end();
          validationJobs.delete(jobId);
          return true;
        }
      }
      return false;
    };

    const interval = setInterval(() => {
      if (sendProgress()) {
        clearInterval(interval);
      }
    }, 200);

    req.on("close", () => {
      clearInterval(interval);
    });
  });

  app.post("/api/despachos/validate-placas-internal", requireAuth, async (req, res) => {
    try {
      const parsed = despachosRowsSchema.parse(req.body);
      const { rows, onlyMissing } = parsed;

      console.log(`[DESPACHOS-B-INT] Validando ${rows.length} placas contra BD local`);
      
      const placaCache = new Map<string, { valid: boolean; data: { propietarioId: string; venceSoat: string; pesoVacio: string; capacidad?: string } | null; source: string; error?: string }>();
      const validatedRows = [];

      for (const row of rows) {
        const errors: string[] = [...row.errors.filter(e => !e.toLowerCase().includes("placa"))];
        let placaValid: boolean | null = row.placaValid;
        let placaData = row.placaData;

        if (onlyMissing && row.placaValid === true) {
          validatedRows.push({ ...row, errors });
          continue;
        }

        if (row.placa) {
          const placaKey = row.placa.toUpperCase().replace(/\s/g, "");
          
          if (placaCache.has(placaKey)) {
            const cached = placaCache.get(placaKey)!;
            placaValid = cached.valid;
            placaData = cached.data;
            if (!cached.valid && cached.error) errors.push(cached.error);
          } else {
            const localVehiculo = await storage.getVehiculoByPlaca(placaKey);
            const capacidad = localVehiculo?.toneladas || "";
            
            const rndcCached = await storage.getRndcVehiculoByPlaca(placaKey);
            if (rndcCached) {
              placaValid = true;
              placaData = {
                propietarioId: rndcCached.propietarioNumeroId || "",
                venceSoat: rndcCached.venceSoat || "",
                pesoVacio: rndcCached.pesoVacio || "",
                capacidad,
              };
              placaCache.set(placaKey, { valid: true, data: placaData, source: "rndc_cache" });
            } else if (localVehiculo) {
              placaValid = true;
              placaData = {
                propietarioId: localVehiculo.propietarioNumeroId || "",
                venceSoat: localVehiculo.venceSoat || "",
                pesoVacio: "",
                capacidad,
              };
              placaCache.set(placaKey, { valid: true, data: placaData, source: "vehiculos" });
            } else {
              placaValid = false;
              const err = `Placa '${row.placa}' no encontrada en BD local`;
              errors.push(err);
              placaCache.set(placaKey, { valid: false, data: null, source: "none", error: err });
            }
          }
        }

        validatedRows.push({ ...row, placaValid, placaData, errors });
      }

      console.log(`[DESPACHOS-B-INT] Completado. Placas consultadas: ${placaCache.size}`);
      res.json({ success: true, rows: validatedRows });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error en validación interna";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/despachos/validate-placas", requireAuth, async (req, res) => {
    try {
      const parsed = despachosRowsSchema.parse(req.body);
      const { rows, credentials, onlyMissing } = parsed;
      
      if (!credentials) {
        return res.status(400).json({ success: false, message: "Credenciales RNDC requeridas" });
      }

      const jobId = `placas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const toProcess = onlyMissing ? rows.filter(r => r.placaValid !== true && r.placa) : rows.filter(r => r.placa);
      const uniquePlacas = new Set(toProcess.map(r => r.placa.toUpperCase().replace(/\s/g, "")));
      
      validationJobs.set(jobId, { progress: 0, total: uniquePlacas.size, current: "", completed: false, rows: [] });
      console.log(`[DESPACHOS-B-RNDC] Job ${jobId}: Consultando ${uniquePlacas.size} placas únicas (onlyMissing=${onlyMissing})`);
      
      res.json({ success: true, jobId, total: uniquePlacas.size });

      (async () => {
        const { XMLParser } = await import("fast-xml-parser");
        const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
        const placaCache = new Map<string, { valid: boolean; data: { tipoIdPropietario?: string; propietarioId: string; venceSoat: string; pesoVacio: string; capacidad?: string } | null; error?: string }>();
        let progress = 0;

        const validatedRows = [];
        for (const row of rows) {
          const errors: string[] = [...row.errors.filter(e => !e.toLowerCase().includes("placa"))];
          let placaValid: boolean | null = row.placaValid;
          let placaData = row.placaData;

          if (onlyMissing && row.placaValid === true) {
            validatedRows.push({ ...row, errors });
            continue;
          }

          if (row.placa) {
            const placaKey = row.placa.toUpperCase().replace(/\s/g, "");
            
            if (placaCache.has(placaKey)) {
              const cached = placaCache.get(placaKey)!;
              placaValid = cached.valid;
              placaData = cached.data;
              if (!cached.valid && cached.error) errors.push(cached.error);
            } else {
              const localVehiculo = await storage.getVehiculoByPlaca(placaKey);
              const capacidad = localVehiculo?.toneladas || "";
              
              const xmlPlaca = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<root>
 <acceso>
  <username>${credentials.username}</username>
  <password>${credentials.password}</password>
 </acceso>
 <solicitud>
  <tipo>3</tipo>
  <procesoid>12</procesoid>
 </solicitud>
 <variables>
INGRESOID,FECHAING,NUMPLACA,CODTIPOIDPROPIETARIO,NUMIDPROPIETARIO,PESOVEHICULOVACIO,FECHAVENCIMIENTOSOAT
 </variables>
 <documento>
  <NUMNITEMPRESATRANSPORTE>${credentials.nitEmpresa}</NUMNITEMPRESATRANSPORTE>
  <NUMPLACA>'${placaKey}'</NUMPLACA>
 </documento>
</root>`;
              
              try {
                const response = await sendXmlToRndc(xmlPlaca);
                console.log(`[RNDC-B] Placa ${placaKey}: success=${response.success}, code=${response.code}`);
                if (response.success) {
                  const parsedXml = parser.parse(response.rawXml);
                  let doc = parsedXml?.root?.documento;
                  if (Array.isArray(doc)) doc = doc[doc.length - 1];
                  if (doc) {
                    placaValid = true;
                    const tipoIdProp = String(doc.CODTIPOIDPROPIETARIO || doc.codtipoidpropietario || "");
                    const propId = String(doc.NUMIDPROPIETARIO || doc.numidpropietario || "");
                    const soat = String(doc.FECHAVENCIMIENTOSOAT || doc.fechavencimientosoat || "");
                    const peso = String(doc.PESOVEHICULOVACIO || doc.pesovehiculovacio || "");
                    const ingresoId = String(doc.INGRESOID || doc.ingresoid || "");
                    placaData = {
                      tipoIdPropietario: tipoIdProp,
                      propietarioId: propId,
                      venceSoat: soat,
                      pesoVacio: peso,
                      capacidad,
                    };
                    placaCache.set(placaKey, { valid: true, data: placaData });
                    
                    storage.upsertRndcVehiculo({
                      placa: placaKey,
                      propietarioNumeroId: propId,
                      venceSoat: soat,
                      pesoVacio: peso,
                      ingresoId,
                      rawXml: response.rawXml,
                      lastSyncedAt: new Date(),
                    }).catch(err => console.log(`[RNDC-B] Error guardando cache para ${placaKey}:`, err));
                  } else {
                    placaValid = false;
                    console.log(`[RNDC-B] Placa ${placaKey} sin documento. Raw: ${response.rawXml?.substring(0, 500)}`);
                    const err = `Placa '${row.placa}' no encontrada en RNDC`;
                    errors.push(err);
                    placaCache.set(placaKey, { valid: false, data: null, error: err });
                  }
                } else {
                  placaValid = false;
                  console.log(`[RNDC-B] Placa ${placaKey} error: ${response.message}. Raw: ${response.rawXml?.substring(0, 500)}`);
                  const err = `Error RNDC placa: ${response.message}`;
                  errors.push(err);
                  placaCache.set(placaKey, { valid: false, data: null, error: err });
                }
              } catch (e) {
                placaValid = false;
                console.log(`[RNDC-B] Placa ${placaKey} excepción: ${e}`);
                const err = `Error consultando placa en RNDC`;
                errors.push(err);
                placaCache.set(placaKey, { valid: false, data: null, error: err });
              }
              
              progress++;
              const job = validationJobs.get(jobId);
              if (job) {
                job.progress = progress;
                job.current = placaKey;
              }
              
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          validatedRows.push({ ...row, placaValid, placaData, errors });
        }

        const job = validationJobs.get(jobId);
        if (job) {
          job.completed = true;
          job.rows = validatedRows;
        }
        console.log(`[DESPACHOS-B] Job ${jobId} completado. Placas consultadas: ${placaCache.size}`);
      })();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error consultando placas";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/despachos/validate-cedulas-internal", requireAuth, async (req, res) => {
    try {
      const parsed = despachosRowsSchema.parse(req.body);
      const { rows, onlyMissing } = parsed;

      console.log(`[DESPACHOS-C-INT] Validando ${rows.length} cédulas contra Conductores (Enrolamiento)`);
      
      const sanitizeCedula = (c: string) => String(c).replace(/[\s.,]/g, "");
      const cedulaCache = new Map<string, { valid: boolean; data: { venceLicencia: string; nombre?: string } | null; error?: string }>();
      const validatedRows = [];
      
      const parseDateDDMMYYYY = (dateStr: string): Date | null => {
        if (!dateStr) return null;
        const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
          const [, day, month, year] = match;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        return null;
      };
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const validCategories = ["C1", "C2", "C3"];

      for (const row of rows) {
        const errors: string[] = [...row.errors.filter(e => !e.toLowerCase().includes("cédula"))];
        let cedulaValid: boolean | null = row.cedulaValid;
        let cedulaData = row.cedulaData;

        if (onlyMissing && row.cedulaValid === true) {
          validatedRows.push({ ...row, errors });
          continue;
        }

        if (row.cedula) {
          const cedulaKey = sanitizeCedula(row.cedula);
          
          if (cedulaCache.has(cedulaKey)) {
            const cached = cedulaCache.get(cedulaKey)!;
            cedulaValid = cached.valid;
            cedulaData = cached.data;
            if (!cached.valid && cached.error) errors.push(cached.error);
          } else {
            const conductor = await storage.getRndcConductorByCedula(cedulaKey);
            if (conductor && conductor.venceLicencia) {
              const licenseDate = parseDateDDMMYYYY(conductor.venceLicencia);
              const hasValidCategory = validCategories.includes((conductor.categoriaLicencia || "").toUpperCase());
              const isNotExpired = licenseDate && licenseDate >= today;
              
              if (hasValidCategory && isNotExpired) {
                cedulaValid = true;
                cedulaData = { venceLicencia: conductor.venceLicencia, nombre: conductor.nombre || undefined };
                cedulaCache.set(cedulaKey, { valid: true, data: cedulaData });
                console.log(`[DESPACHOS-C-INT] Cédula ${cedulaKey} válida. Licencia ${conductor.categoriaLicencia} hasta ${conductor.venceLicencia}`);
              } else if (!hasValidCategory) {
                cedulaValid = false;
                const err = `Categoría licencia inválida: ${conductor.categoriaLicencia || 'N/A'} (requiere C1/C2/C3)`;
                errors.push(err);
                cedulaCache.set(cedulaKey, { valid: false, data: null, error: err });
              } else {
                cedulaValid = false;
                const err = `Licencia vencida: ${conductor.venceLicencia}`;
                errors.push(err);
                cedulaCache.set(cedulaKey, { valid: false, data: null, error: err });
              }
            } else {
              cedulaValid = null;
              cedulaCache.set(cedulaKey, { valid: false, data: null, error: `No encontrada en Conductores` });
            }
          }
        }

        validatedRows.push({ ...row, cedulaValid, cedulaData, errors });
      }

      console.log(`[DESPACHOS-C-INT] Completado. Cédulas consultadas: ${cedulaCache.size}`);
      res.json({ success: true, rows: validatedRows });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error en validación interna";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/despachos/validate-cedulas", requireAuth, async (req, res) => {
    try {
      const parsed = despachosRowsSchema.parse(req.body);
      const { rows, credentials, onlyMissing } = parsed;
      
      if (!credentials) {
        return res.status(400).json({ success: false, message: "Credenciales RNDC requeridas" });
      }

      const jobId = `cedulas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const sanitizeCedula = (c: string) => String(c).replace(/[\s.,]/g, "");
      const toProcess = onlyMissing ? rows.filter(r => r.cedulaValid !== true && r.cedula) : rows.filter(r => r.cedula);
      const uniqueCedulas = new Set(toProcess.map(r => sanitizeCedula(r.cedula)));
      
      validationJobs.set(jobId, { progress: 0, total: uniqueCedulas.size, current: "", completed: false, rows: [] });
      console.log(`[DESPACHOS-C] Job ${jobId}: Consultando ${uniqueCedulas.size} cédulas únicas (onlyMissing=${onlyMissing})`);
      
      res.json({ success: true, jobId, total: uniqueCedulas.size });

      (async () => {
        const { XMLParser } = await import("fast-xml-parser");
        const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
        const cedulaCache = new Map<string, { valid: boolean; data: { venceLicencia: string } | null; error?: string }>();
        let progress = 0;

        const validatedRows = [];
        for (const row of rows) {
          const errors: string[] = [...row.errors.filter(e => !e.toLowerCase().includes("cédula"))];
          let cedulaValid: boolean | null = row.cedulaValid;
          let cedulaData = row.cedulaData;

          if (onlyMissing && row.cedulaValid === true) {
            validatedRows.push({ ...row, errors });
            continue;
          }

          if (row.cedula) {
            const cedulaKey = sanitizeCedula(row.cedula);
            
            if (cedulaCache.has(cedulaKey)) {
              const cached = cedulaCache.get(cedulaKey)!;
              cedulaValid = cached.valid;
              cedulaData = cached.data;
              if (!cached.valid && cached.error) errors.push(cached.error);
            } else {
              const storedConductor = await storage.getRndcConductorByCedula(cedulaKey);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              const parseDateDDMMYYYY = (dateStr: string): Date | null => {
                if (!dateStr) return null;
                const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                if (match) {
                  const [, day, month, year] = match;
                  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                }
                return null;
              };
              
              if (storedConductor && storedConductor.venceLicencia) {
                const licenseDate = parseDateDDMMYYYY(storedConductor.venceLicencia);
                const validCategories = ["C1", "C2", "C3"];
                const hasValidCategory = validCategories.includes((storedConductor.categoriaLicencia || "").toUpperCase());
                const isNotExpired = licenseDate && licenseDate >= today;
                
                if (hasValidCategory && isNotExpired) {
                  console.log(`[RNDC-C] Cédula ${cedulaKey} encontrada en BD interna. Licencia válida hasta ${storedConductor.venceLicencia}`);
                  cedulaValid = true;
                  cedulaData = { venceLicencia: storedConductor.venceLicencia, nombre: storedConductor.nombre || undefined };
                  cedulaCache.set(cedulaKey, { valid: true, data: cedulaData });
                  progress++;
                  const job = validationJobs.get(jobId);
                  if (job) { job.progress = progress; job.current = cedulaKey; }
                  validatedRows.push({ ...row, cedulaValid, cedulaData, errors });
                  continue;
                } else {
                  console.log(`[RNDC-C] Cédula ${cedulaKey} en BD pero licencia vencida o categoría inválida. Consultando RNDC...`);
                }
              }
              
              const xmlCedula = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<root>
 <acceso>
  <username>${credentials.username}</username>
  <password>${credentials.password}</password>
 </acceso>
 <solicitud>
  <tipo>3</tipo>
  <procesoid>11</procesoid>
 </solicitud>
 <variables>
INGRESOID,FECHAING,NUMLICENCIACONDUCCION,CODCATEGORIALICENCIACONDUCCION,FECHAVENCIMIENTOLICENCIA
 </variables>
 <documento>
  <NUMNITEMPRESATRANSPORTE>${credentials.nitEmpresa}</NUMNITEMPRESATRANSPORTE>
  <NUMIDTERCERO>${cedulaKey}</NUMIDTERCERO>
 </documento>
</root>`;
              
              try {
                console.log(`[RNDC-C] Cédula ${cedulaKey} XML enviado:\n${xmlCedula}`);
                const response = await sendXmlToRndc(xmlCedula);
                console.log(`[RNDC-C] Cédula ${cedulaKey}: success=${response.success}, code=${response.code}`);
                if (response.success) {
                  const parsedXml = parser.parse(response.rawXml);
                  let docs = parsedXml?.root?.documento;
                  if (!docs) {
                    cedulaValid = false;
                    console.log(`[RNDC-C] Cédula ${cedulaKey} sin documento. Raw: ${response.rawXml?.substring(0, 500)}`);
                    const err = `Cédula '${row.cedula}' no encontrada en RNDC`;
                    errors.push(err);
                    cedulaCache.set(cedulaKey, { valid: false, data: null, error: err });
                  } else {
                    if (!Array.isArray(docs)) docs = [docs];
                    
                    const validCategories = ["C1", "C2", "C3"];
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    const parseDateDDMMYYYY = (dateStr: string): Date | null => {
                      if (!dateStr) return null;
                      const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                      if (match) {
                        const [, day, month, year] = match;
                        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                      }
                      return null;
                    };
                    
                    // Log all records for debugging
                    docs.forEach((d: any, i: number) => {
                      const cat = String(d.codcategorialicenciaconduccion || d.CODCATEGORIALICENCIACONDUCCION || "");
                      const fechaStr = String(d.fechavencimientolicencia || d.FECHAVENCIMIENTOLICENCIA || "");
                      const fecha = parseDateDDMMYYYY(fechaStr);
                      const isValidCat = validCategories.includes(cat.toUpperCase());
                      const isNotExpired = fecha && fecha >= today;
                      console.log(`[RNDC-C] Cédula ${cedulaKey} doc[${i}]: cat=${cat}, fecha=${fechaStr}, validCat=${isValidCat}, noVencida=${isNotExpired}`);
                    });
                    
                    const validDocs = docs
                      .filter((d: any) => {
                        const cat = String(d.codcategorialicenciaconduccion || d.CODCATEGORIALICENCIACONDUCCION || "").toUpperCase();
                        return validCategories.includes(cat);
                      })
                      .filter((d: any) => {
                        const fechaStr = String(d.fechavencimientolicencia || d.FECHAVENCIMIENTOLICENCIA || "");
                        const fecha = parseDateDDMMYYYY(fechaStr);
                        return fecha && fecha >= today;
                      })
                      .sort((a: any, b: any) => {
                        const fechaA = parseDateDDMMYYYY(String(a.fechavencimientolicencia || a.FECHAVENCIMIENTOLICENCIA || ""));
                        const fechaB = parseDateDDMMYYYY(String(b.fechavencimientolicencia || b.FECHAVENCIMIENTOLICENCIA || ""));
                        if (!fechaA) return 1;
                        if (!fechaB) return -1;
                        return fechaB.getTime() - fechaA.getTime();
                      });
                    
                    console.log(`[RNDC-C] Cédula ${cedulaKey}: ${docs.length} registros, ${validDocs.length} válidos (C1/C2/C3 no vencidos)`);
                    
                    if (validDocs.length > 0) {
                      const bestDoc = validDocs[0];
                      cedulaValid = true;
                      const venceLicencia = String(bestDoc.fechavencimientolicencia || bestDoc.FECHAVENCIMIENTOLICENCIA || "");
                      const categoriaLicencia = String(bestDoc.codcategorialicenciaconduccion || bestDoc.CODCATEGORIALICENCIACONDUCCION || "");
                      const ingresoId = String(bestDoc.ingresoid || bestDoc.INGRESOID || "");
                      
                      cedulaData = { venceLicencia };
                      cedulaCache.set(cedulaKey, { valid: true, data: cedulaData });
                      
                      try {
                        await storage.upsertRndcConductor({
                          cedula: cedulaKey,
                          categoriaLicencia,
                          venceLicencia,
                          ingresoId,
                          rawXml: response.rawXml,
                          lastSyncedAt: new Date(),
                        });
                        console.log(`[RNDC-C] Cédula ${cedulaKey} guardada en BD interna`);
                      } catch (saveErr) {
                        console.log(`[RNDC-C] Error guardando cédula ${cedulaKey}: ${saveErr}`);
                      }
                    } else {
                      cedulaValid = false;
                      const err = `Cédula '${row.cedula}' sin licencia C1/C2/C3 vigente`;
                      errors.push(err);
                      cedulaCache.set(cedulaKey, { valid: false, data: null, error: err });
                    }
                  }
                } else {
                  cedulaValid = false;
                  console.log(`[RNDC-C] Cédula ${cedulaKey} error: ${response.message}. Raw: ${response.rawXml?.substring(0, 500)}`);
                  const err = `Error RNDC cédula: ${response.message}`;
                  errors.push(err);
                  cedulaCache.set(cedulaKey, { valid: false, data: null, error: err });
                }
              } catch (e) {
                cedulaValid = false;
                console.log(`[RNDC-C] Cédula ${cedulaKey} excepción: ${e}`);
                const err = `Error consultando cédula en RNDC`;
                errors.push(err);
                cedulaCache.set(cedulaKey, { valid: false, data: null, error: err });
              }
              
              progress++;
              const job = validationJobs.get(jobId);
              if (job) {
                job.progress = progress;
                job.current = cedulaKey;
              }
              
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          validatedRows.push({ ...row, cedulaValid, cedulaData, errors });
        }

        const job = validationJobs.get(jobId);
        if (job) {
          job.completed = true;
          job.rows = validatedRows;
        }
        console.log(`[DESPACHOS-C] Job ${jobId} completado. Cédulas consultadas: ${cedulaCache.size}`);
      })();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error consultando cédulas";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/despachos", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const despachos = await storage.getDespachos(limit);
      res.json({ success: true, despachos });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener despachos" });
    }
  });

  app.get("/api/despachos/:id", requireAuth, async (req, res) => {
    try {
      const despacho = await storage.getDespacho(req.params.id);
      if (!despacho) {
        return res.status(404).json({ success: false, message: "Despacho no encontrado" });
      }
      res.json({ success: true, despacho });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al obtener despacho" });
    }
  });

  app.post("/api/despachos", requireAuth, async (req, res) => {
    try {
      const { nombre, fecha, rows, remesas, manifiestos } = req.body;
      if (!nombre || !fecha || !rows) {
        return res.status(400).json({ success: false, message: "Datos incompletos" });
      }
      const validRows = rows.filter((r: any) => !r.errors?.length).length;
      const errorRows = rows.filter((r: any) => r.errors?.length > 0).length;
      
      // Determine status based on what's included
      let status = "draft";
      if (remesas?.length > 0 && manifiestos?.length > 0) {
        status = "completed";
      } else if (remesas?.length > 0) {
        status = "remesas_sent";
      }
      
      const despacho = await storage.createDespacho({
        nombre,
        fecha,
        totalRows: rows.length,
        validRows,
        errorRows,
        rows,
        remesas: remesas || null,
        manifiestos: manifiestos || null,
        status,
      });
      res.json({ success: true, despacho });
    } catch (error) {
      console.error("Error guardando despacho:", error);
      res.status(500).json({ success: false, message: "Error al guardar despacho" });
    }
  });

  app.put("/api/despachos/:id", requireAuth, async (req, res) => {
    try {
      const { rows, status, remesas, manifiestos } = req.body;
      const updates: any = {};
      if (rows) {
        updates.rows = rows;
        updates.validRows = rows.filter((r: any) => !r.errors?.length).length;
        updates.errorRows = rows.filter((r: any) => r.errors?.length > 0).length;
      }
      if (remesas !== undefined) updates.remesas = remesas;
      if (manifiestos !== undefined) updates.manifiestos = manifiestos;
      if (status) updates.status = status;
      const despacho = await storage.updateDespacho(req.params.id, updates);
      if (!despacho) {
        return res.status(404).json({ success: false, message: "Despacho no encontrado" });
      }
      res.json({ success: true, despacho });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al actualizar despacho" });
    }
  });

  app.delete("/api/despachos/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteDespacho(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error al eliminar despacho" });
    }
  });

  // Database backup endpoint - uses pg_dump with environment variable for security
  // Access control: Only available when BACKUP_ENABLED=true (feature flag for security)
  app.get("/api/system/backup", requireAuth, async (req, res) => {
    // Feature flag check - backup must be explicitly enabled
    if (process.env.BACKUP_ENABLED !== "true") {
      return res.status(403).json({ 
        success: false, 
        message: "Función de respaldo deshabilitada. Configure BACKUP_ENABLED=true para habilitar." 
      });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ success: false, message: "DATABASE_URL no configurada" });
    }

    try {
      // Parse DATABASE_URL to extract connection parameters
      const url = new URL(databaseUrl);
      const host = url.hostname;
      const port = url.port || "5432";
      const database = url.pathname.slice(1);
      const username = url.username;
      const password = decodeURIComponent(url.password);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `rndc-backup-${timestamp}.sql`;

      res.setHeader("Content-Type", "application/sql");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      // Use environment variable for password (more secure than command line)
      const pgDump = spawn("pg_dump", [
        "-h", host,
        "-p", port,
        "-U", username,
        "-d", database,
        "--no-owner",
        "--no-acl",
        "--clean",
        "--if-exists",
      ], {
        env: {
          ...process.env,
          PGPASSWORD: password,
        },
      });

      let hasError = false;

      pgDump.stdout.pipe(res);

      pgDump.stderr.on("data", (data) => {
        console.error("pg_dump stderr:", data.toString());
      });

      pgDump.on("error", (error) => {
        hasError = true;
        console.error("pg_dump error:", error);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Error ejecutando backup" });
        }
      });

      pgDump.on("close", (code) => {
        if (code !== 0 && !hasError) {
          console.error(`pg_dump exited with code ${code}`);
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: `pg_dump falló con código ${code}` });
          }
        }
      });
    } catch (error) {
      console.error("Backup error:", error);
      res.status(500).json({ success: false, message: "Error generando backup" });
    }
  });

  return httpServer;
}

async function processSubmissionsAsync(batchId: string, submissionIds: string[], wsUrl?: string) {
  let successCount = 0;
  let errorCount = 0;

  try {
    for (const submissionId of submissionIds) {
      try {
        const submission = await storage.getRndcSubmission(submissionId);
        if (!submission) {
          errorCount++;
          continue;
        }

        await storage.updateRndcSubmission(submissionId, { status: "processing" });

        const response = await sendXmlToRndc(submission.xmlRequest, wsUrl);

        await storage.updateRndcSubmission(submissionId, {
          status: response.success ? "success" : "error",
          xmlResponse: response.rawXml,
          responseCode: response.code,
          responseMessage: response.message,
          processedAt: new Date(),
        });

        if (response.success) {
          successCount++;
        } else {
          errorCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        errorCount++;
        try {
          await storage.updateRndcSubmission(submissionId, {
            status: "error",
            responseMessage: error instanceof Error ? error.message : "Error desconocido",
            processedAt: new Date(),
          });
        } catch {
          console.error(`Failed to update submission ${submissionId} status`);
        }
      }

      const pendingCount = submissionIds.length - successCount - errorCount;
      try {
        await storage.updateRndcBatch(batchId, {
          successCount,
          errorCount,
          pendingCount,
        });
      } catch {
        console.error(`Failed to update batch ${batchId} progress`);
      }
    }
  } finally {
    try {
      await storage.updateRndcBatch(batchId, {
        status: "completed",
        completedAt: new Date(),
        successCount,
        errorCount,
        pendingCount: 0,
      });
    } catch {
      console.error(`Failed to mark batch ${batchId} as completed`);
    }
  }
}

async function processCumplidoRemesaAsync(batchId: string, submissionIds: string[], wsUrl?: string) {
  let successCount = 0;
  let errorCount = 0;

  try {
    for (const submissionId of submissionIds) {
      try {
        const submission = await storage.getCumplidoRemesaSubmission(submissionId);
        if (!submission) {
          errorCount++;
          continue;
        }

        await storage.updateCumplidoRemesaSubmission(submissionId, { status: "processing" });

        const response = await sendXmlToRndc(submission.xmlCumplidoRequest, wsUrl);

        await storage.updateCumplidoRemesaSubmission(submissionId, {
          status: response.success ? "success" : "error",
          xmlResponse: response.rawXml,
          responseCode: response.code,
          responseMessage: response.message,
          processedAt: new Date(),
        });

        if (response.success) {
          successCount++;
        } else {
          errorCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        errorCount++;
        try {
          await storage.updateCumplidoRemesaSubmission(submissionId, {
            status: "error",
            responseMessage: error instanceof Error ? error.message : "Error desconocido",
            processedAt: new Date(),
          });
        } catch {
          console.error(`Failed to update cumplido ${submissionId} status`);
        }
      }

      const pendingCount = submissionIds.length - successCount - errorCount;
      try {
        await storage.updateRndcBatch(batchId, {
          successCount,
          errorCount,
          pendingCount,
        });
      } catch {
        console.error(`Failed to update batch ${batchId} progress`);
      }
    }
  } finally {
    try {
      await storage.updateRndcBatch(batchId, {
        status: "completed",
        completedAt: new Date(),
        successCount,
        errorCount,
        pendingCount: 0,
      });
    } catch {
      console.error(`Failed to mark batch ${batchId} as completed`);
    }
  }
}

async function processCumplidoManifiestoAsync(batchId: string, submissionIds: string[], wsUrl?: string) {
  let successCount = 0;
  let errorCount = 0;

  try {
    for (const submissionId of submissionIds) {
      try {
        const submission = await storage.getCumplidoManifiestoSubmission(submissionId);
        if (!submission) {
          errorCount++;
          continue;
        }

        await storage.updateCumplidoManifiestoSubmission(submissionId, { status: "processing" });

        const response = await sendXmlToRndc(submission.xmlCumplidoRequest, wsUrl);

        await storage.updateCumplidoManifiestoSubmission(submissionId, {
          status: response.success ? "success" : "error",
          xmlResponse: response.rawXml,
          responseCode: response.code,
          responseMessage: response.message,
          processedAt: new Date(),
        });

        if (response.success) {
          successCount++;
        } else {
          errorCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        errorCount++;
        try {
          await storage.updateCumplidoManifiestoSubmission(submissionId, {
            status: "error",
            responseMessage: error instanceof Error ? error.message : "Error desconocido",
            processedAt: new Date(),
          });
        } catch {
          console.error(`Failed to update manifiesto ${submissionId} status`);
        }
      }

      const pendingCount = submissionIds.length - successCount - errorCount;
      try {
        await storage.updateRndcBatch(batchId, {
          successCount,
          errorCount,
          pendingCount,
        });
      } catch {
        console.error(`Failed to update batch ${batchId} progress`);
      }
    }
  } finally {
    try {
      await storage.updateRndcBatch(batchId, {
        status: "completed",
        completedAt: new Date(),
        successCount,
        errorCount,
        pendingCount: 0,
      });
    } catch {
      console.error(`Failed to mark batch ${batchId} as completed`);
    }
  }
}

async function processRemesaAsync(batchId: string, submissionIds: string[], wsUrl?: string) {
  let successCount = 0;
  let errorCount = 0;

  try {
    for (const submissionId of submissionIds) {
      try {
        const submission = await storage.getRemesaSubmission(submissionId);
        if (!submission) {
          errorCount++;
          continue;
        }

        await storage.updateRemesaSubmission(submissionId, { status: "processing" });

        const response = await sendXmlToRndc(submission.xmlRequest, wsUrl);

        let idRemesa: string | null = null;
        if (response.success && response.rawXml) {
          const idMatch = response.rawXml.match(/<IDREMESA>([^<]+)<\/IDREMESA>/i);
          if (idMatch) {
            idRemesa = idMatch[1];
          }
        }

        await storage.updateRemesaSubmission(submissionId, {
          status: response.success ? "success" : "error",
          xmlResponse: response.rawXml,
          responseCode: response.code,
          responseMessage: response.message,
          idRemesa: idRemesa,
          processedAt: new Date(),
        });

        if (response.success) {
          successCount++;
        } else {
          errorCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        errorCount++;
        try {
          await storage.updateRemesaSubmission(submissionId, {
            status: "error",
            responseMessage: error instanceof Error ? error.message : "Error desconocido",
            processedAt: new Date(),
          });
        } catch {
          console.error(`Failed to update remesa ${submissionId} status`);
        }
      }

      const pendingCount = submissionIds.length - successCount - errorCount;
      try {
        await storage.updateRndcBatch(batchId, {
          successCount,
          errorCount,
          pendingCount,
        });
      } catch {
        console.error(`Failed to update remesa batch ${batchId} progress`);
      }
    }
  } finally {
    try {
      await storage.updateRndcBatch(batchId, {
        status: "completed",
        completedAt: new Date(),
        successCount,
        errorCount,
        pendingCount: 0,
      });
    } catch {
      console.error(`Failed to mark remesa batch ${batchId} as completed`);
    }
  }
}

async function processManifiestoAsync(batchId: string, submissionIds: string[], wsUrl: string) {
  let successCount = 0;
  let errorCount = 0;

  try {
    for (const submissionId of submissionIds) {
      try {
        const submission = await storage.getManifiestoSubmission(submissionId);
        if (!submission) {
          errorCount++;
          continue;
        }

        await storage.updateManifiestoSubmission(submissionId, { status: "processing" });

        const response = await sendXmlToRndc(submission.xmlRequest, wsUrl);

        let idManifiesto: string | null = null;
        if (response.success) {
          // Try multiple extraction methods
          if (response.rawXml) {
            // Method 1: Look for INGRESOIDMANIFIESTO tag
            const idMatch = response.rawXml.match(/<INGRESOIDMANIFIESTO>([^<]+)<\/INGRESOIDMANIFIESTO>/i);
            if (idMatch) {
              idManifiesto = idMatch[1];
            }
            // Method 2: Look for ingresoid tag
            if (!idManifiesto) {
              const ingresoidMatch = response.rawXml.match(/<ingresoid>([^<]+)<\/ingresoid>/i);
              if (ingresoidMatch) {
                idManifiesto = ingresoidMatch[1];
              }
            }
          }
          // Method 3: Use the response code (which often contains the ID for successful submissions)
          if (!idManifiesto && response.code && /^\d+$/.test(response.code)) {
            idManifiesto = response.code;
          }
        }

        await storage.updateManifiestoSubmission(submissionId, {
          status: response.success ? "success" : "error",
          xmlResponse: response.rawXml,
          responseCode: response.code,
          responseMessage: response.message,
          idManifiesto: idManifiesto,
          processedAt: new Date(),
        });

        if (response.success) {
          successCount++;
        } else {
          errorCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        errorCount++;
        try {
          await storage.updateManifiestoSubmission(submissionId, {
            status: "error",
            responseMessage: error instanceof Error ? error.message : "Error desconocido",
            processedAt: new Date(),
          });
        } catch {
          console.error(`Failed to update manifiesto ${submissionId} status`);
        }
      }

      const pendingCount = submissionIds.length - successCount - errorCount;
      try {
        await storage.updateRndcBatch(batchId, {
          successCount,
          errorCount,
          pendingCount,
        });
      } catch {
        console.error(`Failed to update manifiesto batch ${batchId} progress`);
      }
    }
  } finally {
    try {
      await storage.updateRndcBatch(batchId, {
        status: "completed",
        completedAt: new Date(),
        successCount,
        errorCount,
        pendingCount: 0,
      });
    } catch {
      console.error(`Failed to mark manifiesto batch ${batchId} as completed`);
    }
  }
}
