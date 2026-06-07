"""CTR model — Logistic Regression (yahi RTB me classically use hota tha)."""
import logging
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

from .data import make_dataset, featurize

logger = logging.getLogger("ml.model")


class CtrModel:
    def __init__(self) -> None:
        self.model: LogisticRegression | None = None
        self.auc: float = 0.0
        self.source: str = "none"  # "synthetic" (boot) ya "live-stream" (retrained)
        self.live_samples: int = 0  # ab tak stream se kitne feedback aaye
        self.retrains: int = 0

    def train(self) -> None:
        # Boot pe synthetic data se baseline model (predictions turant available).
        X, y = make_dataset()
        X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=1)
        clf = LogisticRegression(max_iter=500)
        clf.fit(X_tr, y_tr)
        preds = clf.predict_proba(X_te)[:, 1]
        self.auc = float(roc_auc_score(y_te, preds))
        self.model = clf
        self.source = "synthetic"
        logger.info("CTR model trained (synthetic). Holdout AUC=%.3f", self.auc)

    def retrain_live(self, X, y) -> None:
        # Phase 4: live ad-feedback stream se retrain. Naya clf banake atomically swap.
        X = np.array(X, dtype=float)
        y = np.array(y, dtype=int)
        if len(set(y.tolist())) < 2:
            return  # dono classes (click/no-click) chahiye warna fit nahi hota
        clf = LogisticRegression(max_iter=500)
        clf.fit(X, y)
        # AUC sirf tab jab dono classes hon (yahan hain).
        try:
            self.auc = float(roc_auc_score(y, clf.predict_proba(X)[:, 1]))
        except ValueError:
            pass
        self.model = clf  # atomic swap (CPython attribute assignment)
        self.retrains += 1
        self.source = "live-stream"
        logger.info("CTR model retrained (live). samples=%d AUC=%.3f", len(y), self.auc)

    def predict(self, interests, device, country, hour, ad_category) -> float:
        if self.model is None:
            raise RuntimeError("model not trained")
        feats = np.array([featurize(interests, device, country, hour, ad_category)])
        return float(self.model.predict_proba(feats)[0, 1])
