export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Debug: headers এবং body দেখানো
  console.log("Request headers:", req.headers);
  console.log("Request body:", req.body);

  // চেক: req.body কি empty বা undefined?
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      ok: false,
      error: "Empty body received. Did you set Content-Type: application/json?"
    });
  }

  // সব ঠিক থাকলে response পাঠানো
  res.status(200).json({
    ok: true,
    message: "Data received successfully",
    data: req.body
  });
}
