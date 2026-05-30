import json
import uuid
import base64
import random
import tomllib
import logging
import asyncio
import httpx
import websockets
import uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from .config import ComfyUIConfig, OpenAIConfig, Config
from .prompts import CREATE_PROMPT, KEEP_PROMPT, BE_PROMPT, HE_PROMPT, THEME_PROMPT, IMAGE_PROMPT

logger = logging.getLogger(__name__)


class ComfyUI:
    def __init__(self, config: ComfyUIConfig):
        self.running = False
        self.client_id = str(uuid.uuid4())
        server_address = f"127.0.0.1:{config.port}"
        self.prompt_url = f"http://{server_address}/prompt"
        self.view_url = f"http://{server_address}/view"
        self.ws_url = f"ws://{server_address}/ws?clientId={self.client_id}"
        self.workflow = Path(config.workflow_json_path).read_text(encoding="utf-8")
        self.consumer_timeout = config.consumer_timeout
        *self.prompt_keys, self.prompt_last_key = config.prompt_keys
        self.__image_params: dict[str, dict] = {}

    def set_prompt(self, prompt_data: dict, prompt_text: str) -> None:
        """
        设置提示词

        :param prompt_text: 提示词
        :param prompt_data: 提示词数据
        """
        current = prompt_data
        for key in self.prompt_keys:
            current = current[key]
        current[self.prompt_last_key] = prompt_text

    async def receive_serve(self):
        self.running = True
        while self.running:
            try:
                async with websockets.connect(self.ws_url) as ws:
                    async for message in ws:
                        if not isinstance(message, str):
                            continue
                        try:
                            data = json.loads(message)
                            if data["type"] != "executed":
                                continue
                            prompt_id = data["data"]["prompt_id"]
                            image_param = data["data"]["output"]["images"][-1]
                            image_param = {
                                "filename": image_param["filename"],
                                "subfolder": image_param["subfolder"],
                                "type": image_param["type"],
                            }
                            self.__image_params[prompt_id] = image_param
                            asyncio.get_running_loop().call_later(self.consumer_timeout, self.cleanup, prompt_id, image_param)
                        except (json.JSONDecodeError, KeyError):
                            continue
                        except Exception as e:
                            logger.error(f"Error processing WebSocket message: {e!r}")
                            continue
            except Exception as e:
                logger.error(f"Error in WebSocket connection: {e!r}")
                logger.info("WebSocket connection closed, retrying in 3 seconds...")
            await asyncio.sleep(3)

    def cleanup(self, prompt_id: str, image_param: dict):
        if prompt_id in self.__image_params and self.__image_params[prompt_id] is image_param:
            del self.__image_params[prompt_id]

    async def generate_image(self, client: httpx.AsyncClient, prompt_text: str):
        """
        通过 ComfyUI API 异步生成图片并返回 Base64 编码
        """
        workflow = json.loads(self.workflow)
        self.set_prompt(workflow, prompt_text)
        resp = await client.post(self.prompt_url, json={"prompt": workflow, "client_id": self.client_id})
        resp.raise_for_status()
        prompt_id: str = resp.json()["prompt_id"]
        return prompt_id

    async def view_image(self, client: httpx.AsyncClient, prompt_id: str):
        if prompt_id in self.__image_params:
            image_param = self.__image_params.pop(prompt_id)
            resp = await client.get(self.view_url, params=image_param)
            resp.raise_for_status()
            return resp.content


class OpenAIAPI:
    def __init__(self, config: OpenAIConfig) -> None:
        self.url = f"{config.url.rstrip("/")}/chat/completions"
        self.model = config.model
        self.headers = {"Authorization": f"Bearer {config.api_key}", "Content-Type": "application/json"}

    def buildpayload(self, system_prompt: str, user_prompt: str = "") -> dict:
        return {
            "model": self.model,
            "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        }

    async def call_api(self, client: httpx.AsyncClient, payload: dict):
        resp = await client.post(self.url, headers=self.headers, json=payload)
        resp.raise_for_status()
        try:
            data = resp.json()
            message = data["choices"][0]["message"]
        except Exception as e:
            raise RuntimeError(f"Failed to parse API response {resp.text}") from e
        if "content" not in message and "tool_calls" not in message:
            raise ValueError(f"API returned an invalid response: {resp.text}")
        return message

    async def call_api_stream(self, client: httpx.AsyncClient, payload: dict):
        payload["stream"] = True
        async with client.stream("POST", self.url, headers=self.headers, json=payload) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                raise RuntimeError(f"API error ({response.status_code}): {error_text.decode('utf-8')}")
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                if line.startswith("data:"):
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        content = json.loads(data_str)["choices"][0]["delta"]["content"]
                        if content:
                            yield f"data: {json.dumps(content)}\n\n"
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue


class Server:
    def __init__(self, config_file: str):
        with open(config_file, "rb") as f:
            config = Config.model_validate(tomllib.load(f))
        self.host = config.host
        self.port = config.port
        self.client = httpx.AsyncClient(trust_env=False, timeout=60.0)
        self.comfy_ui = ComfyUI(config.comfy_ui)
        self.openai = OpenAIAPI(config.openai)
        self.app = FastAPI(root_path="/api", lifespan=self.lifespan)
        self.app.add_middleware(
            CORSMiddleware,
            allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
            allow_credentials=True,
            allow_methods=["POST", "GET", "OPTIONS"],
            allow_headers=["Content-Type", "Authorization"],
            expose_headers=["Content-Length"],
            max_age=600,
        )
        self.app.post("/if-start")(self.if_start)
        self.app.post("/if-keep")(self.if_keep)
        self.app.post("/if-be")(self.if_be)
        self.app.post("/if-he")(self.if_he)
        self.app.post("/generate-colors")(self.generate_colors)
        self.app.post("/generate-image")(self.generate_image)
        self.app.get("/view-image")(self.view_image)

    @asynccontextmanager
    async def lifespan(self, app: FastAPI):
        loop = asyncio.get_running_loop()
        ws_task = loop.create_task(self.comfy_ui.receive_serve())
        logger.info("ComfyUI WebSocket receiver started.")
        yield
        self.comfy_ui.running = False
        ws_task.cancel()
        await self.client.aclose()
        logger.info("ComfyUI WebSocket receiver stopped.")

    async def if_start(self, request: Request):
        content = await request.body()
        if not content:
            raise HTTPException(status_code=400, detail="Request body cannot be empty.")
        content = content.decode("utf-8")
        payload = self.openai.buildpayload(CREATE_PROMPT, content)
        payload["response_format"] = {"type": "json_object"}
        try:
            return StreamingResponse(self.openai.call_api_stream(self.client, payload), media_type="text/event-stream")
        except Exception as err:
            logger.exception(err)
            raise HTTPException(status_code=500, detail=str(err))

    async def if_keep(self, request: Request):
        content = await request.body()
        if not content:
            raise HTTPException(status_code=400, detail="Request body cannot be empty.")
        content = content.decode("utf-8")
        payload = self.openai.buildpayload(KEEP_PROMPT, content)
        payload["response_format"] = {"type": "json_object"}
        try:
            return StreamingResponse(self.openai.call_api_stream(self.client, payload), media_type="text/event-stream")
        except Exception as err:
            raise HTTPException(status_code=500, detail=str(err))

    # 3. 改为流式
    async def if_be(self, request: Request):
        content = await request.body()
        if not content:
            raise HTTPException(status_code=400, detail="Request body cannot be empty.")
        content = content.decode("utf-8")
        payload = self.openai.buildpayload(BE_PROMPT, content)
        try:
            return StreamingResponse(self.openai.call_api_stream(self.client, payload), media_type="text/event-stream")
        except Exception as err:
            raise HTTPException(status_code=500, detail=str(err))

    # 4. 改为流式
    async def if_he(self, request: Request):
        content = await request.body()
        if not content:
            raise HTTPException(status_code=400, detail="Request body cannot be empty.")
        content = content.decode("utf-8")
        payload = self.openai.buildpayload(HE_PROMPT, content)
        try:
            return StreamingResponse(self.openai.call_api_stream(self.client, payload), media_type="text/event-stream")
        except Exception as err:
            raise HTTPException(status_code=500, detail=str(err))

    async def generate_colors(self, request: Request):
        content = await request.body()
        content = content.decode("utf-8")
        payload = self.openai.buildpayload(THEME_PROMPT, content)
        payload["response_format"] = {"type": "json_object"}
        try:
            message = await self.openai.call_api(self.client, payload)
            return JSONResponse(content=json.loads(message["content"]))
        except Exception as err:
            raise HTTPException(status_code=500, detail=str(err))

    async def generate_image(self, request: Request):
        content = await request.body()
        content = content.decode("utf-8")
        payload = self.openai.buildpayload(IMAGE_PROMPT, content)
        try:
            message = await self.openai.call_api(self.client, payload)
            prompt_id = await self.comfy_ui.generate_image(self.client, message["content"])
            return JSONResponse(content={"prompt_id": prompt_id})
        except Exception as err:
            logger.exception(err)
            raise HTTPException(status_code=500, detail=str(err))

    async def view_image(self, prompt_id: str):
        try:
            raw = await self.comfy_ui.view_image(self.client, prompt_id)
            if raw is None:
                return JSONResponse(content={"status": "waiting", "message": "", "raw": ""})
            else:
                return JSONResponse(content={"status": "ok", "message": "", "raw": base64.b64encode(raw).decode("utf-8")})
        except Exception as err:
            return JSONResponse(content={"status": "error", "message": str(err), "raw": ""})

    def run(self):
        uvicorn.run(self.app, host=self.host, port=self.port)
