/**
 * Meme Engine TypeScript Types
 * ============================
 * 
 * Type definitions for the AI video meme generation pipeline.
 * Re-exported and adapted from the shared schemas for Next.js use.
 * 
 * @module types
 * @version 2.0.0
 */

// Re-export all shared schemas from the core package
export * from '../../../src/schemas';

// ============================================
// Web-Specific API Types
// ============================================

/**
 * Request body for creating a new meme generation request
 */
export interface CreateMemeRequest {
  /** Meme concept/description */
  concept: string;
  
  /** Video format */
  format?: import('../../../src/schemas').MemeFormat;
  
  /** Visual style */
  style?: import('../../../src/schemas').MemeStyle;
  
  /** Target duration in seconds */
  duration?: number;
  
  /** Export formats */
  exportFormats?: ("9:16" | "16:9" | "1:1")[];
}

/**
 * Response from creating a meme generation request
 */
export interface CreateMemeResponse {
  /** Unique request ID */
  request_id: string;
  
  /** Pipeline ID for tracking */
  pipeline_id: string;
  
  /** Current status */
  status: "pending" | "generating" | "brief_ready" | "complete" | "failed";
  
  /** URL-friendly slug */
  slug: string;
  
  /** Timestamp */
  created_at: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  /** Error message */
  error: string;
  
  /** Error code */
  code?: string;
  
  /** Additional details */
  details?: Record<string, any>;
}

/**
 * Video output item for gallery display
 */
export interface VideoOutput {
  id: string;
  concept: string;
  format: string;
  created_at: string;
  thumbnail?: string;
  files: {
    "9x16"?: string;
    "16x9"?: string;
  };
}
