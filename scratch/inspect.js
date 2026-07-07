const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    env[key] = value;
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || '',
  env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function inspect() {
  const { data, error } = await supabase.from('donations').select('*').limit(1);
  if (error) {
    console.error('Error fetching donation:', error);
  } else {
    console.log('Columns in donations table:', data.length > 0 ? Object.keys(data[0]) : 'No data, columns unknown');
  }
}

inspect();
