import { NextRequest, NextResponse } from "next/server";
import {
  getAIProvider,
  setAIProvider,
  getFoundryBaseUrl,
  setFoundryBaseUrl,
  getFoundryModel,
  setFoundryModel,
  getFoundryToken,
  setFoundryToken,
} from "@/lib/db/settings";
import { createProvider } from "@/lib/ai/provider";

export async function GET() {
  try {
    const provider = getAIProvider();
    const baseUrl = getFoundryBaseUrl();
    const model = getFoundryModel();
    const hasToken = !!getFoundryToken();

    return NextResponse.json({ provider, baseUrl, model, hasToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, baseUrl, model, token } = body;

    if (provider) {
      if (provider !== "claude" && provider !== "foundry") {
        return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
      }
      setAIProvider(provider);
    }

    if (baseUrl !== undefined) {
      setFoundryBaseUrl(baseUrl);
    }

    if (model !== undefined) {
      setFoundryModel(model);
    }

    if (token !== undefined) {
      setFoundryToken(token);
    }

    return NextResponse.json({
      provider: getAIProvider(),
      baseUrl: getFoundryBaseUrl(),
      model: getFoundryModel(),
      hasToken: !!getFoundryToken(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const providerName = getAIProvider();
    const provider = createProvider(providerName);
    const available = await provider.isAvailable();

    if (!available) {
      return NextResponse.json({ available: false, error: "Provider not configured" });
    }

    if (providerName === "foundry") {
      const result = await provider.testConnection();
      return NextResponse.json(result);
    }

    return NextResponse.json({ available });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ available: false, error: message });
  }
}
