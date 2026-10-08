-- Lead-to-Delivery AI Agent: SQLite Schema

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    inquiry TEXT,
    budget REAL,
    need TEXT,
    timeline TEXT,
    decision_maker INTEGER DEFAULT 0,
    score REAL,
    tier TEXT,
    status TEXT DEFAULT 'NEW',
    outreach_subject TEXT,
    outreach_body TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    deal_value REAL,
    status TEXT DEFAULT 'OPEN',
    created_at TEXT DEFAULT (datetime('now')),
    won_at TEXT,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id INTEGER NOT NULL,
    task_name TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    depends_on INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (deal_id) REFERENCES deals(id),
    FOREIGN KEY (depends_on) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intent TEXT,
    agent TEXT,
    action TEXT,
    result TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);
