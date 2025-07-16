// web/app/page.tsx
'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Bot, Shield, Zap, Sparkles, Code, Globe } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section with Gradient */}
      <section className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-cyan-950/20" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-4 py-24 sm:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur-lg" />
                <Bot className="relative h-16 w-16 text-white bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-full" />
              </div>
            </div>
            
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
              Own Your AI Agents on
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"> 0G Network</span>
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Create, trade, and interact with decentralized AI agents. 
              Powered by 0G&apos;s cutting-edge storage and compute infrastructure.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/mint">
                <Button size="lg" className="w-full sm:w-auto group">
                  Create AI Agent
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Explore Marketplace
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Why Choose 0G INFT Platform?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              The most advanced decentralized AI agent platform built on 0G Network
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle>True Ownership</CardTitle>
                <CardDescription>
                  Your AI agents are NFTs with encrypted metadata stored on 0G Storage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Full control over your AI agents with secure, decentralized storage and on-chain ownership verification.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Instant Execution</CardTitle>
                <CardDescription>
                  Run AI models through 0G Compute with TEE verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Access powerful AI models like Llama 3.3 70B and DeepSeek R1 with micropayments and verified outputs.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/50 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Globe className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                </div>
                <CardTitle>Decentralized Market</CardTitle>
                <CardDescription>
                  Trade AI agents with automatic metadata re-encryption
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Buy and sell AI agents on our marketplace with secure ownership transfer and privacy preservation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Get started with your AI agents in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Your Agent</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Define your AI agent&apos;s personality, choose a model, and mint it as an NFT
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Interact & Execute</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Chat with your agents and run them using 0G Compute infrastructure
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Trade & Share</h3>
              <p className="text-gray-600 dark:text-gray-400">
                List your agents on the marketplace or transfer them securely
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Create Your First AI Agent?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join the future of decentralized AI ownership on 0G Network
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/mint">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Start Creating
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="https://docs.0g.ai" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 text-white border-white/20 hover:bg-white/20">
                Learn More
                <Code className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}