import { cookies } from "next/headers";

import {
  findSessionUser,
  SESSION_COOKIE_NAME,
} from "@/modules/auth/session.service";

import type { AuthUser } from "@/modules/auth/auth.types";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return findSessionUser(token);
}