// web/app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  Brain, 
  GraduationCap, 
  Rocket, 
  Users, 
  MessageSquare,
  Zap,
  BookOpen,
  Code,
  Palette,
  ChevronRight,
  Star
} from 'lucide-react'
import { useAccount } from 'wagmi'

export default function HomePage() {
  const { isConnected } = useAccount()
  const [starPositions, setStarPositions] = useState<Array<{x: number, y: number}>>([])

  useEffect(() => {
    // Генерируем звезды для фона
    const stars = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100
    }))
    setStarPositions(stars)
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Анимированный фон в стиле космоса */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900">
        {/* Звезды */}
        {starPositions.map((star, i) => (
          <div
            key={i}
            className="absolute animate-pulse"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              animationDelay: `${Math.random() * 3}s`
            }}
          >
            <Star className="w-2 h-2 text-white/30" fill="currentColor" />
          </div>
        ))}
        
        {/* Градиентные круги */}
        <div className="absolute top-20 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-40 -right-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            {/* Неоновый логотип */}
            <div className="inline-flex items-center justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur-2xl opacity-50" />
                <div className="relative bg-black/50 backdrop-blur-xl rounded-full p-8 border-2 border-transparent bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-padding">
                  <h1 className="text-6xl font-bold text-white">0G</h1>
                  <p className="text-2xl font-light text-purple-300">INFT</p>
                </div>
              </div>
            </div>

            <h2 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              AI Agent Learning Campus
            </h2>
            
            <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
              Create, train, and evolve your AI agents with cutting-edge fine-tuning technology. 
              Your agents learn and grow like students in a real campus!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/mint">
                <Button size="lg" className="group bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg px-8 py-6">
                  <GraduationCap className="mr-2 h-5 w-5" />
                  Create Your First Agent
                  <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              
              {isConnected && (
                <Link href="/agents">
                  <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6">
                    <Brain className="mr-2 h-5 w-5" />
                    My Agent Campus
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
            {/* Mint & Create */}
            <Card className="group bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-xl border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:scale-105">
              <div className="p-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Mint INFT</h3>
                <p className="text-gray-300 mb-4">
                  Create unique AI agents with custom personalities and skills. Each agent is a unique NFT on 0G Network.
                </p>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                  Choose Your Agent's Skills
                </Badge>
              </div>
            </Card>

            {/* Learning & Fine-tuning */}
            <Card className="group bg-gradient-to-br from-indigo-900/50 to-purple-900/50 backdrop-blur-xl border-white/10 hover:border-indigo-500/50 transition-all duration-300 hover:scale-105">
              <div className="p-8">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Agent Learning Campus</h3>
                <p className="text-gray-300 mb-4">
                  Train your agents with custom data. Fine-tune their knowledge and abilities in our learning center.
                </p>
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                  Fine-Tuning Center
                </Badge>
              </div>
            </Card>

            {/* Chat & Interact */}
            <Card className="group bg-gradient-to-br from-pink-900/50 to-orange-900/50 backdrop-blur-xl border-white/10 hover:border-pink-500/50 transition-all duration-300 hover:scale-105">
              <div className="p-8">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Chat & Collaborate</h3>
                <p className="text-gray-300 mb-4">
                  Interact with your AI agents, test their abilities, and watch them evolve through conversations.
                </p>
                <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30">
                  Hello World!
                </Badge>
              </div>
            </Card>
          </div>

          {/* Advanced Features Section */}
          <div className="mt-32">
            <h3 className="text-4xl font-bold text-center text-white mb-16">
              Advanced Agent Features
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center group">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="w-10 h-10 text-white" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">Transfer</h4>
                <p className="text-gray-400">Securely transfer agents between wallets</p>
              </div>

              <div className="text-center group">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Code className="w-10 h-10 text-white" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">Clone</h4>
                <p className="text-gray-400">Create copies of successful agents</p>
              </div>

              <div className="text-center group">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-pink-600 to-orange-600 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Palette className="w-10 h-10 text-white" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">Customize</h4>
                <p className="text-gray-400">Design unique personalities and prompts</p>
              </div>

              <div className="text-center group">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-600 to-teal-600 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">Collaborate</h4>
                <p className="text-gray-400">Share and trade agents on marketplace</p>
              </div>
            </div>
          </div>

          {/* Learning Pandas Section */}
          <div className="mt-32 text-center">
            <div className="inline-flex items-center gap-8 mb-12">
              {/* Панды читают книги */}
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
                <div className="relative bg-black/30 backdrop-blur-xl rounded-3xl p-6 border border-blue-500/30">
                  <div className="text-6xl mb-2">🐼</div>
                  <Badge className="bg-blue-500/20 text-blue-300">ML</Badge>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 bg-purple-500 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
                <div className="relative bg-black/30 backdrop-blur-xl rounded-3xl p-6 border border-purple-500/30">
                  <div className="text-6xl mb-2">🐼</div>
                  <Badge className="bg-purple-500/20 text-purple-300">LLM</Badge>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 bg-pink-500 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
                <div className="relative bg-black/30 backdrop-blur-xl rounded-3xl p-6 border border-pink-500/30">
                  <div className="text-6xl mb-2">🐼</div>
                  <Badge className="bg-pink-500/20 text-pink-300">DL</Badge>
                </div>
              </div>
            </div>
            
            <p className="text-2xl text-gray-300 italic">
              "Teach your agent like a student in a real campus"
            </p>
          </div>
        </section>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}