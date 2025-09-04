import formidable from "formidable";
import fs from "fs";
import fetch from "node-fetch";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  // ✅ Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow all origins
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ message: err.message });

    const file = files.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // Validate file type
    const mimeType = file.mimetype || "";
    if (!["image/jpeg", "image/jpg"].includes(mimeType)) {
      return res.status(400).json({ message: "Only JPG images are allowed" });
    }

    // Read file as Base64
    const fileData = fs.readFileSync(file.filepath);
    const base64Data = fileData.toString("base64");

    // Upload to Shopify Files
    const shopifyResponse = await fetch(
      "https://YOUR_STORE.myshopify.com/admin/api/2025-10/files.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          file: {
            attachment: base64Data,
            filename: file.originalFilename,
          },
        }),
      }
    );

    const result = await shopifyResponse.json();

    if (shopifyResponse.ok) {
      res.status(200).json({ message: "JPG image uploaded!", result });
    } else {
      res.status(shopifyResponse.status).json({ message: "Shopify error", result });
    }
  });
}
