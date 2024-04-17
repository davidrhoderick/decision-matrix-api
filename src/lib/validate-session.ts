import lucia from "./auth";

const validateSession = async (authorization?: string | null) => {
  const sessionId = lucia.readBearerToken(authorization ?? "");

  if (!sessionId) {
    return { session: false, user: false };
  }

  return lucia.validateSession(sessionId);
};

export default validateSession;
