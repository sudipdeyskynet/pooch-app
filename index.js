import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import cors from "cors"; // <-- import cors

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (or specify your Shopify domain)
app.use(cors({
  origin: "https://YOUR_SHOPIFY_DOMAIN.myshopify.com", // replace with your Shopify store
  methods: ["POST", "GET"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });

// Test route
app.get("/", (req, res) => res.send("Pooch Profile App Running"));

// Form submission
app.post("/submit", upload.single("image"), async (req, res) => {
  try {
    const { name, breed, birthday, weight, message, customer_id } = req.body;
    const imageFile = req.file;

    if (!imageFile) return res.status(400).json({ error: "Image is required" });

    const imageData = fs.readFileSync(imageFile.path, { encoding: "base64" });

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
          { key: "breed", value: breed },
          { key: "birthday", value: birthday },
          { key: "weight", value: weight },
          { key: "message", value: message },
          { key: "image", value: imageData },
          { key: "customer_id", value: customer_id }
        ]
      }
    };

    const response = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2025-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    const result = await response.json();

    fs.unlinkSync(imageFile.path);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
