import { serve } from "bun";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { AIAppGenerator } from "../src/generators/ai-generator";

const PORT = 3002;
const dbPath = join(process.cwd(), "app-data.db");

// Initialize SQLite database
const db = new Database(dbPath, { create: true });

// Create tables
db.run(`
  CREATE TABLE IF NOT EXISTS apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    spec TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS app_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
  )
`);

// Generic data table for dynamically generated apps
db.run(`
  CREATE TABLE IF NOT EXISTS dynamic_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Helper function to parse JSON body
async function parseBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (path === "/health") {
      return Response.json({ status: "ok", database: "connected" }, { headers: corsHeaders });
    }

    // Apps endpoints
    if (path === "/api/apps") {
      if (method === "GET") {
        const apps = db.query("SELECT * FROM apps ORDER BY created_at DESC").all();
        return Response.json(apps, { headers: corsHeaders });
      }
      
      if (method === "POST") {
        const body = await parseBody(req);
        if (!body || !body.name || !body.spec) {
          return Response.json({ error: "Missing name or spec" }, { status: 400, headers: corsHeaders });
        }
        
        const stmt = db.prepare("INSERT INTO apps (name, spec) VALUES (?, ?)");
        const result = stmt.run(body.name, JSON.stringify(body.spec));
        
        const newApp = db.query("SELECT * FROM apps WHERE id = ?").get(result.lastInsertRowid);
        return Response.json(newApp, { headers: corsHeaders });
      }
    }

    // Get single app
    const appMatch = path.match(/^\/api\/apps\/(\d+)$/);
    if (appMatch) {
      const appId = parseInt(appMatch[1]);
      
      if (method === "GET") {
        const app = db.query("SELECT * FROM apps WHERE id = ?").get(appId);
        if (!app) {
          return Response.json({ error: "App not found" }, { status: 404, headers: corsHeaders });
        }
        return Response.json(app, { headers: corsHeaders });
      }
      
      if (method === "DELETE") {
        db.run("DELETE FROM apps WHERE id = ?", appId);
        return Response.json({ success: true }, { headers: corsHeaders });
      }
    }

    // Dynamic data endpoints (for generated apps to use)
    if (path.startsWith("/api/data/")) {
      const collection = path.replace("/api/data/", "");
      
      if (method === "GET") {
        const items = db.query("SELECT * FROM dynamic_data WHERE collection = ? ORDER BY created_at DESC").all(collection);
        return Response.json(items.map(item => ({ 
          id: item.id, 
          ...JSON.parse(item.data as string),
          created_at: item.created_at,
          updated_at: item.updated_at
        })), { headers: corsHeaders });
      }
      
      if (method === "POST") {
        const body = await parseBody(req);
        if (!body) {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
        }
        
        const stmt = db.prepare("INSERT INTO dynamic_data (collection, data) VALUES (?, ?)");
        const result = stmt.run(collection, JSON.stringify(body));
        
        const newItem = db.query("SELECT * FROM dynamic_data WHERE id = ?").get(result.lastInsertRowid);
        return Response.json({ 
          id: newItem.id, 
          ...JSON.parse(newItem.data as string),
          created_at: newItem.created_at,
          updated_at: newItem.updated_at
        }, { headers: corsHeaders });
      }
    }

    // Handle single item operations
    const itemMatch = path.match(/^\/api\/data\/([^\/]+)\/(\d+)$/);
    if (itemMatch) {
      const [, collection, itemId] = itemMatch;
      const id = parseInt(itemId);
      
      if (method === "GET") {
        const item = db.query("SELECT * FROM dynamic_data WHERE collection = ? AND id = ?").get(collection, id);
        if (!item) {
          return Response.json({ error: "Item not found" }, { status: 404, headers: corsHeaders });
        }
        return Response.json({ 
          id: item.id, 
          ...JSON.parse(item.data as string),
          created_at: item.created_at,
          updated_at: item.updated_at
        }, { headers: corsHeaders });
      }
      
      if (method === "PUT") {
        const body = await parseBody(req);
        if (!body) {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
        }
        
        db.run(
          "UPDATE dynamic_data SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE collection = ? AND id = ?",
          JSON.stringify(body), collection, id
        );
        
        const updatedItem = db.query("SELECT * FROM dynamic_data WHERE collection = ? AND id = ?").get(collection, id);
        return Response.json({ 
          id: updatedItem.id, 
          ...JSON.parse(updatedItem.data as string),
          created_at: updatedItem.created_at,
          updated_at: updatedItem.updated_at
        }, { headers: corsHeaders });
      }
      
      if (method === "DELETE") {
        db.run("DELETE FROM dynamic_data WHERE collection = ? AND id = ?", collection, id);
        return Response.json({ success: true }, { headers: corsHeaders });
      }
    }

    // Stats endpoint
    if (path === "/api/stats") {
      const appCount = db.query("SELECT COUNT(*) as count FROM apps").get();
      const dataCount = db.query("SELECT COUNT(*) as count FROM dynamic_data").get();
      const collections = db.query("SELECT DISTINCT collection FROM dynamic_data").all();
      
      return Response.json({
        apps: appCount.count,
        dataItems: dataCount.count,
        collections: collections.map(c => c.collection)
      }, { headers: corsHeaders });
    }

    // AI Generate endpoint
    if (path === "/api/generate" && method === "POST") {
      const body = await parseBody(req);
      if (!body || !body.prompt) {
        return Response.json({ error: "Missing prompt" }, { status: 400, headers: corsHeaders });
      }

      try {
        const generator = new AIAppGenerator();
        const appSpec = await generator.generateApp(body.prompt);
        
        // Save generated app to database
        const stmt = db.prepare("INSERT INTO apps (name, spec) VALUES (?, ?)");
        const result = stmt.run(appSpec.appName, JSON.stringify(appSpec));
        
        const newApp = db.query("SELECT * FROM apps WHERE id = ?").get(result.lastInsertRowid);
        return Response.json({ 
          app: newApp,
          spec: appSpec 
        }, { headers: corsHeaders });
      } catch (error) {
        console.error("Generation error:", error);
        return Response.json({ 
          error: "Failed to generate app", 
          details: error.message 
        }, { status: 500, headers: corsHeaders });
      }
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  },
});

console.log(`API server running at http://localhost:${PORT}`);
console.log("Available endpoints:");
console.log(`  - POST   http://localhost:${PORT}/api/generate (AI-powered app generation)`);
console.log(`  - GET    http://localhost:${PORT}/api/apps`);
console.log(`  - POST   http://localhost:${PORT}/api/apps`);
console.log(`  - GET    http://localhost:${PORT}/api/apps/:id`);
console.log(`  - DELETE http://localhost:${PORT}/api/apps/:id`);
console.log(`  - GET    http://localhost:${PORT}/api/data/:collection`);
console.log(`  - POST   http://localhost:${PORT}/api/data/:collection`);
console.log(`  - GET    http://localhost:${PORT}/api/data/:collection/:id`);
console.log(`  - PUT    http://localhost:${PORT}/api/data/:collection/:id`);
console.log(`  - DELETE http://localhost:${PORT}/api/data/:collection/:id`);
console.log(`  - GET    http://localhost:${PORT}/api/stats`);