import { NextResponse } from 'next/server';
import { generateNonce } from 'siwe';

export async function GET() {
  const nonce = generateNonce();
  
  const response = NextResponse.json({ nonce }, { status: 200 });
  
  // Store nonce in httpOnly cookie for verification
  response.cookies.set('siwe-nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 5, // 5 minutes
    path: '/',
  });
  
  return new Response(nonce, { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}