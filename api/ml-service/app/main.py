"""FastAPI app — boot pe synthetic train, fir live stream se retrain, /predict pCTR deta hai."""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel

from .model import CtrModel
from .trainer import FeedbackBuffer, start_consumer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ml] %(message)s")
logger = logging.getLogger("ml.main")

ctr_model = CtrModel()
feedback_buffer = FeedbackBuffer(ctr_model)  # Kafka consumer + HTTP /feedback dono isme add karte hain


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Training CTR model on synthetic data...")
    ctr_model.train()  # boot pe baseline (predictions turant available)
    # Phase 4: KAFKA mode me background consumer; DIRECT mode me /feedback HTTP se aayega.
    start_consumer(feedback_buffer, os.environ.get("KAFKA_BROKER", "localhost:9092"))
    yield


app = FastAPI(title="RTB CTR Service", lifespan=lifespan)


class PredictRequest(BaseModel):
    interests: list[str]
    device: str
    country: str
    hourOfDay: int
    adCategory: str


class PredictResponse(BaseModel):
    ctr: float


@app.get("/health")
def health():
    return {
        "status": "ok",
        "auc": round(ctr_model.auc, 3),
        "source": ctr_model.source,        # "synthetic" ya "live-stream"
        "liveSamples": ctr_model.live_samples,
        "retrains": ctr_model.retrains,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    ctr = ctr_model.predict(
        req.interests, req.device, req.country, req.hourOfDay, req.adCategory
    )
    return PredictResponse(ctr=round(ctr, 4))


class FeedbackFeatures(BaseModel):
    interests: list[str]
    device: str
    country: str
    hourOfDay: int
    adCategory: str


class FeedbackRequest(BaseModel):
    features: FeedbackFeatures
    clicked: int


@app.post("/feedback")
def feedback(req: FeedbackRequest):
    # DIRECT mode (USE_KAFKA=false): engine yahan click feedback bhejta hai -> live retrain.
    feedback_buffer.add(req.features.model_dump(), req.clicked)
    return {"ok": True}
