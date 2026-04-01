import { auth } from "./server";

export async function requireUserId(): Promise<string> {
  const session = await auth.getSession();
  if (!session?.data?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.data.user.id;
}
