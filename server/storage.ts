import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  rndcSubmissions,
  rndcBatches,
  cumplidoRemesaSubmissions,
  cumplidoManifiestoSubmissions,
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
}

export const storage = new DatabaseStorage();
