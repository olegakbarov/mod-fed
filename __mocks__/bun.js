// Mock for Bun runtime
module.exports = {
  serve: jest.fn((options) => {
    return {
      port: options.port || 3000,
      hostname: 'localhost',
      stop: jest.fn(),
    };
  }),
  
  file: jest.fn((path) => ({
    text: jest.fn().mockResolvedValue(''),
    json: jest.fn().mockResolvedValue({}),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  })),
  
  write: jest.fn().mockResolvedValue(undefined),
};