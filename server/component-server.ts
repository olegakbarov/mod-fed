import { serve } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const PORT = 3001;
const componentsDir = join(process.cwd(), "remote-components");

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    
    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", message: "Component server is running" }, { headers });
    }

    // List components
    if (url.pathname === "/components") {
      const files = await readdir(componentsDir);
      const components = files.filter(file => file.endsWith(".js")).map(file => file.replace(".js", ""));
      return Response.json(components, { headers });
    }

    // Serve component files
    const componentPath = url.pathname.slice(1);
    if (componentPath.endsWith(".js")) {
      const file = Bun.file(join(componentsDir, componentPath));
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            ...headers,
            "Content-Type": "application/javascript",
          },
        });
      }
    }

    return new Response("Not Found", { status: 404, headers });
  },
});

console.log(`Component server running at http://localhost:${PORT}`);
console.log("Available endpoints:");
console.log(`  - http://localhost:${PORT}/health`);
console.log(`  - http://localhost:${PORT}/components`);

const files = await readdir(componentsDir).catch(() => []);
files.filter(f => f.endsWith(".js")).forEach(file => {
  console.log(`  - http://localhost:${PORT}/${file}`);
});