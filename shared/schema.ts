import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const rndcSubmissions = pgTable("rndc_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull(),
  ingresoidmanifiesto: varchar("ingresoidmanifiesto").notNull(),
  numidgps: varchar("numidgps").notNull(),
  numplaca: varchar("numplaca").notNull(),
  codpuntocontrol: varchar("codpuntocontrol").notNull(),
  latitud: varchar("latitud").notNull(),
  longitud: varchar("longitud").notNull(),
  fechallegada: varchar("fechallegada").notNull(),
  horallegada: varchar("horallegada").notNull(),
  fechasalida: varchar("fechasalida").notNull(),
  horasalida: varchar("horasalida").notNull(),
  xmlRequest: text("xml_request").notNull(),
  xmlResponse: text("xml_response"),
  status: varchar("status").notNull().default("pending"),
  responseCode: varchar("response_code"),
  responseMessage: text("response_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertRndcSubmissionSchema = createInsertSchema(rndcSubmissions).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertRndcSubmission = z.infer<typeof insertRndcSubmissionSchema>;
export type RndcSubmission = typeof rndcSubmissions.$inferSelect;

export const rndcBatches = pgTable("rndc_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull().default("puntos_control"),
  totalRecords: integer("total_records").notNull(),
  successCount: integer("success_count").default(0),
  errorCount: integer("error_count").default(0),
  pendingCount: integer("pending_count").notNull(),
  status: varchar("status").notNull().default("processing"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertRndcBatchSchema = createInsertSchema(rndcBatches).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertRndcBatch = z.infer<typeof insertRndcBatchSchema>;
export type RndcBatch = typeof rndcBatches.$inferSelect;

export const cumplidoRemesaSubmissions = pgTable("cumplido_remesa_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull(),
  consecutivoRemesa: varchar("consecutivo_remesa").notNull(),
  numNitEmpresa: varchar("num_nit_empresa").notNull(),
  numPlaca: varchar("num_placa").notNull(),
  origen: varchar("origen"),
  destino: varchar("destino"),
  fechaEntradaCargue: varchar("fecha_entrada_cargue").notNull(),
  horaEntradaCargue: varchar("hora_entrada_cargue").notNull(),
  fechaEntradaDescargue: varchar("fecha_entrada_descargue").notNull(),
  horaEntradaDescargue: varchar("hora_entrada_descargue").notNull(),
  cantidadCargada: varchar("cantidad_cargada").notNull(),
  cantidadEntregada: varchar("cantidad_entregada").notNull(),
  xmlQueryRequest: text("xml_query_request"),
  xmlCumplidoRequest: text("xml_cumplido_request").notNull(),
  xmlResponse: text("xml_response"),
  status: varchar("status").notNull().default("pending"),
  responseCode: varchar("response_code"),
  responseMessage: text("response_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertCumplidoRemesaSubmissionSchema = createInsertSchema(cumplidoRemesaSubmissions).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertCumplidoRemesaSubmission = z.infer<typeof insertCumplidoRemesaSubmissionSchema>;
export type CumplidoRemesaSubmission = typeof cumplidoRemesaSubmissions.$inferSelect;

export const cumplidoManifiestoSubmissions = pgTable("cumplido_manifiesto_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull(),
  numManifiestoCarga: varchar("num_manifiesto_carga").notNull(),
  numNitEmpresa: varchar("num_nit_empresa").notNull(),
  numPlaca: varchar("num_placa").notNull(),
  origen: varchar("origen"),
  destino: varchar("destino"),
  fechaEntregaDocumentos: varchar("fecha_entrega_documentos").notNull(),
  xmlCumplidoRequest: text("xml_cumplido_request").notNull(),
  xmlResponse: text("xml_response"),
  status: varchar("status").notNull().default("pending"),
  responseCode: varchar("response_code"),
  responseMessage: text("response_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertCumplidoManifiestoSubmissionSchema = createInsertSchema(cumplidoManifiestoSubmissions).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertCumplidoManifiestoSubmission = z.infer<typeof insertCumplidoManifiestoSubmissionSchema>;
export type CumplidoManifiestoSubmission = typeof cumplidoManifiestoSubmissions.$inferSelect;
