const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Fixture</title></head>
<body><a href="https://norixo.io/">Norixo</a></body>
</html>`;

export function GET() {
  return new Response(FIXTURE_HTML, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
