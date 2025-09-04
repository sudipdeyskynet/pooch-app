import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false, // allow formidable to handle form-data
  },
};

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

      const fd = new FormData();
      fd.append("file", fs.createReadStream(file.filepath));
      fd.append("purpose", "IMAGE");

      const response = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2025-10/files.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
          ...fd.getHeaders(),
        },
        body: fd,
      });

      const result = await response.json();
      if (result.errors) return res.status(400).json({ ok: false, error: result.errors });

      return res.status(200).json({ ok: true, file: result.file });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });
}
