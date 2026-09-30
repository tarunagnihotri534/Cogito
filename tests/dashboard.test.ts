import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Server } from 'http';
import { startDashboardServer } from '../src/dashboard/server.js';
import { initStorage, recordDecision } from '../src/core/store.js';

describe('Dashboard Server API', () => {
  let tempDir: string;
  let server: Server;
  const port = 3456;
  const baseUrl = `http://localhost:${port}`;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-dashboard-test-'));
    initStorage(tempDir);
    await new Promise<void>((resolve) => {
      server = startDashboardServer(tempDir, port, () => resolve());
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /api/decisions returns recorded decisions', async () => {
    recordDecision(tempDir, {
      summary: 'Use Vitest for testing',
      rationale: 'Fast execution and native ESM support',
      scope: ['tests/**'],
      tags: ['testing', 'vitest']
    });

    const res = await fetch(`${baseUrl}/api/decisions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(1);
    expect(data[0].summary).toBe('Use Vitest for testing');
  });

  it('POST /api/decisions records a new decision', async () => {
    const res = await fetch(`${baseUrl}/api/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: 'Use Fastify for HTTP services',
        rationale: 'High throughput and low overhead',
        scope: ['src/services/**'],
        tags: ['http', 'api'],
        author: 'perf-engineer'
      })
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toMatch(/^dec_/);
    expect(data.summary).toBe('Use Fastify for HTTP services');
  });

  it('GET /api/doctor returns repository diagnostics report', async () => {
    recordDecision(tempDir, {
      summary: 'Valid decision',
      rationale: 'Reason',
      scope: ['src/**']
    });

    const res = await fetch(`${baseUrl}/api/doctor`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('healthy');
    expect(data).toHaveProperty('totalActiveDecisions');
    expect(data).toHaveProperty('issues');
  });

  it('GET /api/decisions/:id/timeline returns supersession sequence', async () => {
    const d1 = recordDecision(tempDir, {
      summary: 'V1 Architecture',
      rationale: 'Initial setup',
      scope: ['src/**']
    });

    const d2 = recordDecision(tempDir, {
      summary: 'V2 Architecture',
      rationale: 'Redesign',
      scope: ['src/**'],
      supersedes: d1.id
    });

    const res = await fetch(`${baseUrl}/api/decisions/${d2.id}/timeline`);
    expect(res.status).toBe(200);
    const timeline = await res.json();
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBe(2);
    expect(timeline[0].id).toBe(d1.id);
    expect(timeline[1].id).toBe(d2.id);
  });

  it('PUT /api/decisions/:id updates decision fields and reindexes', async () => {
    const d = recordDecision(tempDir, {
      summary: 'Original Summary',
      rationale: 'Original Rationale',
      scope: ['src/**'],
      tags: ['init']
    });

    const res = await fetch(`${baseUrl}/api/decisions/${d.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: 'Updated Summary',
        rationale: 'Updated Rationale',
        scope: ['src/**', 'lib/**'],
        tags: ['init', 'revised'],
        reviewBy: '2026-12-31'
      })
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.summary).toBe('Updated Summary');
    expect(updated.rationale).toBe('Updated Rationale');
    expect(updated.scope).toEqual(['src/**', 'lib/**']);
    expect(updated.reviewBy).toBe('2026-12-31');
  });
});
