// web/app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button, Card, Badge } from '@/components/ui'
import { 
  Bot,
  Shield, 
  Zap,
  Globe,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import { useAccount } from 'wagmi'

export default function HomePage() {
  const { isConnected } = useAccount()

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/30 to-white">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-5xl mx-auto">
          {/* Robot Icon */}
          <div className="mb-8 inline-block">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-400 rounded-full blur-xl opacity-40" />
              <div className="relative bg-purple-100 rounded-full p-6">
                <Bot className="w-16 h-16 text-purple-600" />
              </div>
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Own Your AI Agents on{' '}
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              0G Network
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Create, trade, and interact with decentralized AI agents. Powered by 0G's cutting-edge storage and compute infrastructure.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/mint">
              <Button size="lg" className="bg-black hover:bg-gray-800 text-white px-8 py-6 text-lg rounded-lg">
                Create AI Agent
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            
            <Link href="/marketplace">
              <Button size="lg" variant="ghost" className="text-black hover:bg-gray-100 px-8 py-6 text-lg">
                Explore Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-4xl font-bold text-center mb-16">
          Why Choose 0G INFT Platform?
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* True Ownership */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow p-8">
            <div className="mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4">True Ownership</h3>
            <p className="text-gray-600 mb-4">
              Your AI agents are NFTs with encrypted metadata stored on 0G Storage
            </p>
            <p className="text-gray-600">
              Full control over your AI agents with secure, decentralized storage and on-chain ownership verification.
            </p>
          </Card>

          {/* Instant Execution */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow p-8">
            <div className="mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Zap className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4">Instant Execution</h3>
            <p className="text-gray-600 mb-4">
              Run AI models through 0G Compute with TEE verification
            </p>
            <p className="text-gray-600">
              Access powerful AI models like Llama 3.3 70B and DeepSeek R1 with micropayments and verified outputs.
            </p>
          </Card>

          {/* Decentralized Market */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow p-8">
            <div className="mb-6">
              <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center">
                <Globe className="w-8 h-8 text-cyan-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4">Decentralized Market</h3>
            <p className="text-gray-600 mb-4">
              Trade AI agents with automatic metadata re-encryption
            </p>
            <p className="text-gray-600">
              Buy and sell AI agents on our marketplace with secure ownership transfer and privacy preservation.
            </p>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-4xl font-bold text-center mb-8">How It Works</h2>
        <p className="text-xl text-gray-600 text-center mb-16">
          Get started with your AI agents in three simple steps
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              1
            </div>
            <h3 className="text-xl font-bold mb-2">Create Your Agent</h3>
            <p className="text-gray-600">
              Choose an AI model, customize personality, and mint as an NFT
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              2
            </div>
            <h3 className="text-xl font-bold mb-2">Interact & Execute</h3>
            <p className="text-gray-600">
              Chat with your agents and run AI inference through 0G Compute
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              3
            </div>
            <h3 className="text-xl font-bold mb-2">Trade & Share</h3>
            <p className="text-gray-600">
              List on marketplace or transfer ownership with metadata security
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-purple-600 to-blue-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Create Your First AI Agent?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join the future of decentralized AI ownership on 0G Network
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/mint">
              <Button size="lg" className="bg-white text-purple-700 hover:bg-gray-100 px-8 py-6 text-lg">
                <Sparkles className="mr-2 h-5 w-5" />
                Start Creating
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10 px-8 py-6 text-lg">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-purple-600 text-xl mb-4">0G INFT</h3>
              <p className="text-gray-600">
                Building the future of intelligent NFTs on the 0G Network
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Platform</h4>
              <ul className="space-y-2 text-gray-600">
                <li><Link href="/mint" className="hover:text-purple-600">Mint Agent</Link></li>
                <li><Link href="/marketplace" className="hover:text-purple-600">Marketplace</Link></li>
                <li><Link href="/agents" className="hover:text-purple-600">My Agents</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="https://docs.0g.ai" target="_blank" className="hover:text-purple-600">Documentation</a></li>
                <li><a href="https://faucet.0g.ai" target="_blank" className="hover:text-purple-600">Faucet</a></li>
                <li><a href="https://explorer.0g.ai" target="_blank" className="hover:text-purple-600">Explorer</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Community</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-purple-600">Discord</a></li>
                <li><a href="#" className="hover:text-purple-600">Twitter</a></li>
                <li><a href="#" className="hover:text-purple-600">Telegram</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t text-center text-gray-600">
            © 2024 0G INFT Platform. Built with ❤️ on 0G Network
          </div>
        </div>
      </footer>
    </div>
  )
}