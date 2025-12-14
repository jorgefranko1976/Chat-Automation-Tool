import { eq, desc, sql, and, like, gte, lte } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  rndcSubmissions,
  rndcBatches,
  cumplidoRemesaSubmissions,
  cumplidoManifiestoSubmissions,
  monitoringQueries,
  rndcManifests,
  rndcControlPoints,
  rndcQueries,
  type User,
  type InsertUser,
  type RndcSubmission,
  type InsertRndcSubmission,
  type RndcBatch,
  type InsertRndcBatch,
  type CumplidoRemesaSubmission,
  type InsertCumplidoRemesaSubmission,
  type CumplidoManifiestoSubmission,
  type InsertCumplidoManifiestoSubmission,
  type MonitoringQuery,
  type InsertMonitoringQuery,
  type RndcManifest,
  type InsertRndcManifest,
  type RndcControlPoint,
  type InsertRndcControlPoint,
  type RndcQuery,
  type InsertRndcQuery,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  
  getRndcBatchesByType(type: string, limit?: number): Promise<RndcBatch[]>;
  
  createMonitoringQuery(query: InsertMonitoringQuery): Promise<MonitoringQuery>;
  getMonitoringQuery(id: string): Promise<MonitoringQuery | undefined>;
  updateMonitoringQuery(id: string, updates: Partial<MonitoringQuery>): Promise<MonitoringQuery | undefined>;
  getMonitoringQueries(limit?: number): Promise<MonitoringQuery[]>;
  
  createRndcManifest(manifest: InsertRndcManifest): Promise<RndcManifest>;
  getRndcManifests(limit?: number, offset?: number): Promise<RndcManifest[]>;
  getRndcManifestCount(): Promise<number>;
  getRndcManifestByIngresoId(ingresoId: string): Promise<RndcManifest | undefined>;
  searchRndcManifests(filters: ManifestSearchFilters, limit?: number, offset?: number): Promise<{ manifests: RndcManifest[]; total: number }>;
  
  createRndcControlPoint(controlPoint: InsertRndcControlPoint): Promise<RndcControlPoint>;
  getRndcControlPointsByManifest(manifestId: string): Promise<RndcControlPoint[]>;
  
  createRndcQuery(query: InsertRndcQuery): Promise<RndcQuery>;
  getRndcQuery(id: string): Promise<RndcQuery | undefined>;
  updateRndcQuery(id: string, updates: Partial<RndcQuery>): Promise<RndcQuery | undefined>;
  getRndcQueries(limit?: number): Promise<RndcQuery[]>;
  getRndcQueriesByType(queryType: string, limit?: number): Promise<RndcQuery[]>;
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
}

export const storage = new DatabaseStorage();
