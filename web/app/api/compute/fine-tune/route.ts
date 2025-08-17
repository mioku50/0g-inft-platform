import { NextRequest, NextResponse } from "next/server"
import { validateComputeEnvironment, shouldAttestOnChain, parseBoolEnv } from "@/lib/server/compute-env"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
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
      message: "Fine-tuning feature is under development"
    }, { status: 501 })

  } catch (error: any) {
    console.error("Fine-tune query error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
      message: "Fine-tuning feature is under development"
    }, { status: 501 })

  } catch (error: any) {
    console.error("Fine-tune error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
