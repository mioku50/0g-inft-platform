// web/app/marketplace/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sparkles, Store, Clock, ArrowRight } from 'lucide-react'

export default function MarketplacePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Animated stars background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      <div className="relative container mx-auto px-4 py-32">
        <div className="max-w-3xl mx-auto text-center">
          {/* Icon */}
          <div className="mb-8 inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl border border-white/10">
            <Store className="w-16 h-16 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
            Marketplace Coming Soon
          </h1>

          {/* Description */}
          <p className="text-xl text-gray-300 mb-12 leading-relaxed">
            We're building a decentralized marketplace where you can buy, sell, and trade AI agents. 
            Each agent is a unique NFT with its own personality and capabilities.
          </p>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Buy & Sell</h3>
              <p className="text-gray-400 text-sm">Trade AI agents with secure on-chain transactions</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Fair Pricing</h3>
              <p className="text-gray-400 text-sm">Market-driven prices for unique AI capabilities</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Instant Transfer</h3>
              <p className="text-gray-400 text-sm">Secure metadata transfer with TEE verification</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => router.push('/mint')}
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-full hover:opacity-90 transition-all shadow-lg"
            >
              Create Your Agent
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={() => router.push('/agents')}
              variant="outline"
              className="px-8 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full hover:bg-white/20 transition-all"
            >
              View Your Agents
            </Button>
          </div>
        </div>
      </div>

      {/* CSS для звезд */}
      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        
        .stars, .stars2, .stars3 {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 120%;
          overflow: hidden;
        }
        
        .stars::after {
          content: "";
          position: absolute;
          top: -10rem;
          left: -10rem;
          right: -10rem;
          bottom: -10rem;
          background-image: 
            radial-gradient(2px 2px at 20% 30%, white, transparent),
            radial-gradient(2px 2px at 60% 70%, white, transparent),
            radial-gradient(1px 1px at 50% 50%, white, transparent);
          background-size: 200px 200px;
          animation: moveStars 100s linear infinite;
          opacity: 0.5;
        }
        
        @keyframes moveStars {
          from { transform: translateY(0); }
          to { transform: translateY(-100%); }
        }
      `}</style>
    </div>
  )
}