import { NextRequest, NextResponse } from "next/server"
import { validateComputeEnvironment } from "@/lib/server/compute-env"

export const runtime = "nodejs"

/**
 * POST /api/agents/[id]/activate
 * Activate a candidate model version for an agent
 * Platform pays gas for on-chain activation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    return NextResponse.json({
      error: "Compute environment misconfigured",
      details: envValidation.errors
    }, { status: 503 })
  }

  try {
    // Temporary implementation - return not implemented
    return NextResponse.json({
      error: "Feature temporarily disabled",
      message: "Model activation feature is under development"
    }, { status: 501 })

  } catch (error: any) {
    console.error("Activation error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
