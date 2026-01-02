import React, { useState } from 'react';
import { View } from 'react-native';
import ContactList from './ContactList';
import ChatPrivateView from './ChatPrivateView'; // Assure-toi que le chemin est correct

const ChatWrapper = ({ me }) => {
  const [activeChat, setActiveChat] = useState<any>(null); // null = liste, sinon = user sélectionné

  const handleStartChat = (user: any) => {
    setActiveChat(user);
  };

  const handleBackFromChat = () => {
    setActiveChat(null);
  };

  const handleBlockUser = (userId: string) => {
    // Cette fonction sera appelée depuis ChatPrivateView
    // Tu peux ici recharger les contacts si besoin
    handleBackFromChat();
  };

  return (
    <View style={{ flex: 1 }}>
      {activeChat ? (
        <ChatPrivateView
          chatWith={activeChat}      // l'utilisateur avec qui on discute
          me={me}
          onBack={handleBackFromChat}
          onBlockUser={handleBlockUser} // optionnel, si tu veux gérer le blocage depuis le chat
        />
      ) : (
        <ContactList me={me} onStartChat={handleStartChat} />
      )}
    </View>
  );
};

export default ChatWrapper;