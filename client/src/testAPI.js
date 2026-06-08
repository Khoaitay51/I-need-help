// Test API connection
import constants from './utils/constants';

const { API_BASE_URL } = constants;

// Test function
async function testAPI() {
  try {
    console.log('Testing API connection to:', API_BASE_URL);
    
    // Test health endpoint
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);
    
    // Test root endpoint
    const rootResponse = await fetch(`${API_BASE_URL}/`);
    const rootData = await rootResponse.json();
    console.log('Root endpoint:', rootData);
    
  } catch (error) {
    console.error('API Test failed:', error);
  }
}

// Run test
testAPI();
