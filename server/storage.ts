import { eq, desc, sql, and, like, gte, lte } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  rndcSubmissions,
  rndcBatches,
  cumplidoRemesaSubmissions,
  cumplidoManifiestoSubmissions,
  remesaSubmissions,
  manifiestoSubmissions,
  monitoringQueries,
  rndcManifests,
  rndcControlPoints,
  rndcQueries,
  terceros,
  vehiculos,
  rndcVehiculos,
  rndcConductores,
  despachos,
  destinos,
  pdfTemplates,
  qrConfigs,
  type User,
  type InsertUser,
  type UpdateUserProfile,
  type RndcSubmission,
  type InsertRndcSubmission,
  type RndcBatch,
  type InsertRndcBatch,
  type CumplidoRemesaSubmission,
  type InsertCumplidoRemesaSubmission,
  type CumplidoManifiestoSubmission,
  type InsertCumplidoManifiestoSubmission,
  type RemesaSubmission,
  type InsertRemesaSubmission,
  type ManifiestoSubmission,
  type InsertManifiestoSubmission,
  type MonitoringQuery,
  type InsertMonitoringQuery,
  type RndcManifest,
  type InsertRndcManifest,
  type RndcControlPoint,
  type InsertRndcControlPoint,
  type RndcQuery,
  type InsertRndcQuery,
  type Tercero,
  type InsertTercero,
  type Vehiculo,
  type InsertVehiculo,
  type RndcVehiculo,
  type InsertRndcVehiculo,
  type RndcConductor,
  type InsertRndcConductor,
  type Despacho,
  type InsertDespacho,
  type Destino,
  type InsertDestino,
  type PdfTemplate,
  type InsertPdfTemplate,
  type QrConfig,
  type InsertQrConfig,
  type QRFieldConfig,
} from "@shared/schema";

export interface DashboardStats {
  queriesToday: number;
  batchesToday: number;
  submissionsToday: number;
  submissionsSuccessToday: number;
  submissionsErrorToday: number;
  totalBatches: number;
  totalSuccessRate: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: string, updates: UpdateUserProfile): Promise<User | undefined>;
  updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined>;
  updateUserLastLogin(id: string): Promise<void>;
  
  getDashboardStats(): Promise<DashboardStats>;
  
  createRndcBatch(batch: InsertRndcBatch): Promise<RndcBatch>;
  getRndcBatch(id: string): Promise<RndcBatch | undefined>;
  updateRndcBatch(id: string, updates: Partial<RndcBatch>): Promise<RndcBatch | undefined>;
  getRndcBatches(limit?: number): Promise<RndcBatch[]>;
  
  createRndcSubmission(submission: InsertRndcSubmission): Promise<RndcSubmission>;
  getRndcSubmission(id: string): Promise<RndcSubmission | undefined>;
  updateRndcSubmission(id: string, updates: Partial<RndcSubmission>): Promise<RndcSubmission | undefined>;
  getRndcSubmissionsByBatch(batchId: string): Promise<RndcSubmission[]>;
  getPendingSubmissions(limit?: number): Promise<RndcSubmission[]>;
  getRecentSubmissions(limit?: number): Promise<RndcSubmission[]>;
  
  createCumplidoRemesaSubmission(submission: InsertCumplidoRemesaSubmission): Promise<CumplidoRemesaSubmission>;
  getCumplidoRemesaSubmission(id: string): Promise<CumplidoRemesaSubmission | undefined>;
  updateCumplidoRemesaSubmission(id: string, updates: Partial<CumplidoRemesaSubmission>): Promise<CumplidoRemesaSubmission | undefined>;
  getCumplidoRemesaSubmissionsByBatch(batchId: string): Promise<CumplidoRemesaSubmission[]>;
  
  createCumplidoManifiestoSubmission(submission: InsertCumplidoManifiestoSubmission): Promise<CumplidoManifiestoSubmission>;
  getCumplidoManifiestoSubmission(id: string): Promise<CumplidoManifiestoSubmission | undefined>;
  updateCumplidoManifiestoSubmission(id: string, updates: Partial<CumplidoManifiestoSubmission>): Promise<CumplidoManifiestoSubmission | undefined>;
  getCumplidoManifiestoSubmissionsByBatch(batchId: string): Promise<CumplidoManifiestoSubmission[]>;
  
  createRemesaSubmission(submission: InsertRemesaSubmission): Promise<RemesaSubmission>;
  getRemesaSubmission(id: string): Promise<RemesaSubmission | undefined>;
  updateRemesaSubmission(id: string, updates: Partial<RemesaSubmission>): Promise<RemesaSubmission | undefined>;
  getRemesaSubmissionsByBatch(batchId: string): Promise<RemesaSubmission[]>;
  getAllRemesaSubmissions(limit?: number): Promise<RemesaSubmission[]>;
  
  createManifiestoSubmission(submission: InsertManifiestoSubmission): Promise<ManifiestoSubmission>;
  getManifiestoSubmission(id: string): Promise<ManifiestoSubmission | undefined>;
  updateManifiestoSubmission(id: string, updates: Partial<ManifiestoSubmission>): Promise<ManifiestoSubmission | undefined>;
  getManifiestoSubmissionsByBatch(batchId: string): Promise<ManifiestoSubmission[]>;
  getAllManifiestoSubmissions(limit?: number): Promise<ManifiestoSubmission[]>;
  
  getRndcBatchesByType(type: string, limit?: number): Promise<RndcBatch[]>;
  
  createMonitoringQuery(query: InsertMonitoringQuery): Promise<MonitoringQuery>;
  getMonitoringQuery(id: string): Promise<MonitoringQuery | undefined>;
  updateMonitoringQuery(id: string, updates: Partial<MonitoringQuery>): Promise<MonitoringQuery | undefined>;
  getMonitoringQueries(limit?: number): Promise<MonitoringQuery[]>;
  
  createRndcManifest(manifest: InsertRndcManifest): Promise<RndcManifest>;
  getRndcManifests(limit?: number, offset?: number): Promise<RndcManifest[]>;
  getRndcManifestCount(): Promise<number>;
  getRndcManifestByIngresoId(ingresoId: string): Promise<RndcManifest | undefined>;
  searchRndcManifestByQuery(query: string): Promise<RndcManifest | undefined>;
  searchRndcManifests(filters: ManifestSearchFilters, limit?: number, offset?: number): Promise<{ manifests: RndcManifest[]; total: number }>;
  
  createRndcControlPoint(controlPoint: InsertRndcControlPoint): Promise<RndcControlPoint>;
  getRndcControlPointsByManifest(manifestId: string): Promise<RndcControlPoint[]>;
  
  createRndcQuery(query: InsertRndcQuery): Promise<RndcQuery>;
  getRndcQuery(id: string): Promise<RndcQuery | undefined>;
  updateRndcQuery(id: string, updates: Partial<RndcQuery>): Promise<RndcQuery | undefined>;
  getRndcQueries(limit?: number): Promise<RndcQuery[]>;
  getRndcQueriesByType(queryType: string, limit?: number): Promise<RndcQuery[]>;
  
  createTercero(tercero: InsertTercero): Promise<Tercero>;
  getTercero(id: string): Promise<Tercero | undefined>;
  getTerceroByIdentificacion(tipoId: string, numeroId: string): Promise<Tercero | undefined>;
  getTerceroByCodigoGranja(codigoGranja: string): Promise<Tercero | undefined>;
  getTerceroByCodigoGranjaBase(codigoGranjaBase: string): Promise<Tercero | undefined>;
  getTerceroByNombreSede(nombreSede: string): Promise<Tercero | undefined>;
  updateTercero(id: string, updates: Partial<Tercero>): Promise<Tercero | undefined>;
  deleteTercero(id: string): Promise<void>;
  getTerceros(tipoTercero?: string, limit?: number): Promise<Tercero[]>;
  searchTerceros(query: string, tipoTercero?: string): Promise<Tercero[]>;
  upsertTerceroByCodigoGranja(tercero: InsertTercero): Promise<{ tercero: Tercero; isNew: boolean }>;
  
  createVehiculo(vehiculo: InsertVehiculo): Promise<Vehiculo>;
  getVehiculo(id: string): Promise<Vehiculo | undefined>;
  getVehiculoByPlaca(placa: string): Promise<Vehiculo | undefined>;
  updateVehiculo(id: string, updates: Partial<Vehiculo>): Promise<Vehiculo | undefined>;
  deleteVehiculo(id: string): Promise<void>;
  getVehiculos(limit?: number): Promise<Vehiculo[]>;
  searchVehiculos(query: string): Promise<Vehiculo[]>;
  
  getRndcVehiculoByPlaca(placa: string): Promise<RndcVehiculo | undefined>;
  getRndcVehiculosByPlacas(placas: string[]): Promise<RndcVehiculo[]>;
  upsertRndcVehiculo(vehiculo: InsertRndcVehiculo): Promise<RndcVehiculo>;
  
  getRndcConductorByCedula(cedula: string): Promise<RndcConductor | undefined>;
  getRndcConductoresByCedulas(cedulas: string[]): Promise<RndcConductor[]>;
  upsertRndcConductor(conductor: InsertRndcConductor): Promise<RndcConductor>;
  getRndcConductores(limit?: number): Promise<RndcConductor[]>;
  searchRndcConductores(query: string): Promise<RndcConductor[]>;
  updateRndcConductor(id: string, updates: Partial<RndcConductor>): Promise<void>;
  deleteRndcConductor(id: string): Promise<void>;
  
  createDespacho(despacho: InsertDespacho): Promise<Despacho>;
  getDespacho(id: string): Promise<Despacho | undefined>;
  updateDespacho(id: string, updates: Partial<Despacho>): Promise<Despacho | undefined>;
  deleteDespacho(id: string): Promise<void>;
  getDespachos(limit?: number): Promise<Despacho[]>;
  
  createDestino(destino: InsertDestino): Promise<Destino>;
  getDestino(id: string): Promise<Destino | undefined>;
  getDestinoByCodSede(numIdTercero: string, codSede: string): Promise<Destino | undefined>;
  getDestinoByNombreSede(nombreSede: string): Promise<Destino | undefined>;
  getDestinoByCodMunicipioRndc(codMunicipioRndc: string): Promise<Destino | undefined>;
  getMunicipioNameByCode(codMunicipioRndc: string): Promise<string>;
  updateDestino(id: string, updates: Partial<Destino>): Promise<Destino | undefined>;
  deleteDestino(id: string): Promise<void>;
  getDestinos(limit?: number): Promise<Destino[]>;
  searchDestinos(query: string): Promise<Destino[]>;
  upsertDestino(destino: InsertDestino): Promise<{ destino: Destino; isNew: boolean }>;
  
  createPdfTemplate(template: InsertPdfTemplate): Promise<PdfTemplate>;
  getPdfTemplate(id: string): Promise<PdfTemplate | undefined>;
  getPdfTemplatesByUser(userId: string): Promise<PdfTemplate[]>;
  getDefaultPdfTemplate(userId: string, templateType: string): Promise<PdfTemplate | undefined>;
  updatePdfTemplate(id: string, updates: Partial<PdfTemplate>): Promise<PdfTemplate | undefined>;
  deletePdfTemplate(id: string): Promise<void>;
  setDefaultPdfTemplate(id: string, userId: string): Promise<void>;
  
  getQrConfig(userId: string): Promise<QrConfig | undefined>;
  upsertQrConfig(userId: string, fields: QRFieldConfig[]): Promise<QrConfig>;
}

export interface ManifestSearchFilters {
  dateFrom?: string;
  dateTo?: string;
  numPlaca?: string;
  ingresoIdManifiesto?: string;
  numManifiestoCarga?: string;
  codPuntoControl?: string;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserProfile(id: string, updates: UpdateUserProfile): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const [
      queriesTodayResult,
      batchesTodayResult,
      submissionsTodayResult,
      submissionsSuccessTodayResult,
      submissionsErrorTodayResult,
      totalBatchesResult,
      totalSuccessResult,
      totalSubmissionsResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(rndcQueries).where(sql`DATE(${rndcQueries.createdAt}) = CURRENT_DATE`),
      db.select({ count: sql<number>`count(*)` }).from(rndcBatches).where(sql`DATE(${rndcBatches.createdAt}) = CURRENT_DATE`),
      db.select({ count: sql<number>`count(*)` }).from(rndcSubmissions).where(sql`DATE(${rndcSubmissions.createdAt}) = CURRENT_DATE`),
      db.select({ count: sql<number>`count(*)` }).from(rndcSubmissions).where(sql`DATE(${rndcSubmissions.createdAt}) = CURRENT_DATE AND ${rndcSubmissions.status} = 'success'`),
      db.select({ count: sql<number>`count(*)` }).from(rndcSubmissions).where(sql`DATE(${rndcSubmissions.createdAt}) = CURRENT_DATE AND ${rndcSubmissions.status} = 'error'`),
      db.select({ count: sql<number>`count(*)` }).from(rndcBatches),
      db.select({ count: sql<number>`count(*)` }).from(rndcSubmissions).where(eq(rndcSubmissions.status, "success")),
      db.select({ count: sql<number>`count(*)` }).from(rndcSubmissions),
    ]);

    const totalSuccess = Number(totalSuccessResult[0]?.count || 0);
    const totalSubmissions = Number(totalSubmissionsResult[0]?.count || 0);
    const totalSuccessRate = totalSubmissions > 0 ? Math.round((totalSuccess / totalSubmissions) * 100) : 0;

    return {
      queriesToday: Number(queriesTodayResult[0]?.count || 0),
      batchesToday: Number(batchesTodayResult[0]?.count || 0),
      submissionsToday: Number(submissionsTodayResult[0]?.count || 0),
      submissionsSuccessToday: Number(submissionsSuccessTodayResult[0]?.count || 0),
      submissionsErrorToday: Number(submissionsErrorTodayResult[0]?.count || 0),
      totalBatches: Number(totalBatchesResult[0]?.count || 0),
      totalSuccessRate,
    };
  }

  async createRndcBatch(batch: InsertRndcBatch): Promise<RndcBatch> {
    const [newBatch] = await db.insert(rndcBatches).values(batch).returning();
    return newBatch;
  }

  async getRndcBatch(id: string): Promise<RndcBatch | undefined> {
    const [batch] = await db.select().from(rndcBatches).where(eq(rndcBatches.id, id));
    return batch;
  }

  async updateRndcBatch(id: string, updates: Partial<RndcBatch>): Promise<RndcBatch | undefined> {
    const [batch] = await db.update(rndcBatches).set(updates).where(eq(rndcBatches.id, id)).returning();
    return batch;
  }

  async getRndcBatches(limit = 50): Promise<RndcBatch[]> {
    return db.select().from(rndcBatches).orderBy(desc(rndcBatches.createdAt)).limit(limit);
  }

  async createRndcSubmission(submission: InsertRndcSubmission): Promise<RndcSubmission> {
    const [newSubmission] = await db.insert(rndcSubmissions).values(submission).returning();
    return newSubmission;
  }

  async getRndcSubmission(id: string): Promise<RndcSubmission | undefined> {
    const [submission] = await db.select().from(rndcSubmissions).where(eq(rndcSubmissions.id, id));
    return submission;
  }

  async updateRndcSubmission(id: string, updates: Partial<RndcSubmission>): Promise<RndcSubmission | undefined> {
    const [submission] = await db.update(rndcSubmissions).set(updates).where(eq(rndcSubmissions.id, id)).returning();
    return submission;
  }

  async getRndcSubmissionsByBatch(batchId: string): Promise<RndcSubmission[]> {
    return db.select().from(rndcSubmissions).where(eq(rndcSubmissions.batchId, batchId)).orderBy(desc(rndcSubmissions.createdAt));
  }

  async getPendingSubmissions(limit = 100): Promise<RndcSubmission[]> {
    return db.select().from(rndcSubmissions).where(eq(rndcSubmissions.status, "pending")).limit(limit);
  }

  async getRecentSubmissions(limit = 100): Promise<RndcSubmission[]> {
    return db.select().from(rndcSubmissions).orderBy(desc(rndcSubmissions.createdAt)).limit(limit);
  }

  async createCumplidoRemesaSubmission(submission: InsertCumplidoRemesaSubmission): Promise<CumplidoRemesaSubmission> {
    const [newSubmission] = await db.insert(cumplidoRemesaSubmissions).values(submission).returning();
    return newSubmission;
  }

  async getCumplidoRemesaSubmission(id: string): Promise<CumplidoRemesaSubmission | undefined> {
    const [submission] = await db.select().from(cumplidoRemesaSubmissions).where(eq(cumplidoRemesaSubmissions.id, id));
    return submission;
  }

  async updateCumplidoRemesaSubmission(id: string, updates: Partial<CumplidoRemesaSubmission>): Promise<CumplidoRemesaSubmission | undefined> {
    const [submission] = await db.update(cumplidoRemesaSubmissions).set(updates).where(eq(cumplidoRemesaSubmissions.id, id)).returning();
    return submission;
  }

  async getCumplidoRemesaSubmissionsByBatch(batchId: string): Promise<CumplidoRemesaSubmission[]> {
    return db.select().from(cumplidoRemesaSubmissions).where(eq(cumplidoRemesaSubmissions.batchId, batchId)).orderBy(desc(cumplidoRemesaSubmissions.createdAt));
  }

  async createCumplidoManifiestoSubmission(submission: InsertCumplidoManifiestoSubmission): Promise<CumplidoManifiestoSubmission> {
    const [newSubmission] = await db.insert(cumplidoManifiestoSubmissions).values(submission).returning();
    return newSubmission;
  }

  async getCumplidoManifiestoSubmission(id: string): Promise<CumplidoManifiestoSubmission | undefined> {
    const [submission] = await db.select().from(cumplidoManifiestoSubmissions).where(eq(cumplidoManifiestoSubmissions.id, id));
    return submission;
  }

  async updateCumplidoManifiestoSubmission(id: string, updates: Partial<CumplidoManifiestoSubmission>): Promise<CumplidoManifiestoSubmission | undefined> {
    const [submission] = await db.update(cumplidoManifiestoSubmissions).set(updates).where(eq(cumplidoManifiestoSubmissions.id, id)).returning();
    return submission;
  }

  async getCumplidoManifiestoSubmissionsByBatch(batchId: string): Promise<CumplidoManifiestoSubmission[]> {
    return db.select().from(cumplidoManifiestoSubmissions).where(eq(cumplidoManifiestoSubmissions.batchId, batchId)).orderBy(desc(cumplidoManifiestoSubmissions.createdAt));
  }

  async createRemesaSubmission(submission: InsertRemesaSubmission): Promise<RemesaSubmission> {
    const [newSubmission] = await db.insert(remesaSubmissions).values(submission).returning();
    return newSubmission;
  }

  async getRemesaSubmission(id: string): Promise<RemesaSubmission | undefined> {
    const [submission] = await db.select().from(remesaSubmissions).where(eq(remesaSubmissions.id, id));
    return submission;
  }

  async updateRemesaSubmission(id: string, updates: Partial<RemesaSubmission>): Promise<RemesaSubmission | undefined> {
    const [submission] = await db.update(remesaSubmissions).set(updates).where(eq(remesaSubmissions.id, id)).returning();
    return submission;
  }

  async getRemesaSubmissionsByBatch(batchId: string): Promise<RemesaSubmission[]> {
    return db.select().from(remesaSubmissions).where(eq(remesaSubmissions.batchId, batchId)).orderBy(desc(remesaSubmissions.createdAt));
  }

  async getAllRemesaSubmissions(limit = 100): Promise<RemesaSubmission[]> {
    return db.select().from(remesaSubmissions).orderBy(desc(remesaSubmissions.createdAt)).limit(limit);
  }

  async createManifiestoSubmission(submission: InsertManifiestoSubmission): Promise<ManifiestoSubmission> {
    const [newSubmission] = await db.insert(manifiestoSubmissions).values(submission).returning();
    return newSubmission;
  }

  async getManifiestoSubmission(id: string): Promise<ManifiestoSubmission | undefined> {
    const [submission] = await db.select().from(manifiestoSubmissions).where(eq(manifiestoSubmissions.id, id));
    return submission;
  }

  async updateManifiestoSubmission(id: string, updates: Partial<ManifiestoSubmission>): Promise<ManifiestoSubmission | undefined> {
    const [submission] = await db.update(manifiestoSubmissions).set(updates).where(eq(manifiestoSubmissions.id, id)).returning();
    return submission;
  }

  async getManifiestoSubmissionsByBatch(batchId: string): Promise<ManifiestoSubmission[]> {
    return db.select().from(manifiestoSubmissions).where(eq(manifiestoSubmissions.batchId, batchId)).orderBy(desc(manifiestoSubmissions.createdAt));
  }

  async getAllManifiestoSubmissions(limit = 100): Promise<ManifiestoSubmission[]> {
    return db.select().from(manifiestoSubmissions).orderBy(desc(manifiestoSubmissions.createdAt)).limit(limit);
  }

  async getRndcBatchesByType(type: string, limit = 50): Promise<RndcBatch[]> {
    return db.select().from(rndcBatches).where(eq(rndcBatches.type, type)).orderBy(desc(rndcBatches.createdAt)).limit(limit);
  }

  async createMonitoringQuery(query: InsertMonitoringQuery): Promise<MonitoringQuery> {
    const [newQuery] = await db.insert(monitoringQueries).values(query).returning();
    return newQuery;
  }

  async getMonitoringQuery(id: string): Promise<MonitoringQuery | undefined> {
    const [query] = await db.select().from(monitoringQueries).where(eq(monitoringQueries.id, id));
    return query;
  }

  async updateMonitoringQuery(id: string, updates: Partial<MonitoringQuery>): Promise<MonitoringQuery | undefined> {
    const [query] = await db.update(monitoringQueries).set(updates).where(eq(monitoringQueries.id, id)).returning();
    return query;
  }

  async getMonitoringQueries(limit = 50): Promise<MonitoringQuery[]> {
    return db.select().from(monitoringQueries).orderBy(desc(monitoringQueries.createdAt)).limit(limit);
  }

  async createRndcManifest(manifest: InsertRndcManifest): Promise<RndcManifest> {
    const [newManifest] = await db.insert(rndcManifests).values(manifest).returning();
    return newManifest;
  }

  async getRndcManifests(limit = 50, offset = 0): Promise<RndcManifest[]> {
    return db.select().from(rndcManifests).orderBy(desc(rndcManifests.createdAt)).limit(limit).offset(offset);
  }

  async getRndcManifestCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(rndcManifests);
    return Number(result[0]?.count || 0);
  }

  async getRndcManifestByIngresoId(ingresoId: string): Promise<RndcManifest | undefined> {
    const [manifest] = await db.select().from(rndcManifests).where(eq(rndcManifests.ingresoIdManifiesto, ingresoId));
    return manifest;
  }

  async searchRndcManifestByQuery(query: string): Promise<RndcManifest | undefined> {
    const [manifest] = await db.select().from(rndcManifests)
      .where(
        sql`${rndcManifests.ingresoIdManifiesto} = ${query} OR ${rndcManifests.numManifiestoCarga} = ${query}`
      )
      .orderBy(desc(rndcManifests.createdAt))
      .limit(1);
    return manifest;
  }

  async createRndcControlPoint(controlPoint: InsertRndcControlPoint): Promise<RndcControlPoint> {
    const [newPoint] = await db.insert(rndcControlPoints).values(controlPoint).returning();
    return newPoint;
  }

  async getRndcControlPointsByManifest(manifestId: string): Promise<RndcControlPoint[]> {
    return db.select().from(rndcControlPoints).where(eq(rndcControlPoints.manifestId, manifestId)).orderBy(rndcControlPoints.codPuntoControl);
  }

  async searchRndcManifests(filters: ManifestSearchFilters, limit = 50, offset = 0): Promise<{ manifests: RndcManifest[]; total: number }> {
    const conditions: any[] = [];

    if (filters.numPlaca) {
      conditions.push(like(rndcManifests.numPlaca, `%${filters.numPlaca}%`));
    }

    if (filters.ingresoIdManifiesto) {
      conditions.push(like(rndcManifests.ingresoIdManifiesto, `%${filters.ingresoIdManifiesto}%`));
    }

    if (filters.numManifiestoCarga) {
      conditions.push(like(rndcManifests.numManifiestoCarga, `%${filters.numManifiestoCarga}%`));
    }

    if (filters.dateFrom) {
      conditions.push(gte(rndcManifests.createdAt, new Date(filters.dateFrom)));
    }

    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(rndcManifests.createdAt, endDate));
    }

    if (filters.codPuntoControl) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${rndcControlPoints} 
          WHERE ${rndcControlPoints.manifestId} = ${rndcManifests.id}
          AND ${rndcControlPoints.codPuntoControl} LIKE ${'%' + filters.codPuntoControl + '%'}
        )`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [manifests, countResult] = await Promise.all([
      whereClause 
        ? db.select().from(rndcManifests).where(whereClause).orderBy(desc(rndcManifests.createdAt)).limit(limit).offset(offset)
        : db.select().from(rndcManifests).orderBy(desc(rndcManifests.createdAt)).limit(limit).offset(offset),
      whereClause
        ? db.select({ count: sql<number>`count(*)` }).from(rndcManifests).where(whereClause)
        : db.select({ count: sql<number>`count(*)` }).from(rndcManifests),
    ]);

    return {
      manifests,
      total: Number(countResult[0]?.count || 0),
    };
  }

  async createRndcQuery(query: InsertRndcQuery): Promise<RndcQuery> {
    const [newQuery] = await db.insert(rndcQueries).values(query).returning();
    return newQuery;
  }

  async getRndcQuery(id: string): Promise<RndcQuery | undefined> {
    const [query] = await db.select().from(rndcQueries).where(eq(rndcQueries.id, id));
    return query;
  }

  async updateRndcQuery(id: string, updates: Partial<RndcQuery>): Promise<RndcQuery | undefined> {
    const [query] = await db.update(rndcQueries).set(updates).where(eq(rndcQueries.id, id)).returning();
    return query;
  }

  async getRndcQueries(limit = 50): Promise<RndcQuery[]> {
    return db.select().from(rndcQueries).orderBy(desc(rndcQueries.createdAt)).limit(limit);
  }

  async getRndcQueriesByType(queryType: string, limit = 50): Promise<RndcQuery[]> {
    return db.select().from(rndcQueries).where(eq(rndcQueries.queryType, queryType)).orderBy(desc(rndcQueries.createdAt)).limit(limit);
  }

  async createTercero(tercero: InsertTercero): Promise<Tercero> {
    const [newTercero] = await db.insert(terceros).values(tercero).returning();
    return newTercero;
  }

  async getTercero(id: string): Promise<Tercero | undefined> {
    const [tercero] = await db.select().from(terceros).where(eq(terceros.id, id));
    return tercero;
  }

  async getTerceroByIdentificacion(tipoId: string, numeroId: string): Promise<Tercero | undefined> {
    const [tercero] = await db.select().from(terceros).where(
      and(eq(terceros.tipoIdentificacion, tipoId), eq(terceros.numeroIdentificacion, numeroId))
    );
    return tercero;
  }

  async getTerceroByCodigoGranja(codigoGranja: string): Promise<Tercero | undefined> {
    const [tercero] = await db.select().from(terceros).where(
      and(eq(terceros.tipoTercero, "GRANJA"), eq(terceros.codigoGranja, codigoGranja))
    );
    return tercero;
  }

  async getTerceroByCodigoGranjaBase(codigoGranjaBase: string): Promise<Tercero | undefined> {
    const [tercero] = await db.select().from(terceros).where(
      and(
        eq(terceros.tipoTercero, "GRANJA"),
        sql`${terceros.codigoGranja} ILIKE ${codigoGranjaBase + '%'}`
      )
    );
    return tercero;
  }

  async getTerceroByNombreSede(nombreSede: string): Promise<Tercero | undefined> {
    const [tercero] = await db.select().from(terceros).where(
      sql`${terceros.nombreSede} ILIKE ${nombreSede}`
    );
    return tercero;
  }

  async updateTercero(id: string, updates: Partial<Tercero>): Promise<Tercero | undefined> {
    const [tercero] = await db.update(terceros).set({ ...updates, updatedAt: new Date() }).where(eq(terceros.id, id)).returning();
    return tercero;
  }

  async deleteTercero(id: string): Promise<void> {
    await db.delete(terceros).where(eq(terceros.id, id));
  }

  async getTerceros(tipoTercero?: string, limit = 100): Promise<Tercero[]> {
    if (tipoTercero) {
      return db.select().from(terceros).where(eq(terceros.tipoTercero, tipoTercero)).orderBy(desc(terceros.createdAt)).limit(limit);
    }
    return db.select().from(terceros).orderBy(desc(terceros.createdAt)).limit(limit);
  }

  async searchTerceros(query: string, tipoTercero?: string): Promise<Tercero[]> {
    const searchPattern = `%${query}%`;
    const conditions = [
      sql`(${terceros.nombre} ILIKE ${searchPattern} OR ${terceros.numeroIdentificacion} ILIKE ${searchPattern} OR ${terceros.primerApellido} ILIKE ${searchPattern})`
    ];
    if (tipoTercero) {
      conditions.push(eq(terceros.tipoTercero, tipoTercero));
    }
    return db.select().from(terceros).where(and(...conditions)).orderBy(desc(terceros.createdAt)).limit(50);
  }

  async upsertTerceroByCodigoGranja(terceroData: InsertTercero): Promise<{ tercero: Tercero; isNew: boolean }> {
    if (terceroData.codigoGranja) {
      const existing = await this.getTerceroByCodigoGranja(terceroData.codigoGranja);
      if (existing) {
        const updated = await this.updateTercero(existing.id, terceroData);
        return { tercero: updated!, isNew: false };
      }
    }
    const newTercero = await this.createTercero(terceroData);
    return { tercero: newTercero, isNew: true };
  }

  async createVehiculo(vehiculo: InsertVehiculo): Promise<Vehiculo> {
    const [newVehiculo] = await db.insert(vehiculos).values(vehiculo).returning();
    return newVehiculo;
  }

  async getVehiculo(id: string): Promise<Vehiculo | undefined> {
    const [vehiculo] = await db.select().from(vehiculos).where(eq(vehiculos.id, id));
    return vehiculo;
  }

  async getVehiculoByPlaca(placa: string): Promise<Vehiculo | undefined> {
    const [vehiculo] = await db.select().from(vehiculos).where(eq(vehiculos.placa, placa.toUpperCase()));
    return vehiculo;
  }

  async updateVehiculo(id: string, updates: Partial<Vehiculo>): Promise<Vehiculo | undefined> {
    const [vehiculo] = await db.update(vehiculos).set({ ...updates, updatedAt: new Date() }).where(eq(vehiculos.id, id)).returning();
    return vehiculo;
  }

  async deleteVehiculo(id: string): Promise<void> {
    await db.delete(vehiculos).where(eq(vehiculos.id, id));
  }

  async getVehiculos(limit = 100): Promise<Vehiculo[]> {
    return db.select().from(vehiculos).orderBy(desc(vehiculos.createdAt)).limit(limit);
  }

  async searchVehiculos(query: string): Promise<Vehiculo[]> {
    const searchPattern = `%${query}%`;
    return db.select().from(vehiculos).where(
      sql`(${vehiculos.placa} ILIKE ${searchPattern} OR ${vehiculos.propietarioNombre} ILIKE ${searchPattern} OR ${vehiculos.conductorNombre} ILIKE ${searchPattern})`
    ).orderBy(desc(vehiculos.createdAt)).limit(50);
  }

  async getRndcVehiculoByPlaca(placa: string): Promise<RndcVehiculo | undefined> {
    const [vehiculo] = await db.select().from(rndcVehiculos).where(eq(rndcVehiculos.placa, placa.toUpperCase()));
    return vehiculo;
  }

  async getRndcVehiculosByPlacas(placas: string[]): Promise<RndcVehiculo[]> {
    if (placas.length === 0) return [];
    const upperPlacas = placas.map(p => p.toUpperCase());
    return db.select().from(rndcVehiculos).where(sql`${rndcVehiculos.placa} = ANY(${upperPlacas})`);
  }

  async upsertRndcVehiculo(vehiculo: InsertRndcVehiculo): Promise<RndcVehiculo> {
    const upperPlaca = vehiculo.placa.toUpperCase();
    const [result] = await db.insert(rndcVehiculos)
      .values({ ...vehiculo, placa: upperPlaca })
      .onConflictDoUpdate({
        target: rndcVehiculos.placa,
        set: {
          propietarioTipoId: vehiculo.propietarioTipoId,
          propietarioNumeroId: vehiculo.propietarioNumeroId,
          propietarioNombre: vehiculo.propietarioNombre,
          venceSoat: vehiculo.venceSoat,
          venceTecnicomecanica: vehiculo.venceTecnicomecanica,
          pesoVacio: vehiculo.pesoVacio,
          ingresoId: vehiculo.ingresoId,
          rawXml: vehiculo.rawXml,
          lastSyncedAt: new Date(),
        }
      })
      .returning();
    return result;
  }

  async getRndcConductorByCedula(cedula: string): Promise<RndcConductor | undefined> {
    const [conductor] = await db.select().from(rndcConductores).where(eq(rndcConductores.cedula, cedula));
    return conductor;
  }

  async getRndcConductoresByCedulas(cedulas: string[]): Promise<RndcConductor[]> {
    if (cedulas.length === 0) return [];
    return db.select().from(rndcConductores).where(sql`${rndcConductores.cedula} = ANY(${cedulas})`);
  }

  async upsertRndcConductor(conductor: InsertRndcConductor): Promise<RndcConductor> {
    const [result] = await db.insert(rndcConductores)
      .values(conductor)
      .onConflictDoUpdate({
        target: rndcConductores.cedula,
        set: {
          nombre: conductor.nombre,
          primerApellido: conductor.primerApellido,
          segundoApellido: conductor.segundoApellido,
          categoriaLicencia: conductor.categoriaLicencia,
          venceLicencia: conductor.venceLicencia,
          ingresoId: conductor.ingresoId,
          direccion: conductor.direccion,
          telefono: conductor.telefono,
          placa: conductor.placa,
          observaciones: conductor.observaciones,
          rawXml: conductor.rawXml,
          lastSyncedAt: new Date(),
        }
      })
      .returning();
    return result;
  }

  async getRndcConductores(limit = 500): Promise<RndcConductor[]> {
    return db.select().from(rndcConductores).orderBy(desc(rndcConductores.createdAt)).limit(limit);
  }

  async searchRndcConductores(query: string): Promise<RndcConductor[]> {
    const searchPattern = `%${query}%`;
    return db.select().from(rndcConductores).where(
      sql`(${rndcConductores.cedula} ILIKE ${searchPattern} OR ${rndcConductores.nombre} ILIKE ${searchPattern})`
    ).orderBy(desc(rndcConductores.createdAt)).limit(100);
  }

  async deleteRndcConductor(id: string): Promise<void> {
    await db.delete(rndcConductores).where(eq(rndcConductores.id, id));
  }

  async updateRndcConductor(id: string, updates: Partial<RndcConductor>): Promise<void> {
    await db.update(rndcConductores).set(updates).where(eq(rndcConductores.id, id));
  }

  async createDespacho(despacho: InsertDespacho): Promise<Despacho> {
    const [newDespacho] = await db.insert(despachos).values(despacho).returning();
    return newDespacho;
  }

  async getDespacho(id: string): Promise<Despacho | undefined> {
    const [despacho] = await db.select().from(despachos).where(eq(despachos.id, id));
    return despacho;
  }

  async updateDespacho(id: string, updates: Partial<Despacho>): Promise<Despacho | undefined> {
    const [despacho] = await db.update(despachos).set({ ...updates, updatedAt: new Date() }).where(eq(despachos.id, id)).returning();
    return despacho;
  }

  async deleteDespacho(id: string): Promise<void> {
    await db.delete(despachos).where(eq(despachos.id, id));
  }

  async getDespachos(limit = 50): Promise<Despacho[]> {
    return db.select().from(despachos).orderBy(desc(despachos.createdAt)).limit(limit);
  }

  async createDestino(destino: InsertDestino): Promise<Destino> {
    const [newDestino] = await db.insert(destinos).values(destino).returning();
    return newDestino;
  }

  async getDestino(id: string): Promise<Destino | undefined> {
    const [destino] = await db.select().from(destinos).where(eq(destinos.id, id));
    return destino;
  }

  async getDestinoByCodSede(numIdTercero: string, codSede: string): Promise<Destino | undefined> {
    const [destino] = await db.select().from(destinos)
      .where(and(eq(destinos.numIdTercero, numIdTercero), eq(destinos.codSede, codSede)));
    return destino;
  }

  async getDestinoByNombreSede(nombreSede: string): Promise<Destino | undefined> {
    const [destino] = await db.select().from(destinos)
      .where(sql`LOWER(${destinos.nombreSede}) = LOWER(${nombreSede})`);
    return destino;
  }

  async getDestinoByCodMunicipioRndc(codMunicipioRndc: string): Promise<Destino | undefined> {
    const [destino] = await db.select().from(destinos)
      .where(eq(destinos.codMunicipioRndc, codMunicipioRndc));
    return destino;
  }

  async getMunicipioNameByCode(codMunicipioRndc: string): Promise<string> {
    if (!codMunicipioRndc) return "";
    const [destino] = await db.select({ municipioRndc: destinos.municipioRndc })
      .from(destinos)
      .where(eq(destinos.codMunicipioRndc, codMunicipioRndc))
      .limit(1);
    return destino?.municipioRndc || codMunicipioRndc;
  }

  async updateDestino(id: string, updates: Partial<Destino>): Promise<Destino | undefined> {
    const [destino] = await db.update(destinos).set({ ...updates, updatedAt: new Date() }).where(eq(destinos.id, id)).returning();
    return destino;
  }

  async deleteDestino(id: string): Promise<void> {
    await db.delete(destinos).where(eq(destinos.id, id));
  }

  async getDestinos(limit = 500): Promise<Destino[]> {
    return db.select().from(destinos).orderBy(destinos.nombreSede).limit(limit);
  }

  async searchDestinos(query: string): Promise<Destino[]> {
    const searchPattern = `%${query}%`;
    return db.select().from(destinos).where(
      sql`(${destinos.nombreSede} ILIKE ${searchPattern} OR ${destinos.municipioRndc} ILIKE ${searchPattern} OR ${destinos.codMunicipioRndc} ILIKE ${searchPattern})`
    ).orderBy(destinos.nombreSede).limit(100);
  }

  async upsertDestino(destino: InsertDestino): Promise<{ destino: Destino; isNew: boolean }> {
    const existing = await this.getDestinoByCodSede(destino.numIdTercero, destino.codSede);
    if (existing) {
      const updated = await this.updateDestino(existing.id, destino);
      return { destino: updated!, isNew: false };
    }
    const newDestino = await this.createDestino(destino);
    return { destino: newDestino, isNew: true };
  }

  async createPdfTemplate(template: InsertPdfTemplate): Promise<PdfTemplate> {
    const [newTemplate] = await db.insert(pdfTemplates).values(template as any).returning();
    return newTemplate;
  }

  async getPdfTemplate(id: string): Promise<PdfTemplate | undefined> {
    const [template] = await db.select().from(pdfTemplates).where(eq(pdfTemplates.id, id));
    return template;
  }

  async getPdfTemplatesByUser(userId: string): Promise<PdfTemplate[]> {
    return db.select().from(pdfTemplates)
      .where(eq(pdfTemplates.userId, userId))
      .orderBy(desc(pdfTemplates.updatedAt));
  }

  async getDefaultPdfTemplate(userId: string, templateType: string): Promise<PdfTemplate | undefined> {
    const [template] = await db.select().from(pdfTemplates)
      .where(and(
        eq(pdfTemplates.userId, userId),
        eq(pdfTemplates.templateType, templateType),
        eq(pdfTemplates.isDefault, 1)
      ));
    return template;
  }

  async updatePdfTemplate(id: string, updates: Partial<PdfTemplate>): Promise<PdfTemplate | undefined> {
    const [template] = await db.update(pdfTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pdfTemplates.id, id))
      .returning();
    return template;
  }

  async deletePdfTemplate(id: string): Promise<void> {
    await db.delete(pdfTemplates).where(eq(pdfTemplates.id, id));
  }

  async setDefaultPdfTemplate(id: string, userId: string): Promise<void> {
    const template = await this.getPdfTemplate(id);
    if (!template) return;
    await db.update(pdfTemplates)
      .set({ isDefault: 0 })
      .where(and(
        eq(pdfTemplates.userId, userId),
        eq(pdfTemplates.templateType, template.templateType)
      ));
    await db.update(pdfTemplates)
      .set({ isDefault: 1 })
      .where(eq(pdfTemplates.id, id));
  }

  async getQrConfig(userId: string): Promise<QrConfig | undefined> {
    const [config] = await db.select().from(qrConfigs).where(eq(qrConfigs.userId, userId));
    return config;
  }

  async upsertQrConfig(userId: string, fields: QRFieldConfig[]): Promise<QrConfig> {
    const existing = await this.getQrConfig(userId);
    if (existing) {
      const [updated] = await db.update(qrConfigs)
        .set({ fields, updatedAt: new Date() })
        .where(eq(qrConfigs.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(qrConfigs)
        .values({ userId, fields })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
