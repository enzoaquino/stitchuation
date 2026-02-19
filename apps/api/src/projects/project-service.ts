import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { projects } from "../db/schema.js";
import { NotFoundError } from "../errors.js";
import type { CreateProjectInput } from "./schemas.js";

export class ProjectService {
  async create(userId: string, input: CreateProjectInput) {
    const now = new Date();
    const [project] = await db
      .insert(projects)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        canvasId: input.canvasId,
        status: "wip",
        startedAt: now,
      })
      .returning();

    return project;
  }

  async getById(userId: string, id: string) {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId), isNull(projects.deletedAt)))
      .limit(1);

    return project ?? null;
  }

  async listByUser(userId: string) {
    return db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
      .orderBy(desc(projects.createdAt));
  }

  async advanceStatus(userId: string, id: string) {
    const project = await this.getById(userId, id);
    if (!project) throw new NotFoundError("Project");

    const now = new Date();

    if (project.status === "wip") {
      const [updated] = await db
        .update(projects)
        .set({ status: "at_finishing", finishingAt: now, updatedAt: now })
        .where(and(eq(projects.id, id), eq(projects.userId, userId)))
        .returning();
      return updated;
    }

    if (project.status === "at_finishing") {
      const [updated] = await db
        .update(projects)
        .set({ status: "completed", completedAt: now, updatedAt: now })
        .where(and(eq(projects.id, id), eq(projects.userId, userId)))
        .returning();
      return updated;
    }

    throw new Error("Project is already completed");
  }

  async softDelete(userId: string, id: string) {
    const now = new Date();
    const [deleted] = await db
      .update(projects)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(projects.id, id), eq(projects.userId, userId), isNull(projects.deletedAt)))
      .returning();

    if (!deleted) throw new NotFoundError("Project");
    return deleted;
  }
}
