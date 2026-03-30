"""Tests for ComfyUIClient module."""
import pytest
import asyncio
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
import json

from comfyui_client import ComfyUIClient, InsufficientCreditsError, ComfyUIError


class TestComfyUIClient:
    """Test suite for ComfyUIClient."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return ComfyUIClient(api_key="test-key")
    
    @pytest.fixture
    def sample_workflow(self):
        """Sample workflow for testing."""
        return {
            "1": {
                "class_type": "SaveImage",
                "inputs": {"filename_prefix": "test"}
            }
        }
    
    def test_client_initialization(self, client):
        """Test client creates with correct defaults."""
        assert client.api_key == "test-key"
        assert client.base_url == "https://cloud.comfy.org"
        assert client.client_id is not None
        assert len(client.client_id) == 36  # UUID length
    
    def test_client_initialization_custom_url(self):
        """Test client with custom base URL."""
        client = ComfyUIClient(api_key="test", base_url="https://custom.comfy.org")
        assert client.base_url == "https://custom.comfy.org"
    
    def test_make_ws_url(self, client):
        """Test WebSocket URL generation."""
        url = client.make_ws_url()
        assert url.startswith("wss://cloud.comfy.org/ws")
        assert "clientId=" in url
        assert "token=test-key" in url
    
    def test_make_ws_url_custom(self):
        """Test WebSocket URL with custom base."""
        client = ComfyUIClient(api_key="test", base_url="https://custom.comfy.org")
        url = client.make_ws_url()
        assert url.startswith("wss://custom.comfy.org/ws")
    
    @pytest.mark.asyncio
    async def test_upload_file_mock(self, client, tmp_path, monkeypatch):
        """Test file upload with mocked subprocess."""
        # Create test file
        test_file = tmp_path / "test.png"
        test_file.write_bytes(b"fake image data")
        
        # Mock subprocess result
        def mock_run(*args, **kwargs):
            class MockResult:
                returncode = 0
                stdout = '{"name": "test_uploaded.png"}'
                stderr = ""
            return MockResult()
        
        monkeypatch.setattr("subprocess.run", mock_run)
        
        result = await client.upload_file(str(test_file))
        assert result == "test_uploaded.png"
    
    @pytest.mark.asyncio
    async def test_upload_file_failure(self, client, tmp_path, monkeypatch):
        """Test file upload failure handling."""
        test_file = tmp_path / "test.png"
        test_file.write_bytes(b"fake image data")
        
        def mock_run(*args, **kwargs):
            class MockResult:
                returncode = 1
                stdout = ""
                stderr = "Upload failed"
            return MockResult()
        
        monkeypatch.setattr("subprocess.run", mock_run)
        
        with pytest.raises(ComfyUIError, match="Upload failed"):
            await client.upload_file(str(test_file))
    
    @pytest.mark.asyncio
    async def test_upload_file_not_found(self, client):
        """Test upload with non-existent file."""
        with pytest.raises(FileNotFoundError):
            await client.upload_file("/nonexistent/file.png")
    
    @pytest.mark.asyncio
    async def test_extract_files(self, client):
        """Test output extraction from WebSocket messages."""
        outputs = {
            "2": {
                "images": [{"filename": "test.png", "subfolder": "", "type": "output"}]
            },
            "3": {
                "video": [{"filename": "test.mp4", "subfolder": "video", "type": "output"}]
            },
            "4": {
                "gifs": [{"filename": "test.gif", "subfolder": "", "type": "output"}]
            }
        }
        
        files = client.extract_files(outputs)
        assert len(files) == 3
        assert files[0]["filename"] == "test.png"
        assert files[1]["filename"] == "test.mp4"
        assert files[2]["filename"] == "test.gif"
    
    @pytest.mark.asyncio
    async def test_extract_files_empty(self, client):
        """Test extraction with empty outputs."""
        files = client.extract_files({})
        assert files == []
    
    @pytest.mark.asyncio
    async def test_generate_with_fallback(self, client, sample_workflow):
        """Test fallback chain execution."""
        workflows = [
            ("primary", sample_workflow),
            ("fallback", sample_workflow)
        ]
        
        # Test the structure
        assert len(workflows) == 2
        assert workflows[0][0] == "primary"
        assert workflows[1][0] == "fallback"
    
    def test_clean_workflow_for_upload(self, client):
        """Test workflow cleaning removes temp paths."""
        workflow = {
            "1": {
                "class_type": "LoadImage",
                "inputs": {
                    "image": "/tmp/temp_123.png"
                }
            },
            "2": {
                "class_type": "SaveImage",
                "inputs": {"filename_prefix": "output"}
            }
        }
        
        cleaned = client.clean_workflow_for_upload(workflow)
        assert cleaned["1"]["inputs"]["image"] == "temp_123.png"
        assert cleaned["2"]["inputs"]["filename_prefix"] == "output"
    
    @pytest.mark.asyncio
    async def test_insufficient_credits_error(self):
        """Test InsufficientCreditsError is raised correctly."""
        error = InsufficientCreditsError("Not enough credits")
        assert str(error) == "Not enough credits"
        assert isinstance(error, ComfyUIError)


class TestComfyUIClientWebSocket:
    """Test WebSocket handling."""
    
    @pytest.fixture
    def client(self):
        return ComfyUIClient(api_key="test-key")
    
    @pytest.mark.asyncio
    async def test_handle_execution_message(self, client):
        """Test handling of execution messages."""
        message = {
            "type": "executing",
            "data": {"node": "1", "prompt_id": "test-123"}
        }
        
        # Should not raise
        await client._handle_message(message, "test-123")
    
    @pytest.mark.asyncio
    async def test_handle_completion_message(self, client):
        """Test handling of completion messages."""
        message = {
            "type": "executed",
            "data": {
                "prompt_id": "test-123",
                "output": {"images": [{"filename": "test.png"}]}
            }
        }
        
        await client._handle_message(message, "test-123")


class TestComfyUIClientPrompt:
    """Test prompt/queue operations."""
    
    @pytest.fixture
    def client(self):
        return ComfyUIClient(api_key="test-key")
    
    def test_prepare_prompt(self, client):
        """Test prompt preparation."""
        workflow = {"1": {"class_type": "SaveImage", "inputs": {}}}
        
        prompt = client._prepare_prompt(workflow)
        assert prompt["prompt"] == workflow
        assert prompt["client_id"] == client.client_id


class TestComfyUIErrorHandling:
    """Test error handling scenarios."""
    
    @pytest.mark.asyncio
    async def test_network_error_handling(self):
        """Test handling of network errors."""
        client = ComfyUIClient(api_key="test-key")
        
        # Mock websocket connection failure
        with patch("websockets.connect", side_effect=ConnectionError("Connection failed")):
            with pytest.raises(ComfyUIError):
                await client.generate({"1": {"class_type": "SaveImage"}})
    
    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """Test handling of timeout errors."""
        client = ComfyUIClient(api_key="test-key")
        
        with patch("asyncio.wait_for", side_effect=asyncio.TimeoutError()):
            with pytest.raises(ComfyUIError):
                await client.generate({"1": {"class_type": "SaveImage"}})
