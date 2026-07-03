import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This uses the SERVICE ROLE key, not the anon key.
// Why: an unauthenticated person is registering a mandal for the first time —
// they have no Supabase session yet, so RLS policies tied to auth.uid() would
// block a normal client. The service role key bypasses RLS safely because
// this code only runs on the server, never in the browser.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()
    const { name, address, city, phone, adminEmail, adminPassword, adminName } = body

    // 1. Basic validation — never trust data straight from the client
    if (!name || !phone || !adminEmail || !adminPassword || !adminName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // 2. Turn the mandal name into a URL-safe slug
    // e.g. "Shree Ganesh Utsav Mandal" -> "shree-ganesh-utsav-mandal"
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // Add a short random suffix so two mandals with the same name don't collide
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`

    // 3. Create the mandal row — status starts as 'pending'
    const { data: mandal, error: mandalError } = await supabaseAdmin
      .from('mandals')
      .insert({
        name,
        slug,
        address: address || null,
        city: city || null,
        phone,
        status: 'pending'
      })
      .select()
      .single()

    if (mandalError) {
      console.error('Mandal insert error:', mandalError)
      return NextResponse.json(
        { error: 'Could not create mandal. Please try again.' },
        { status: 500 }
      )
    }

    // 4. Create the actual login account for this mandal's admin
    // This uses Supabase Auth's admin API — only works with the service role key
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true // skip email verification for now, during early testing
    })

    if (authError) {
      // Roll back the mandal row if auth creation fails, so we don't leave orphan data
      await supabaseAdmin.from('mandals').delete().eq('id', mandal.id)
      console.error('Auth creation error:', authError)
      return NextResponse.json(
        { error: authError.message || 'Could not create admin account' },
        { status: 500 }
      )
    }

    // 5. Create the matching row in our own `users` table
    // This is what links the Supabase auth account to a role + mandal
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        mandal_id: mandal.id,
        full_name: adminName,
        phone,
        role: 'admin'
      })

    if (userError) {
      // Roll back both the mandal and the auth account if this last step fails
      await supabaseAdmin.from('mandals').delete().eq('id', mandal.id)
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      console.error('User insert error:', userError)
      return NextResponse.json(
        { error: 'Could not finish setting up admin account' },
        { status: 500 }
      )
    }

    // 6. Success — return the mandal info (never return passwords or sensitive data)
    return NextResponse.json({
      success: true,
      mandal: {
        id: mandal.id,
        name: mandal.name,
        slug: mandal.slug,
        status: mandal.status
      }
    })

  } catch (err) {
    console.error('Unexpected error in mandal registration:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
