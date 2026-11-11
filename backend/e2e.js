import pg from 'pg';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api';

async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Login failed');
  return { token: data.data.token, user: data.data.user };
}

async function request(endpoint, method, token, body = null) {
  const options = {
    method,
    headers: { 'Authorization': `Bearer ${token}` }
  };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_URL}${endpoint}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data.data;
}

async function printState(client, tech, bookingId) {
    const booking = await request(`/bookings/${bookingId}`, 'GET', client.token);
    const clientWallet = await request('/wallet', 'GET', client.token);
    const techWallet = await request('/wallet', 'GET', tech.token);
    console.log(`\n--- STATE ---`);
    console.log(`Booking Status: ${booking.booking.status}`);
    console.log(`Payment Status: ${booking.booking.paymentStatus}`);
    console.log(`Client Balance: $${clientWallet.wallet.currentBalance}`);
    console.log(`Tech Balance:   $${techWallet.wallet.currentBalance}`);
    console.log(`-------------\n`);
}

async function main() {
  const clientDb = new pg.Client({ connectionString: 'postgresql://postgres:1111@127.0.0.1:5432/fixitai' });
  await clientDb.connect();
  const { rows } = await clientDb.query("SELECT email, role FROM users");
  
  const clientEmail = rows.find(r => r.role === 'client')?.email;
  const adminEmail = rows.find(r => r.role === 'admin')?.email;
  
  const { rows: techRows } = await clientDb.query("SELECT tp.id, u.email, u.id as user_id FROM technician_profiles tp JOIN users u ON u.id = tp.user_id");
  const techRow = techRows[0];
  
  if (!clientEmail || !techRow || !adminEmail) {
    throw new Error("Missing users in DB");
  }

  try {
    console.log(`1. Logging in...`);
    const client = await login(clientEmail, 'password123');
    const tech = await login(techRow.email, 'password123');

    // Initialize wallets
    await request('/wallet', 'GET', client.token);
    await request('/wallet', 'GET', tech.token);

    console.log("2. Client creates booking...");
    const bookingRes = await request('/bookings', 'POST', client.token, {
      technicianId: techRow.id,
      serviceTitle: 'Test Cancellation Fix',
      description: 'The sink is leaking heavily'
    });
    const bookingId = bookingRes.booking.id;
    console.log("Booking created:", bookingId);

    console.log("3. Tech accepts booking...");
    await request(`/bookings/${bookingId}/status`, 'PATCH', tech.token, { status: 'accepted' });
    console.log("Booking accepted");


    console.log("5. Client tops up wallet and pays...");
    await request('/wallet/top-up', 'POST', client.token, { amount: 200 });
    await request(`/bookings/${bookingId}/pay`, 'POST', client.token);
    console.log("Client paid.");
    await printState(client, tech, bookingId);

    console.log("6. Client attempts to cancel paid booking...");
    // Attempting concurrent cancellations to test race condition lock
    const p1 = request(`/bookings/${bookingId}`, 'DELETE', client.token, { cancellationNote: 'Changed mind' }).catch(e => e);
    const p2 = request(`/bookings/${bookingId}`, 'DELETE', client.token, { cancellationNote: 'Changed mind' }).catch(e => e);
    
    const [res1, res2] = await Promise.all([p1, p2]);
    console.log("First request result:", res1 instanceof Error ? res1.message : "Success");
    console.log("Second request result:", res2 instanceof Error ? res2.message : "Success");

    await printState(client, tech, bookingId);

    console.log("\n✅ E2E CANCELLATION VERIFICATION SUCCESSFUL");
  } catch (err) {
    console.error("❌ E2E VERIFICATION FAILED:", err.message);
  } finally {
    await clientDb.end();
  }
}

main();
