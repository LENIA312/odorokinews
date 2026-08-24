-- odorokinews v0.1 初期スキーマ
-- docs.md 24章の想定テーブルに基づく。

CREATE TABLE world (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  name_en TEXT,
  origin_story TEXT NOT NULL,
  current_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_major INTEGER NOT NULL DEFAULT 0,
  population INTEGER,
  description TEXT,
  industries TEXT, -- JSON配列
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'company', -- company / government / school / other
  city_id INTEGER REFERENCES cities(id),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 変動設定
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  city_id INTEGER REFERENCES cities(id),
  occupation TEXT,
  organization_id INTEGER REFERENCES organizations(id),
  money INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'alive', -- 現在の状態（alive/deceased等）
  origin TEXT NOT NULL DEFAULT 'simulation', -- simulation | news_generated
  bio TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id),
  related_person_id INTEGER NOT NULL REFERENCES people(id),
  relation_type TEXT NOT NULL, -- family / friend / colleague / spouse ...
  created_at TEXT NOT NULL
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  location_city_id INTEGER REFERENCES cities(id),
  summary TEXT NOT NULL,
  detail TEXT,
  related_people TEXT, -- JSON配列 (person id)
  related_organizations TEXT, -- JSON配列 (organization id)
  world_state_impact TEXT, -- JSON: 世界状態への影響の記録
  is_newsworthy INTEGER NOT NULL DEFAULT 1,
  news_id INTEGER,
  source TEXT NOT NULL DEFAULT 'ai', -- ai | fallback_template
  created_at TEXT NOT NULL
);

CREATE TABLE news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '社会',
  related_people TEXT, -- JSON配列
  related_organizations TEXT, -- JSON配列
  related_city_id INTEGER REFERENCES cities(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  generated_by TEXT NOT NULL, -- モデル名 | fallback_template
  created_at TEXT NOT NULL
);

CREATE TABLE timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_date TEXT NOT NULL,
  event_id INTEGER NOT NULL REFERENCES events(id),
  headline TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE economic_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_date TEXT NOT NULL,
  organization_id INTEGER REFERENCES organizations(id),
  metric TEXT NOT NULL, -- stock_price / price_index など
  value REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE simulation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_date TEXT NOT NULL UNIQUE, -- 同一世界日の二重実行を防止
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- running | success | failed
  ai_calls_used INTEGER NOT NULL DEFAULT 0,
  event_id INTEGER REFERENCES events(id),
  news_id INTEGER REFERENCES news(id),
  error TEXT
);

CREATE INDEX idx_news_published_at ON news(published_at DESC);
CREATE INDEX idx_events_world_date ON events(world_date DESC);
CREATE INDEX idx_timeline_world_date ON timeline(world_date DESC);
CREATE INDEX idx_people_org ON people(organization_id);
CREATE INDEX idx_relationships_person ON relationships(person_id);
CREATE INDEX idx_economic_data_org ON economic_data(organization_id, world_date DESC);
