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

async function testReject() {
  // Let's find one donation and try to update its status to 'rejected' inside a transaction or just update and revert it.
  const { data, error: fetchError } = await supabase.from('donations').select('id, status').limit(1).single();
  if (fetchError || !data) {
    console.error('No donation found to test:', fetchError);
    return;
  }

  const originalStatus = data.status;
  console.log(`Original status of donation ${data.id} is ${originalStatus}`);

  // Try updating to 'rejected'
  const { error: updateError } = await supabase
    .from('donations')
    .update({ status: 'rejected' })
    .eq('id', data.id);

  if (updateError) {
    console.error('Update to rejected failed (probably due to constraint):', updateError);
  } else {
    console.log('Update to rejected succeeded! Reverting back to', originalStatus);
    const { error: revertError } = await supabase
      .from('donations')
      .update({ status: originalStatus })
      .eq('id', data.id);
    if (revertError) {
      console.error('Could not revert status back:', revertError);
    } else {
      console.log('Reverted successfully.');
    }
  }
}

testReject();
