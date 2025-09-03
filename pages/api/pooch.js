import fetch from "node-fetch";

export default async function handler(req, res) {
  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*"); // live use: replace "*" with your Shopify domain
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle OPTIONS preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { 
    name, 
    customer_id, 
    breed, 
    birthday, 
    weight, 
    notes, 
    image_file_gid 
  } = req.body || {};

  // Required fields check
  if (!name || !customer_id) {
    return res.status(400).json({ ok: false, error: "Name and customer_id are required" });
  }

  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  // Build fields array
  const fields = [
    { key: "name", value: name },
    { key: "breed", value: breed || "" },
    { key: "birthday", value: birthday || "" },
    { key: "weight", value: weight ? weight.toString() : "" },
    { key: "notes", value: notes || "" },
    { key: "customer_id", value: `gid://shopify/Customer/${customer_id}` }
  ];

  if (image_file_gid) {
    fields.unshift({ key: "image", value: image_file_gid });
  }

  // GraphQL mutation
  const query = `
    mutation {
      metaobjectCreate(
        metaobject: {
          type: "pooch_profile",
          fields: ${JSON.stringify(fields).replace(/"([^"]+)":/g, '$1:')}
        }
      ) {
        metaobject {
          id
          type
          fields {
            key
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({ query })
      }
    );

    const result = await response.json();

    if (result.errors) {
      return res.status(500).json({ ok: false, error: result.errors });
    }

    if (result.data.metaobjectCreate.userErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: result.data.metaobjectCreate.userErrors
      });
    }

    res.status(200).json({
      ok: true,
      data: result.data.metaobjectCreate.metaobject
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
