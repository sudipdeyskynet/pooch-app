import fetch from "node-fetch";

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*"); // আপনার Shopify domain ব্যবহার করতে পারেন
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // OPTIONS request handle
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { filename, file_base64 } = req.body || {};

  if (!filename || !file_base64) {
    return res.status(400).json({ ok: false, error: "File data required" });
  }

  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  try {
    const response = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-10/files.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({
          file: {
            attachment: file_base64,
            filename
          }
        })
      }
    );

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch (err) {
      console.error("Shopify raw response:", text);
      return res.status(500).json({
        ok: false,
        error: "Invalid JSON from Shopify: " + text
      });
    }

    if (result.file && result.file.id) {
      return res.status(200).json({
        ok: true,
        gid: `gid://shopify/File/${result.file.id}`
      });
    } else {
      return res.status(400).json({ ok: false, error: result });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
