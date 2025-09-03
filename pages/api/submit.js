import fetch from "node-fetch";

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { customer_id, name, breed, birthday, weight, message } = req.body;

    if (!customer_id || !name) {
      return res.status(400).json({ error: "customer_id and name are required" });
    }

    const mutation = `
      mutation metaobjectCreate($input: MetaobjectInput!) {
        metaobjectCreate(input: $input) {
          metaobject { id }
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
          { key: "weight", value: weight || "" },
          { key: "message", value: message || "" },
          { key: "customer_id", value: `gid://shopify/Customer/${customer_id}` }
        ]
      }
    };

    const response = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2025-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const result = await response.json();

    if (result.errors || (result.data.metaobjectCreate.userErrors.length > 0)) {
      return res.status(400).json({ error: "Failed to create profile", details: result });
    }

    return res.status(200).json({ success: true, metaobjectId: result.data.metaobjectCreate.metaobject.id });

  } catch (err) { 
    console.error(err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
