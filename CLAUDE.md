# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- **Run setup**: `bun run script.ts` - Sets up the entire AI App Generator PoC project
- **Start component server**: `cd ai-app-generator-poc && bun run server/component-server.ts` - Runs the Bun server serving remote components on port 3001
- **Install dependencies**: `cd ai-app-generator-poc && bun install` - Install all project dependencies
- **Run React Native (iOS)**: `cd ai-app-generator-poc && npx react-native run-ios` - Run the app on iOS simulator
- **Run React Native (Android)**: `cd ai-app-generator-poc && npx react-native run-android` - Run the app on Android emulator

### Running the Full PoC
1. Terminal 1: `cd ai-app-generator-poc && bun run server/component-server.ts`
2. Terminal 2: `cd ai-app-generator-poc && npx react-native run-ios` (or run-android)

### Testing & Building
No test commands or build pipeline currently configured. The project is a proof-of-concept using Bun for rapid development.

## Architecture

This is an AI App Generator proof-of-concept that demonstrates:

1. **Module Federation Simulation**: The `src/federation/loader.ts` simulates loading remote components dynamically. Currently uses eval() for PoC purposes - should be replaced with proper Module Federation in production.

2. **Component Registry**: Components are registered in `src/registry/components-registry.json` with:
   - Component metadata (props, AI tags, descriptions)
   - Remote URLs for component loading
   - Template definitions for common app patterns

3. **AI Generation Pipeline**: 
   - User provides natural language prompt
   - AI generator creates app specification based on keywords (todo, dashboard, blog)
   - Components are dynamically loaded and rendered
   - Currently uses simple keyword matching - intended for Claude/GPT API integration

4. **Remote Component Architecture**:
   - Components stored in `remote-components/` directory
   - Served via Bun server on localhost:3001
   - Fallback to local copies in `src/components/`

5. **Server Components Simulation**: `src/server-components/` contains POC code for server-side component rendering (not actively used)

## Key Implementation Details

- **Technology Stack**: Bun runtime, React Native, TypeScript
- **Component Loading**: Uses eval() in POC - requires proper Module Federation for production
- **AI Integration Point**: `src/generators/ai-generator.ts` - currently keyword-based, ready for LLM integration
- **Security Note**: The loader uses eval() which is intentionally insecure for POC purposes only

## Development Notes

- The project structure centers around `ai-app-generator-poc/` directory
- Remote components are JavaScript files that export React Native components
- Component registry defines available components and their capabilities for AI selection
- The main setup script (`script.ts`) creates a full React Native project with all necessary files