import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { customer_id, name, breed, birthday, weight, message } = await req.json();
    if (!customer_id || !name) return res.status(400).json({ error: "Customer ID and name required" });

    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION;
    const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

    const url = `${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

    const query = `
      mutation metaobjectCreate($input: MetaobjectInput!) {
        metaobjectCreate(input: $input) {
          metaobject { id type }
          userErrors { field message }
        }
      }
    `;

    const variables = {
      input: {
        type: "pooch_profile",
        fields: [
          { key: "name", value: name },
          { key: "breed", value: breed || "" },
          { key: "birthday", value: birthday || "" },
          { key: "weight", value: weight ? weight.toString() : "" },
          { key: "message", value: message || "" }
        ],
        ownerId: `gid://shopify/Customer/${customer_id}`
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_TOKEN
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    if (result.errors) return res.status(500).json({ error: result.errors[0].message });
    if (result.data.metaobjectCreate.userErrors.length)
      return res.status(400).json({ error: result.data.metaobjectCreate.userErrors.map(e => e.message).join(", ") });

    res.status(200).json({ success: true, metaobject: result.data.metaobjectCreate.metaobject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
