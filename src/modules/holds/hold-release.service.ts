import {
  releaseHoldTransaction,
  type ReleasedHoldResult,
} from "./hold-release.repository";

type ReleaseSeatHoldInput = {
  holdId: string;
  userId: string;
  isAdmin: boolean;
};

export function releaseSeatHold(
  input: ReleaseSeatHoldInput,
): Promise<ReleasedHoldResult> {
  return releaseHoldTransaction(input);
}