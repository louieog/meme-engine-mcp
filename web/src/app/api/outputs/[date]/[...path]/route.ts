import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface RouteParams {
  date: string;
  path: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { date, path: pathSegments } = await params;
    const filePath = pathSegments.join('/');
    
    // Security: Ensure date is valid format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }
    
    // Security: Ensure path doesn't traverse up
    if (filePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }
    
    // Resolve full path
    const outputDir = path.resolve(process.cwd(), '..', 'output');
    const fullPath = path.resolve(outputDir, date, filePath);
    
    // Security check: must be within output directory
    if (!fullPath.startsWith(outputDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Read file
    const file = await fs.readFile(fullPath);
    
    // Determine content type
    const ext = path.extname(fullPath).toLowerCase();
    const contentType: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
    };
    
    const headers = new Headers();
    headers.set('Content-Type', contentType[ext] || 'application/octet-stream');
    
    // Cache videos for 1 day
    if (ext === '.mp4' || ext === '.webm') {
      headers.set('Cache-Control', 'public, max-age=86400');
    }
    
    return new NextResponse(file, { headers });
  } catch (error) {
    console.error('File serving error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
