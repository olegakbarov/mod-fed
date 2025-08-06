# AI App Generator PoC

A proof of concept demonstrating AI-powered app generation using module federation concepts and React Native. Now integrated with Vercel AI SDK for real AI-powered app generation using OpenAI or Anthropic.

## 🏗️ Project Structure

```
ai-app-generator-poc/
├── App.tsx                          # Main React Native app
├── remote-components/               # JavaScript components for federation
│   ├── Button.js
│   ├── Card.js
│   ├── Header.js
│   ├── List.js
│   └── TextInput.js
├── src/
│   ├── components/                 # TypeScript fallback components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Header.tsx
│   │   ├── List.tsx
│   │   └── TextInput.tsx
│   ├── federation/
│   │   └── loader.ts              # Module federation loader (simulated)
│   ├── generators/
│   │   └── ai-generator.ts        # AI app generation logic
│   ├── registry/
│   │   └── components-registry.json # Component metadata
│   └── server-components/
│       └── server-component-generator.ts # Server component generator
└── server/
    └── component-server.ts         # Bun server for remote components
```

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh) installed
- React Native development environment
- iOS Simulator or Android Emulator
- AI API Key (OpenAI or Anthropic) - optional but recommended

### Installation

```bash
cd ai-app-generator-poc
bun install
```

### AI Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your AI provider API key:
```env
AI_PROVIDER=openai  # or 'anthropic'
AI_API_KEY=your-api-key-here
AI_MODEL=gpt-4o-mini  # or claude-3-5-sonnet-20241022
```

### Running the PoC

1. **Terminal 1 - Start Component Server:**
```bash
bun run server/component-server.ts
```

2. **Terminal 2 - Start API Server (with AI):**
```bash
bun run server/api-server.ts
```

3. **Terminal 3 - Run React Native App:**
```bash
npx react-native run-ios
# OR
npx react-native run-android
```

## 🎯 How It Works

1. **User Input**: Enter a natural language description of your app
2. **AI Generation**: Uses Vercel AI SDK with OpenAI/Anthropic to generate app specifications
3. **Component Selection**: AI selects appropriate components from the registry
4. **Dynamic Loading**: Components are loaded (simulated module federation)
5. **App Rendering**: The generated app is displayed in real-time

## 📝 Example Prompts

Try these in the app:
- "Create a todo list app"
- "Build a dashboard with analytics"
- "Make a blog reader app"
- "Design a social media feed"

## 🏛️ Architecture Highlights

### Module Federation (Simulated)
- Remote components served from `http://localhost:3001`
- Dynamic loading based on app requirements
- Local fallbacks for resilience

### AI Generation
- **Real AI Integration**: Uses Vercel AI SDK with OpenAI or Anthropic
- **Structured Output**: AI generates valid JSON app specifications
- **Fallback Logic**: Keyword-based matching when API is unavailable
- **Component selection based on AI analysis

### Component Registry
- Metadata-driven component discovery
- AI tags for intelligent selection
- Props validation and documentation

## 🛠️ Development

### Type Checking
```bash
bun run typecheck
```

### Linting
```bash
bun run lint
```

### Component Server
The component server runs on port 3001 and serves:
- `/health` - Health check endpoint
- `/components` - List available components
- `/{component}.js` - Individual component files

### API Server
The API server runs on port 3002 and provides:
- `POST /api/generate` - AI-powered app generation
- `GET/POST /api/apps` - App management
- `GET/POST/PUT/DELETE /api/data/:collection` - Dynamic data storage
- `GET /api/stats` - Usage statistics

## 🔄 Component Architecture

### Remote Components (`remote-components/`)
- Plain JavaScript for universal compatibility
- Served via HTTP for federation simulation
- Hot-swappable without app rebuild

### Local Components (`src/components/`)
- TypeScript for type safety
- Fallback when remote loading fails
- Identical functionality to remote versions

## 🚧 Limitations & Next Steps

### Current Limitations (PoC)
- Uses `eval()` for module loading (security risk - production should use proper federation)
- Simulated server components (not real RSC)

### Future Enhancements
1. ~~Integrate real AI APIs (Claude/GPT)~~ ✅ Completed with Vercel AI SDK
2. Implement proper Webpack Module Federation
3. Add React Server Components when available for RN
4. Expand component library
5. Add state management
6. Implement component composition rules
7. Add data binding between components

## 📄 License

MIT