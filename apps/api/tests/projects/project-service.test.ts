import { describe, it, expect, beforeAll } from "vitest";
import { ProjectService } from "../../src/projects/project-service.js";
import { CanvasService } from "../../src/canvases/canvas-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { NotFoundError } from "../../src/errors.js";

describe("ProjectService", () => {
  let projectService: ProjectService;
  let canvasService: CanvasService;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    projectService = new ProjectService();
    canvasService = new CanvasService();
    const authService = new AuthService();

    const { user } = await authService.register({
      email: `project-test-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Project Tester",
    });
    userId = user.id;

    const { user: otherUser } = await authService.register({
      email: `project-other-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Other User",
    });
    otherUserId = otherUser.id;
  });

  it("creates a project linked to a canvas with default status wip", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Melissa Shirley",
      designName: "Nutcracker Project",
    });

    const project = await projectService.create(userId, { canvasId: canvas.id });

    expect(project.id).toBeDefined();
    expect(project.canvasId).toBe(canvas.id);
    expect(project.userId).toBe(userId);
    expect(project.status).toBe("wip");
    expect(project.startedAt).toBeDefined();
    expect(project.finishingAt).toBeNull();
    expect(project.completedAt).toBeNull();
    expect(project.deletedAt).toBeNull();
  });

  it("creates a project with a client-provided UUID", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Kirk & Bradley",
      designName: "Client UUID Project",
    });

    const clientId = crypto.randomUUID();
    const project = await projectService.create(userId, { id: clientId, canvasId: canvas.id });

    expect(project.id).toBe(clientId);
  });

  it("rejects duplicate canvas (unique constraint)", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Zecca",
      designName: "Duplicate Canvas Test",
    });

    await projectService.create(userId, { canvasId: canvas.id });

    await expect(
      projectService.create(userId, { canvasId: canvas.id })
    ).rejects.toThrow();
  });

  it("gets a project by ID", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Lee",
      designName: "GetById Test",
    });

    const project = await projectService.create(userId, { canvasId: canvas.id });
    const fetched = await projectService.getById(userId, project.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(project.id);
    expect(fetched!.canvasId).toBe(canvas.id);
  });

  it("returns null for non-existent project", async () => {
    const fetched = await projectService.getById(userId, crypto.randomUUID());
    expect(fetched).toBeNull();
  });

  it("prevents accessing another user's project", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "DMC",
      designName: "User Isolation Test",
    });

    const project = await projectService.create(userId, { canvasId: canvas.id });
    const fetched = await projectService.getById(otherUserId, project.id);

    expect(fetched).toBeNull();
  });

  it("does not return deleted projects via getById", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Labors of Love",
      designName: "Deleted GetById Test",
    });

    const project = await projectService.create(userId, { canvasId: canvas.id });
    await projectService.softDelete(userId, project.id);

    const fetched = await projectService.getById(userId, project.id);
    expect(fetched).toBeNull();
  });

  it("lists projects for a user", async () => {
    const projects = await projectService.listByUser(userId);
    expect(projects.length).toBeGreaterThan(0);

    for (const p of projects) {
      expect(p.userId).toBe(userId);
      expect(p.deletedAt).toBeNull();
    }
  });

  it("does not return soft-deleted projects in list", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "DeleteListTest",
      designName: "Soft Delete List Test",
    });

    const project = await projectService.create(userId, { canvasId: canvas.id });
    await projectService.softDelete(userId, project.id);

    const projects = await projectService.listByUser(userId);
    const found = projects.find((p) => p.id === project.id);
    expect(found).toBeUndefined();
  });

  it("advances status from wip to at_finishing", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Advance",
      designName: "WIP to Finishing",
    });

    const project = await projectService.create(userId, { canvasId: canvas.id });
    const advanced = await projectService.advanceStatus(userId, project.id);

    expect(advanced.status).toBe("at_finishing");
    expect(advanced.finishingAt).toBeDefined();
    expect(advanced.completedAt).toBeNull();
  });

  it("advances status from at_finishing to completed", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Advance",
      designName: "Finishing to Completed",
    });

    const project = await projectService.create(userId, { canvasId: canvas.id });
    await projectService.advanceStatus(userId, project.id);
    const completed = await projectService.advanceStatus(userId, project.id);

    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeDefined();
  });

  it("throws when advancing past completed", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Advance",
      designName: "Past Completed",
    });

    const project = await projectService.create(userId, { canvasId: canvas.id });
    await projectService.advanceStatus(userId, project.id);
    await projectService.advanceStatus(userId, project.id);

    await expect(
      projectService.advanceStatus(userId, project.id)
    ).rejects.toThrow("already completed");
  });

  it("throws NotFoundError when advancing non-existent project", async () => {
    try {
      await projectService.advanceStatus(userId, crypto.randomUUID());
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

  it("soft deletes a project", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "SoftDel",
      designName: "Soft Delete Test",
    });

    const project = await projectService.create(userId, { canvasId: canvas.id });
    const deleted = await projectService.softDelete(userId, project.id);

    expect(deleted.deletedAt).toBeDefined();
    expect(deleted.updatedAt).toBeDefined();
  });

  it("throws NotFoundError when soft deleting non-existent project", async () => {
    try {
      await projectService.softDelete(userId, crypto.randomUUID());
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

  it("throws NotFoundError when soft deleting another user's project", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "SoftDelIso",
      designName: "Isolation Delete Test",
    });

    const project = await projectService.create(userId, { canvasId: canvas.id });

    try {
      await projectService.softDelete(otherUserId, project.id);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });
});
