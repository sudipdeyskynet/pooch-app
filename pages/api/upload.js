import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CORS similar to your pooch route
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ ok: false, error: "Form parse error" });
    if (!files.file) return res.status(400).json({ ok: false, error: "No file uploaded" });

    const f = files.file;
    try {
      // 1) Ask Shopify for a staged upload target
      const stagedQuery = `
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters { name value }
            }
            userErrors { field message }
          }
        }
      `;
      const variables = {
        input: [{
          filename: f.originalFilename,
          mimeType: f.mimetype,
          resource: "FILE",
          fileSize: fs.statSync(f.filepath).size.toString(),
        }],
      };

      const stagedResp = await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query: stagedQuery, variables }),
      });
      const stagedJson = await stagedResp.json();

      const errList = stagedJson?.data?.stagedUploadsCreate?.userErrors || [];
      if (errList.length) return res.status(400).json({ ok: false, error: errList });

      const target = stagedJson?.data?.stagedUploadsCreate?.stagedTargets?.[0];
      if (!target) return res.status(500).json({ ok: false, error: "No staged upload target" });

      // 2) Upload the file to Shopify’s staged S3 URL
      const s3Form = new FormData();
      target.parameters.forEach(p => s3Form.append(p.name, p.value));
      s3Form.append("file", fs.createReadStream(f.filepath));

      const s3Resp = await fetch(target.url, { method: "POST", body: s3Form });
      if (!s3Resp.ok) {
        const text = await s3Resp.text();
        return res.status(502).json({ ok: false, error: "S3 upload failed", details: text });
      }

      // 3) Finalize the file in Shopify Files to get a File GID
      const fileCreateMutation = `
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files { id }
            userErrors { field message }
          }
        }
      `;
      const fcVars = {
        files: [{
          originalSource: target.resourceUrl, // from stagedUploadsCreate
          contentType: "IMAGE",              // ensures a MediaImage is created
        }],
      };

      const fcResp = await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query: fileCreateMutation, variables: fcVars }),
      });
      const fcJson = await fcResp.json();

      const fcErrors = fcJson?.data?.fileCreate?.userErrors || [];
      if (fcErrors.length) return res.status(400).json({ ok: false, error: fcErrors });

      const fileGid = fcJson?.data?.fileCreate?.files?.[0]?.id;
      if (!fileGid) return res.status(500).json({ ok: false, error: "No file GID returned" });

      // 4) Return the GID to the frontend
      return res.status(200).json({ ok: true, image_file_gid: fileGid });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });
}
