const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xtrecechdkyqegyrrbos.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_y3FcCVsrW8UvzImChX0BUg_XrlwE8Q7';

console.log('Testing Supabase Connection...');
console.log('URL:', SUPABASE_URL);
console.log('Anon Key:', SUPABASE_ANON_KEY ? '(configured)' : '(missing)');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  try {
    console.log('\n--- 1. Testing Auth Login ---');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'nonexistent@evady.com',
      password: 'somepassword123'
    });
    
    if (loginError) {
      console.log('Login returned expected auth error:', loginError.message, 'Status:', loginError.status);
    } else {
      console.log('Login succeeded (unexpected for dummy user):', loginData);
    }
  } catch (err) {
    console.error('Login threw exception:', err);
  }

  try {
    console.log('\n--- 2. Testing Edge Function Signup Call ---');
    const functionUrl = `${SUPABASE_URL}/functions/v1/signup`;
    console.log('Function URL:', functionUrl);
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        email: 'test_signup@evady.com',
        password: 'password123',
        fullName: 'Test User',
        gender: 'MALE',
        birthdate: '1995-01-01',
      }),
    });

    const text = await response.text();
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('Response Body:', text);
  } catch (err) {
    console.error('Edge Function call threw exception:', err);
  }
}

run();
