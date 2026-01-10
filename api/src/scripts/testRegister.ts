import axios from 'axios';

async function testRegister() {
  const testData = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'reseller'
  };

  try {
    console.log('Testing registration with data:', testData);
    const response = await axios.post('http://localhost:5000/api/auth/register', testData);
    console.log('Success:', response.data);
  } catch (error: any) {
    console.log('Error:', error.response?.data || error.message);
  }
}

testRegister();
