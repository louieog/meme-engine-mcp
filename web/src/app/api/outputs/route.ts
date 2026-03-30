/**
 * Meme Outputs API
 * ================
 * 
 * GET /api/outputs - List all generated meme outputs
 * GET /api/outputs?id={requestId} - Get specific output details
 * 
 * This route provides access to generated meme videos and their metadata.
 * Uses file system scanning since outputs are stored on disk.
 * 
 * @module app/api/outputs
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { ApiErrorResponse, ExportMetadata } from "@/types";

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";

// ============================================================================
// GET Handler - List or Get Outputs
// ============================================================================

/**
 * GET handler for retrieving meme outputs.
 * 
 * Query params:
 * - id: Request ID to get specific output (optional)
 * - limit: Maximum number of results (default: 20)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("id");
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // If ID provided, get specific output
    if (requestId) {
      return await getSpecificOutput(requestId);
    }

    // Otherwise list all outputs
    return await listOutputs(limit, offset);

  } catch (error) {
    console.error("[API] Error retrieving outputs:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json<ApiErrorResponse>(
      { 
        error: "Failed to retrieve outputs",
        code: "INTERNAL_ERROR",
        details: { message: errorMessage }
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Specific Output Retrieval
// ============================================================================

async function getSpecificOutput(requestId: string): Promise<NextResponse> {
  console.log(`[API] Getting output for request: ${requestId}`);

  try {
    // Find output directory by scanning for request ID pattern
    const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
    
    // Find directory matching request ID (format: slug-uuidprefix)
    const targetDir = entries.find(entry => 
      entry.isDirectory() && 
      (entry.name.includes(requestId) || requestId.includes(entry.name.split("-").pop() || ""))
    );

    if (!targetDir) {
      return NextResponse.json<ApiErrorResponse>(
        { 
          error: "Output not found",
          code: "NOT_FOUND",
          details: { requestId }
        },
        { status: 404 }
      );
    }

    const dirPath = path.join(OUTPUT_DIR, targetDir.name);
    
    // Look for metadata file
    const metadataPath = path.join(dirPath, "metadata.json");
    let metadata: ExportMetadata | null = null;
    
    try {
      const metadataContent = await fs.readFile(metadataPath, "utf-8");
      metadata = JSON.parse(metadataContent);
    } catch {
      // Metadata file might not exist yet
      console.log(`[API] Metadata not found at ${metadataPath}`);
    }

    // List video files in directory
    const files = await fs.readdir(dirPath);
    const videoFiles = files.filter(f => 
      f.endsWith(".mp4") || f.endsWith(".mov") || f.endsWith(".webm")
    );
    const thumbnailFiles = files.filter(f => 
      f.endsWith(".jpg") || f.endsWith(".png") || f.endsWith(".jpeg")
    );

    // Build response
    const response = {
      request_id: requestId,
      directory: dirPath,
      status: metadata ? "complete" : "processing",
      videos: videoFiles.map(filename => ({
        filename,
        url: `/api/serve-file?path=${encodeURIComponent(path.join(dirPath, filename))}`,
        format: filename.includes("9x16") ? "9:16" : 
                filename.includes("16x9") ? "16:9" : 
                filename.includes("1x1") ? "1:1" : "unknown",
      })),
      thumbnails: thumbnailFiles.map(filename => ({
        filename,
        url: `/api/serve-file?path=${encodeURIComponent(path.join(dirPath, filename))}`,
      })),
      metadata,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error(`[API] Error getting output for ${requestId}:`, error);
    throw error;
  }
}

// ============================================================================
// List All Outputs
// ============================================================================

async function listOutputs(limit: number, offset: number): Promise<NextResponse> {
  console.log(`[API] Listing outputs (limit=${limit}, offset=${offset})`);

  try {
    // Ensure output directory exists
    try {
      await fs.access(OUTPUT_DIR);
    } catch {
      return NextResponse.json({
        outputs: [],
        total: 0,
        limit,
        offset,
      });
    }

    // Get all directories in output folder
    const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
    const directories = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
      .reverse(); // Most recent first

    const total = directories.length;
    
    // Apply pagination
    const paginatedDirs = directories.slice(offset, offset + limit);

    // Get metadata for each directory
    const outputs = await Promise.all(
      paginatedDirs.map(async (dirName) => {
        const dirPath = path.join(OUTPUT_DIR, dirName);
        
        // Try to read metadata
        const metadataPath = path.join(dirPath, "metadata.json");
        let metadata: Partial<ExportMetadata> | null = null;
        
        try {
          const content = await fs.readFile(metadataPath, "utf-8");
          metadata = JSON.parse(content);
        } catch {
          // No metadata yet
        }

        // List files
        try {
          const files = await fs.readdir(dirPath);
          const hasVideos = files.some(f => f.endsWith(".mp4"));
          
          return {
            slug: dirName,
            directory: dirPath,
            status: metadata ? "complete" : hasVideos ? "processing" : "pending",
            concept: metadata?.concept || dirName,
            created_at: metadata ? await getCreationTime(dirPath) : null,
            has_metadata: !!metadata,
            formats: metadata ? Object.keys(metadata.outputs || {}) : [],
          };
        } catch {
          return {
            slug: dirName,
            directory: dirPath,
            status: "unknown",
            concept: dirName,
            created_at: null,
            has_metadata: false,
            formats: [],
          };
        }
      })
    );

    return NextResponse.json({
      outputs,
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    });

  } catch (error) {
    console.error("[API] Error listing outputs:", error);
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get creation time of a directory
 */
async function getCreationTime(dirPath: string): Promise<string | null> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.birthtime.toISOString();
  } catch {
    return null;
  }
}
