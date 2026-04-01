// src/secure-key-storage.ts
// Secure API key storage with encryption

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.meme-engine');
const KEYS_FILE = path.join(CONFIG_DIR, 'keys.enc');
const SALT_FILE = path.join(CONFIG_DIR, '.salt');

// In-memory cache (cleared on restart)
const memoryCache: Map<string, string> = new Map();

export interface KeyConfig {
  comfyCloudApiKey?: string;
  llmProvider?: string;
  llmApiKey?: string;
  // Add other keys as needed
}

/**
 * Initialize the key storage system
 * Creates config directory if needed
 */
export async function initKeyStorage(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    // Set restrictive permissions (user read/write only)
    await fs.chmod(CONFIG_DIR, 0o700);
  } catch (error) {
    console.error('Failed to initialize key storage:', error);
    throw error;
  }
}

/**
 * Generate or load salt for key derivation
 */
async function getSalt(): Promise<Buffer> {
  try {
    const salt = await fs.readFile(SALT_FILE);
    return salt;
  } catch {
    // Generate new salt
    const salt = crypto.randomBytes(32);
    await fs.writeFile(SALT_FILE, salt);
    await fs.chmod(SALT_FILE, 0o600); // User read/write only
    return salt;
  }
}

/**
 * Derive encryption key from master password
 */
async function deriveKey(masterPassword: string): Promise<Buffer> {
  const salt = await getSalt();
  return crypto.pbkdf2Sync(masterPassword, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt data with AES-256-GCM
 */
async function encrypt(data: string, masterPassword: string): Promise<string> {
  const key = await deriveKey(masterPassword);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt data with AES-256-GCM
 */
async function decrypt(encryptedData: string, masterPassword: string): Promise<string> {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const key = await deriveKey(masterPassword);
  
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Save API keys (encrypted)
 */
export async function saveKeys(
  keys: KeyConfig,
  masterPassword: string
): Promise<void> {
  await initKeyStorage();
  
  const jsonData = JSON.stringify(keys, null, 2);
  const encrypted = await encrypt(jsonData, masterPassword);
  
  await fs.writeFile(KEYS_FILE, encrypted);
  await fs.chmod(KEYS_FILE, 0o600); // User read/write only
  
  // Also cache in memory for quick access
  if (keys.comfyCloudApiKey) {
    memoryCache.set('COMFY_CLOUD_API_KEY', keys.comfyCloudApiKey);
  }
  if (keys.llmApiKey) {
    memoryCache.set('LLM_API_KEY', keys.llmApiKey);
  }
  if (keys.llmProvider) {
    memoryCache.set('LLM_PROVIDER', keys.llmProvider);
  }
}

/**
 * Load API keys (decrypted)
 */
export async function loadKeys(masterPassword: string): Promise<KeyConfig> {
  try {
    const encrypted = await fs.readFile(KEYS_FILE, 'utf-8');
    const decrypted = await decrypt(encrypted, masterPassword);
    return JSON.parse(decrypted);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // No keys file yet
      return {};
    }
    throw new Error('Failed to decrypt keys. Wrong master password?');
  }
}

/**
 * Get API key (from memory cache or env var)
 */
export function getKey(keyName: string): string | undefined {
  // First check memory cache
  if (memoryCache.has(keyName)) {
    return memoryCache.get(keyName);
  }
  
  // Fall back to environment variable
  return process.env[keyName];
}

/**
 * Check if keys are stored
 */
export async function hasStoredKeys(): Promise<boolean> {
  try {
    await fs.access(KEYS_FILE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all stored keys
 */
export async function clearKeys(): Promise<void> {
  try {
    await fs.unlink(KEYS_FILE);
  } catch {
    // File might not exist
  }
  memoryCache.clear();
}

/**
 * Initialize from stored keys on server startup
 */
export async function initializeKeysFromStorage(
  masterPassword?: string
): Promise<boolean> {
  if (!masterPassword) {
    // Try to use without master password (won't work if keys are encrypted)
    return false;
  }
  
  try {
    const keys = await loadKeys(masterPassword);
    
    if (keys.comfyCloudApiKey) {
      memoryCache.set('COMFY_CLOUD_API_KEY', keys.comfyCloudApiKey);
      process.env.COMFY_CLOUD_API_KEY = keys.comfyCloudApiKey;
    }
    if (keys.llmApiKey) {
      memoryCache.set('LLM_API_KEY', keys.llmApiKey);
      process.env.LLM_API_KEY = keys.llmApiKey;
    }
    if (keys.llmProvider) {
      memoryCache.set('LLM_PROVIDER', keys.llmProvider);
      process.env.LLM_PROVIDER = keys.llmProvider;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize keys from storage:', error);
    return false;
  }
}

// Export for use in other modules
export { CONFIG_DIR };
