import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('timetracker.db');

export function initDb(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes REAL,
      FOREIGN KEY (project_id) REFERENCES projects (id)
    );
  `);

  const count = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM projects'
  );

  if (count?.count === 0) {
    db.execSync(`
      INSERT INTO projects (name, color) VALUES ('Personal', '#4CAF50');
      INSERT INTO projects (name, color) VALUES ('Work', '#2196F3');
      INSERT INTO projects (name, color) VALUES ('Learning', '#FF9800');
    `);
  }
}

export default db;
