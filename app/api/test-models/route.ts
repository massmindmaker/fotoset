// API route для проверки доступных провайдеров генерации изображений
import { NextResponse } from "next/server"
import { testConnections, getProviderInfo } from "@/lib/imagen"

export async function GET() {
  try {
    const providerInfo = getProviderInfo()
    const connectionTests = await testConnections()

    return NextResponse.json({
      success: true,
      activeProvider: providerInfo.active,
      availableProviders: providerInfo.available,
      pricing: providerInfo.pricing,
      connectionTests,
      envStatus: {
        KIE_API_KEY: !!process.env.KIE_API_KEY,
        FAL_API_KEY: !!process.env.FAL_API_KEY,
        GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
