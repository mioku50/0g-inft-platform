// В app/agent/[id]/chat/page.tsx:
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { LedgerBalance } from '@/components/compute/LedgerBalance'
import { AgentHeaderServer, getAgentMeta } from '@/components/agents/AgentHeaderServer'
import { ChatClient } from '@/components/agents/ChatClient'

interface PageProps {
  params: { id: string }
}

// server
export default async function Page({ params }: PageProps) {
  const meta = await getAgentMeta(params.id) // серверный fetch/DB
  
  return (
    <div className="min-h-screen relative">
      {/* Modern gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 opacity-50" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-600/20 via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
      
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/agents">
            <Button 
              variant="ghost" 
              className="bg-transparent/0 hover:bg-white/10 border border-white/20 hover:border-white/40 text-white transition-all duration-300"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Button>
          </Link>
          
          <AgentHeaderServer meta={meta} tokenId={params.id} />

          {/* Ledger Balance */}
          <div className="hidden md:block">
            <LedgerBalance compact />
          </div>
        </div>

        <ChatClient agentId={params.id} agentMeta={meta} />
      </div>
    </div>
  )
}