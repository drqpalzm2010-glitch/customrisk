// Fix script: Force lowercase usernames in MongoDB (WITH passwords)
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

async function fixUsernames() {
  console.log('=== FIX USERNAMES (WITH PASSWORDS) ===\n');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  console.log('Connected to MongoDB');
  
  const db = client.db('customrisk');
  const usersCol = db.collection('users');
  
  // Step 1: Delete all existing users
  const before = await usersCol.find({}).toArray();
  console.log(`Found ${before.length} users before fix:`);
  before.forEach(u => console.log(`  - "${u.username}"`));
  
  await usersCol.deleteMany({});
  console.log('\nDeleted all users\n');
  
  // Step 2: Read JSON file
  const jsonPath = path.join(__dirname, 'public/users_data.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Read ${Object.keys(jsonData).length} users from JSON\n`);
  
  // Step 3: Insert each user with EXPLICIT lowercase username AND password
  for (const [key, val] of Object.entries(jsonData)) {
    const lowerKey = key.toLowerCase();
    
    console.log(`Inserting: "${lowerKey}"`);
    
    await usersCol.insertOne({
      username: lowerKey,  // Explicitly lowercase
      password: val.password,  // Include password!
      level: val.level || 1,
      totalXP: val.totalXP || 0,
      createdAt: val.createdAt || new Date().toISOString(),
      lastLogin: val.lastLogin || new Date().toISOString(),
      lifetimeStats: val.lifetimeStats || {},
      unlockedAchievements: val.unlockedAchievements || [],
      currentXP: val.currentXP || 0,
      battleCard: val.battleCard || {},
      soloStats: val.soloStats || {},
      bio: val.bio || ''
    });
  }
  
  // Step 4: Verify
  console.log('\n=== VERIFICATION ===');
  const after = await usersCol.find({}).toArray();
  console.log(`${after.length} users in database:\n`);
  
  after.forEach(u => {
    console.log(`  "${u.username}" - password: ${u.password ? 'YES' : 'NO'}`);
  });
  
  await client.close();
  console.log('\nDone!');
}

fixUsernames().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});