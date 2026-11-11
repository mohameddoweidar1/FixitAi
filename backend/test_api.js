import pg from 'pg';
import crypto from 'crypto';

async function test() {
  // Generate random email
  const email = 'test' + crypto.randomBytes(4).toString('hex') + '@example.com';
  
  // Register
  let res = await fetch('http://127.0.0.1:5000/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!', fullName: 'Test Client', role: 'client' })
  });
  let data = await res.json();
  if (!data.success) {
    console.log('Register failed:', data);
    process.exit(1);
  }
  const token = data.data.token;
  
  // Find tech
  res = await fetch('http://127.0.0.1:5000/api/technicians');
  data = await res.json();
  const techId = data.data.items[0].id;
  
  // Get schedule
  res = await fetch('http://127.0.0.1:5000/api/technicians/' + techId + '/schedule');
  data = await res.json();
  const slot = data.data.timeSlots[0];
  
  res = await fetch('http://127.0.0.1:5000/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      technicianId: techId,
      slotId: slot.id,
      bookingDate: '2026-06-02',
      serviceTitle: 'Test Service',
      description: 'Test description'
    })
  });
  const result = await res.json();
  console.log('Status:', res.status);
  console.log(JSON.stringify(result, null, 2));
}
test();
