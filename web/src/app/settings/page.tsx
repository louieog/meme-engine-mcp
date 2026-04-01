"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Save, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Server,
  FileKey
} from "lucide-react";

interface SettingsState {
  hasStoredKeys: boolean;
  hasSessionPassword: boolean;
  envKeys: {
    comfyCloud: boolean;
    llm: boolean;
    provider: string;
  };
  activeSource: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [comfyCloudKey, setComfyCloudKey] = useState("");
  const [llmProvider, setLlmProvider] = useState("claude");
  const [llmKey, setLlmKey] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(true);
  
  // UI state
  const [showKeys, setShowKeys] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings/keys");
      const data = await res.json();
      setSettings(data);
      
      if (data.envKeys?.provider) {
        setLlmProvider(data.envKeys.provider);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    
    // Validation
    if (masterPassword.length < 8) {
      setMessage({ type: 'error', text: 'Master password must be at least 8 characters' });
      return;
    }
    
    if (masterPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    
    if (!comfyCloudKey && !llmKey) {
      setMessage({ type: 'error', text: 'At least one API key is required' });
      return;
    }
    
    setSaving(true);
    
    try {
      const res = await fetch("/api/settings/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comfyCloudApiKey: comfyCloudKey || undefined,
          llmProvider,
          llmApiKey: llmKey || undefined,
          masterPassword,
          rememberMasterPassword: rememberPassword,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        // Clear form
        setComfyCloudKey("");
        setLlmKey("");
        setMasterPassword("");
        setConfirmPassword("");
        // Reload settings
        loadSettings();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!confirm("Are you sure? This will delete all stored API keys.")) {
      return;
    }
    
    try {
      const res = await fetch("/api/settings/keys", { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: 'success', text: 'All keys cleared' });
        loadSettings();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear keys' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Header />
      
      {/* Status Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            API Key Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">ComfyUI Cloud API Key</span>
              {settings?.envKeys.comfyCloud ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="w-3 h-3" /> Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-500 border-red-500/50 gap-1">
                  <AlertCircle className="w-3 h-3" /> Missing
                </Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">LLM API Key ({settings?.envKeys.provider || 'claude'})</span>
              {settings?.envKeys.llm ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="w-3 h-3" /> Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-500 border-red-500/50 gap-1">
                  <AlertCircle className="w-3 h-3" /> Missing
                </Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">Active Source</span>
              <Badge variant="outline">
                {settings?.activeSource === 'encrypted_file' ? (
                  <><Lock className="w-3 h-3 mr-1" /> Encrypted File</>
                ) : (
                  <><Server className="w-3 h-3 mr-1" /> Environment</>
                )}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileKey className="w-5 h-5" />
            Configure API Keys
          </CardTitle>
          <CardDescription>
            Your API keys are encrypted with a master password and stored locally.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            {/* ComfyUI Cloud Key */}
            <div>
              <label className="block text-sm font-medium mb-1">
                ComfyUI Cloud API Key
              </label>
              <div className="relative">
                <Input
                  type={showKeys ? "text" : "password"}
                  value={comfyCloudKey}
                  onChange={(e) => setComfyCloudKey(e.target.value)}
                  placeholder="Enter your ComfyUI Cloud API key"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys(!showKeys)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Get your key from {" "}
                <a href="https://comfy.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  comfy.org
                </a>
              </p>
            </div>

            {/* LLM Provider */}
            <div>
              <label className="block text-sm font-medium mb-1">
                LLM Provider
              </label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="claude">Claude (Anthropic)</option>
                <option value="openai">GPT-4 (OpenAI)</option>
                <option value="gemini">Gemini (Google)</option>
              </select>
            </div>

            {/* LLM API Key */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {llmProvider === 'claude' && 'Anthropic API Key'}
                {llmProvider === 'openai' && 'OpenAI API Key'}
                {llmProvider === 'gemini' && 'Google API Key'}
              </label>
              <div className="relative">
                <Input
                  type={showKeys ? "text" : "password"}
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder={`Enter your ${llmProvider} API key`}
                />
              </div>
            </div>

            {/* Master Password */}
            <div className="pt-4 border-t">
              <label className="block text-sm font-medium mb-1">
                Master Password
              </label>
              <Input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Create a master password (min 8 chars)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This password encrypts your API keys. Don&apos;t forget it!
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Confirm Master Password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your master password"
              />
            </div>

            {/* Remember Password */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberPassword}
                onChange={(e) => setRememberPassword(e.target.checked)}
                className="rounded border-input"
              />
              <label htmlFor="remember" className="text-sm">
                Remember master password for 7 days
              </label>
            </div>

            {/* Messages */}
            {message && (
              <div className={`p-3 rounded-md text-sm ${
                message.type === 'success' 
                  ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
              }`}>
                {message.text}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save API Keys"}
              </Button>
              
              {settings?.hasStoredKeys && (
                <Button 
                  type="button" 
                  variant="outline" className="text-red-500 border-red-500/50" 
                  onClick={handleClear}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Security Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-muted-foreground space-y-2">
            <li>• API keys are encrypted with AES-256-GCM</li>
            <li>• Encryption uses PBKDF2 with 100,000 iterations</li>
            <li>• Keys are stored in ~/.meme-engine/ (user-only access)</li>
            <li>• Keys are never sent to the browser after saving</li>
            <li>• Session cookies are httpOnly and secure</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
