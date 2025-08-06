#!/usr/bin/env node

import { config } from 'dotenv';
import app, { db } from './app';
import { getAppConfig } from './config';

// Load environment variables
config();

async function startServer() {
  try {
    // Load configuration (will validate required env vars)
    const appConfig = getAppConfig();
    
    console.log('🚀 Starting AI App Generator API Server...');
    console.log(`📊 Environment: ${appConfig.nodeEnv}`);
    console.log(`🗄️  Database: ${appConfig.databasePath}`);

    // Initialize database
    console.log('🔧 Initializing database...');
    await db.initialize();
    console.log('✅ Database initialized successfully');

    // Start HTTP server
    const server = app.listen(appConfig.port, () => {
      console.log(`🌟 Server running on port ${appConfig.port}`);
      console.log(`🏥 Health check: http://localhost:${appConfig.port}/health`);
      console.log('📚 Available endpoints:');
      console.log('  POST /auth/register   - User registration');
      console.log('  POST /auth/login      - User login');
      console.log('  GET  /api/apps        - Get user apps (auth required)');
      console.log('  POST /api/generate    - Generate new app (auth required)');
      console.log('  GET  /api/apps/:id    - Get specific app (auth required)');
      console.log('  DELETE /api/apps/:id  - Delete app (auth required)');
      console.log('');
      console.log('💡 Example usage:');
      console.log('  curl http://localhost:' + appConfig.port + '/health');
      console.log('');
      console.log('🔒 Required environment variables:');
      console.log('  JWT_SECRET     - Secret for signing JWT tokens');
      console.log('  DATABASE_PATH  - Path to SQLite database file');
      console.log('');
      console.log('📄 Optional environment variables:');
      console.log('  PORT           - Server port (default: 3000)');
      console.log('  NODE_ENV       - Environment (default: development)');
      console.log('  AI_PROVIDER    - AI provider: openai|anthropic (default: openai)');
      console.log('  AI_API_KEY     - API key for AI service');
      console.log('  AI_MODEL       - Model name (default: gpt-4o-mini)');
      console.log('');
      console.log('✨ Server ready to accept connections!');
    });

    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      
      server.close(() => {
        console.log('🔒 HTTP server closed');
        
        try {
          db.close();
          console.log('🗄️  Database connection closed');
        } catch (error) {
          console.error('❌ Error closing database:', error);
        }
        
        console.log('👋 Server shutdown complete');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('🛑 SIGINT received (Ctrl+C), shutting down gracefully...');
      
      server.close(() => {
        console.log('🔒 HTTP server closed');
        
        try {
          db.close();
          console.log('🗄️  Database connection closed');
        } catch (error) {
          console.error('❌ Error closing database:', error);
        }
        
        console.log('👋 Server shutdown complete');
        process.exit(0);
      });
    });

  } catch (error: any) {
    console.error('💥 Failed to start server:', error.message);
    
    if (error.message.includes('JWT_SECRET')) {
      console.error('🔑 Please set JWT_SECRET environment variable');
      console.error('   Example: export JWT_SECRET="your-secret-key-here"');
    }
    
    if (error.message.includes('DATABASE_PATH')) {
      console.error('🗄️  Please set DATABASE_PATH environment variable');
      console.error('   Example: export DATABASE_PATH="./app.db"');
    }
    
    console.error('');
    console.error('💡 Quick setup:');
    console.error('   echo "JWT_SECRET=your-secret-key-here" > .env');
    console.error('   echo "DATABASE_PATH=./app.db" >> .env');
    console.error('   echo "AI_API_KEY=your-ai-api-key" >> .env');
    
    process.exit(1);
  }
}

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();