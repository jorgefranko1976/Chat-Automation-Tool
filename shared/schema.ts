import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});

export const updateUserProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  username: z.string().min(3).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;

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

export const remesaSubmissions = pgTable("remesa_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull(),
  consecutivoRemesa: varchar("consecutivo_remesa").notNull(),
  numNitEmpresa: varchar("num_nit_empresa").notNull(),
  numPlaca: varchar("num_placa").notNull(),
  cantidadCargada: varchar("cantidad_cargada").notNull(),
  fechaCargue: varchar("fecha_cargue").notNull(),
  horaCargue: varchar("hora_cargue").notNull(),
  fechaDescargue: varchar("fecha_descargue").notNull(),
  horaDescargue: varchar("hora_descargue").notNull(),
  sedeRemitente: varchar("sede_remitente"),
  sedeDestinatario: varchar("sede_destinatario"),
  codMunicipioOrigen: varchar("cod_municipio_origen"),
  codMunicipioDestino: varchar("cod_municipio_destino"),
  tipoIdPropietario: varchar("tipo_id_propietario"),
  numIdPropietario: varchar("num_id_propietario"),
  cedula: varchar("cedula"),
  valorFlete: integer("valor_flete"),
  xmlRequest: text("xml_request").notNull(),
  xmlResponse: text("xml_response"),
  status: varchar("status").notNull().default("pending"),
  responseCode: varchar("response_code"),
  responseMessage: text("response_message"),
  idRemesa: varchar("id_remesa"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertRemesaSubmissionSchema = createInsertSchema(remesaSubmissions).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertRemesaSubmission = z.infer<typeof insertRemesaSubmissionSchema>;
export type RemesaSubmission = typeof remesaSubmissions.$inferSelect;

export const manifiestoSubmissions = pgTable("manifiesto_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull(),
  consecutivoManifiesto: varchar("consecutivo_manifiesto").notNull(),
  numNitEmpresa: varchar("num_nit_empresa").notNull(),
  numPlaca: varchar("num_placa").notNull(),
  xmlRequest: text("xml_request").notNull(),
  xmlResponse: text("xml_response"),
  status: varchar("status").notNull().default("pending"),
  responseCode: varchar("response_code"),
  responseMessage: text("response_message"),
  idManifiesto: varchar("id_manifiesto"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertManifiestoSubmissionSchema = createInsertSchema(manifiestoSubmissions).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertManifiestoSubmission = z.infer<typeof insertManifiestoSubmissionSchema>;
export type ManifiestoSubmission = typeof manifiestoSubmissions.$inferSelect;

export const monitoringQueries = pgTable("monitoring_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryType: varchar("query_type").notNull(),
  numIdGps: varchar("num_id_gps"),
  manifestId: varchar("manifest_id"),
  xmlRequest: text("xml_request").notNull(),
  xmlResponse: text("xml_response"),
  manifestsCount: integer("manifests_count").default(0),
  manifestsData: text("manifests_data"),
  status: varchar("status").notNull().default("pending"),
  responseCode: varchar("response_code"),
  responseMessage: text("response_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMonitoringQuerySchema = createInsertSchema(monitoringQueries).omit({
  id: true,
  createdAt: true,
});

export type InsertMonitoringQuery = z.infer<typeof insertMonitoringQuerySchema>;
export type MonitoringQuery = typeof monitoringQueries.$inferSelect;

export const rndcManifests = pgTable("rndc_manifests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryId: varchar("query_id"),
  ingresoIdManifiesto: varchar("ingreso_id_manifiesto").notNull(),
  numNitEmpresaTransporte: varchar("num_nit_empresa_transporte").notNull(),
  fechaExpedicionManifiesto: varchar("fecha_expedicion_manifiesto"),
  codigoEmpresa: varchar("codigo_empresa"),
  numManifiestoCarga: varchar("num_manifiesto_carga").notNull(),
  numPlaca: varchar("num_placa").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRndcManifestSchema = createInsertSchema(rndcManifests).omit({
  id: true,
  createdAt: true,
});

export type InsertRndcManifest = z.infer<typeof insertRndcManifestSchema>;
export type RndcManifest = typeof rndcManifests.$inferSelect;

export const rndcControlPoints = pgTable("rndc_control_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  manifestId: varchar("manifest_id").notNull(),
  codPuntoControl: varchar("cod_punto_control").notNull(),
  codMunicipio: varchar("cod_municipio"),
  direccion: varchar("direccion"),
  fechaCita: varchar("fecha_cita"),
  horaCita: varchar("hora_cita"),
  latitud: varchar("latitud"),
  longitud: varchar("longitud"),
  tiempoPactado: varchar("tiempo_pactado"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRndcControlPointSchema = createInsertSchema(rndcControlPoints).omit({
  id: true,
  createdAt: true,
});

export type InsertRndcControlPoint = z.infer<typeof insertRndcControlPointSchema>;
export type RndcControlPoint = typeof rndcControlPoints.$inferSelect;

export const rndcQueries = pgTable("rndc_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryType: varchar("query_type").notNull(),
  queryName: varchar("query_name").notNull(),
  numNitEmpresa: varchar("num_nit_empresa"),
  numIdTercero: varchar("num_id_tercero"),
  xmlRequest: text("xml_request").notNull(),
  xmlResponse: text("xml_response"),
  responseData: text("response_data"),
  status: varchar("status").notNull().default("pending"),
  responseCode: varchar("response_code"),
  responseMessage: text("response_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRndcQuerySchema = createInsertSchema(rndcQueries).omit({
  id: true,
  createdAt: true,
});

export type InsertRndcQuery = z.infer<typeof insertRndcQuerySchema>;
export type RndcQuery = typeof rndcQueries.$inferSelect;

export const terceros = pgTable("terceros", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tipoTercero: varchar("tipo_tercero").notNull(),
  tipoIdentificacion: varchar("tipo_identificacion").notNull(),
  numeroIdentificacion: varchar("numero_identificacion").notNull(),
  nombre: varchar("nombre").notNull(),
  primerApellido: varchar("primer_apellido"),
  segundoApellido: varchar("segundo_apellido"),
  codigoGranja: varchar("codigo_granja"),
  flete: varchar("flete"),
  sede: varchar("sede"),
  nombreSede: varchar("nombre_sede"),
  telefonoFijo: varchar("telefono_fijo"),
  celular: varchar("celular"),
  regimenSimple: varchar("regimen_simple"),
  direccion: varchar("direccion"),
  pais: varchar("pais").default("COLOMBIA"),
  codPais: varchar("cod_pais").default("169"),
  municipio: varchar("municipio"),
  codMunicipioRndc: varchar("cod_municipio_rndc"),
  latitud: varchar("latitud"),
  longitud: varchar("longitud"),
  email: varchar("email"),
  categoriaLicencia: varchar("categoria_licencia"),
  licencia: varchar("licencia"),
  vencimientoLicencia: varchar("vencimiento_licencia"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTerceroSchema = createInsertSchema(terceros).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTercero = z.infer<typeof insertTerceroSchema>;
export type Tercero = typeof terceros.$inferSelect;

export const vehiculos = pgTable("vehiculos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  placa: varchar("placa").notNull().unique(),
  // Propietario
  propietarioTipoId: varchar("propietario_tipo_id").default("CC"),
  propietarioNumeroId: varchar("propietario_numero_id"),
  propietarioNombre: varchar("propietario_nombre"),
  propietarioDireccion: varchar("propietario_direccion"),
  propietarioTelefono: varchar("propietario_telefono"),
  // Conductor
  conductorCc: varchar("conductor_cc"),
  conductorNombre: varchar("conductor_nombre"),
  conductorDireccion: varchar("conductor_direccion"),
  conductorTelefono: varchar("conductor_telefono"),
  // Fechas vencimiento
  venceSoat: varchar("vence_soat"),
  venceLicenciaConduccion: varchar("vence_licencia_conduccion"),
  venceTecnicomecanica: varchar("vence_tecnomecanica"),
  // Otros
  toneladas: varchar("toneladas"),
  comparendos: varchar("comparendos"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVehiculoSchema = createInsertSchema(vehiculos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVehiculo = z.infer<typeof insertVehiculoSchema>;
export type Vehiculo = typeof vehiculos.$inferSelect;

export const rndcVehiculos = pgTable("rndc_vehiculos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  placa: varchar("placa").notNull().unique(),
  propietarioTipoId: varchar("propietario_tipo_id"),
  propietarioNumeroId: varchar("propietario_numero_id"),
  propietarioNombre: varchar("propietario_nombre"),
  venceSoat: varchar("vence_soat"),
  venceTecnicomecanica: varchar("vence_tecnomecanica"),
  pesoVacio: varchar("peso_vacio"),
  ingresoId: varchar("ingreso_id"),
  rawXml: text("raw_xml"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRndcVehiculoSchema = createInsertSchema(rndcVehiculos).omit({
  id: true,
  createdAt: true,
});

export type InsertRndcVehiculo = z.infer<typeof insertRndcVehiculoSchema>;
export type RndcVehiculo = typeof rndcVehiculos.$inferSelect;

export const rndcConductores = pgTable("rndc_conductores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cedula: varchar("cedula").notNull().unique(),
  nombre: varchar("nombre"),
  primerApellido: varchar("primer_apellido"),
  segundoApellido: varchar("segundo_apellido"),
  categoriaLicencia: varchar("categoria_licencia"),
  venceLicencia: varchar("vence_licencia"),
  ingresoId: varchar("ingreso_id"),
  direccion: varchar("direccion"),
  telefono: varchar("telefono"),
  placa: varchar("placa"),
  observaciones: text("observaciones"),
  rawXml: text("raw_xml"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRndcConductorSchema = createInsertSchema(rndcConductores).omit({
  id: true,
  createdAt: true,
});

export type InsertRndcConductor = z.infer<typeof insertRndcConductorSchema>;
export type RndcConductor = typeof rndcConductores.$inferSelect;

export const despachos = pgTable("despachos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre").notNull(),
  fecha: varchar("fecha").notNull(),
  totalRows: integer("total_rows").notNull(),
  validRows: integer("valid_rows").default(0),
  errorRows: integer("error_rows").default(0),
  rows: jsonb("rows").notNull(),
  remesas: jsonb("remesas"),
  manifiestos: jsonb("manifiestos"),
  status: varchar("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDespachoSchema = createInsertSchema(despachos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDespacho = z.infer<typeof insertDespachoSchema>;
export type Despacho = typeof despachos.$inferSelect;
