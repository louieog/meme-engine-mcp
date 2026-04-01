// web/src/app/api/settings/keys/route.ts
// API endpoints for managing API keys

import { NextRequest, NextResponse } from 'next/server';
import {
  saveKeys,
  loadKeys,
  hasStoredKeys,
  clearKeys,
  KeyConfig,
} from '@/lib/secure-key-storage';

// In-memory session store for master passwords
const sessionPasswords = new Map<string, string>();

/**
 * GET /api/settings/keys
 * Check if keys are configured
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session')?.value || 'default';
    const hasStored = await hasStoredKeys();
    const masterPassword = sessionPasswords.get(sessionId);
    
    // Check environment variables
    const envKeys = {
      comfyCloud: !!process.env.COMFY_CLOUD_API_KEY,
      llm: !!(process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
      provider: process.env.LLM_PROVIDER || 'claude',
    };
    
    return NextResponse.json({
      hasStoredKeys: hasStored,
      hasSessionPassword: !!masterPassword,
      envKeys,
      activeSource: masterPassword && hasStored ? 'encrypted_file' : 'environment',
    });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/keys
 * Save API keys (encrypted)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      comfyCloudApiKey, 
      llmProvider, 
      llmApiKey, 
      masterPassword,
      rememberMasterPassword = false 
    } = body;
    
    if (!masterPassword || masterPassword.length < 8) {
      return NextResponse.json(
        { error: 'Master password must be at least 8 characters' },
        { status: 400 }
      );
    }
    
    const keys: KeyConfig = {
      ...(comfyCloudApiKey && { comfyCloudApiKey }),
      ...(llmProvider && { llmProvider }),
      ...(llmApiKey && { llmApiKey }),
    };
    
    await saveKeys(keys, masterPassword);
    
    // Set session password if requested
    const sessionId = crypto.randomUUID();
    if (rememberMasterPassword) {
      sessionPasswords.set(sessionId, masterPassword);
    }
    
    // Set in environment
    if (comfyCloudApiKey) process.env.COMFY_CLOUD_API_KEY = comfyCloudApiKey;
    if (llmApiKey) process.env.LLM_API_KEY = llmApiKey;
    if (llmProvider) process.env.LLM_PROVIDER = llmProvider;
    
    const response = NextResponse.json({ 
      success: true,
      message: 'API keys saved successfully'
    });
    
    if (rememberMasterPassword) {
      response.cookies.set('session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    
    return response;
  } catch (error) {
    console.error('Settings POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/keys
 * Clear all stored keys
 */
export async function DELETE(request: NextRequest) {
  try {
    await clearKeys();
    
    const sessionId = request.cookies.get('session')?.value;
    if (sessionId) {
      sessionPasswords.delete(sessionId);
    }
    
    const response = NextResponse.json({ 
      success: true,
      message: 'All keys cleared'
    });
    
    response.cookies.delete('session');
    return response;
  } catch (error) {
    console.error('Settings DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to clear settings' },
      { status: 500 }
    );
  }
}
