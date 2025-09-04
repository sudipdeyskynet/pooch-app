import formidable from "formidable";
import fetch from "node-fetch";
import fs from "fs/promises";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });

    try {
      const file = files.image;
      if (!file) return res.status(400).json({ ok: false, error: "No file uploaded" });

      console.log("File received:", file.originalFilename, file.filepath);

      // Read file as buffer
      const buffer = await fs.readFile(file.filepath);

      // Create multipart/form-data manually
      const FormData = require("form-data");
      const fd = new FormData();
      fd.append("file", buffer, { filename: file.originalFilename });
      fd.append("purpose", "IMAGE");

      const response = await fetch(
        `https://${process.env.SHOPIFY_STORE}/admin/api/2025-10/files.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
            ...fd.getHeaders(),
          },
          body: fd,
        }
      );

      const result = await response.json();
      console.log("Shopify file upload response:", result);

      if (result.errors) return res.status(400).json({ ok: false, error: result.errors });

      res.status(200).json({ ok: true, file: result.file });
    } catch (e) {
      console.error("Upload error:", e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}
