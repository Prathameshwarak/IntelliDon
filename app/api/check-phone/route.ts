import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = body || {};

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { exists: false, error: 'Phone number is required.' },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');

    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { exists: false, error: 'Phone number must be exactly 10 digits.' },
        { status: 400 }
      );
    }

    // Check if phone exists as mandal phone or admin phone
    const { data: existingMandals, error } = await supabaseAdmin
      .from('mandals')
      .select('id')
      .or(`phone.eq.${cleanPhone},admin_phone.eq.${cleanPhone}`)
      .limit(1);

    if (error) {
      console.error('Error checking phone duplicate in DB:', error);
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    const exists = existingMandals && existingMandals.length > 0;

    return NextResponse.json({
      exists,
      message: exists
        ? 'This phone number is already registered with us. Please use a different number or log in.'
        : 'Phone number is available.',
    });
  } catch (err: any) {
    console.error('API /api/check-phone error:', err);
    return NextResponse.json(
      { exists: false, error: err.message || 'An error occurred while checking phone number.' },
      { status: 500 }
    );
  }
}
