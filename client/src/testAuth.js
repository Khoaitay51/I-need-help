// Test authentication flow with the Admin Dashboard
import httpClient from './utils/httpClient';
import authService from './services/authService';
import * as jwtHelper from './utils/jwtHelper';

async function testAuth() {
  console.log('Starting authentication test...');
  
  // Step 1: Check if we have valid tokens
  const accessToken = jwtHelper.getAccessToken();
  const refreshToken = jwtHelper.getRefreshToken();
  
  console.log('Current tokens:');
  console.log('- Access Token:', accessToken ? 'Present' : 'Not present');
  console.log('- Refresh Token:', refreshToken ? 'Present' : 'Not present');
  
  if (accessToken) {
    console.log('- Access Token expired:', jwtHelper.isTokenExpired(accessToken));
  }
  
  // Step 2: Try to get current user info
  try {
    console.log('\nTesting getCurrentUserInfo endpoint...');
    const userResponse = await authService.getCurrentUserInfo();
    console.log('User info response:', userResponse);
  } catch (error) {
    console.error('Error getting user info:', error);
  }
  
  // Step 3: Try to access admin endpoint
  try {
    console.log('\nTesting admin endpoint...');
    const response = await httpClient.get('/api/users/admin/all');
    console.log('Admin endpoint response:', response);
  } catch (error) {
    console.error('Error accessing admin endpoint:', error);
  }
}

// Run the test
testAuth().catch(console.error);
