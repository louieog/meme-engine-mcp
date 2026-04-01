import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const outputDir = path.resolve(process.cwd(), '..', 'output');
    
    // List all date directories
    const entries = await fs.readdir(outputDir, { withFileTypes: true });
    const dateDirs = entries.filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name));
    
    const outputs = [];
    
    for (const dir of dateDirs) {
      const datePath = path.join(outputDir, dir.name);
      const files = await fs.readdir(datePath);
      
      // Find metadata files
      const metadataFiles = files.filter(f => f.endsWith('-metadata.json') || f === 'metadata.json');
      const videoFiles = files.filter(f => f.endsWith('.mp4'));
      
      for (const metaFile of metadataFiles) {
        try {
          const metaPath = path.join(datePath, metaFile);
          const metaContent = await fs.readFile(metaPath, 'utf-8');
          const metadata = JSON.parse(metaContent);
          
          // Find matching video
          const baseName = metaFile.replace('-metadata.json', '').replace('.json', '');
          const matchingVideo = videoFiles.find(v => 
            v.includes(baseName) || 
            v.includes(metadata.slug || metadata.concept?.toLowerCase().replace(/\s+/g, '-'))
          ) || videoFiles[0];
          
          if (matchingVideo) {
            outputs.push({
              id: `${dir.name}/${baseName}`,
              date: dir.name,
              concept: metadata.concept || baseName,
              slug: metadata.slug || baseName,
              duration: metadata.duration || 0,
              thumbnail: metadata.thumbnail || matchingVideo.replace('.mp4', '_thumb.jpg'),
              video_file: matchingVideo,
              metadata
            });
          }
        } catch (e) {
          console.error(`Error reading metadata ${metaFile}:`, e);
        }
      }
    }
    
    // Sort by date descending
    outputs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return NextResponse.json({ outputs });
  } catch (error) {
    console.error('Gallery error:', error);
    return NextResponse.json({ outputs: [] });
  }
}
