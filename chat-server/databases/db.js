const { Pool } = require('pg');
require('dotenv').config();

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test de connexion
pool.on('connect', () => {
  console.log('Connecté à PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Erreur PostgreSQL:', err);
});

// Fonction helper pour exécuter des requêtes
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Requête exécutée', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Erreur requête:', error);
    throw error;
  }
};

// Fonction pour obtenir un client (transactions)
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Timeout de 5 secondes
  const timeout = setTimeout(() => {
    console.error('Client timeout - libération forcée');
    client.release();
  }, 5000);
  
  client.release = () => {
    clearTimeout(timeout);
    client.release();
  };
  
  return { query, release, client };
};

module.exports = {
  query,
  getClient,
  pool
};