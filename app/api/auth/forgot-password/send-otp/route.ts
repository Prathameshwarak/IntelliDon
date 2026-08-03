import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { saveOTP, canSendOTP } from '@/lib/otp-store';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body || {};

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // 1. Verify if user exists and is an Admin
    let isAdmin = false;
    let userFound = false;

    // Check users table directly by email
    const { data: userRecord } = await supabaseAdmin
      .from('users')
      .select('id, role, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (userRecord) {
      userFound = true;
      if (userRecord.role === 'admin' || userRecord.role === 'super_admin') {
        isAdmin = true;
      }
    } else {
      // Check auth users list if not matched directly in users table
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(
        (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
      );

      if (authUser) {
        userFound = true;
        // Check role in users table by ID
        const { data: profile } = await supabaseAdmin
          .from('users')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle();

        if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
          isAdmin = true;
        }
      } else {
        // Fallback: Check mandals table admin_email
        const { data: mandal } = await supabaseAdmin
          .from('mandals')
          .select('id, admin_email')
          .eq('admin_email', cleanEmail)
          .maybeSingle();

        if (mandal) {
          userFound = true;
          isAdmin = true;
        }
      }
    }

    // If account is not found or not an admin account, return the required error message
    if (!userFound || !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Contact your organization admin for password reset.',
        },
        { status: 403 }
      );
    }

    // 2. Cooldown / Send Limit Check (2 mins cooldown period, standard registration limit)
    const checkCooldown = await canSendOTP(cleanEmail, 2 * 60 * 1000);
    if (!checkCooldown.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Please wait ${checkCooldown.remainingSec} second${checkCooldown.remainingSec > 1 ? 's' : ''} before requesting another OTP.`,
          remainingSec: checkCooldown.remainingSec,
        },
        { status: 429 }
      );
    }

    const gmailUser = process.env.GMAIL_USER || 'intellidon.otp@gmail.com';
    const rawAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || '';
    const gmailAppPassword = rawAppPassword.replace(/\s+/g, '');

    if (!gmailAppPassword) {
      console.error('GMAIL_APP_PASSWORD is missing in environment variables.');
      return NextResponse.json(
        { success: false, error: 'Email service configuration missing. Please contact support.' },
        { status: 500 }
      );
    }

    // Generate random 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP code with 5-minute expiry
    await saveOTP(cleanEmail, code, 5 * 60 * 1000);

    // Send OTP via Nodemailer Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    await transporter.sendMail({
      from: `"IntelliDon Security" <${gmailUser}>`,
      to: cleanEmail,
      subject: `${code} is your password reset verification code - IntelliDon`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset OTP</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fdf8f3; margin: 0; padding: 30px; color: #1a1208;">
          <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #f0e6d9; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #e8650a; font-size: 26px; margin: 0; font-weight: 800; tracking-tight: -0.5px;">IntelliDon</h1>
              <p style="color: #7a6a55; font-size: 13px; margin-top: 4px;">Smart Mandal & Donation Management Platform</p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #f0e6d9; margin: 20px 0;" />
            
            <h2 style="font-size: 18px; color: #1a1208; margin-bottom: 12px;">Password Reset Request</h2>
            <p style="font-size: 14px; color: #4a3d2c; line-height: 1.6; margin-bottom: 24px;">
              We received a request to reset the password for your IntelliDon <strong>Admin Account</strong>. Use the 6-digit OTP below to proceed. This code will expire in <strong>5 minutes</strong>.
            </p>

            <div style="text-align: center; background-color: #fdf6ee; border: 2px dashed #e8650a; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #e8650a;">${code}</span>
            </div>

            <p style="font-size: 12px; color: #9e8c76; line-height: 1.5;">
              If you did not request a password reset, please ignore this email or secure your account. Do not share this code with anyone.
            </p>

            <hr style="border: none; border-top: 1px solid #f0e6d9; margin: 24px 0 16px 0;" />
            
            <p style="font-size: 11px; color: #b0a08d; text-align: center; margin: 0;">
              &copy; ${new Date().getFullYear()} IntelliDon. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${cleanEmail}`,
    });
  } catch (err: any) {
    console.error('Error in /api/auth/forgot-password/send-otp:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to send OTP.' },
      { status: 500 }
    );
  }
}
