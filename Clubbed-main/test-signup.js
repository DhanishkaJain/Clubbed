// Test signup and login
const http = require('http');

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(responseData)
          });
        } catch {
          resolve({
            status: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('\n=== TESTING USER SIGNUP & LOGIN ===\n');

  // Test 1: Signup
  console.log('[1] Attempting to signup with username: testuser5');
  const signupResult = await makeRequest('POST', '/api/user/signup', {
    username: 'testuser5',
    course: 'CSE',
    year: '2',
    password: 'test123456',
    confirm_password: 'test123456'
  });

  console.log('Status:', signupResult.status);
  console.log('Response:', JSON.stringify(signupResult.data, null, 2));

  if (!signupResult.data.success) {
    console.log('\n❌ SIGNUP FAILED');
    process.exit(1);
  }

  console.log('\n✅ SIGNUP SUCCESSFUL - User created with ID:', signupResult.data.userId);

  // Wait a moment
  await new Promise(r => setTimeout(r, 500));

  // Test 2: Login with new credentials
  console.log('\n[2] Attempting to login with new credentials');
  const loginResult = await makeRequest('POST', '/api/user/login', {
    username: 'testuser5',
    course: 'CSE',
    year: '2',
    password: 'test123456'
  });

  console.log('Status:', loginResult.status);
  console.log('Response:', JSON.stringify(loginResult.data, null, 2));

  if (!loginResult.data.success) {
    console.log('\n❌ LOGIN FAILED');
    process.exit(1);
  }

  console.log('\n✅ LOGIN SUCCESSFUL');
  console.log('User info:', JSON.stringify(loginResult.data.user, null, 2));
  console.log('\n=== ✅ ALL TESTS PASSED ===');
  process.exit(0);
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
