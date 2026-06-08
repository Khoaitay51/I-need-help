// Test authentication token in browser console
// Just copy-paste this into your browser console when logged in

(function checkAuthToken() {
  // Check local storage for tokens
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  
  console.group('Auth Token Check');
  console.log('Access Token exists:', !!accessToken);
  if (accessToken) {
    // Parse the JWT token to see its contents
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      console.log('Token payload:', payload);
      console.log('Token expiry:', new Date(payload.exp * 1000).toLocaleString());
      console.log('Is expired:', Date.now() >= payload.exp * 1000);
    } catch (error) {
      console.error('Error parsing token:', error);
    }
  }
  
  console.log('Refresh Token exists:', !!refreshToken);
  console.log('User info:', userInfo);
  console.log('User role:', userInfo.role);
  console.log('isLoggedIn flag:', localStorage.getItem('isLoggedIn'));
  
  // Create a fetch request with the token to check headers
  const headers = new Headers();
  if (accessToken) {
    headers.append('Authorization', `Bearer ${accessToken}`);
  }
  
  console.log('Request headers would be:', {
    Authorization: headers.get('Authorization')
  });
  
  // Check actual network request
  console.log('Making test request to /api/auth/me endpoint...');
  fetch('http://localhost:3434/api/auth/me', {
    headers: headers
  })
    .then(response => {
      console.log('Response status:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('Response data:', data);
    })
    .catch(error => {
      console.error('Request error:', error);
    });
  
  console.groupEnd();
})();
