const { Client } = require('pg');
const axios = require('axios');
const api = axios.create({ baseURL: 'http://localhost:5000/api' });

async function test() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/fixitai' });
  await client.connect();
  
  // Find a client
  const clientRes = await client.query("SELECT email FROM users WHERE role = 'client' LIMIT 1");
  const email = clientRes.rows[0].email;
  
  // Login
  const loginRes = await api.post('/auth/login', { email, password: 'Password123!' });
  const token = loginRes.data.data.token;
  
  // Find tech
  const techRes = await api.get('/technicians');
  const techId = techRes.data.data.items[0].id;
  
  // Get schedule
  const schedRes = await api.get('/technicians/' + techId + '/schedule');
  const slot = schedRes.data.data.timeSlots[0];
  
  try {
    await api.post('/bookings', {
      technicianId: techId,
      slotId: slot.id,
      bookingDate: '2026-06-02',
      serviceTitle: 'Test Service',
      description: 'Test description'
    }, { headers: { Authorization: 'Bearer ' + token } });
    console.log('Success!');
  } catch(e) {
    console.log('Error:', e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }
  
  await client.end();
}
test();
