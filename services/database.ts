
import * as SQLite from 'expo-sqlite';

// Ouverture de la base de données avec l'API moderne
export const db = SQLite.openDatabaseSync('chatapp.db');

export const initDatabase = () => {
    try {
// Activer les clés étrangères
        //db.execSync('drop table if exists private_messages;');
        db.execSync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY NOT NULL,
            username TEXT NOT NULL,
            email TEXT UNIQUE, 
            password TEXT,
            avatar TEXT,
            bio TEXT,
            is_online INTEGER DEFAULT 0,
            last_seen DATETIME
        );

        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            avatar TEXT,
            is_private INTEGER DEFAULT 0,
            created_by TEXT,
            lastUpdate INTEGER
        );

      CREATE TABLE IF NOT EXISTS group_members (
        group_id TEXT,
        user_id TEXT,
        role TEXT DEFAULT 'member', 
        PRIMARY KEY (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
    );

     CREATE TABLE IF NOT EXISTS group_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT,
        type TEXT DEFAULT 'text',           -- ← AJOUTÉ
        file_name TEXT,                     -- ← AJOUTÉ
        file_url TEXT,
        image_url TEXT,
        audio_url TEXT,                     -- ← AJOUTÉ (tu l'utilises dans l'INSERT)
        timestamp INTEGER DEFAULT (strftime('%s', 'now')), -- mieux pour React Native que DATETIME
        FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users (id)
        );

      CREATE TABLE IF NOT EXISTS private_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,      -- Changé en INTEGER AUTOINCREMENT pour simplicité
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'text',                  -- AJOUTÉ : text | image | file | audio
  file_name TEXT,                            -- AJOUTÉ
  file_url TEXT,
  image_url TEXT,
  audio_url TEXT,                            -- AJOUTÉ
  timestamp INTEGER DEFAULT (strftime('%s', 'now')),  -- Timestamp Unix en secondes
  is_read INTEGER DEFAULT 0
);

-- Index pour accélérer les requêtes par conversation
CREATE INDEX IF NOT EXISTS idx_private_messages_conversation 
ON private_messages (sender_id, receiver_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_private_messages_pair 
ON private_messages (
  CASE 
    WHEN sender_id < receiver_id THEN sender_id 
    ELSE receiver_id 
  END,
  CASE 
    WHEN sender_id < receiver_id THEN receiver_id 
    ELSE sender_id 
  END,
  timestamp
);

      CREATE TABLE IF NOT EXISTS blocks (
        blocker_id TEXT NOT NULL,
        blocked_id TEXT NOT NULL,
        PRIMARY KEY (blocker_id, blocked_id),
        FOREIGN KEY (blocker_id) REFERENCES users (id),
        FOREIGN KEY (blocked_id) REFERENCES users (id)
      );
    `);
        console.log("✅ Base de données SQLite initialisée.");
    } catch (error) {
        console.error("❌ Erreur lors de l'initialisation de la base :", error);
    }
};

// --- FONCTIONS GROUPES ---

export const getRoomsFromDB = (userId: string) => {
    try {
        // On récupère uniquement les groupes dont l'utilisateur est membre
        return db.getAllSync(`
            SELECT g.* FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ?
            ORDER BY g.lastUpdate DESC
        `, [userId]);
    } catch (error) {
        console.error("Erreur récupération salons:", error);
        return [];
    }
};

export const createGroupInDB = (name: string, createdBy: string) => {
    try {
        const result: any = db.runSync(
            `INSERT INTO groups (name, avatar, is_private, created_by, lastUpdate) VALUES (?, ?, ?, ?, ?);`,
            [name, `https://picsum.photos/seed/${Math.random()}/200`, 0, createdBy, Date.now()]
        );
        const groupId = result.lastInsertRowId;
        // Ajouter le créateur comme admin
        addGroupMemberInDB(groupId.toString(), createdBy, 'admin');
        return groupId;
    } catch (error) {
        console.error("Erreur création groupe:", error);
    }
};

export const deleteGroupInDB = (id: string) => {
    try {
        db.runSync(`DELETE FROM groups WHERE id = ?`, [id]);
    } catch (error) {
        console.error("Erreur suppression groupe:", error);
    }
};

export const updateGroupNameInDB = (id: string, name: string) => {
    try {
        db.runSync(`UPDATE groups SET name = ?, lastUpdate = ? WHERE id = ?`, [name, Date.now(), id]);
    } catch (error) {
        console.error("Erreur mise à jour nom groupe:", error);
    }
};

// --- FONCTIONS MEMBRES ---

export const addGroupMemberInDB = (groupId: string, userId: string, role: string = 'member') => {
    try {
        db.runSync(`INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?);`, [groupId, userId, role]);
    } catch (error) {
        console.error("Erreur ajout membre:", error);
    }
};

export const removeGroupMemberInDB = (groupId: string, userId: string) => {
    try {
        db.runSync(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`, [groupId, userId]);
    } catch (error) {
        console.error("Erreur retrait membre:", error);
    }
};

export const getGroupMembersFromDB = (groupId: string) => {
    try {
        return db.getAllSync(`
            SELECT user_id as id, role FROM group_members WHERE group_id = ?
        `, [groupId]);
    } catch (error) {
        console.error("Erreur récupération membres:", error);
        return [];
    }
};

// --- FONCTIONS MESSAGES ---

export const saveGroupMessage = (msg: any) => {
    try {
        db.runSync(
            `INSERT INTO group_messages (group_id, sender_id, content, image_url, file_url, timestamp) 
             VALUES (?, ?, ?, ?, ?, ?);`,
            [msg.roomId, msg.senderId, msg.content, msg.imageUrl || null, msg.fileUrl || null, msg.timestamp]
        );
    } catch (error) {
        console.error("Erreur insertion message groupe:", error);
    }
};

export const getGroupChat = (groupId: string) => {
    try {
        return db.getAllSync(`SELECT * FROM group_messages WHERE group_id = ? ORDER BY timestamp ASC`, [groupId]);
    } catch (error) {
        console.error("Erreur récupération chat groupe:", error);
        return [];
    }
};
