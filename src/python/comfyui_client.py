#!/usr/bin/env python3
"""
ComfyUI Cloud API Client

A reusable Python module for interacting with ComfyUI Cloud API.
Handles HTTP API calls, WebSocket connections, file uploads/downloads,
and workflow execution with fallback support.

Example:
    >>> import asyncio
    >>> from comfyui_client import ComfyUIClient
    >>> 
    >>> async def main():
    ...     client = ComfyUIClient(api_key="your-api-key")
    ...     workflow = {"1": {"class_type": "SaveImage", "inputs": {}}}
    ...     prompt_id, outputs = await client.submit_and_wait(workflow)
    ...     print(f"Completed: {prompt_id}")
    ... 
    >>> asyncio.run(main())
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import ssl
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import websockets

# Configure logging
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Error Classes
# ─────────────────────────────────────────────────────────────────────────────

class ComfyUIError(Exception):
    """Base exception for ComfyUI client errors."""
    pass


class InsufficientCreditsError(ComfyUIError):
    """Raised when the account has insufficient credits."""
    pass


class RateLimitError(ComfyUIError):
    """Raised when rate limit is exceeded."""
    pass


class WorkflowExecutionError(ComfyUIError):
    """Raised when workflow execution fails."""
    pass


class TimeoutError(ComfyUIError):
    """Raised when workflow execution times out."""
    pass


class FileOperationError(ComfyUIError):
    """Raised when file upload or download fails."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# SSL Context Setup
# ─────────────────────────────────────────────────────────────────────────────

def _create_ssl_context() -> ssl.SSLContext:
    """Create SSL context with certifi if available, fallback to default."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        logger.debug("certifi not available, using default SSL context")
        return ssl.create_default_context()


# ─────────────────────────────────────────────────────────────────────────────
# ComfyUI Client Class
# ─────────────────────────────────────────────────────────────────────────────

class ComfyUIClient:
    """Client for interacting with ComfyUI Cloud API.
    
    This client provides methods to submit workflows, monitor execution via
    WebSocket, and manage file uploads/downloads. It supports fallback chains
    for model availability and handles various error conditions.
    
    Attributes:
        api_key: The ComfyUI Cloud API key
        base_url: The base URL for ComfyUI Cloud API
        client_id: Unique client identifier for WebSocket connections
        ssl_context: SSL context for secure connections
    
    Example:
        >>> client = ComfyUIClient(api_key="your-key")
        >>> workflow = {"1": {"class_type": "SaveImage", "inputs": {}}}
        >>> prompt_id, outputs = await client.submit_and_wait(workflow)
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://cloud.comfy.org",
        client_id: str | None = None
    ):
        """Initialize the ComfyUI client.
        
        Args:
            api_key: The ComfyUI Cloud API key
            base_url: The base URL for ComfyUI Cloud API (default: https://cloud.comfy.org)
            client_id: Optional custom client ID for WebSocket connections.
                      If not provided, a UUID will be generated.
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.client_id = client_id or str(uuid.uuid4())
        self.ssl_context = _create_ssl_context()
        
        logger.debug(f"ComfyUIClient initialized with client_id={self.client_id}")

    def _make_ws_url(self) -> str:
        """Build WebSocket URL with clientId and token.
        
        Returns:
            WebSocket URL string with authentication parameters
        """
        # Convert https:// to wss://, http:// to ws://
        ws_base = self.base_url.replace("https://", "wss://").replace("http://", "ws://")
        return f"{ws_base}/ws?clientId={self.client_id}&token={self.api_key}"

    def _api_post_json(self, path: str, payload: dict) -> dict:
        """Make POST request to API with JSON payload.
        
        Args:
            path: API endpoint path (e.g., "/api/prompt")
            payload: JSON payload dictionary
            
        Returns:
            Parsed JSON response as dictionary
            
        Raises:
            InsufficientCreditsError: If account has insufficient credits (402)
            RateLimitError: If rate limit is exceeded (429)
            ComfyUIError: For other HTTP errors
        """
        url = self.base_url + path
        data = json.dumps(payload).encode("utf-8")
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "X-API-Key": self.api_key,
            }
        )
        
        try:
            with urllib.request.urlopen(
                req, timeout=60, context=self.ssl_context
            ) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            
            if e.code == 402:
                raise InsufficientCreditsError(f"Insufficient credits: {body}")
            elif e.code == 429:
                raise RateLimitError(f"Rate limit exceeded: {body}")
            elif 400 <= e.code < 500:
                raise ComfyUIError(f"Client error {e.code}: {body}")
            else:
                raise ComfyUIError(f"Server error {e.code}: {body}")
        except urllib.error.URLError as e:
            raise ComfyUIError(f"Connection error: {e.reason}")

    async def upload_file(self, filepath: str | Path) -> str:
        """Upload a file to ComfyUI Cloud via curl subprocess.
        
        Args:
            filepath: Path to the file to upload
            
        Returns:
            The filename/identifier assigned by the server
            
        Raises:
            FileOperationError: If upload fails
            FileNotFoundError: If the file doesn't exist
        """
        filepath = Path(filepath)
        
        if not filepath.exists():
            raise FileNotFoundError(f"File not found: {filepath}")
        
        logger.info(f"Uploading {filepath.name}...")
        
        cmd = [
            "curl", "-s", "-X", "POST",
            f"{self.base_url}/api/upload/image",
            "-H", f"X-API-Key: {self.api_key}",
            "-F", f"image=@{filepath}",
            "-F", "type=input",
            "-F", "overwrite=true"
        ]
        
        try:
            result = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(
                result.communicate(), timeout=120
            )
            
            if result.returncode != 0:
                raise FileOperationError(
                    f"Upload failed: {stderr.decode(errors='replace')}"
                )
            
            resp = json.loads(stdout.decode("utf-8"))
            name = resp.get("name") or resp.get("filename")
            
            if not name:
                raise FileOperationError(f"Invalid upload response: {resp}")
            
            logger.info(f"Uploaded as {name}")
            return name
            
        except asyncio.TimeoutError:
            raise FileOperationError("Upload timed out after 120s")
        except json.JSONDecodeError as e:
            raise FileOperationError(f"Invalid JSON response: {e}")

    async def download_file(
        self,
        filename: str,
        dest_path: str | Path,
        subfolder: str = "",
        file_type: str = "output"
    ) -> bool:
        """Download a file from ComfyUI Cloud via curl with redirect following.
        
        Args:
            filename: Name of the file to download
            dest_path: Local path where file should be saved
            subfolder: Subfolder path on server (default: "")
            file_type: File type/category (default: "output")
            
        Returns:
            True if download succeeded, False otherwise
            
        Raises:
            FileOperationError: If download fails irrecoverably
        """
        dest_path = Path(dest_path)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        params = urllib.parse.urlencode({
            "filename": filename,
            "subfolder": subfolder,
            "type": file_type,
        })
        
        url = f"{self.base_url}/api/view?{params}"
        
        cmd = [
            "curl", "-s", "-L", "-o", str(dest_path),
            "-H", f"X-API-Key: {self.api_key}",
            url
        ]
        
        try:
            result = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(
                result.communicate(), timeout=180
            )
            
            if result.returncode == 0 and dest_path.exists() and dest_path.stat().st_size > 0:
                size_kb = dest_path.stat().st_size / 1024
                logger.info(f"Downloaded {dest_path.name} ({size_kb:.0f} KB)")
                return True
            
            logger.warning(f"Download error for {filename}: {stderr.decode(errors='replace')}")
            return False
            
        except asyncio.TimeoutError:
            logger.warning(f"Download timed out for {filename}")
            return False

    @staticmethod
    def extract_files(outputs: dict | None) -> list[dict]:
        """Extract file information from workflow outputs.
        
        Parses the outputs dictionary from executed nodes and extracts
        file metadata for images, videos, audio, and gifs.
        
        Args:
            outputs: The outputs dictionary from submit_and_wait
            
        Returns:
            List of file info dictionaries with keys like:
            - filename: Name of the file
            - subfolder: Subfolder path
            - type: File type (output, input, etc.)
        """
        files: list[dict] = []
        
        if not outputs:
            return files
        
        for node_id, node_out in outputs.items():
            for key in ("images", "video", "audio", "gifs"):
                items = node_out.get(key, [])
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, dict) and "filename" in item:
                            files.append(item)
        
        return files

    async def submit_and_wait(
        self,
        workflow: dict,
        step_name: str = "",
        timeout_seconds: int = 600
    ) -> tuple[str, dict]:
        """Submit workflow and wait for completion via WebSocket.
        
        Connects WebSocket FIRST (required by ComfyUI Cloud), then submits
        the workflow via HTTP, and listens for execution messages.
        
        Args:
            workflow: ComfyUI workflow dictionary with node definitions
            step_name: Optional name for logging this step
            timeout_seconds: Maximum time to wait for completion (default: 600)
            
        Returns:
            Tuple of (prompt_id, outputs) where:
            - prompt_id: The unique prompt ID assigned by the server
            - outputs: Dictionary of node outputs from executed nodes
            
        Raises:
            TimeoutError: If execution exceeds timeout_seconds
            WorkflowExecutionError: If execution fails with an error
            ComfyUIError: For other API/connection errors
        """
        payload = {
            "prompt": workflow,
            "extra_data": {"api_key_comfy_org": self.api_key}
        }
        
        outputs: dict = {}
        prompt_id: str | None = None
        
        ws_url = self._make_ws_url()
        logger.info(f"[{step_name}] Connecting to WebSocket...")
        
        try:
            async with websockets.connect(
                ws_url,
                ssl=self.ssl_context,
                ping_interval=20,
                ping_timeout=60
            ) as ws:
                # Small delay to ensure WebSocket is ready
                await asyncio.sleep(0.3)
                
                logger.info(f"[{step_name}] Submitting workflow...")
                resp = self._api_post_json("/api/prompt", payload)
                prompt_id = resp.get("prompt_id") or resp.get("id")
                
                if not prompt_id:
                    raise ComfyUIError(f"No prompt_id in response: {json.dumps(resp)}")
                
                logger.info(f"[{step_name}] prompt_id={prompt_id}")
                
                # Set deadline for timeout
                deadline = asyncio.get_event_loop().time() + timeout_seconds
                
                while True:
                    remaining = deadline - asyncio.get_event_loop().time()
                    if remaining <= 0:
                        logger.warning(f"[{step_name}] TIMEOUT after {timeout_seconds}s")
                        raise TimeoutError(f"Workflow timed out after {timeout_seconds}s")
                    
                    try:
                        raw = await asyncio.wait_for(
                            ws.recv(),
                            timeout=min(remaining, 30)
                        )
                    except asyncio.TimeoutError:
                        logger.debug(f"[{step_name}] Waiting...")
                        continue
                    
                    # Skip binary messages (previews, etc.)
                    if isinstance(raw, bytes):
                        continue
                    
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    
                    msg_type = msg.get("type", "")
                    msg_data = msg.get("data", {})
                    
                    # Filter messages by prompt_id
                    if msg_data.get("prompt_id") != prompt_id:
                        continue
                    
                    # Handle message types
                    if msg_type == "executing":
                        node = msg_data.get("node")
                        if node:
                            logger.info(f"[{step_name}] Executing node {node}")
                    
                    elif msg_type == "progress":
                        val = msg_data.get("value", 0)
                        mx = msg_data.get("max", 0)
                        logger.info(f"[{step_name}] Progress: {val}/{mx}")
                    
                    elif msg_type == "executed" and msg_data.get("output"):
                        node_id = msg_data.get("node", "unknown")
                        outputs[node_id] = msg_data["output"]
                        logger.info(f"[{step_name}] Node {node_id} produced output")
                    
                    elif msg_type == "execution_success":
                        logger.info(f"[{step_name}] SUCCESS")
                        return prompt_id, outputs
                    
                    elif msg_type == "execution_error":
                        err_msg = msg_data.get("exception_message", "Unknown error")
                        logger.error(f"[{step_name}] FAILED: {err_msg[:300]}")
                        raise WorkflowExecutionError(err_msg)
                        
        except websockets.exceptions.WebSocketException as e:
            raise ComfyUIError(f"WebSocket error: {e}")
        except Exception as e:
            if isinstance(e, (ComfyUIError, TimeoutError)):
                raise
            raise ComfyUIError(f"Unexpected error: {e}")

    async def generate_with_fallback(
        self,
        workflows: list[tuple[str, dict]],
        step_name: str,
        timeout_per_attempt: int = 600
    ) -> tuple[str, str, dict]:
        """Try each workflow until one succeeds.
        
        This method implements a fallback chain for model availability.
        Each workflow is tried in order until one succeeds or all fail.
        
        Args:
            workflows: List of (model_name, workflow_json) tuples to try
            step_name: Name for logging this step
            timeout_per_attempt: Timeout for each attempt (default: 600)
            
        Returns:
            Tuple of (model_used, prompt_id, outputs) where:
            - model_used: Name of the model that succeeded
            - prompt_id: The prompt ID from the successful execution
            - outputs: The outputs dictionary
            
        Raises:
            ComfyUIError: If all workflows fail
        """
        last_error: Exception | None = None
        
        for model_name, workflow in workflows:
            try:
                logger.info(f"[{step_name}] Trying {model_name}...")
                prompt_id, outputs = await self.submit_and_wait(
                    workflow,
                    step_name=f"{step_name}-{model_name}",
                    timeout_seconds=timeout_per_attempt
                )
                
                if not outputs:
                    raise WorkflowExecutionError("No outputs received")
                
                logger.info(f"[{step_name}] {model_name} succeeded")
                return model_name, prompt_id, outputs
                
            except Exception as e:
                last_error = e
                logger.warning(f"[{step_name}] {model_name} failed: {e}")
                continue
        
        raise ComfyUIError(
            f"All {len(workflows)} workflow attempts failed. Last error: {last_error}"
        )

    async def download_outputs(
        self,
        outputs: dict,
        output_dir: str | Path,
        filename_prefix: str = ""
    ) -> list[Path]:
        """Download all files from workflow outputs.
        
        Convenience method to extract files from outputs and download them
        to a local directory.
        
        Args:
            outputs: The outputs dictionary from submit_and_wait
            output_dir: Directory where files should be saved
            filename_prefix: Optional prefix for downloaded filenames
            
        Returns:
            List of Paths to successfully downloaded files
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        files = self.extract_files(outputs)
        downloaded: list[Path] = []
        
        for i, file_info in enumerate(files):
            filename = file_info["filename"]
            subfolder = file_info.get("subfolder", "")
            file_type = file_info.get("type", "output")
            
            # Build destination path
            if filename_prefix:
                dest_name = f"{filename_prefix}_{i:03d}_{filename}"
            else:
                dest_name = filename
            
            dest_path = output_dir / dest_name
            
            if await self.download_file(filename, dest_path, subfolder, file_type):
                downloaded.append(dest_path)
        
        return downloaded


# ─────────────────────────────────────────────────────────────────────────────
# Test Code
# ─────────────────────────────────────────────────────────────────────────────

async def _test_client():
    """Test the ComfyUIClient functionality."""
    # Get API key from environment
    api_key = os.environ.get("COMFY_CLOUD_API_KEY", "")
    
    if not api_key:
        print("=" * 60)
        print("TEST MODE: No API key found in environment")
        print("Set COMFY_CLOUD_API_KEY to run live tests")
        print("=" * 60)
        
        # Test client initialization without API calls
        client = ComfyUIClient(api_key="test-key-12345")
        
        print(f"\n✓ Client initialized")
        print(f"  - client_id: {client.client_id}")
        print(f"  - base_url: {client.base_url}")
        
        # Test WebSocket URL generation
        ws_url = client._make_ws_url()
        print(f"  - WebSocket URL: {ws_url[:60]}...")
        assert "wss://" in ws_url
        assert "clientId=" in ws_url
        assert "token=" in ws_url
        print("✓ WebSocket URL generation works")
        
        # Test extract_files
        test_outputs = {
            "1": {
                "images": [
                    {"filename": "test.png", "subfolder": "", "type": "output"}
                ]
            },
            "2": {
                "video": [
                    {"filename": "video.mp4", "subfolder": "video", "type": "output"}
                ]
            }
        }
        files = ComfyUIClient.extract_files(test_outputs)
        print(f"✓ extract_files found {len(files)} files")
        assert len(files) == 2
        
        # Test error classes
        try:
            raise InsufficientCreditsError("Test error")
        except ComfyUIError as e:
            print(f"✓ Error inheritance works: {type(e).__name__}")
        
        print("\n" + "=" * 60)
        print("All static tests passed!")
        print("Set COMFY_CLOUD_API_KEY to run live API tests")
        print("=" * 60)
        return
    
    # Live API tests
    print("=" * 60)
    print("LIVE API TEST MODE")
    print("=" * 60)
    
    client = ComfyUIClient(api_key=api_key)
    print(f"✓ Client initialized with ID: {client.client_id}")
    
    # Test with a simple workflow (if you have a valid workflow)
    # This is a minimal example - replace with actual node classes
    test_workflow = {
        "1": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "test_output"
            }
        }
    }
    
    try:
        print("\nAttempting to submit test workflow...")
        print("(This may fail if SaveImage node requires image input)")
        prompt_id, outputs = await client.submit_and_wait(
            test_workflow,
            step_name="test",
            timeout_seconds=60
        )
        print(f"✓ Workflow completed: {prompt_id}")
        print(f"  Outputs: {json.dumps(outputs, indent=2)[:500]}")
    except ComfyUIError as e:
        print(f"⚠ Expected error (workflow may be invalid): {e}")
    
    print("\n" + "=" * 60)
    print("Live test completed!")
    print("=" * 60)


if __name__ == "__main__":
    import argparse
    import sys
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--function", required=True, help="Method name to call")
    parser.add_argument("--args", required=True, help="JSON string of arguments")
    parser.add_argument("--api-key", default=None, help="ComfyUI Cloud API key")
    parser.add_argument("--base-url", default="https://cloud.comfy.org", help="ComfyUI Cloud base URL")
    args = parser.parse_args()
    
    # Parse arguments
    try:
        func_args = json.loads(args.args)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)
    
    # Get API key from args or environment
    api_key = args.api_key or os.environ.get("COMFY_CLOUD_API_KEY")
    if not api_key:
        print(json.dumps({"success": False, "error": "API key required. Provide --api-key or set COMFY_CLOUD_API_KEY"}))
        sys.exit(1)
    
    # Create client instance
    client = ComfyUIClient(api_key=api_key, base_url=args.base_url)
    
    # Get method
    if not hasattr(client, args.function):
        print(json.dumps({"success": False, "error": f"Unknown function: {args.function}"}))
        sys.exit(1)
    
    method = getattr(client, args.function)
    
    # Call method (handle async)
    try:
        if asyncio.iscoroutinefunction(method):
            result = asyncio.run(method(**func_args))
        else:
            result = method(**func_args)
        print(json.dumps({"success": True, "data": result}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
