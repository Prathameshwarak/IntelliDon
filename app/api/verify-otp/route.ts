import { NextResponse } from 'next/server';
import { getOTP, markOTPVerified } from '@/lib/otp-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body || {};

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email address is required.' },
        { status: 400 }
      );
    }

    if (!otp || typeof otp !== 'string') {
      return NextResponse.json(
        { success: false, error: '6-digit OTP is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return NextResponse.json(
        { success: false, error: 'OTP must be a 6-digit number.' },
        { status: 400 }
      );
    }

    const record = await getOTP(cleanEmail);

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'OTP has expired or was not requested. Please request a new code.' },
        { status: 400 }
      );
    }

    if (record.code !== cleanOtp) {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP code. Please double-check and try again.' },
        { status: 400 }
      );
    }

    // Mark email as verified
    await markOTPVerified(cleanEmail);

    return NextResponse.json({
      success: true,
      verified: true,
      message: 'Email address verified successfully!',
    });
  } catch (err: any) {
    console.error('API /api/verify-otp error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'An unexpected error occurred while verifying OTP.' },
      { status: 500 }
    );
  }
}
