// Hidden "true" click behaviour — ML model live stream se isi pattern ko seekhta hai.
// Ye intentionally ML service ke training data ke hidden rule jaisa hai, taaki
// online retraining same truth pe converge kare (online learning ka demo).
import { UserContext } from "@rtb/shared";

export function simulateClick(user: UserContext, adCategory: string): 0 | 1 {
  let p = 0.02;
  if (user.interests.includes(adCategory)) p += 0.06; // relevant ad -> zyada click
  if (user.device === "mobile") p += 0.015;
  if (user.hourOfDay >= 18 && user.hourOfDay <= 22) p += 0.02; // prime time
  if (adCategory === "automobile") p -= 0.01; // high-consideration -> click thoda kam
  p = Math.min(Math.max(p, 0.001), 0.5);
  return Math.random() < p ? 1 : 0;
}
