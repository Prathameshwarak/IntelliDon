const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function testQuery() {
  const mandal_id = '8f55f103-dcc3-4972-864a-2bf06c07f549';
  const { data, error } = await supabase
    .from('donations')
    .select(`
      id,
      receipt_number,
      donor_name,
      donor_phone,
      donor_address,
      amount,
      payment_mode,
      status,
      screenshot_url,
      pdf_url,
      created_at,
      collected_by,
      rejection_reason,
      users!collected_by (
        full_name
      )
    `)
    .eq('mandal_id', mandal_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('SUPABASE ERROR DETAILS:', error);
  } else {
    console.log('Query succeeded! Total records fetched:', data.length);
  }
}

testQuery();
