import React, { useState, useEffect } from 'react';
import authService from '../services/authService';
import userService from '../services/userService';
import * as jwtHelper from '../utils/jwtHelper';

const AuthDebugger = () => {
  const [authState, setAuthState] = useState({
    accessToken: null,
    refreshToken: null,
    tokenDecoded: null,
    isExpired: null,
    userInfo: null,
    isLoggedIn: false
  });
  
  const [testResult, setTestResult] = useState({
    meEndpoint: null,
    adminEndpoint: null,
    loading: false
  });
  
  // Load auth state on component mount
  useEffect(() => {
    checkAuthState();
  }, []);
  
  const checkAuthState = () => {
    const accessToken = jwtHelper.getAccessToken();
    const refreshToken = jwtHelper.getRefreshToken();
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    let tokenDecoded = null;
    let isExpired = null;
    
    if (accessToken) {
      try {
        tokenDecoded = JSON.parse(atob(accessToken.split('.')[1]));
        isExpired = jwtHelper.isTokenExpired(accessToken);
      } catch (e) {
        console.error('Error decoding token', e);
      }
    }
    
    setAuthState({
      accessToken,
      refreshToken,
      tokenDecoded,
      isExpired,
      userInfo,
      isLoggedIn
    });
  };
  
  const testMeEndpoint = async () => {
    setTestResult(prev => ({ ...prev, loading: true }));
    try {
      const response = await authService.getCurrentUserInfo();
      setTestResult(prev => ({ 
        ...prev, 
        meEndpoint: response,
        loading: false
      }));
    } catch (error) {
      setTestResult(prev => ({ 
        ...prev, 
        meEndpoint: { success: false, error: error.message },
        loading: false
      }));
    }
  };
  
  const testAdminEndpoint = async () => {
    setTestResult(prev => ({ ...prev, loading: true }));
    try {
      const response = await userService.getAllUsers();
      setTestResult(prev => ({ 
        ...prev, 
        adminEndpoint: response,
        loading: false
      }));
    } catch (error) {
      setTestResult(prev => ({ 
        ...prev, 
        adminEndpoint: { success: false, error: error.message },
        loading: false
      }));
    }
  };
  
  const handleLogout = () => {
    authService.logout();
    checkAuthState();
    setTestResult({
      meEndpoint: null,
      adminEndpoint: null,
      loading: false
    });
  };
  
  const renderTokenInfo = () => {
    if (!authState.tokenDecoded) return <p>No token information available</p>;
    
    return (
      <div>
        <h4>Token Information</h4>
        <p><strong>Subject:</strong> {authState.tokenDecoded.sub}</p>
        <p><strong>Token Type:</strong> {authState.tokenDecoded.token_type}</p>
        <p><strong>Expires:</strong> {new Date(authState.tokenDecoded.exp * 1000).toLocaleString()}</p>
        <p><strong>Is Expired:</strong> {authState.isExpired ? 'Yes' : 'No'}</p>
      </div>
    );
  };
  
  const renderUserInfo = () => {
    if (!authState.userInfo) return <p>No user information available</p>;
    
    return (
      <div>
        <h4>User Information</h4>
        <p><strong>ID:</strong> {authState.userInfo.id}</p>
        <p><strong>Username:</strong> {authState.userInfo.username}</p>
        <p><strong>Name:</strong> {authState.userInfo.name}</p>
        <p><strong>Role:</strong> {authState.userInfo.role}</p>
        <p><strong>Login Time:</strong> {authState.userInfo.loginTime}</p>
      </div>
    );
  };
  
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2>Authentication Debugger</h2>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={checkAuthState}>Refresh State</button>
        {authState.isLoggedIn && (
          <button onClick={handleLogout}>Logout</button>
        )}
      </div>
      
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h3>Authentication State</h3>
        <p><strong>Access Token:</strong> {authState.accessToken ? '✅ Present' : '❌ Missing'}</p>
        <p><strong>Refresh Token:</strong> {authState.refreshToken ? '✅ Present' : '❌ Missing'}</p>
        <p><strong>Is Logged In Flag:</strong> {authState.isLoggedIn ? '✅ True' : '❌ False'}</p>
        
        {renderTokenInfo()}
        {renderUserInfo()}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>API Tests</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button 
            onClick={testMeEndpoint} 
            disabled={testResult.loading}
          >
            Test /api/auth/me
          </button>
          <button 
            onClick={testAdminEndpoint} 
            disabled={testResult.loading}
          >
            Test /api/users/admin/all
          </button>
        </div>
        
        {testResult.loading && <p>Loading...</p>}
        
        {testResult.meEndpoint && (
          <div style={{ 
            marginBottom: '15px', 
            padding: '10px', 
            border: '1px solid #ccc', 
            borderRadius: '5px',
            backgroundColor: testResult.meEndpoint.success ? '#f0fff0' : '#fff0f0'
          }}>
            <h4>Me Endpoint Result</h4>
            <p><strong>Success:</strong> {testResult.meEndpoint.success ? 'Yes' : 'No'}</p>
            {testResult.meEndpoint.success ? (
              <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
                {JSON.stringify(testResult.meEndpoint.data, null, 2)}
              </pre>
            ) : (
              <p><strong>Error:</strong> {testResult.meEndpoint.error}</p>
            )}
          </div>
        )}
        
        {testResult.adminEndpoint && (
          <div style={{ 
            padding: '10px', 
            border: '1px solid #ccc', 
            borderRadius: '5px',
            backgroundColor: testResult.adminEndpoint.success ? '#f0fff0' : '#fff0f0'
          }}>
            <h4>Admin Endpoint Result</h4>
            <p><strong>Success:</strong> {testResult.adminEndpoint.success ? 'Yes' : 'No'}</p>
            {testResult.adminEndpoint.success ? (
              <div>
                <p><strong>Message:</strong> {testResult.adminEndpoint.message}</p>
                <p><strong>Users count:</strong> {testResult.adminEndpoint.data?.length || 0}</p>
                <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
                  {JSON.stringify(testResult.adminEndpoint.data, null, 2)}
                </pre>
              </div>
            ) : (
              <p><strong>Error:</strong> {testResult.adminEndpoint.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthDebugger;
