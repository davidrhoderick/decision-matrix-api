import lucia from "./auth/index";

const validateSession = async (authorization?: string | null) => {
  const sessionId = lucia.readBearerToken(authorization ?? "");

  if (!sessionId) {
    return { session: false, user: false };
  }

  const session = await lucia.validateSession(sessionId);
  
  if (!session.user?.emailVerified) {
    return { session: false, user: false };
  }

  return session;
};

export default validateSession;
