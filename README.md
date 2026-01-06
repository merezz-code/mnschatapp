# 💬 MNSChatApp

MNSChatApp est une application de messagerie en temps réel développée avec **React + TypeScript** côté frontend et **Node.js / Express** côté backend.  
Elle permet aux utilisateurs de discuter instantanément via une interface moderne et responsive.

---

## 🚀 Fonctionnalités

- 💬 Chat en temps réel
- 👤 Authentification utilisateur
- 🟢 Statut en ligne / hors ligne
- 📱 Interface responsive
- ⚡ Communication temps réel (Socket.io)

---

## 🛠️ Technologies utilisées

### Frontend
- React
- TypeScript
- Vite
- CSS / Tailwind (selon le projet)

### Backend
- Node.js
- Express.js
- Socket.io
- MongoDB (ou autre base selon configuration)

---

## 📦 Prérequis

Assure-toi d’avoir installé :
- Node.js (v16 ou +)
- npm ou yarn
- Windows : Télécharge depuis https://www.postgresql.org/download/windows/
- Mac : brew install postgresql
- Linux : sudo apt install postgresql

---
# Ouvre psql
psql -U postgres

# Dans psql :
CREATE DATABASE mnschatapp;
\c mnschatapp

# Copie-colle le contenu de schema.sql
---

## 📥 Installation

### 1️⃣ Cloner le projet
```bash
git clone https://github.com/merezz-code/MNSChatApp.git
cd MNSChatApp

# 💬 MNSChatApp

MNSChatApp est une application de messagerie en temps réel développée avec **React + TypeScript** côté frontend et **Node.js / Express** côté backend.  
Elle permet aux utilisateurs de discuter instantanément via une interface moderne et responsive.

---

## 🚀 Fonctionnalités

- 💬 Chat en temps réel
- 👤 Authentification utilisateur
- 🟢 Statut en ligne / hors ligne
- 📱 Interface responsive
- ⚡ Communication temps réel (Socket.io)

---

## 🛠️ Technologies utilisées

### Frontend
- React
- TypeScript
- Vite
- CSS / Tailwind (selon le projet)

### Backend
- Node.js
- Express.js
- Socket.io
- MongoDB (ou autre base selon configuration)

---

## 📦 Prérequis

Assure-toi d’avoir installé :
- Node.js (v16 ou +)
- npm ou yarn
- MongoDB (local ou MongoDB Atlas)

---

## 📥 Installation

### 1️⃣ Cloner le projet
```bash
git clone https://github.com/merezz-code/MNSChatApp.git
cd MNSChatApp
npm install
cd chat-server
npm install

## lancer app frontend
npx expo start -c
## backend
cd chat-server
npm install
npm start


# PostgreSQL Configuration
DATABASE_URL=postgresql://postgres:admin@localhost:5432/mnschatapp


# OU si vous utilisez un service cloud comme Render, Supabase, etc.
# DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Port du serveur
PORT=3000

#pour api Uri il faut mettre address IP de votre wifi make sure ur pc and smartphon have the same connection wifi 192.168.1.7 = > with ur address wifi !!
API_URL = 'http://192.168.1.7:3000/api'