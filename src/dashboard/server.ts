import express from 'express';
import path from 'path';
import fs from 'fs';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';
import {
  checkFileDecisions,
  getDecision,
  listDecisions,
  recordDecision,
  updateDecisionStatus,
  reindexStorage
} from '../core/store.js';
import { runDoctor } from '../core/doctor.js';
import { getDecisionTimeline } from '../core/timeline.js';
import { DecisionConfidence, DecisionStatus } from '../types/decision.js';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startDashboardServer(
  baseDir: string = process.cwd(),
  port: number = 3333,
  onStart?: () => void
) {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get('/api/decisions', (req, res) => {
    try {
      const status = req.query.status as DecisionStatus | undefined;
      const tagsParam = req.query.tags as string | undefined;
      const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()) : undefined;

      const items = listDecisions(baseDir, { status, tags });
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/decisions/:id', (req, res) => {
    try {
      const record = getDecision(baseDir, req.params.id);
      if (!record) {
        return res.status(404).json({ error: 'Decision not found' });
      }
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/decisions/:id/timeline', (req, res) => {
    try {
      const timeline = getDecisionTimeline(baseDir, req.params.id);
      res.json(timeline);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/doctor', (req, res) => {
    try {
      const report = runDoctor({ baseDir });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/decisions', (req, res) => {
    try {
      const body = req.body;
      const record = recordDecision(baseDir, {
        summary: body.summary,
        rationale: body.rationale,
        scope: Array.isArray(body.scope)
          ? body.scope
          : String(body.scope || '').split(',').map((s) => s.trim()),
        tags: Array.isArray(body.tags)
          ? body.tags
          : String(body.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
        author: body.author || 'web-ui',
        confidence: (body.confidence as DecisionConfidence) || 'explicit',
        context: body.context,
        consequences: body.consequences,
        supersedes: body.supersedes,
        reviewBy: body.reviewBy
      });

      res.status(201).json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/decisions/:id', (req, res) => {
    try {
      const record = getDecision(baseDir, req.params.id);
      if (!record) {
        return res.status(404).json({ error: 'Decision not found' });
      }

      const UpdateSchema = z.object({
        summary: z.string().min(1, 'Summary is required').optional(),
        rationale: z.string().min(1, 'Rationale is required').optional(),
        scope: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        reviewBy: z.string().optional(),
        context: z.string().optional(),
        consequences: z.string().optional()
      });

      const body = UpdateSchema.parse(req.body);
      const fullPath = path.resolve(baseDir, record.filePath);
      const existingFileContent = fs.readFileSync(fullPath, 'utf8');
      const parsed = matter(existingFileContent);

      const updatedData = {
        ...parsed.data,
        ...body
      };

      const cleanData = Object.fromEntries(
        Object.entries(updatedData).filter(([_, v]) => v !== undefined)
      );

      const summary = body.summary || record.summary;
      const rationale = body.rationale || record.rationale;
      const context = body.context !== undefined ? body.context : record.context;
      const consequences = body.consequences !== undefined ? body.consequences : record.consequences;

      const bodySections = [`# ${summary}\n`];
      bodySections.push(`## Rationale\n${rationale}\n`);
      if (context) bodySections.push(`## Context\n${context}\n`);
      if (consequences) bodySections.push(`## Consequences\n${consequences}\n`);

      const newContent = matter.stringify(bodySections.join('\n'), cleanData);
      fs.writeFileSync(fullPath, newContent, 'utf8');

      reindexStorage(baseDir);

      const updatedRecord = getDecision(baseDir, req.params.id);
      res.json(updatedRecord);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/decisions/check', (req, res) => {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }
      const matches = checkFileDecisions(baseDir, filePath);
      res.json(matches);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/decisions/:id/status', (req, res) => {
    try {
      const { status, supersededBy } = req.body;
      if (!['active', 'superseded', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      const updated = updateDecisionStatus(
        baseDir,
        req.params.id,
        status as DecisionStatus,
        supersededBy
      );
      if (!updated) {
        return res.status(404).json({ error: 'Decision not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve Dashboard Static Files
  let staticDir = path.resolve(__dirname, '../../dist/dashboard/public');
  if (!fs.existsSync(staticDir)) {
    staticDir = path.resolve(__dirname, '../../dist/dashboard');
  }
  if (!fs.existsSync(staticDir)) {
    staticDir = path.resolve(__dirname, './public');
  }
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  } else {
    app.get('*', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Decision Tracker Dashboard</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-slate-900 text-slate-100 min-h-screen font-sans p-8">
            <div class="max-w-4xl mx-auto">
              <h1 class="text-3xl font-bold text-indigo-400 mb-4">🧠 Decision Tracker Dashboard</h1>
              <p class="text-slate-400 mb-6">Backend API server is running on port ${port}. Run <code>npm run build</code> to compile the frontend interface.</p>
              
              <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h2 class="text-xl font-semibold mb-4 text-slate-200">API Status</h2>
                <ul class="space-y-2 text-sm text-slate-300">
                  <li>🟢 <code>GET /api/decisions</code> - List decisions</li>
                  <li>🟢 <code>POST /api/decisions</code> - Record new decision</li>
                  <li>🟢 <code>GET /api/doctor</code> - Run diagnostics</li>
                  <li>🟢 <code>GET /api/decisions/:id/timeline</code> - Supersession timeline</li>
                  <li>🟢 <code>PUT /api/decisions/:id</code> - Validated decision editor</li>
                </ul>
              </div>
            </div>
          </body>
        </html>
      `);
    });
  }

  const server = app.listen(port, () => {
    if (onStart) onStart();
  });

  return server;
}
