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

    // Check if email already exists in Auth or Mandals database
    try {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const isAuthTaken = authUsers?.users?.some(
        (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
      );

      const { data: existingAdminMandal } = await supabaseAdmin
        .from('mandals')
        .select('id')
        .eq('admin_email', cleanEmail)
        .maybeSingle();

      let existingOrgMandal = null;
      try {
        const { data: orgMandal } = await supabaseAdmin
          .from('mandals')
          .select('id')
          .eq('org_email', cleanEmail)
          .maybeSingle();
        existingOrgMandal = orgMandal;
      } catch (err) {
        // org_email column may be optional in schema
      }

      if (isAuthTaken || !!existingAdminMandal || !!existingOrgMandal) {
        return NextResponse.json(
          {
            success: false,
            error: 'This email is already registered with us. Please log in or use a different email.',
          },
          { status: 409 }
        );
      }
    } catch (dbErr) {
      console.error('Error checking existing email in send-otp:', dbErr);
    }

    // Rate Limit / Cooldown Check (2 minutes / 120 seconds cooling period)
    const checkCooldown = await canSendOTP(cleanEmail, 2 * 60 * 1000);
    if (!checkCooldown.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Please wait ${checkCooldown.remainingSec} second${checkCooldown.remainingSec > 1 ? 's' : ''} before requesting another OTP.`,
          remainingSec: checkCooldown.remainingSec
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
        { success: false, error: 'Email service configuration missing (GMAIL_APP_PASSWORD). Please contact support.' },
        { status: 500 }
      );
    }

    // Generate random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 5-minute expiry
    await saveOTP(cleanEmail, code, 5 * 60 * 1000);

    // Configure Nodemailer Gmail Transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    await transporter.sendMail({
      from: `"IntelliDon" <${gmailUser}>`,
      to: cleanEmail,
      subject: `${code} is your IntelliDon verification code`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Verification Code</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fdf8f3; margin: 0; padding: 30px; color: #1a1208;">
          <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #f0e6d9; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #e8650a; font-size: 26px; margin: 0; font-weight: 800; tracking-tight: -0.5px;">IntelliDon</h1>
              <p style="color: #7a6a55; font-size: 13px; margin-top: 4px;">Smart Mandal & Donation Management Platform</p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #f0e6d9; margin: 20px 0;" />
            
            <h2 style="font-size: 18px; color: #1a1208; margin-bottom: 12px;">Verify your email address</h2>
            <p style="font-size: 14px; color: #4a3d2c; line-height: 1.6; margin-bottom: 24px;">
              Use the 6-digit code below to complete your registration. This code will expire in <strong>5 minutes</strong>.
            </p>

            <div style="text-align: center; background-color: #fdf6ee; border: 2px dashed #e8650a; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #e8650a;">${code}</span>
            </div>

            <p style="font-size: 12px; color: #9e8c76; line-height: 1.5;">
              If you did not request this code, please ignore this email. Do not share this code with anyone.
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
      message: `OTP verification code sent successfully to ${cleanEmail}`,
    });
  } catch (err: any) {
    console.error('API /api/send-otp Nodemailer error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'An unexpected error occurred while sending OTP email via Gmail.' },
      { status: 500 }
    );
  }
}
