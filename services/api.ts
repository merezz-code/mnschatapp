import { API_URL } from '../config/api';



// Helper pour les requêtes
const apiRequest = async (endpoint: string, method: string = 'GET', body?: any) => {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Erreur API');
    }

    return data;
  } catch (error) {
    console.error(`Erreur API ${endpoint}:`, error);
    throw error;
  }
};

// ============ USERS ============

export const registerUser = async (username: string, email: string, password: string) => {
  return apiRequest('/auth/register', 'POST', { username, email, password });
};

export const loginUser = async (email: string, password: string) => {
  return apiRequest('/auth/login', 'POST', { email, password });
};

export const updateUserProfile = async (userId: string, username: string, bio: string, avatar: string) => {
  return apiRequest(`/users/${userId}`, 'PUT', { username, bio, avatar });
};

export const getAllUsers = async () => {
  return apiRequest('/users');
};

// ============ GROUPS ============

export const getUserGroups = async (userId: string) => {
  return apiRequest(`/groups/user/${userId}`);
};

export const createGroup = async (name: string, createdBy: string, isPrivate: boolean = false) => {
  return apiRequest('/groups', 'POST', { name, createdBy, isPrivate });
};

export const deleteGroup = async (groupId: string) => {
  return apiRequest(`/groups/${groupId}`, 'DELETE');
};

export const updateGroupName = async (groupId: string, name: string) => {
  return apiRequest(`/groups/${groupId}`, 'PUT', { name });
};

// ============ GROUP MEMBERS ============

export const getGroupMembers = async (groupId: string) => {
  return apiRequest(`/groups/${groupId}/members`);
};

export const addGroupMember = async (groupId: string, userId: string, role: string = 'member') => {
  return apiRequest(`/groups/${groupId}/members`, 'POST', { userId, role });
};

export const removeGroupMember = async (groupId: string, userId: string) => {
  return apiRequest(`/groups/${groupId}/members/${userId}`, 'DELETE');
};

// ============ GROUP MESSAGES ============

export const getGroupMessages = async (groupId: string) => {
  return apiRequest(`/groups/${groupId}/messages`);
};

// Dans api.ts, remplace la fonction saveGroupMessage par :
export const saveGroupMessage = async (messageData: any) => {
  try {
    console.log('📤 Envoi message groupe:', {
      groupId: messageData.groupId,
      type: messageData.type,
      content: messageData.content?.substring(0, 50)
    });

    const response = await fetch(`${API_URL}/groups/${messageData.groupId}/messages`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(messageData)
    });

    console.log('📥 Status HTTP:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur serveur:', errorText);
      throw new Error(`Erreur HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const responseText = await response.text();
    console.log('📥 Réponse brute:', responseText.substring(0, 200));

    // Vérifier si la réponse est vide
    if (!responseText || responseText.trim() === '') {
      console.log('✅ Message enregistré (réponse vide OK)');
      return { success: true };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError);
      console.error('📄 Réponse complète:', responseText);
      
      // Si la réponse contient du HTML, c'est probablement une erreur serveur
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        throw new Error('Le serveur a renvoyé du HTML au lieu de JSON. Vérifiez les logs serveur.');
      }
      
      throw new Error('Réponse serveur invalide (pas du JSON)');
    }

    if (data.success === false) {
      throw new Error(data.error || 'Erreur serveur inconnue');
    }

    console.log('✅ Message groupe enregistré avec succès');
    return data;
  } catch (error: any) {
    console.error('❌ Erreur API /groups/:groupId/messages:', error);
    throw error;
  }
};

// ============ GROUP MESSAGE DELETION ============

export const deleteGroupMessageLocal = async (userId: string, messageId: number) => {
  return apiRequest('/groups/messages/delete-local', 'POST', { userId, messageId });
};

export const deleteGroupMessageForAll = async (messageId: number) => {
  return apiRequest(`/groups/messages/${messageId}/delete-all`, 'PUT');
};
// ============ PRIVATE MESSAGES ============

export const getPrivateMessages = async (userId1: string, userId2: string) => {
  return apiRequest(`/private-messages/${userId1}/${userId2}`);
};

export const sendPrivateMessage = async (msg: any) => {
  return apiRequest('/private-messages', 'POST', msg);
};

export const getPrivateChats = async (userId: string) => {
  return apiRequest(`/private-chats/${userId}`);
};

export const deleteMessageLocal = async (userId: string, messageId: number) => {
  return apiRequest('/private-messages/delete-local', 'POST', { userId, messageId });
};

export const deleteMessageForAll = async (messageId: number) => {
  return apiRequest(`/private-messages/${messageId}/delete-all`, 'PUT');
};
// services/api.js (ou api.ts)



export const getUnreadCounts = async (userId) => {
  try {
    console.log('🔄 getUnreadCounts appelé pour userId:', userId);
    
    const url = `${API_URL}/messages/unread-count/${userId}`;
    console.log('📡 URL:', url);
    
    const response = await fetch(url);
    
    console.log('📊 HTTP Status:', response.status);
    
    if (!response.ok) {
      console.error('❌ Erreur HTTP:', response.status);
      return { success: false, counts: [] };
    }
    
    const data = await response.json();
    console.log('📦 Data reçue du backend:', data);
    
    // ✅ Retourner directement data (qui contient déjà success et counts)
    return data;
    
  } catch (error) {
    console.error('❌ Exception getUnreadCounts:', error);
    return { success: false, counts: [] };
  }
};
export default {
  // Auth
  registerUser,
  loginUser,
  updateUserProfile,
  getAllUsers,
  
  // Groups
  getUserGroups,
  createGroup,
  deleteGroup,
  updateGroupName,
  
  // Group Members
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  
  // Group Messages
  getGroupMessages,
  saveGroupMessage,
  deleteGroupMessageLocal,
  deleteGroupMessageForAll,
  
  // Private Messages
  getPrivateMessages,
  sendPrivateMessage,
  getPrivateChats,
  deleteMessageLocal,
  deleteMessageForAll,
  getUnreadCounts,
};