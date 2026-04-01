import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('path');
  
  if (!filePath) {
    return NextResponse.json({ error: 'No path provided' }, { status: 400 });
  }
  
  // Security: Ensure path is within output directory
  const outputDir = path.resolve(process.cwd(), '..', 'output');
  const fullPath = path.resolve(outputDir, filePath);
  
  if (!fullPath.startsWith(outputDir)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
  }
  
  try {
    const file = await fs.readFile(fullPath);
    const ext = path.extname(fullPath);
    const contentType = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.json': 'application/json',
    }[ext] || 'application/octet-stream';
    
    return new NextResponse(file, {
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
