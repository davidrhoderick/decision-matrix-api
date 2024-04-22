import db from "@/lib/db";
import { DatabaseUser, emailVerificationTable } from "./models";
import { generateId } from "lucia";
import { eq } from "drizzle-orm";
import { TimeSpan, createDate } from "oslo";
import { Resend } from "resend";
import { InternalServerError } from "elysia";

const resend = new Resend(process.env.RESEND_API_KEY);

const emailVerificationToken = async (user: DatabaseUser) => {
  await db
    .delete(emailVerificationTable)
    .where(eq(emailVerificationTable.userId, user.id));
  const tokenId = generateId(40);
  const [{ id: emailVerificationToken }] = await db
    .insert(emailVerificationTable)
    .values({
      id: tokenId,
      email: user.email,
      userId: user.id,
      expiresAt: createDate(new TimeSpan(2, "h")).toString(),
    })
    .returning({ id: emailVerificationTable.id });

  try {
    await resend.emails.send({
      from: "decision-matrix@afabl.com",
      to: user.email,
      subject: "Confirm your email address",
      html: `<h1>Confirm your email address</h1>
          <p>Please confirm your email address by clicking on the link below:</p>
          
          <a href="${process.env.BACKEND_URL}/confirm-email/${emailVerificationToken}">${process.env.BACKEND_URL}/confirm-email/${emailVerificationToken}</a>
          
          <p>Then you will be able to start using the application</p>
          
          <p>~Dave</p>`,
    });
  } catch (error) {
    console.error(error);
    throw new InternalServerError("Unable to send confirmation email");
  }
};

export default emailVerificationToken;
