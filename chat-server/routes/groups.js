const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

// Créer un groupe
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { name, description, avatar, isPrivate } = req.body;
    
    // Créer le groupe
    const groupResult = await client.query(
      `INSERT INTO groups (name, description, avatar, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description, avatar, req.userId]
    );
    
    const group = groupResult.rows[0];
    
    // Ajouter le créateur comme admin
    await client.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [group.id, req.userId]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json(group);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur création groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// Récupérer tous les groupes de l'utilisateur
router.get('/my-groups', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, 
              COUNT(gm.user_id) as member_count,
              MAX(CASE WHEN gm.user_id = $1 THEN gm.role END) as my_role
       FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id
       WHERE g.id IN (
         SELECT group_id FROM group_members WHERE user_id = $1
       )
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [req.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur récupération groupes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les groupes publics (découvrir)
router.get('/discover', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, COUNT(gm.user_id) as member_count
       FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id
       WHERE g.id NOT IN (
         SELECT group_id FROM group_members WHERE user_id = $1
       )
       GROUP BY g.id
       ORDER BY member_count DESC, g.created_at DESC
       LIMIT 50`,
      [req.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur découverte groupes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejoindre un groupe
router.post('/:groupId/join', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT DO NOTHING`,
      [req.params.groupId, req.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur rejoindre groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Quitter un groupe
router.delete('/:groupId/leave', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.groupId, req.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur quitter groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un groupe (admin seulement)
router.delete('/:groupId', authenticateToken, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    const memberCheck = await pool.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.groupId, req.userId]
    );
    
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    await pool.query('DELETE FROM groups WHERE id = $1', [req.params.groupId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour un groupe
router.patch('/:groupId', authenticateToken, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    const memberCheck = await pool.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.groupId, req.userId]
    );
    
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    const { name, description, avatar } = req.body;
    
    const result = await pool.query(
      `UPDATE groups 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           avatar = COALESCE($3, avatar)
       WHERE id = $4
       RETURNING *`,
      [name, description, avatar, req.params.groupId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur mise à jour groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un membre
router.post('/:groupId/members', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    await pool.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT DO NOTHING`,
      [req.params.groupId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur ajout membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Retirer un membre (admin seulement)
router.delete('/:groupId/members/:userId', authenticateToken, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    const memberCheck = await pool.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.groupId, req.userId]
    );
    
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    await pool.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.groupId, req.params.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur retrait membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des membres d'un groupe
router.get('/:groupId/members', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.profile_picture, u.status, gm.role
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.role DESC, u.username ASC`,
      [req.params.groupId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur liste membres:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;