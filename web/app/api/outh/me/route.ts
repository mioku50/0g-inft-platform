import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('siwe-session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ 
        authenticated: false 
      }, { status: 401 });
    }
    
    const session = JSON.parse(sessionCookie);
    
    // Check if session is still valid
    const issuedAt = new Date(session.issuedAt);
    const expiresAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    if (new Date() > expiresAt) {
      // Session expired
      const response = NextResponse.json({ 
        authenticated: false,
        reason: 'Session expired' 
      }, { status: 401 });
      
      response.cookies.delete('siwe-session');
      return response;
    }
    
    return NextResponse.json({ 
      authenticated: true,
      address: session.address,
      chainId: session.chainId 
    }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json({ 
      authenticated: false,
      error: 'Invalid session' 
    }, { status: 401 });
  }
}