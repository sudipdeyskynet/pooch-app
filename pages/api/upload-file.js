import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false, // FormData handle
  },
};

import formidable from "formidable";
import fs from "fs";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });

    const file = files.file;
    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

    try {
      const buffer = fs.readFileSync(file.filepath);

      const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-10/files.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({
          file: {
            attachment: buffer.toString("base64"),
            filename: file.originalFilename
          }
        })
      });

      const result = await response.json();

      if (result.file && result.file.id) {
        res.status(200).json({ ok: true, gid: `gid://shopify/File/${result.file.id}` });
      } else {
        res.status(400).json({ ok: false, error: result });
      }

    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}
