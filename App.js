import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import MainApp from './MainApp';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Plus besoin d'initDatabase car on utilise PostgreSQL côté serveur
  useEffect(() => {
    console.log('🚀 Application démarrée - Mode API PostgreSQL');
    // Optionnel: Vérifier la connexion au serveur
    checkServerConnection();
  }, []);

  const checkServerConnection = async () => {
    try {
      const API_URL = 'http://192.168.1.7:3000';

      const response = await fetch(API_URL);
      console.log("hahahaha");
      console.log(response);

      const data = await response.json();
      console.log(data);
      
      if (data.status === 'OK') {
        console.log('✅ Connexion au serveur réussie:', data.message);
      } else {
        console.warn('⚠️ Serveur accessible mais réponse inattendue');
      }
    } catch (error) {
      console.error('❌ Impossible de se connecter au serveur:', error.message);
      console.log('💡 Vérifiez que le serveur est démarré: cd chat-server && node server.js');
    }
  };

  if (!isLoggedIn) {
    return (
      <Auth
        onLoginSuccess={(user) => {
          console.log('👤 Utilisateur connecté:', user.username);
          setCurrentUser(user);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  return (
    <MainApp
      me={currentUser}
      onLogout={() => {
        console.log('👋 Déconnexion utilisateur');
        setCurrentUser(null);
        setIsLoggedIn(false);
      }}
    />
  );
}