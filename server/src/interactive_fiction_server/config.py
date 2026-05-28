from pydantic import BaseModel


class OpenAIConfig(BaseModel):
    url: str = "https://api.deepseek.com"
    model: str = "deepseek-v4-flash"
    api_key: str = "sk-xxx"


class ComfyUIConfig(BaseModel):
    port: int = 8000
    prompt_keys: list[str] = ["76", "inputs", "value"]
    workflow_json_path: str = "./image_flux2_klein_text_to_image.json"
    consumer_timeout: int = 600


class Config(BaseModel):
    host: str = "127.0.0.1"
    port: int = 11005
    openai: OpenAIConfig = OpenAIConfig()
    comfy_ui: ComfyUIConfig = ComfyUIConfig()
