import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isOTPVerified } from '@/lib/otp-store';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body || {};

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email address is required.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Ensure OTP has been verified
    const verified = await isOTPVerified(cleanEmail);
    if (!verified) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email OTP verification is required before setting a new password.',
        },
        { status: 400 }
      );
    }

    // 2. Find Auth User ID and verify Admin role
    let userId: string | null = null;
    let isAdmin = false;

    // Check auth users list
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authUsers?.users?.find(
      (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
    );

    if (authUser) {
      userId = authUser.id;
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
        isAdmin = true;
      }
    } else {
      // Check users table directly
      const { data: dbUser } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (dbUser) {
        userId = dbUser.id;
        if (dbUser.role === 'admin' || dbUser.role === 'super_admin') {
          isAdmin = true;
        }
      }
    }

    if (!userId || !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Contact your organization admin for password reset.',
        },
        { status: 403 }
      );
    }

    // 3. Update User Password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: password,
      user_metadata: {
        requires_password_change: false,
      },
    });

    if (updateError) {
      console.error('Password reset update error:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message || 'Could not reset password.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been updated successfully!',
    });
  } catch (err: any) {
    console.error('Error in /api/auth/forgot-password/reset-password:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'An unexpected error occurred while resetting password.' },
      { status: 500 }
    );
  }
}
