import { NextResponse } from 'next/server';
import { join } from 'path';
import { promises as fs } from 'fs';

const dataPath = join(process.cwd(), 'src', 'data', 'hunts.json');

async function readData() {
  try {
    const txt = await fs.readFile(dataPath, 'utf8');
    return JSON.parse(txt);
  } catch {
    return [];
  }
}

async function writeData(data: any[]) {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
}

// List all hunts (optional)
export async function GET() {
  const hunts = await readData();
  return NextResponse.json(hunts);
}

// Create a new hunt entry
export async function POST(request: Request) {
  const body = await request.json();
  const { result } = body;
  if (!result) {
    return NextResponse.json({ ok: false, error: 'Missing result' }, { status: 400 });
  }
  const hunts = await readData();
  const newHunt = {
    id: crypto.randomUUID(),
    result,
    createdAt: new Date().toISOString(),
    mode: 'memory', // demo mode – could be 'supabase' in prod
  };
  hunts.push(newHunt);
  await writeData(hunts);
  return NextResponse.json({ ok: true, hunt: newHunt, mode: newHunt.mode }, { status: 201 });
}
