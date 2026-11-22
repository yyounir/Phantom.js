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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const hunts = await readData();
  const hunt = hunts.find((h: { id: string }) => h.id === params.id);
  if (!hunt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(hunt);
}
