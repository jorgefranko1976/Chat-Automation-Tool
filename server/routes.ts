import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendXmlToRndc } from "./rndc-service";
import { insertRndcSubmissionSchema } from "@shared/schema";
import { z } from "zod";

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

const rndcQuerySchema = z.object({
  queryType: z.string(),
  queryName: z.string(),
  numNitEmpresa: z.string().optional(),
  numIdTercero: z.string().optional(),
  xmlRequest: z.string(),
  wsUrl: z.string().url().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
      const targetUrl = wsUrl || "https://rndc.mintransporte.gov.co/MenuPrincipal/tablogin/loginWebService.asmx";
      
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
