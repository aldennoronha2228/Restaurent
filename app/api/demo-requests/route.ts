import { NextRequest, NextResponse } from 'next/server';

type DemoPayload = {
  name?: string;
  phone?: string;
};

type DemoSubmission = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
};

const demoSubmissions: DemoSubmission[] = [];

export async function GET() {
  const items = [...demoSubmissions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return NextResponse.json({ submissions: items });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DemoPayload;
    const name = String(body?.name || '').trim();
    const phone = String(body?.phone || '').trim();

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    if (name.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
    }

    if (!/^[+()\-\d\s]{7,20}$/.test(phone)) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });
    }

    demoSubmissions.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      phone,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
