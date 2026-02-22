import { Resend } from "resend";

export default {
  async scheduled(event, env, ctx) {
    const resend = new Resend(env.RESEND_API_KEY);

    if (event.cron === "0 6 * * *") {
      // DAILY at 06:00 UTC
      const html = await fetch(env.PUBLIC_URL + "/api/rate-digest?type=daily")
        .then((r) => r.text());

      await resend.emails.send({
        from: "Digest <digest@everydaytools.uk>",
        to: "ahmadzoury@gmail.com",
        subject: "Daily Rate Digest",
        html
      });
    }

    if (event.cron === "0 7 * * 0") {
      // WEEKLY every Sunday at 07:00 UTC
      const html = await fetch(env.PUBLIC_URL + "/api/rate-digest?type=weekly")
        .then((r) => r.text());

      await resend.emails.send({
        from: "Digest <digest@everydaytools.uk>",
        to: "ahmadzoury@gmail.com",
        subject: "Weekly Rate Digest",
        html
      });
    }
  }
};