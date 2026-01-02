import React, { useState } from 'react';
import { View } from 'react-native';
import ContactList from './ContactList';
import ChatPrivateView from './ChatPrivateView';

const ChatWrapper = ({ me }) => {
  const [activeChat, setActiveChat] = useState<any>(null); // null = liste contacts, sinon contact sélectionné

  const handleStartChat = (user: any) => {
    setActiveChat(user); // ouvre ChatPrivate avec ce contact
  };

  const handleBackFromChat = () => {
    setActiveChat(null); // retourne à la liste des contacts
  };

  return (
    <View style={{ flex: 1 }}>
      {activeChat ? (
        <ChatPrivateView chatWith={activeChat} me={me} onBack={handleBackFromChat} />
      ) : (
        <ContactList me={me} onStartChat={handleStartChat} />
      )}
    </View>
  );
};

export default ChatWrapper;
