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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
