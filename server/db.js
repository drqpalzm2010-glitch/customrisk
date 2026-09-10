const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Database configuration
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB_NAME || 'customrisk';
const DB_FILE = process.env.USER_DB_PATH || path.join(__dirname, '../public/users_data.json');

let mongoClient = null;
let mongoDb = null;
let useMongo = false;

// Initialize database connection
async function initDB() {
  if (MONGODB_URI) {
    try {
      mongoClient = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      await mongoClient.connect();
      mongoDb = mongoClient.db(DB_NAME);
      useMongo = true;
      console.log('[DB] Connected to MongoDB Atlas');
      
      // Create indexes for better performance
      await mongoDb.collection('users').createIndex({ username: 1 }, { unique: true });
      return true;
    } catch (err) {
      console.error('[DB] MongoDB connection failed, falling back to JSON file:', err.message);
      useMongo = false;
    }
  } else {
    console.log('[DB] MONGODB_URI not set, using JSON file storage');
  }
  return false;
}

// Get database instance
function getDB() {
  return mongoDb;
}

// Check if using MongoDB
function isMongoEnabled() {
  return useMongo;
}

// JSON File Fallback Functions (existing functionality)
function loadUsersFromFile() {
  try {
    if (!fs.existsSync(DB_FILE)) return {};
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[DB] Error reading users file:', err);
    return {};
  }
}

function saveUsersToFile(users) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Error saving users file:', err);
  }
}

// MongoDB User Operations
async function loadUsersFromMongo() {
  try {
    const users = {};
    const cursor = mongoDb.collection('users').find({});
    const docs = await cursor.toArray();
    docs.forEach(doc => {
      // Normalize: use lowercase username as key, ensure username field matches
      const originalUsername = doc.username;
      const normalizedKey = (originalUsername || doc._id || '').toLowerCase();
      const normalizedDoc = { ...doc, username: normalizedKey };
      delete normalizedDoc._id; // Remove _id for clean storage
      users[normalizedKey] = normalizedDoc;
    });
    return users;
  } catch (err) {
    console.error('[DB] Error loading users from MongoDB:', err);
    return {};
  }
}

async function saveUserToMongo(username, userData) {
  try {
    const key = (username || '').toLowerCase();
    // Always ensure username field is lowercase
    const cleanData = { ...userData, username: key };
    // Remove _id to avoid conflicts
    delete cleanData._id;
    await mongoDb.collection('users').updateOne(
      { username: key },
      { $set: cleanData },
      { upsert: true }
    );
  } catch (err) {
    console.error('[DB] Error saving user to MongoDB:', err);
  }
}

async function removeUserFromMongo(username) {
  try {
    const key = (username || '').toLowerCase();
    await mongoDb.collection('users').deleteOne({ username: key });
  } catch (err) {
    console.error('[DB] Error removing user from MongoDB:', err);
  }
}

// Sync JSON file to MongoDB (one-time migration)
async function syncJsonToMongo() {
  if (!useMongo) return false;
  try {
    const users = loadUsersFromFile();
    const keys = Object.keys(users);
    if (keys.length === 0) return false;
    
    console.log(`[DB] Syncing ${keys.length} users from JSON to MongoDB...`);
    for (const key of keys) {
      await saveUserToMongo(key, users[key]);
    }
    console.log('[DB] Sync complete');
    return true;
  } catch (err) {
    console.error('[DB] Sync error:', err);
    return false;
  }
}

// Close connection on shutdown
async function closeDB() {
  if (mongoClient) {
    await mongoClient.close();
    console.log('[DB] MongoDB connection closed');
  }
}

module.exports = {
  initDB,
  getDB,
  isMongoEnabled,
  loadUsersFromFile,
  saveUsersToFile,
  loadUsersFromMongo,
  saveUserToMongo,
  removeUserFromMongo,
  syncJsonToMongo,
  closeDB,
};
