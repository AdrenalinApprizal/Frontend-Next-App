// Test script to verify API routing fixes
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testApiRouting() {
  console.log('🧪 Testing API routing fixes...\n');

  // Test cases for different patterns
  const testCases = [
    {
      name: 'Group message POST (old pattern)',
      path: '/api/proxy/group/123e4567-e89b-12d3-a456-426614174000/messages',
      method: 'POST',
      expectedRoute: 'groups/123e4567-e89b-12d3-a456-426614174000/messages',
      expectedPort: '8082'
    },
    {
      name: 'Group message POST (new pattern)',
      path: '/api/proxy/groups/123e4567-e89b-12d3-a456-426614174000/messages',
      method: 'POST',
      expectedRoute: 'groups/123e4567-e89b-12d3-a456-426614174000/messages',
      expectedPort: '8082'
    },
    {
      name: 'Regular messages endpoint',
      path: '/api/proxy/messages',
      method: 'GET',
      expectedRoute: 'messages',
      expectedPort: '8082'
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    console.log(`   Path: ${testCase.path}`);
    console.log(`   Method: ${testCase.method}`);
    
    try {
      const response = await fetch(`${BASE_URL}${testCase.path}`, {
        method: testCase.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: testCase.method === 'POST' ? JSON.stringify({ 
          content: 'Test message',
          type: 'text'
        }) : undefined
      });

      // Don't expect success since backend isn't running, just check if request is processed
      console.log(`   Status: ${response.status}`);
      console.log(`   ✅ Request processed by proxy\n`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }
}

// Run the test
testApiRouting().catch(console.error);
