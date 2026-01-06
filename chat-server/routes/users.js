const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

// Récupérer tous les utilisateurs (pour la liste des contacts)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, profile_picture, bio, status, last_seen 
       FROM users 
       WHERE id != $1 
       ORDER BY username ASC`,
      [req.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer un utilisateur spécifique
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, profile_picture, bio, status, last_seen 
       FROM users 
       WHERE id = $1`,
      [req.params.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur récupération utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour le profil
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const { username, bio, profilePicture } = req.body;
    
    const result = await pool.query(
      `UPDATE users 
       SET username = COALESCE($1, username),
           bio = COALESCE($2, bio),
           profile_picture = COALESCE($3, profile_picture)
       WHERE id = $4
       RETURNING id, username, email, profile_picture, bio`,
      [username, bio, profilePicture, req.userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Bloquer un utilisateur
router.post('/block/:userId', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, req.params.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur blocage:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Débloquer un utilisateur
router.delete('/block/:userId', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [req.userId, req.params.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur déblocage:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des utilisateurs bloqués
router.get('/blocked/list', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.profile_picture 
       FROM blocks b
       JOIN users u ON b.blocked_id = u.id
       WHERE b.blocker_id = $1`,
      [req.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur liste bloqués:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;