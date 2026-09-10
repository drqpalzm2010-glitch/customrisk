/*// User data RE-SYNC script: Clear MongoDB and re-import from JSON
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Load environment variables
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {}

// MongoDB connection
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = 'customrisk';

async function resyncData() {
  if (!MONGO_URI) {
    console.log('❌ No MongoDB_URI found. Please set MONGODB_URI in .env file.');
    process.exit(1);
  }

  console.log('🔄 Starting data RE-SYNC from JSON to MongoDB...\n');

  try {
    // Read JSON file
    const jsonPath = path.join(__dirname, 'public/users_data.json');
    if (!fs.existsSync(jsonPath)) {
      console.log('❌ users_data.json not found!');
      process.exit(1);
    }

    const usersData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const userCount = Object.keys(usersData).length;
    console.log(`📊 Found ${userCount} users in JSON file`);

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');
    const groupChatsCollection = db.collection('groupChats');

    // Check current state
    const existingCount = await usersCollection.countDocuments();
    console.log(`📊 Current users in MongoDB: ${existingCount}`);

    // Ask for confirmation
    console.log('\n⚠️  This will REPLACE all existing user data in MongoDB with JSON data.');
    console.log('   Continue? (y/n)');
    
    // Auto-confirm for script
    const confirmed = true;
    if (!confirmed) {
      console.log('❌ Aborted');
      await client.close();
      process.exit(0);
    }

    // Clear existing data
    console.log('\n🗑️  Clearing existing MongoDB data...');
    await usersCollection.deleteMany({});
    await groupChatsCollection.deleteMany({});
    console.log('✅ Cleared');

    // Re-import users (without _id to avoid conflicts, normalized to lowercase)
    console.log('\n📥 Re-importing users to MongoDB...');
    let imported = 0;
    let errors = 0;

    for (const [key, userData] of Object.entries(usersData)) {
      try {
        // Normalize: ensure username is lowercase in both key and data
        const normalizedUsername = key.toLowerCase();
        const { _id, password, ...cleanData } = userData;
        
        await usersCollection.insertOne({
          username: normalizedUsername,
          ...cleanData,
          migratedAt: new Date().toISOString()
        });
        
        imported++;
        console.log(`   ✅ ${normalizedUsername}`);
      } catch (err) {
        errors++;
        console.log(`   ❌ ${key}: ${err.message}`);
      }
    }

    // Also check for group chats in JSON if they exist
    let groupChatsData = {};
    const groupChatsPath = path.join(__dirname, 'public/groupChats.json');
    if (fs.existsSync(groupChatsPath)) {
      try {
        groupChatsData = JSON.parse(fs.readFileSync(groupChatsPath, 'utf8'));
        console.log(`\n📥 Re-importing ${Object.keys(groupChatsData).length} group chats...`);
        
        for (const [groupId, groupData] of Object.entries(groupChatsData)) {
          try {
            const { _id, ...cleanData } = groupData;
            await groupChatsCollection.insertOne({
              ...cleanData,
              _id: groupId,
              migratedAt: new Date().toISOString()
            });
          } catch (err) {
            console.log(`   ❌ Group ${groupId}: ${err.message}`);
          }
        }
      } catch (e) {
        console.log('   No group chats to import');
      }
    }

    console.log('\n📈 Re-Sync Summary:');
    console.log(`   Users imported: ${imported}`);
    console.log(`   Errors: ${errors}`);

    // Verify final state
    const finalUsers = await usersCollection.countDocuments();
    const finalGroups = await groupChatsCollection.countDocuments();
    console.log(`\n✅ Re-Sync Complete!`);
    console.log(`   Total users in MongoDB: ${finalUsers}`);
    console.log(`   Total group chats: ${finalGroups}`);

    // Show sample data
    console.log('\n📋 Sample user data in MongoDB:');
    const sampleUser = await usersCollection.findOne({});
    if (sampleUser) {
      console.log(`   - ${sampleUser.username}: Level ${sampleUser.level}, XP ${sampleUser.totalXP}`);
    }

    await client.close();
    console.log('\n✅ Done! Server can now be restarted.');
    process.exit(0);
  } catch (err) {
    console.log('\n❌ Re-Sync failed:');
    console.log(`   ${err.message}`);
    process.exit(1);
  }
}

resyncData();
/*commented while not in use*/