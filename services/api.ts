const API_URL = 'http://10.120.62.243:3000/api';



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

export const saveGroupMessage = async (msg: any) => {
  return apiRequest(`/groups/${msg.groupId}/messages`, 'POST', msg);
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
  
  // Private Messages
  getPrivateMessages,
  sendPrivateMessage,
  getPrivateChats,
  deleteMessageLocal,
  deleteMessageForAll,
};