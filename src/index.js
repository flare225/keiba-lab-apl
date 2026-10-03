const json = (data, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS", "access-control-allow-headers": "content-type" } });

    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "keiba-lab-api",
        version: "0.1.0",
        updated_at: new Date().toISOString(),
        missing: env.DB ? [] : ["D1 binding: DB"],
      });
    }

    if (url.pathname === "/v1/meetings/today") {
      if (!env.DB) {
        return json({ ok: false, error: "D1 binding DB is not configured", meetings: [] }, 503);
      }

      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      try {
        const result = await env.DB.prepare(
          `SELECT * FROM races WHERE race_date = ? ORDER BY venue, race_no`
        ).bind(today).all();

        return json({
          ok: true,
          date: today,
          updated_at: new Date().toISOString(),
          meetings: result.results ?? [],
        });
      } catch (error) {
        return json({ ok: false, error: String(error), meetings: [] }, 500);
      }
    }

    return json({ ok: false, error: "Not Found" }, 404);
  },

  async scheduled(event, env, ctx) {
    // Cron entry point. Data acquisition/normalization is added in the next stage.
    console.log("keiba-lab scheduled update", new Date(event.scheduledTime).toISOString());
  },
};
