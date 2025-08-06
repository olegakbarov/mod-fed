-- Create app_data table for storing application-specific data
CREATE TABLE app_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_app_data_app_id ON app_data(app_id);
CREATE INDEX idx_app_data_created_at ON app_data(created_at);