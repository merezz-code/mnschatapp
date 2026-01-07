-- Schéma PostgreSQL pour ChatApp
-- À exécuter dans votre base de données PostgreSQL

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    avatar TEXT,
    bio TEXT,
    is_online INTEGER DEFAULT 0,
    last_seen TIMESTAMP,
    is_activated INTEGER DEFAULT 0,
    activation_code VARCHAR(10),
    activation_code_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des groupes
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    is_private INTEGER DEFAULT 0,
    created_by VARCHAR(50),
    last_update BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Table des membres de groupe
CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER,
    user_id VARCHAR(50),
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des messages de groupe
CREATE TABLE IF NOT EXISTS group_messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL,
    sender_id VARCHAR(50) NOT NULL,
    content TEXT,
    type VARCHAR(20) DEFAULT 'text',
    file_name TEXT,
    file_url TEXT,
    image_url TEXT,
    audio_url TEXT,
    timestamp BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des messages privés
CREATE TABLE IF NOT EXISTS private_messages (
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR(50) NOT NULL,
    receiver_id VARCHAR(50) NOT NULL,
    content TEXT,
    type VARCHAR(20) DEFAULT 'text',
    file_name TEXT,
    file_url TEXT,
    image_url TEXT,
    audio_url TEXT,
    timestamp BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
    is_read INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_private_messages_conversation 
ON private_messages (sender_id, receiver_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_private_messages_timestamp 
ON private_messages (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_group_messages_group 
ON group_messages (group_id, timestamp);

-- Table des blocages
CREATE TABLE IF NOT EXISTS blocks (
    blocker_id VARCHAR(50) NOT NULL,
    blocked_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id),
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des messages supprimés (pour suppression locale)
CREATE TABLE IF NOT EXISTS deleted_messages (
    user_id VARCHAR(50) NOT NULL,
    message_id INTEGER NOT NULL,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, message_id)
);

CREATE TABLE IF NOT EXISTS deleted_group_messages (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  message_id INTEGER NOT NULL,
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, message_id)
);

CREATE INDEX idx_deleted_group_messages_user_id ON deleted_group_messages(user_id);
CREATE INDEX idx_deleted_group_messages_message_id ON deleted_group_messages(message_id);

ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;