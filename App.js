import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import MainApp from './MainApp';
import { initDatabase } from './services/database';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    initDatabase();
  }, []);

  if (!isLoggedIn) {
    return (
      <Auth
        onLoginSuccess={(user) => {
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
        setCurrentUser(null);
        setIsLoggedIn(false);
      }}
    />
  );
}