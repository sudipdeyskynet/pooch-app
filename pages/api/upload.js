import { IncomingForm } from "formidable";
import fs from "fs";
import fetch from "node-fetch";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const form = new IncomingForm();

    // Parse form data as promise
    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = data.files.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // Validate JPG
    if (!["image/jpeg", "image/jpg", "image/pjpeg"].includes(file.mimetype)) {
  return res.status(400).json({ message: "Only JPG images are allowed" });
}


    // Read file as Base64
    const fileData = fs.readFileSync(file.filepath);
    const base64Data = fileData.toString("base64");

    // Upload to Shopify
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

    const resultText = await shopifyResponse.text();
    let resultJson;
    try {
      resultJson = JSON.parse(resultText);
    } catch (e) {
      return res.status(500).json({ message: "Shopify returned invalid JSON", resultText });
    }

    if (shopifyResponse.ok) {
      return res.status(200).json({ message: "JPG image uploaded!", result: resultJson });
    } else {
      return res.status(shopifyResponse.status).json({ message: "Shopify error", result: resultJson });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}
