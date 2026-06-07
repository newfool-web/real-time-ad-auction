"""Phase 4 — live click-feedback se model retrain karta hai (online learning).

Feedback do raaston se aa sakta hai:
  • KAFKA mode (USE_KAFKA=true): 'ad-feedback' topic consume karta hai (LOCAL/full).
  • DIRECT mode (USE_KAFKA=false): engine HTTP POST /feedback bhejta hai (PROD/A1).
Dono ek hi FeedbackBuffer me jaate hain, jo har BATCH pe model retrain karta hai.
"""
import json
import logging
import os
import threading
import time

from kafka import KafkaConsumer
from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import NoBrokersAvailable, TopicAlreadyExistsError

from .data import featurize
from .model import CtrModel

logger = logging.getLogger("ml.trainer")

TOPIC = "ad-feedback"
BATCH = 100          # har itne feedback pe retrain
MAX_BUFFER = 8000    # sliding window cap (memory bound)


class FeedbackBuffer:
    """Thread-safe buffer — Kafka consumer aur HTTP endpoint dono isme add karte hain."""

    def __init__(self, model: CtrModel) -> None:
        self.model = model
        self._X: list = []
        self._y: list = []
        self._since_retrain = 0
        self._lock = threading.Lock()

    def add(self, features: dict, clicked: int) -> None:
        feats = featurize(
            features["interests"], features["device"], features["country"],
            features["hourOfDay"], features["adCategory"],
        )
        with self._lock:
            self._X.append(feats)
            self._y.append(int(clicked))
            self.model.live_samples += 1
            self._since_retrain += 1
            if len(self._X) > MAX_BUFFER:
                self._X = self._X[-MAX_BUFFER:]
                self._y = self._y[-MAX_BUFFER:]
            ready = self._since_retrain >= BATCH
            if ready:
                self._since_retrain = 0
                X, y = list(self._X), list(self._y)
        if ready:
            self.model.retrain_live(X, y)  # lock ke bahar (CPU-heavy)


def start_consumer(buffer: FeedbackBuffer, broker: str) -> None:
    """Sirf KAFKA mode me background consumer chalao."""
    if os.environ.get("USE_KAFKA", "true") == "false":
        logger.info("USE_KAFKA=false -> kafka consumer skip (feedback HTTP se aayega)")
        return
    threading.Thread(target=_run, args=(buffer, broker), daemon=True).start()


def _ensure_topic(broker: str) -> None:
    try:
        admin = KafkaAdminClient(bootstrap_servers=broker)
        try:
            admin.create_topics([NewTopic(name=TOPIC, num_partitions=1, replication_factor=1)])
        except TopicAlreadyExistsError:
            pass
        admin.close()
    except Exception as e:  # broker abhi ready nahi — consumer connect loop handle karega
        logger.info("ensure_topic skipped: %s", e)


def _connect(broker: str) -> KafkaConsumer:
    while True:
        try:
            return KafkaConsumer(
                TOPIC,
                bootstrap_servers=broker,
                group_id="ml-trainer",
                auto_offset_reset="latest",
                value_deserializer=lambda v: v.decode("utf-8"),
            )
        except NoBrokersAvailable:
            logger.info("kafka not ready, retrying in 2s...")
            time.sleep(2)


def _run(buffer: FeedbackBuffer, broker: str) -> None:
    _ensure_topic(broker)
    consumer = _connect(broker)
    logger.info("consuming %s for live retraining", TOPIC)

    for msg in consumer:
        try:
            evt = json.loads(msg.value)
            if evt.get("type") != "ad-feedback":
                continue
            buffer.add(evt["features"], int(evt["clicked"]))
        except Exception as e:
            logger.warning("bad feedback msg: %s", e)
