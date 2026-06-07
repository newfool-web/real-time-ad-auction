// Simulated traffic — random publisher ad requests banata hai.
import { AdRequest } from "@rtb/shared";

// Categories jin pe advertisers target karte hain (real industries):
//   sports      -> Nike, Adidas, Yonex
//   electronics -> Samsung
//   food        -> McDonald's
//   watches     -> Rolex
//   automobile  -> BMW
//   beauty      -> Nykaa
const ADVERTISER_INTERESTS = ["sports", "electronics", "food", "watches", "automobile", "beauty"];
// Noise interests — inpe koi advertiser target nahi karta.
const NOISE_INTERESTS = ["travel", "news", "gaming"];
const DEVICES = ["mobile", "desktop", "tablet"] as const;
const COUNTRIES = ["IN", "US", "UK", "DE"];
const SLOTS = ["300x250", "728x90", "160x600"];

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function randomAdRequest(): AdRequest {
  // Har category ko ~42% chance. Expected matched advertisers ~3-4 per slot
  // (sports=3 brands, baaki 1-2). Realistic 3-4 bid auctions.
  const interests = ADVERTISER_INTERESTS.filter(() => Math.random() < 0.42);
  if (Math.random() < 0.25) interests.push(pick(NOISE_INTERESTS));
  // Fill rate ke liye guarantee karo ki kam se kam ek advertiser-interest ho.
  if (!interests.some((i) => ADVERTISER_INTERESTS.includes(i))) {
    interests.push(pick(ADVERTISER_INTERESTS));
  }

  return {
    slotSize: pick(SLOTS),
    // Floor thoda kam -> zyada bids floor clear karte hain -> zyada bids per auction.
    floorPrice: Number((0.05 + Math.random() * 0.12).toFixed(2)),
    user: {
      interests,
      device: pick(DEVICES),
      country: pick(COUNTRIES),
      hourOfDay: new Date().getHours(),
    },
  };
}
