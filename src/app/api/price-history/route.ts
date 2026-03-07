import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get('interval') || '1h';
  const limit = searchParams.get('limit') || '168';

  try {
    // Use data-api.binance.vision for more reliable public access without region blocks
    const response = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=HBARUSDT&interval=${interval}&limit=${limit}`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch price history:", error);
    return NextResponse.json({ error: "Failed to fetch price data" }, { status: 500 });
  }
}
