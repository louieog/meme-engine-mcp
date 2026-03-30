# ComfyUI Workflow Templates

This directory contains ComfyUI workflow templates in API format for different generation tasks.

## Workflow Files

### Image Generation
- `character-image-api.json` - Generate character reference images
- `character-image-manifest.json` - Parameter manifest for customization

### Video Generation
- `image-to-video-api.json` - Convert images to video clips
- `image-to-video-manifest.json` - Parameter manifest
- `kling-v3-omni-i2v-api.json` - Kling v3 Omni Pro image-to-video
- `kling-v3-omni-i2v-manifest.json` - Parameter manifest

### Audio Generation
- `tts-dialogue-api.json` - Text-to-speech with ElevenLabs
- `tts-dialogue-manifest.json` - Parameter manifest

### Post-Processing
- `lip-sync-api.json` - Synchronize video with audio
- `lip-sync-manifest.json` - Parameter manifest

## Usage

Workflows are loaded and customized by the `workflow_builders.py` module:

```python
from src.python.workflow_builders import load_template, customize_template

# Load base template
template = load_template("character-image-api")

# Apply custom parameters
customized = customize_template(template, {
    "prompt": "A funny cat wearing a suit",
    "aspect_ratio": "9:16",
    "seed": 42
})
```

## Manifest Format

Manifest files define which parameters can be dynamically injected:

```json
{
  "name": "character-image",
  "dynamic_params": {
    "1": {
      "prompt": "scene.visual",
      "seed": "parameters.seed"
    }
  }
}
```

## Adding New Workflows

1. Create `{name}-api.json` with ComfyUI API format
2. Create `{name}-manifest.json` defining dynamic parameters
3. Add builder method to `workflow_builders.py`
4. Register in appropriate BUILDERS dict
