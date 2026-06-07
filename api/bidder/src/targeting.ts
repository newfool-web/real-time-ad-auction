import { UserContext } from "@rtb/shared";
import { config } from "./config";

/** Targeting: agar bidder ke target interests hain to user ke saath overlap chahiye. */
export function matchesTargeting(user: UserContext): boolean {
  if (config.targetInterests.length === 0) return true; // generic bidder sabko target karta hai
  return config.targetInterests.some((t) => user.interests.includes(t));
}
