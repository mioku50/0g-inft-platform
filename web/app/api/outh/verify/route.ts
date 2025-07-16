import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';

export async function POST(request: NextRequest) {
  try {
    const { message, signature, nonce } = await request.json();
    
    // Get nonce from cookie
    const storedNonce = request.cookies.get('siwe-nonce')?.value;
    
    if (!storedNonce || storedNonce !== nonce) {
      return NextResponse.json({ error: 'Invalid nonce' }, { status: 400 });
    }
    
    const siweMessage = new SiweMessage(message);
    
    // Verify the signature
    const fields = await siweMessage.verify({ signature });
    
    if (!fields.success) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Create session
    const response = NextResponse.json({ 
      success: true,
      address: fields.data.address 
    }, { status: 200 });
    
    // Set session cookie
    response.cookies.set('siwe-session', JSON.stringify({
      address: fields.data.address,
      chainId: fields.data.chainId,
      issuedAt: fields.data.issuedAt,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    
    // Clear nonce
    response.cookies.delete('siwe-nonce');
    
    return response;
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json({ 
      error: 'Verification failed',
      details: error.message 
    }, { status: 400 });
  }
}