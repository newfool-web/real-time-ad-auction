// ML service ko call karke pCTR lete hain. Fail ho to safe fallback.
import axios from "axios";
import { PredictResponse, UserContext } from "@rtb/shared";
import { config } from "./config";
import { logger } from "./logger";

const client = axios.create({ baseURL: config.mlServiceUrl, timeout: 60 });

export async function predictCtr(user: UserContext): Promise<number> {
  try {
    const { data } = await client.post<PredictResponse>("/predict", {
      interests: user.interests,
      device: user.device,
      country: user.country,
      hourOfDay: user.hourOfDay,
      adCategory: config.adCategory,
    });
    return data.ctr;
  } catch (err) {
    // ML down ho to bidder ko block mat karo — conservative fallback.
    logger.warn({ err: (err as Error).message }, "ml predict failed, using fallback");
    return 0.01;
  }
}
