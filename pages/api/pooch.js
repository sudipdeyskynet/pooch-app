import fetch from "node-fetch";

export default async function handler(req, res) {
  // শুধুমাত্র POST method গ্রহণ
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Debug: incoming request check
  console.log("Request body:", req.body);

  // Body থেকে data extract করা
  const { customer_id, name, breed, birthday, weight, notes } = req.body || {};

  if (!customer_id || !name) {
    return res.status(400).json({ ok: false, error: "Customer ID and name are required" });
  }

  // Environment variables থেকে Shopify store info
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;           // উদাহরণ: yourstore.myshopify.com
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // Admin API token with write_metaobjects

  // Shopify metaobject data
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
    // Shopify API call
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
      // সফল হলে data return
      res.status(200).json({ ok: true, data: result });
    } else {
      // Shopify error
      res.status(400).json({ ok: false, error: result.errors || JSON.stringify(result) });
    }
  } catch (err) {
    // Network বা unexpected error
    res.status(500).json({ ok: false, error: err.message });
  }
}
