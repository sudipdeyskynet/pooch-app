import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { customer_id, name, breed, birthday, weight, notes } = req.body;

  if (!customer_id || !name) {
    return res.status(400).json({ ok: false, error: "Customer ID and name are required" });
  }

  const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // e.g., yourstore.myshopify.com
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // Admin API token with write_metaobjects

  const metaobjectData = {
    metaobject: {
      type: "pooch_profile",
      fields: [
        { key: "customer_id", value: customer_id },
        { key: "name", value: name },
        { key: "breed", value: breed || "" },
        { key: "birthday", value: birthday || "" },
        { key: "weight", value: weight ? parseFloat(weight) : null },
        { key: "notes", value: notes || "" }
      ]
    }
  };

  try {
    const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-10/metaobjects.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify(metaobjectData)
    });

    const result = await response.json();

    if (response.ok) {
      res.status(200).json({ ok: true, data: result });
    } else {
      res.status(400).json({ ok: false, error: result.errors || JSON.stringify(result) });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
