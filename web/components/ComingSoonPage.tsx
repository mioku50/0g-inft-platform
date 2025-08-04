'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Brain, 
  Sparkles, 
  Clock,
  Zap,
  Settings,
  Monitor,
  Bell
} from 'lucide-react'

interface ComingSoonPageProps {
  agentId?: string
  title?: string
  subtitle?: string
}

export function ComingSoonPage({ 
  agentId, 
  title = "Fine-Tuning", 
  subtitle = "AI Model Training" 
}: ComingSoonPageProps) {
  const features = [
    {
      icon: Brain,
      title: "6 AI Models",
      description: "DistilBERT, Llama 3.3 70B, DeepSeek R1, GPT-3.5, Code Llama, Mistral"
    },
    {
      icon: Zap,
      title: "Real 0G SDK",
      description: "Direct integration with 0G Compute Network infrastructure"
    },
    {
      icon: Settings,
      title: "Custom Training",
      description: "Upload datasets and configure training parameters"
    },
    {
      icon: Monitor,
      title: "Real-time Monitoring",
      description: "Track training progress and download models"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href={agentId ? `/agents/${agentId}` : "/agents"}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to {agentId ? "Agent" : "Agents"}
          </Link>
        </div>

        {/* Main Coming Soon Card */}
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm text-white mb-8">
            <CardHeader className="text-center pb-8">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                <Brain className="h-10 w-10 text-white" />
              </div>
              
              <div className="flex items-center justify-center gap-3 mb-4">
                <h1 className="text-4xl font-bold">{title}</h1>
                <Badge className="bg-purple-600 text-white px-3 py-1">
                  <Clock className="w-4 h-4 mr-1" />
                  Coming Soon
                </Badge>
              </div>
              
              <p className="text-xl text-purple-200 mb-6">
                Advanced {subtitle} powered by 0G Compute Network
              </p>

              <div className="flex items-center justify-center gap-2 text-yellow-300">
                <Sparkles className="h-5 w-5" />
                <span className="text-lg font-medium">Currently in development</span>
                <Sparkles className="h-5 w-5" />
              </div>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* Features Preview */}
              <div>
                <h2 className="text-2xl font-semibold mb-6 text-center">What's Coming</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {features.map((feature, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-4 p-4 bg-white/5 rounded-lg border border-white/10"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center flex-shrink-0">
                        <feature.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                        <p className="text-purple-200 text-sm">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="text-center py-6 border-t border-white/20">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Bell className="h-5 w-5 text-purple-300" />
                  <span className="text-purple-200">Stay tuned for updates</span>
                </div>
                
                <p className="text-sm text-purple-300 mb-6">
                  We're working hard to bring you the most advanced AI model training experience.
                  Follow our development progress and be the first to know when Fine-Tuning goes live!
                </p>

                <div className="flex justify-center gap-4">
                  <Button 
                    variant="outline" 
                    className="border-white/30 text-white hover:bg-white/10"
                    asChild
                  >
                    <Link href="/agents">
                      View My Agents
                    </Link>
                  </Button>
                  
                  {agentId && (
                    <Button 
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      asChild
                    >
                      <Link href={`/chat/${agentId}`}>
                        Chat with Agent
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Note */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="text-center text-purple-200">
                <p className="text-sm">
                  <strong>Note:</strong> Fine-Tuning functionality is temporarily disabled while we enhance 
                  the user experience and ensure optimal integration with the 0G Compute Network.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}