#!/bin/bash

# Start development server with proper debugging
# This script helps diagnose and run the 0G INFT Platform

echo "🚀 Starting 0G INFT Platform Development Server"
echo "=============================================="

cd /home/runner/work/0g-inft-platform/0g-inft-platform/web

echo "📋 Environment Check:"
echo "  Node version: $(node --version)"
echo "  NPM version: $(npm --version)"
echo "  Debug mode: $NEXT_PUBLIC_DEBUG"

echo ""
echo "🔍 Pre-flight checks..."

# Check if all dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check TypeScript compilation
echo "🔧 Checking TypeScript compilation..."
npx tsc --noEmit --project tsconfig.json
if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed"
    exit 1
fi

echo "✅ TypeScript compilation passed"

# Check for lint errors
echo "🧹 Running lint check..."
npx next lint --quiet
echo "✅ Lint check completed"

echo ""
echo "🌐 Starting Next.js development server..."
echo "  Port: 3000"
echo "  Debug mode: enabled"
echo "  Non-custodial inference: enabled"

# Set environment variables and start server
export NEXT_PUBLIC_DEBUG=1
export NODE_OPTIONS="--max-old-space-size=4096"

# Start the server with proper error handling
exec npm run dev