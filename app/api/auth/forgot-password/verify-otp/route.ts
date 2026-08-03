import { NextResponse } from 'next/server';
import {
  getOTP,
  markOTPVerified,
  checkVerifyRateLimit,
  recordFailedVerifyAttempt,
  resetFailedVerifyAttempts,
} from '@/lib/otp-store';

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

    // 1. Rate limit check for verification attempts (Max 4 attempts, 10 min lock)
    const rateCheck = checkVerifyRateLimit(cleanEmail);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.remainingSec / 60);
      return NextResponse.json(
        {
          success: false,
          error: `Too many invalid attempts. OTP verification is locked for ${minutes} minute${minutes > 1 ? 's' : ''}. Please try again later.`,
          remainingSec: rateCheck.remainingSec,
        },
        { status: 429 }
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
      const failStatus = recordFailedVerifyAttempt(cleanEmail);
      if (failStatus.locked) {
        const minutes = Math.ceil(failStatus.remainingSec / 60);
        return NextResponse.json(
          {
            success: false,
            error: `Maximum verification attempts (4) reached. Verification is locked for ${minutes} minutes.`,
            remainingSec: failStatus.remainingSec,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: `Invalid OTP code. ${failStatus.remainingAttempts} attempt${failStatus.remainingAttempts > 1 ? 's' : ''} remaining.`,
          remainingAttempts: failStatus.remainingAttempts,
        },
        { status: 400 }
      );
    }

    // Mark email as verified and clear rate limit attempts
    resetFailedVerifyAttempts(cleanEmail);
    await markOTPVerified(cleanEmail);

    return NextResponse.json({
      success: true,
      verified: true,
      message: 'Email address verified successfully!',
    });
  } catch (err: any) {
    console.error('Error in /api/auth/forgot-password/verify-otp:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'An unexpected error occurred while verifying OTP.' },
      { status: 500 }
    );
  }
}
