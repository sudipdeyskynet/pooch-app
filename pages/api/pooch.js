import fetch from "node-fetch";
import formidable from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  // Parse multipart form (text fields + file)
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ ok: false, error: "Form parse error" });

    const { name, customer_id, breed, birthday, weight, notes } = fields;
    if (!name || !customer_id) return res.status(400).json({ ok: false, error: "Name and customer_id are required" });

    let image_file_gid = null;

    try {
      // ✅ Step 1: If image uploaded, push to Shopify
      if (files.image) {
        const fileStats = fs.statSync(files.image.filepath);

        const uploadQuery = `
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

        const uploadVariables = {
          input: [
            {
              filename: files.image.originalFilename,
              mimeType: files.image.mimetype,
              resource: "FILE",
              fileSize: fileStats.size.toString(),
            },
          ],
        };

        const uploadRes = await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          },
          body: JSON.stringify({ query: uploadQuery, variables: uploadVariables }),
        });

        const uploadJson = await uploadRes.json();
        const stagedTarget = uploadJson.data.stagedUploadsCreate.stagedTargets[0];

        // Upload file to Shopify’s storage
        const formData = new FormData();
        stagedTarget.parameters.forEach(p => formData.append(p.name, p.value));
        formData.append("file", fs.createReadStream(files.image.filepath));

        await fetch(stagedTarget.url, { method: "POST", body: formData });

        // Use resourceUrl as the file GID
        image_file_gid = stagedTarget.resourceUrl;
      }

      // ✅ Step 2: Create Metaobject
      const fieldsArr = [
        { key: "name", value: name },
        { key: "breed", value: breed || "" },
        { key: "birthday", value: birthday || "" },
        { key: "weight", value: weight ? weight.toString() : "" },
        { key: "notes", value: notes || "" },
        { key: "customer_id", value: `gid://shopify/Customer/${customer_id}` },
      ];

      if (image_file_gid) fieldsArr.unshift({ key: "image", value: image_file_gid });

      const metaQuery = `
        mutation {
          metaobjectCreate(
            metaobject: {
              type: "pooch_profile",
              fields: ${JSON.stringify(fieldsArr).replace(/"([^"]+)":/g, '$1:')}
            }
          ) {
            metaobject { id type fields { key value } }
            userErrors { field message }
          }
        }
      `;

      const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query: metaQuery }),
      });

      const result = await response.json();
      if (result.errors) return res.status(500).json({ ok: false, error: result.errors });
      if (result.data.metaobjectCreate.userErrors.length > 0)
        return res.status(400).json({ ok: false, error: result.data.metaobjectCreate.userErrors });

      res.status(200).json({ ok: true, data: result.data.metaobjectCreate.metaobject });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}
