// Vercel serves the SPA directly, so its API must be explicitly configured.
if (process.env.VERCEL === "1") {
  let valid = false;
  try {
    const url = new URL(process.env.VITE_API_URL?.trim() ?? "");
    valid =
      url.protocol === "https:" &&
      url.pathname.replace(/\/+$/, "") === "/api/v1" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;
  } catch {
    // Report the required shape without echoing environment variable contents.
  }
  if (!valid) {
    console.error(
      "Set VITE_API_URL to https://YOUR_API_DOMAIN/api/v1 in Vercel before building.",
    );
    process.exit(1);
  }
}
