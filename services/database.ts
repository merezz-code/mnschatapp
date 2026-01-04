import * as SQLite from 'expo-sqlite';

// Ouverture de la base de données avec l'API moderne
export const db = SQLite.openDatabaseSync('chatapp.db');

export const initDatabase = () => {
    try {
        // Activer les clés étrangères
        db.execSync(`
            PRAGMA foreign_keys = ON;

            -- Table utilisateurs
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

            -- Table groupes
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                avatar TEXT,
                is_private INTEGER DEFAULT 0,
                created_by TEXT,
                lastUpdate INTEGER
            );

            -- Table membres des groupes
            CREATE TABLE IF NOT EXISTS group_members (
                group_id TEXT,
                user_id TEXT,
                role TEXT DEFAULT 'member', 
                PRIMARY KEY (group_id, user_id),
                FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
            );

            -- Table messages de groupe
            CREATE TABLE IF NOT EXISTS group_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                content TEXT,
                type TEXT DEFAULT 'text',
                file_name TEXT,
                file_url TEXT,
                image_url TEXT,
                audio_url TEXT,
                timestamp INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users (id)
            );

            -- Table messages privés
            CREATE TABLE IF NOT EXISTS private_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                content TEXT,
                type TEXT DEFAULT 'text',
                file_name TEXT,
                file_url TEXT,
                image_url TEXT,
                audio_url TEXT,
                timestamp INTEGER DEFAULT (strftime('%s', 'now')),
                is_read INTEGER DEFAULT 0
            );

            -- Index pour accélérer les requêtes par conversation privée
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

            -- Table blocages
            CREATE TABLE IF NOT EXISTS blocks (
                blocker_id TEXT NOT NULL,
                blocked_id TEXT NOT NULL,
                PRIMARY KEY (blocker_id, blocked_id),
                FOREIGN KEY (blocker_id) REFERENCES users (id),
                FOREIGN KEY (blocked_id) REFERENCES users (id)
            );

            -- ✅ NOUVELLE TABLE : Tracking des lectures de messages groupe
            CREATE TABLE IF NOT EXISTS message_reads (
                message_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                read_at INTEGER NOT NULL,
                PRIMARY KEY (message_id, user_id),
                FOREIGN KEY (message_id) REFERENCES group_messages (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_message_reads_user 
            ON message_reads (user_id, read_at);

            -- ✅ NOUVELLE TABLE : Tracking des groupes quittés
            CREATE TABLE IF NOT EXISTS user_left_groups (
                user_id TEXT NOT NULL,
                group_id TEXT NOT NULL,
                left_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, group_id)
            );

            CREATE INDEX IF NOT EXISTS idx_user_left_groups 
            ON user_left_groups (user_id, group_id);
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

// ✅ NOUVELLE FONCTION : Récupérer les messages d'un groupe en filtrant selon la date de sortie
export const getGroupChat = (groupId: string, userId: string) => {
    try {
        // Récupérer la date de sortie si elle existe
        const leftInfo = db.getFirstSync(
            'SELECT left_at FROM user_left_groups WHERE user_id = ? AND group_id = ?',
            [userId, groupId]
        );

        if (leftInfo) {
            // Ne montrer QUE les messages après la date de sortie
            // (si l'utilisateur rejoint le groupe plus tard)
            return db.getAllSync(
                `SELECT 
                    id, group_id as roomId, sender_id as senderId, content, type,
                    file_name as fileName, file_url as fileUrl, 
                    image_url as imageUrl, audio_url as audioUrl, timestamp
                 FROM group_messages 
                 WHERE group_id = ? AND timestamp > ?
                 ORDER BY timestamp ASC`,
                [groupId, leftInfo.left_at]
            );
        }

        // Sinon, tous les messages
        return db.getAllSync(
            `SELECT 
                id, group_id as roomId, sender_id as senderId, content, type,
                file_name as fileName, file_url as fileUrl, 
                image_url as imageUrl, audio_url as audioUrl, timestamp
             FROM group_messages 
             WHERE group_id = ? 
             ORDER BY timestamp ASC`,
            [groupId]
        );
    } catch (error) {
        console.error('Erreur récupération chat groupe:', error);
        return [];
    }
};

// NOUVELLE FONCTION : Marquer qu'un utilisateur a quitté un groupe
export const markUserLeftGroup = (userId: string, groupId: string) => {
    try {
        const leftAt = Date.now();
        db.runSync(
            'INSERT OR REPLACE INTO user_left_groups (user_id, group_id, left_at) VALUES (?, ?, ?)',
            [userId, groupId, leftAt]
        );
        console.log(`✅ Utilisateur ${userId} a quitté le groupe ${groupId} à ${leftAt}`);
    } catch (error) {
        console.error('Erreur marquage sortie groupe:', error);
    }
};

//  NOUVELLE FONCTION : Supprimer l'historique de sortie (si l'utilisateur rejoint à nouveau)
export const clearUserLeftGroup = (userId: string, groupId: string) => {
    try {
        db.runSync(
            'DELETE FROM user_left_groups WHERE user_id = ? AND group_id = ?',
            [userId, groupId]
        );
        console.log(`✅ Historique de sortie effacé pour ${userId} du groupe ${groupId}`);
    } catch (error) {
        console.error('Erreur suppression historique sortie:', error);
    }
};
